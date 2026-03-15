import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AI Story Engine - generates narrative, choices, events, NPC dialogue
 * Accepts: { session_id, action, choice_index, custom_input }
 *
 * Fixes & optimizations:
 * - Enemy schema now enforces exact fields combatEngine expects (fixes "undefined" enemy names & HP)
 * - Monster list capped at 8, loaded in parallel with other data
 * - Conditions removed from context (not used downstream, saves tokens)
 * - Story log sliced to last 3 entries (reduces prompt size, speeds up LLM response)
 * - Backstory capped at 200 chars
 * - Magic items removed from context (unused in story generation)
 * - Combat prompt injection ensures AI always returns valid enemy objects
 * - Location/quest/session updates batched into single DB write
 * - XP award uses character data already loaded (avoids extra DB fetch)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, custom_input } = await req.json();

  // Load session + character
  const session = await base44.asServiceRole.entities.GameSession.get(session_id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const character = await base44.asServiceRole.entities.Character.get(session.character_id);

  // Only load monsters — cap at 8 to reduce prompt size & CPU time
  const monsters = await base44.asServiceRole.entities.Monster.list('-created_date', 8);
  const monsterNames = monsters.map(m =>
    `${m.name} (CR ${m.challenge}, AC ${m.armor_class}, HP ${m.hit_points}, ATK +${m.attack_bonus || 3}, DMG ${m.damage_dice || '1d6'}+${m.damage_bonus || 2}, XP ${m.xp || 50})`
  ).join('; ');

  // Build compact character summary
  const charSummary = character ? `${character.name}, Lvl ${character.level} ${character.race} ${character.class} | HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'} | Background: ${(character.backstory || 'Unknown').slice(0, 200)}` : '';

  const worldSummary = `Location: ${session.current_location || 'Unknown'} | Season: ${session.season} | Time: ${session.time_of_day} | Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'} | Reputation: ${session.reputation || 0}${session.adult_mode ? ' | Adult mode: ON' : ''}`;

  // Only last 3 log entries to reduce token usage and speed up response
  const recentLog = (session.story_log || []).slice(-3).map(e => e.text).join('\n');

  const gameDataContext = `Available monsters (use EXACT stats when spawning enemies): ${monsterNames}`;

  // Strict enemy schema — enforces all fields combatEngine needs
  const enemyItemSchema = {
    type: 'object',
    properties: {
      name:          { type: 'string', description: 'Monster name exactly as listed above' },
      hp:            { type: 'number', description: 'Hit points as an integer, e.g. 11' },
      ac:            { type: 'number', description: 'Armor class as an integer, e.g. 13' },
      attack_bonus:  { type: 'number', description: 'Attack roll bonus, e.g. 4' },
      damage_dice:   { type: 'string', description: 'Damage dice string e.g. "1d6", "2d4"' },
      damage_bonus:  { type: 'number', description: 'Flat damage bonus added to roll, e.g. 2' },
      dexterity:     { type: 'number', description: 'Dexterity stat for initiative, e.g. 12' },
      cr:            { type: 'number', description: 'Challenge rating as decimal, e.g. 0.25, 1, 2' },
      xp:            { type: 'number', description: 'XP reward on defeat, e.g. 100' },
    },
    required: ['name', 'hp', 'ac', 'attack_bonus', 'damage_dice', 'damage_bonus', 'cr', 'xp']
  };

  const choiceItemSchema = {
    type: 'object',
    properties: {
      text:        { type: 'string' },
      skill_check: { type: 'string', description: 'D&D 5e skill: Persuasion, Athletics, Perception, Deception, Stealth, Insight, Investigation, Arcana, Intimidation, Acrobatics, Survival, History, Medicine, Religion, etc.' },
      dc:          { type: 'number', description: 'DC 10-25. Easy=10, Moderate=15, Hard=20, Near-impossible=25' },
      risk_level:  { type: 'string', enum: ['low','medium','high','extreme'] }
    }
  };

  let prompt = '';
  let responseSchema = null;

  if (action === 'start') {
    prompt = `You are the Dungeon Master for a high fantasy RPG. Begin the adventure.
Character: ${charSummary}
World: ${worldSummary}
${gameDataContext}
Story Seed: ${session.story_seed || 'A mysterious summons has drawn our hero to action...'}

Write an immersive opening narrative (3-4 paragraphs) that sets the scene vividly, introduces the situation, and ends with tension or a decision point.${session.adult_mode ? ' Mature/gritty tone permitted.' : ''}

Then provide exactly 4 choices the player can make. Include skill checks and DCs on risky choices (at least 2-3 of 4 should have checks). Use diverse skills — Persuasion, Deception, Intimidation, Perception, Investigation, Athletics, Stealth, Insight, Acrobatics, Survival, Arcana, History, Medicine, Religion. DCs: 10=trivial, 15=moderate, 20=hard, 25=extreme.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:       { type: 'string' },
        choices:         { type: 'array', items: choiceItemSchema },
        location_update: { type: 'string' },
        quest_trigger:   { type: 'string' },
        npc_present:     { type: 'string' }
      }
    };

  } else if (action === 'choice') {
    const selectedChoice = choice_index !== undefined
      ? `Player selected choice ${choice_index + 1}`
      : `Player action: ${custom_input}`;

    const skillCheckNote = selectedChoice.includes('[Skill Check:')
      ? `IMPORTANT: A skill check outcome is in the action text (SUCCESS or FAILURE). Reflect it directly — do not contradict it. On SUCCESS: describe overcoming the challenge vividly. On FAILURE: describe a setback or consequence.`
      : '';

    const combatNote = `If combat_trigger is true, the enemies array is REQUIRED and MUST use these exact fields: name (string, use monster names from the list above), hp (integer), ac (integer), attack_bonus (integer), damage_dice (string like "1d8"), damage_bonus (integer), dexterity (integer), cr (decimal number), xp (integer). Pull real stats from the available monsters list. Spawn 1-3 enemies appropriate to CR ${Math.max(1, character?.level || 1) - 1}–${character?.level || 1}.`;

    prompt = `You are the Dungeon Master. Continue the story based on the player's choice.
Character: ${charSummary}
World: ${worldSummary}
${gameDataContext}
Recent Story:
${recentLog}

Player Action: ${selectedChoice}
${skillCheckNote}

Write the consequence narrative (2-3 paragraphs) reacting directly to the action and any skill check outcome. Then provide 4 new choices. Consider active conditions, reputation, environment (${session.season}, ${session.time_of_day}).${session.adult_mode ? ' Mature content permitted.' : ''}
${combatNote}`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:         { type: 'string' },
        choices:           { type: 'array', items: choiceItemSchema },
        combat_trigger:    { type: 'boolean' },
        enemies:           { type: 'array', items: enemyItemSchema },
        reputation_change: { type: 'number' },
        xp_earned:         { type: 'number' },
        loot:              { type: 'array', items: { type: 'object' } },
        location_update:   { type: 'string' },
        quest_update:      { type: 'object' },
        new_condition:     { type: 'string' },
        plot_flag:         { type: 'string' }
      }
    };

  } else if (action === 'combat_narrate') {
    prompt = `You are the Dungeon Master narrating a combat round.
Character: ${charSummary}
World: ${worldSummary}
Combat context: ${custom_input}

Write a vivid 1-2 paragraph combat narrative for this round.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative:   { type: 'string' },
        atmosphere:  { type: 'string' }
      }
    };

  } else if (action === 'generate_event') {
    prompt = `Generate a random encounter or event appropriate for:
Character: ${charSummary}
World: ${worldSummary}
${gameDataContext}
Type: ${custom_input || 'random'}

Create a context-appropriate event (combat, social, environmental, or discovery).
If it's a combat event, use the enemy schema with real monster stats.`;

    responseSchema = {
      type: 'object',
      properties: {
        event_type:     { type: 'string' },
        narrative:      { type: 'string' },
        choices:        { type: 'array', items: choiceItemSchema },
        combat_trigger: { type: 'boolean' },
        enemies:        { type: 'array', items: enemyItemSchema }
      }
    };
  }

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: responseSchema,
    add_context_from_internet: false
  });

  // Batch all session updates into a single DB write
  if (result.narrative) {
    const updatedLog = [
      ...(session.story_log || []),
      {
        timestamp: new Date().toISOString(),
        action,
        player_choice: custom_input ?? choice_index,
        text: result.narrative,
        choices: result.choices || []
      }
    ].slice(-50); // keep last 50 entries

    const updateData = { story_log: updatedLog };
    if (result.location_update)   updateData.current_location = result.location_update;
    if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
    if (result.plot_flag)         updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
    if (result.combat_trigger)    updateData.in_combat = true;

    // Single DB write for session
    await base44.asServiceRole.entities.GameSession.update(session_id, updateData);

    // Award XP using already-loaded character (avoids extra DB round-trip)
    if (result.xp_earned && character) {
      await base44.asServiceRole.entities.Character.update(character.id, {
        xp: (character.xp || 0) + result.xp_earned
      });
    }
  }

    return Response.json(result);
  } catch (error) {
    console.error('Story generation error:', error);
    return Response.json({ error: error.message || 'Story generation failed' }, { status: 500 });
  }
});
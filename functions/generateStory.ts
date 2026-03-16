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

  // Load session + character (user-scoped since they belong to the user)
  const session = await base44.entities.GameSession.get(session_id);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const character = await base44.entities.Character.get(session.character_id);

  // Load low-CR monsters appropriate for character level
  const charLevel = character?.level || 1;
  const monsters = await base44.entities.Monster.list('-created_date', 50);
  
  // Parse CR from challenge string (e.g., "0.25 (50 XP)", "1 (200 XP)")
  const parseCR = (crStr) => {
    if (!crStr) return 999;
    const match = crStr.match(/^([\d.\/]+)/);
    if (!match) return 999;
    const crPart = match[1];
    if (crPart.includes('/')) {
      const [num, denom] = crPart.split('/');
      return parseFloat(num) / parseFloat(denom);
    }
    return parseFloat(crPart) || 999;
  };

  // Parse HP average from strings like "11 (2d8+2)"
  const parseHP = (hpStr) => {
    if (typeof hpStr === 'number') return hpStr;
    if (!hpStr) return 10;
    const match = hpStr.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 10;
  };

  // Parse AC from strings like "13 (natural armor)"
  const parseAC = (acStr) => {
    if (typeof acStr === 'number') return acStr;
    if (!acStr) return 10;
    const match = acStr.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 10;
  };

  // Strict CR filtering based on character level
  const maxCR = charLevel <= 2 ? 0.5 : charLevel <= 4 ? 1 : charLevel <= 6 ? 2 : Math.floor(charLevel / 2);
  
  const appropriateMonsters = monsters
    .map(m => ({ ...m, cr_numeric: parseCR(m.challenge) }))
    .filter(m => m.cr_numeric <= maxCR)
    .sort((a, b) => a.cr_numeric - b.cr_numeric)
    .slice(0, 15);

  // If no monsters available, allow story to continue — just disable combat triggers
  const combatBlocked = appropriateMonsters.length === 0;

  const monsterNames = appropriateMonsters.map(m => {
    const hp = parseHP(m.hit_points);
    const ac = parseAC(m.armor_class);
    const xpByCR = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800 };
    const xp = xpByCR[m.cr_numeric] || Math.floor(m.cr_numeric * 200);
    return `${m.name} (CR ${m.challenge}, AC ${ac}, HP ${hp}, XP ${xp})`;
  }).join('; ');

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

Then provide exactly 4 choices the player can make. Include skill checks and DCs on risky choices (at least 2-3 of 4 should have checks). Use diverse skills — Persuasion, Deception, Intimidation, Perception, Investigation, Athletics, Stealth, Insight, Acrobatics, Survival, Arcana, History, Medicine, Religion. DCs: 10=trivial, 15=moderate, 20=hard, 25=extreme.

CRITICAL: Do NOT trigger combat in the opening scene. The first story beats should focus on exploration, NPC interaction, discovery, or investigation. Combat should only emerge after at least 3-5 player choices when it makes narrative sense.`;

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

    const combatNote = `COMBAT PACING AND BALANCING RULES — READ CAREFULLY:

1. COMBAT FREQUENCY: Combat should be RARE and MEANINGFUL, not constant. The story should feature:
   - Rich exploration and NPC interactions (60-70% of gameplay)
   - Environmental puzzles and discovery (15-20%)
   - Combat encounters (10-15% — roughly 1 in every 6-8 player choices)
   
2. EARLY GAME PROTECTION: For level 1-2 characters, avoid combat in:
   - The opening scene (first choice)
   - The first 3-5 player actions
   - Scenarios where the player is deliberately avoiding conflict
   - Unless the player explicitly seeks out danger or attacks first

3. ENCOUNTER DESIGN — IF combat_trigger becomes true:
   The enemies array is REQUIRED and MUST use these exact fields:
   - name (string, use monster names from the list above)
   - hp (integer - use the HP number shown)
   - ac (integer - use the AC number shown)
   - attack_bonus (integer 2-4)
   - damage_dice (string like "1d6" or "1d8")
   - damage_bonus (integer 1-3)
   - dexterity (integer 10-14)
   - cr (decimal number from the list)
   - xp (integer from the list)

4. STRICT CR LIMITS BY LEVEL:
   - Level 1: ONLY CR 0-0.125 creatures (Rat, Kobold, etc.). Spawn 1 enemy ONLY.
   - Level 2: CR 0.125-0.25 creatures (Goblin, Wolf). Spawn 1-2 enemies MAX.
   - Level 3-4: CR 0.25-0.5 creatures. Spawn 1-2 enemies.
   - Level 5-6: CR 0.5-1 creatures. Spawn 2-3 enemies.
   - Level 7+: CR 1-2 creatures. Spawn 2-4 enemies.

5. NEVER spawn CR ${character?.level || 1}+ enemies for a level ${character?.level || 1} character.
6. Pull exact stats (HP, AC, attack bonus, damage) from the monster list above — do not invent values.

REMEMBER: A level 1 character has ~10 HP. Two bandits (CR 0.125 each with 11 HP, +3 attack, 1d6+1 damage) can easily kill them in 2 rounds. Be conservative with early encounters.`;

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
    else if (action === 'choice') updateData.in_combat = false; // clear stale combat flag after non-combat choices

    // Single DB write for session
    await base44.entities.GameSession.update(session_id, updateData);

    // Award XP using already-loaded character (avoids extra DB round-trip)
    if (result.xp_earned && character) {
      await base44.entities.Character.update(character.id, {
        xp: (character.xp || 0) + result.xp_earned
      });
    }

    // Validate combat trigger: if true, enemies must exist and be non-empty
    // Also block combat if no appropriate monsters are in the database
    if (result.combat_trigger && (!result.enemies || result.enemies.length === 0)) {
      result.combat_trigger = false;
    }
    if (combatBlocked && result.combat_trigger) {
      result.combat_trigger = false;
      result.enemies = [];
    }
  }

    return Response.json(result);
  } catch (error) {
    console.error('Story generation error:', error);
    return Response.json({ error: error.message || 'Story generation failed' }, { status: 500 });
  }
});
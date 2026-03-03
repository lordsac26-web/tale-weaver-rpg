import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AI Story Engine - generates narrative, choices, events, NPC dialogue
 * Accepts: { session_id, action, choice_index, custom_input }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { session_id, action, choice_index, custom_input } = await req.json();

  // Load session + character
  const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
  const session = sessions[0];
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  const chars = await base44.asServiceRole.entities.Character.filter({ id: session.character_id });
  const character = chars[0];

  // Load game data context for the AI
  const [monsters, conditions, magicItems] = await Promise.all([
    base44.asServiceRole.entities.Monster.list('-created_date', 30),
    base44.asServiceRole.entities.DnDCondition.list(),
    base44.asServiceRole.entities.MagicItem.list('-created_date', 20)
  ]);

  const monsterNames = monsters.map(m => `${m.name} (CR ${m.challenge}, AC ${m.armor_class}, HP ${m.hit_points})`).join('; ');
  const conditionNames = conditions.map(c => `${c.name}: ${(c.description || []).slice(0, 1).join(' ')}`).join('; ');

  // Build context summary
  const charSummary = character ? `
Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}
HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class}
Active Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'}
Background: ${character.backstory || 'Unknown'}
Alignment: ${character.alignment || 'Neutral'}
  ` : '';

  const worldSummary = `
Location: ${session.current_location || 'Unknown'}
Season: ${session.season} | Time: ${session.time_of_day}
Active Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'}
Reputation: ${session.reputation || 0}
Adult Mode: ${session.adult_mode ? 'Yes (mature content enabled)' : 'No'}
Story Seed: ${session.story_seed || 'Standard high fantasy adventure'}
  `;

  const recentLog = (session.story_log || []).slice(-5).map(e => e.text).join('\n');

  let prompt = '';
  let responseSchema = null;

  const gameDataContext = `
Available Monsters (use real names/stats when spawning enemies): ${monsterNames}
D&D 5E Conditions (apply accurately): ${conditionNames}
`;

  if (action === 'start') {
    prompt = `You are the Dungeon Master for a high fantasy RPG. Begin the adventure.
${charSummary}
${worldSummary}
${gameDataContext}
Story Seed: ${session.story_seed || 'A mysterious summons has drawn our hero to action...'}

Write an immersive opening narrative (3-4 paragraphs) that:
- Sets the scene vividly (environment, atmosphere, sensory details)
- Introduces the immediate situation the character finds themselves in
- Ends with a moment of tension or decision
${session.adult_mode ? '- Mature/gritty tone is permitted' : '- Keep content appropriate for general audiences'}

Then provide exactly 4 choices the player can make.
For EACH choice that involves risk or effort, include a relevant skill check and DC. Use diverse skills — not just combat ones. For example:
- Dialogue with NPCs: Persuasion DC 12-16, Deception DC 12-18, Intimidation DC 10-16, Insight DC 13
- Physical obstacles: Athletics DC 12-18, Acrobatics DC 10-15
- Exploration/secrets: Perception DC 12-15, Investigation DC 13-16, Stealth DC 12-14, Survival DC 11
- Knowledge/magic: Arcana DC 13-17, History DC 12, Religion DC 13, Medicine DC 12
DCs should reflect actual difficulty (10=trivial, 15=moderate, 20=hard, 25=extreme). At least 2-3 of the 4 choices should have skill checks.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative: { type: 'string' },
        choices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              skill_check: { type: 'string' },
              dc: { type: 'number' },
              risk_level: { type: 'string' }
            }
          }
        },
        location_update: { type: 'string' },
        quest_trigger: { type: 'string' },
        npc_present: { type: 'string' }
      }
    };
  } else if (action === 'choice') {
    const storyLog = recentLog;
    const selectedChoice = choice_index !== undefined
      ? `Player selected choice ${choice_index + 1}`
      : `Player action: ${custom_input}`;

    const skillCheckNote = selectedChoice.includes('[Skill Check:')
      ? `IMPORTANT: The player attempted a skill check. The outcome is embedded in their action text (SUCCESS or FAILURE). Reflect this outcome DIRECTLY in your narrative — do not contradict it. On SUCCESS: describe how the character overcomes the challenge with vivid detail. On FAILURE: describe a setback, complication, or consequence. Keep it immersive and reactive.`
      : '';

    prompt = `You are the Dungeon Master. Continue the story based on the player's choice.
${charSummary}
${worldSummary}
${gameDataContext}
Recent Story:
${storyLog}

Player Action: ${selectedChoice}
${skillCheckNote}

Write the consequence narrative (2-3 paragraphs) that directly reacts to the player's action and any skill check outcome. Then provide 4 new choices.
Consider:
- Character's active conditions and how they affect outcomes
- Reputation/alignment impact if morally significant
- Environmental conditions (${session.season}, ${session.time_of_day})
- Make skill check consequences feel meaningful and permanent
${session.adult_mode ? '- Mature content permitted' : ''}
- If combat should trigger, flag it`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative: { type: 'string' },
        choices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              skill_check: { type: 'string', description: 'D&D 5e skill name e.g. Persuasion, Athletics, Perception, Deception, Stealth, Insight, Investigation, Arcana, etc.' },
              dc: { type: 'number', description: 'Difficulty Class 10-25' },
              risk_level: { type: 'string', enum: ['low','medium','high','extreme'] }
            }
          }
        },
        combat_trigger: { type: 'boolean' },
        enemies: { type: 'array', items: { type: 'object' } },
        reputation_change: { type: 'number' },
        xp_earned: { type: 'number' },
        loot: { type: 'array', items: { type: 'object' } },
        location_update: { type: 'string' },
        quest_update: { type: 'object' },
        new_condition: { type: 'string' },
        plot_flag: { type: 'string' }
      }
    };
  } else if (action === 'combat_narrate') {
    prompt = `You are the Dungeon Master narrating a combat round.
${charSummary}
${worldSummary}
Combat context: ${custom_input}

Write a vivid 1-2 paragraph combat narrative for this round, describing the action cinematically.`;

    responseSchema = {
      type: 'object',
      properties: {
        narrative: { type: 'string' },
        atmosphere: { type: 'string' }
      }
    };
  } else if (action === 'generate_event') {
    prompt = `Generate a random encounter/event appropriate for:
${charSummary}
${worldSummary}
Type: ${custom_input || 'random'}

Create a context-appropriate event. Could be combat, social, environmental, or discovery.`;

    responseSchema = {
      type: 'object',
      properties: {
        event_type: { type: 'string' },
        narrative: { type: 'string' },
        choices: { type: 'array', items: { type: 'object' } },
        combat_trigger: { type: 'boolean' },
        enemies: { type: 'array', items: { type: 'object' } }
      }
    };
  }

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: responseSchema,
    add_context_from_internet: false
  });

  // Update session story log
  if (result.narrative) {
    const updatedLog = [...(session.story_log || []), {
      timestamp: new Date().toISOString(),
      action: action,
      player_choice: custom_input || choice_index,
      text: result.narrative,
      choices: result.choices || []
    }].slice(-50); // keep last 50 entries

    const updateData = { story_log: updatedLog };
    if (result.location_update) updateData.current_location = result.location_update;
    if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
    if (result.plot_flag) updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
    if (result.combat_trigger) updateData.in_combat = true;

    await base44.asServiceRole.entities.GameSession.update(session_id, updateData);

    // Award XP
    if (result.xp_earned && character) {
      await base44.asServiceRole.entities.Character.update(character.id, {
        xp: (character.xp || 0) + result.xp_earned
      });
    }
  }

  return Response.json(result);
});
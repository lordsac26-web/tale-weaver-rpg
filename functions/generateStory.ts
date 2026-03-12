import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AI Story Engine - generates narrative, choices, events, NPC dialogue
 * Accepts: { session_id, action, choice_index, custom_input }
 *
 * CPU OPTIMIZATIONS:
 * 1. Game data (monsters, conditions, magic items) only loaded for 'start' action
 *    For 'choice' actions, we skip the heavy DB reads — the AI doesn't need full
 *    monster lists to continue a story, only to begin one.
 * 2. Story log slice reduced from last 5 to last 3 entries to shrink prompt size
 * 3. Magic items removed from context entirely — rarely useful in prompt, high cost
 * 4. Monster list capped at 15 instead of 30
 * 5. Condition descriptions truncated more aggressively
 * 6. Wrapped in try/catch for proper error responses instead of silent 502s
 */ 

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, custom_input } = await req.json();

    // Load session + character (always needed)
    const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const chars = await base44.asServiceRole.entities.Character.filter({ id: session.character_id });
    const character = chars[0];
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    // OPTIMIZATION: Only load game reference data for 'start' action
    // 'choice' and other actions don't need the full monster/condition lists
    let gameDataContext = '';
    if (action === 'start') {
      const [monsters, conditions] = await Promise.all([
        base44.asServiceRole.entities.Monster.list('-created_date', 15), // reduced from 30
        base44.asServiceRole.entities.DnDCondition.list(),
        // Removed magic items — not useful enough in prompt to justify the load
      ]);

      const monsterNames = monsters
        .map(m => `${m.name} (CR ${m.challenge}, AC ${m.armor_class}, HP ${m.hit_points})`)
        .join('; ');
      const conditionNames = conditions
        .map(c => `${c.name}: ${(c.description || []).slice(0, 1).join(' ').slice(0, 60)}`)
        .join('; ');

      gameDataContext = `
Available Monsters (use real names/stats when spawning enemies): ${monsterNames}
D&D 5E Conditions (apply accurately): ${conditionNames}
`;
    }

    // Alignment axis helper
    const getAlignmentLabel = (lc, ge) => {
      const lawChaos = lc >= 4 ? 'Lawful' : lc <= -4 ? 'Chaotic' : 'Neutral';
      const goodEvil = ge >= 4 ? 'Good' : ge <= -4 ? 'Evil' : 'Neutral';
      if (lawChaos === 'Neutral' && goodEvil === 'Neutral') return 'True Neutral';
      return `${lawChaos} ${goodEvil}`;
    };
    const lcScore = character?.alignment_law_chaos || 0;
    const geScore = character?.alignment_good_evil || 0;
    const currentAlignment = getAlignmentLabel(lcScore, geScore);

    // Build context summary
    const charSummary = `
Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}
HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class}
Active Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'}
Background: ${character.backstory || 'Unknown'}
Alignment: ${currentAlignment} (Law/Chaos score: ${lcScore}, Good/Evil score: ${geScore})
`;

    const worldSummary = `
Location: ${session.current_location || 'Unknown'}
Season: ${session.season} | Time: ${session.time_of_day}
Active Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'}
Reputation: ${session.reputation || 0}
Adult Mode: ${session.adult_mode ? 'Yes (mature content enabled)' : 'No'}
Story Seed: ${session.story_seed || 'Standard high fantasy adventure'}
`;

    // OPTIMIZATION: reduced from last 5 to last 3 entries to shrink prompt size
    const recentLog = (session.story_log || []).slice(-3).map(e => e.text).join('\n');

    let prompt = '';
    let responseSchema = null;

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

Then provide exactly 4 choices the player can make in the "choices" JSON array.
CRITICAL: Choices MUST go in the "choices" array — NEVER embed them as numbered lists inside the "narrative" string.
For EACH choice that involves risk or effort, include a relevant skill check and DC. Use diverse skills — not just combat ones. For example:
- Dialogue with NPCs: Persuasion DC 12-16, Deception DC 12-18, Intimidation DC 10-16, Insight DC 13
- Physical obstacles: Athletics DC 12-18, Acrobatics DC 10-15
- Exploration/secrets: Perception DC 12-15, Investigation DC 13-16, Stealth DC 12-14, Survival DC 11
- Knowledge/magic: Arcana DC 13-17, History DC 12, Religion DC 13, Medicine DC 12
DCs should reflect actual difficulty (10=trivial, 15=moderate, 20=hard, 25=extreme). At least 2-3 of the 4 choices should have skill checks.

Begin your narrative with this exact header format:
**HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Level: ${character.level} | Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore}) | ${session.current_location || 'Unknown'} | ${session.time_of_day || 'Morning'}**

Then continue with your scene description and story.`;

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
                risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'extreme'] }
              }
            }
          },
          location_update: { type: 'string' },
          quest_trigger: { type: 'string' },
          npc_present: { type: 'string' }
        }
      };

    } else if (action === 'choice') {
      const selectedChoice = choice_index !== undefined
        ? `Player selected choice ${choice_index + 1}`
        : `Player action: ${custom_input}`;

      const skillCheckNote = selectedChoice.includes('[Skill Check:')
        ? `IMPORTANT: The player attempted a skill check. The outcome is embedded in their action text (SUCCESS or FAILURE). Reflect this outcome DIRECTLY in your narrative — do not contradict it. On SUCCESS: describe how the character overcomes the challenge. On FAILURE: describe a setback or consequence.`
        : '';

      prompt = `You are the Dungeon Master for a dark-fantasy RPG. Continue the story based on the player's choice.
${charSummary}
${worldSummary}
Recent Story:
${recentLog}

Player Action: ${selectedChoice}
${skillCheckNote}

=== ALIGNMENT TRACKING ===
Law/Chaos axis = ${lcScore} (positive = Lawful, negative = Chaotic)
Good/Evil axis = ${geScore} (positive = Good, negative = Evil)
Current alignment: ${currentAlignment}

After morally significant decisions return alignment_shift values:
- law_chaos_shift: -5 to +5 (positive = more Lawful)
- good_evil_shift: -5 to +5 (positive = more Good)
- Set both to 0 if morally neutral
=== END ALIGNMENT ===

Begin your response with:
**HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Level: ${character.level} | Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore}) | ${session.current_location || 'Unknown'} | ${session.time_of_day || 'Morning'}**

Write the consequence narrative (2-3 paragraphs) reacting to the player's action. Then provide 4 new choices in the "choices" JSON array.
CRITICAL: The "narrative" field must contain ONLY story text — NEVER numbered choice lists. Choices go exclusively in the "choices" array.
${session.adult_mode ? '- Mature/gritty content permitted' : ''}
- If combat should trigger, flag it
- Never decide the player's emotions or words — only describe the world and consequences`;

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
                risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'extreme'] }
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
          plot_flag: { type: 'string' },
          alignment_shift: {
            type: 'object',
            properties: {
              law_chaos_shift: { type: 'number' },
              good_evil_shift: { type: 'number' }
            }
          }
        }
      };

    } else if (action === 'combat_narrate') {
      prompt = `You are the Dungeon Master narrating a combat round.
${charSummary}
${worldSummary}
Combat context: ${custom_input}

Write a vivid 1-2 paragraph combat narrative for this round.`;

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

    // ── Post-process: extract choices embedded in narrative text ──
    if (result.narrative && (!result.choices || result.choices.length === 0)) {
      const lines = result.narrative.split('\n');
      const choiceLines = [];
      let firstChoiceIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\d+\.\s+/.test(lines[i])) {
          if (firstChoiceIdx === -1) firstChoiceIdx = i;
          choiceLines.push({ startIdx: i, lines: [lines[i]] });
        } else if (choiceLines.length > 0 && firstChoiceIdx !== -1 && lines[i].trim() !== '' && !/^\s*\d+\.\s+/.test(lines[i])) {
          choiceLines[choiceLines.length - 1].lines.push(lines[i]);
        }
      }

      if (choiceLines.length >= 2) {
        const extracted = [];
        for (const block of choiceLines) {
          const fullText = block.lines.join(' ').trim();
          const textOnly = fullText.replace(/^\s*\d+\.\s+/, '').replace(/\*\*/g, '').trim();
          const skillMatch = fullText.match(/Skill\s+Check:\s*(\w[\w\s]*?)\s*\(?\s*DC\s*(\d+)/i);
          const riskMatch = fullText.match(/Risk\s+Level:\s*(Low|Medium|High|Extreme)/i);
          extracted.push({
            text: textOnly.replace(/\s*[-–—]\s*\*?Skill Check:.*$/i, '').replace(/\s*[-–—]\s*\*?Risk Level:.*$/i, '').replace(/\*+/g, '').trim(),
            skill_check: skillMatch ? skillMatch[1].trim() : undefined,
            dc: skillMatch ? parseInt(skillMatch[2]) : undefined,
            risk_level: riskMatch ? riskMatch[1].toLowerCase() : 'low',
          });
        }
        result.choices = extracted;
        result.narrative = lines.slice(0, firstChoiceIdx).join('\n').trim();
      }
    }

    // Strip any trailing choice-like text from narrative
    if (result.narrative && result.choices && result.choices.length > 0) {
      result.narrative = result.narrative
        .replace(/(\n\s*\d+\.\s+\*{0,2}.+){2,}$/gs, '')
        .replace(/\n[^\n]*choices?\s+(?:loomed|are|were|remain|await)[^\n]*$/i, '')
        .trim();
    }

    // Update session story log
    if (result.narrative) {
      const updatedLog = [...(session.story_log || []), {
        timestamp: new Date().toISOString(),
        action,
        player_choice: custom_input || choice_index,
        text: result.narrative,
        choices: result.choices || []
      }].slice(-50);

      const updateData = { story_log: updatedLog };
      if (result.location_update) updateData.current_location = result.location_update;
      if (result.reputation_change) updateData.reputation = (session.reputation || 0) + result.reputation_change;
      if (result.plot_flag) updateData.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
      if (result.combat_trigger) updateData.in_combat = true;

      await base44.asServiceRole.entities.GameSession.update(session_id, updateData);

      // Award XP and apply alignment shifts
      const charUpdates = {};
      if (result.xp_earned) charUpdates.xp = (character.xp || 0) + result.xp_earned;

      if (result.alignment_shift) {
        const lcShift = result.alignment_shift.law_chaos_shift || 0;
        const geShift = result.alignment_shift.good_evil_shift || 0;
        if (lcShift !== 0 || geShift !== 0) {
          const newLC = Math.max(-10, Math.min(10, (character.alignment_law_chaos || 0) + lcShift));
          const newGE = Math.max(-10, Math.min(10, (character.alignment_good_evil || 0) + geShift));
          charUpdates.alignment_law_chaos = newLC;
          charUpdates.alignment_good_evil = newGE;
          charUpdates.alignment = getAlignmentLabel(newLC, newGE);
        }
      }

      if (Object.keys(charUpdates).length > 0) {
        await base44.asServiceRole.entities.Character.update(character.id, charUpdates);
      }
    }

    return Response.json(result);

  } catch (error) {
    console.error('generateStory error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
});
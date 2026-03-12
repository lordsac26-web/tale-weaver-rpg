import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, action, choice_index, custom_input } = await req.json();

    const sessions = await base44.asServiceRole.entities.GameSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const chars = await base44.asServiceRole.entities.Character.filter({ id: session.character_id });
    const character = chars[0];
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    // Only load monsters for 'start' — skip for all other actions
    let gameDataContext = '';
    if (action === 'start') {
      const monsters = await base44.asServiceRole.entities.Monster.list('-created_date', 5);
      const monsterNames = monsters
        .map(m => `${m.name} (CR ${m.challenge}, AC ${m.armor_class})`)
        .join('; ');
      gameDataContext = monsterNames ? `Available Monsters: ${monsterNames}` : '';
    }

    const getAlignmentLabel = (lc, ge) => {
      const lawChaos = lc >= 4 ? 'Lawful' : lc <= -4 ? 'Chaotic' : 'Neutral';
      const goodEvil = ge >= 4 ? 'Good' : ge <= -4 ? 'Evil' : 'Neutral';
      if (lawChaos === 'Neutral' && goodEvil === 'Neutral') return 'True Neutral';
      return `${lawChaos} ${goodEvil}`;
    };
    const lcScore = character?.alignment_law_chaos || 0;
    const geScore = character?.alignment_good_evil || 0;
    const currentAlignment = getAlignmentLabel(lcScore, geScore);

    const charSummary = `Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}
HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class}
Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'}
Background: ${(character.backstory || 'Unknown').slice(0, 200)}
Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore})`;

    const worldSummary = `Location: ${session.current_location || 'Unknown'} | Season: ${session.season} | Time: ${session.time_of_day}
Quests: ${(session.active_quests || []).map(q => q.title).join(', ') || 'None'}
Reputation: ${session.reputation || 0} | Adult Mode: ${session.adult_mode ? 'Yes' : 'No'}
Story Seed: ${session.story_seed || 'Standard high fantasy adventure'}`;

    const statusHeader = `**HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class} | Level: ${character.level} | Alignment: ${currentAlignment} | ${session.current_location || 'Unknown'} | ${session.time_of_day || 'Morning'}**`;

    const recentLog = (session.story_log || []).slice(-3).map(e => e.text).join('\n');

    let prompt = '';
    let responseSchema = null;

    if (action === 'start') {
      prompt = `You are a Dungeon Master. Begin this adventure.
${charSummary}
${worldSummary}
${gameDataContext}

Write an immersive opening (3-4 paragraphs): set the scene vividly, introduce the situation, end with tension.
${session.adult_mode ? 'Mature/gritty tone permitted.' : 'Keep content appropriate for general audiences.'}

Provide exactly 4 choices in the "choices" JSON array. NEVER embed choices in the narrative.
Include skill checks (DC 10-25) on 2-3 choices. Use diverse skills (Persuasion, Stealth, Arcana, Athletics, etc.).

Begin with:
${statusHeader}`;

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
        ? `The player attempted a skill check — outcome is in their action text (SUCCESS or FAILURE). Reflect this directly in your narrative.`
        : '';

      prompt = `You are a Dungeon Master. Continue the story.
${charSummary}
${worldSummary}
Recent Story: ${recentLog}

Player Action: ${selectedChoice}
${skillCheckNote}

Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore})
Return alignment_shift (law_chaos_shift, good_evil_shift, range -5 to +5, 0 if neutral).

Begin with:
${statusHeader}

Write 2-3 paragraphs reacting to the action. Then provide 4 new choices in the "choices" array.
NEVER put choices inside the narrative text.
${session.adult_mode ? 'Mature content permitted.' : ''}
Flag combat if it should trigger. Never decide the player's emotions or words.`;

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
      prompt = `You are a Dungeon Master narrating a combat round.
${charSummary}
Combat context: ${custom_input}
Write a vivid 1-2 paragraph combat narrative.`;

      responseSchema = {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          atmosphere: { type: 'string' }
        }
      };

    } else if (action === 'generate_event') {
      prompt = `Generate a random encounter for:
${charSummary}
${worldSummary}
Type: ${custom_input || 'random'}`;

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

    // Extract choices embedded in narrative if AI ignored the schema
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

    // Strip any trailing numbered list from narrative
    if (result.narrative && result.choices && result.choices.length > 0) {
      result.narrative = result.narrative
        .replace(/(\n\s*\d+\.\s+\*{0,2}.+){2,}$/gs, '')
        .replace(/\n[^\n]*choices?\s+(?:loomed|are|were|remain|await)[^\n]*$/i, '')
        .trim();
    }

    // Persist to DB
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
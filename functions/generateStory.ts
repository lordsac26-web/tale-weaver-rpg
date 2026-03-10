import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
  const charSummary = character ? `
Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}
HP: ${character.hp_current}/${character.hp_max} | AC: ${character.armor_class}
Active Conditions: ${(character.conditions || []).map(c => c.name || c).join(', ') || 'None'}
Background: ${character.backstory || 'Unknown'}
Alignment: ${currentAlignment} (Law/Chaos score: ${lcScore}, Good/Evil score: ${geScore})
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

Then provide exactly 4 choices the player can make in the "choices" JSON array.
CRITICAL: Choices MUST go in the "choices" array of the JSON response — NEVER embed them as numbered lists inside the "narrative" string. The narrative should end before any choices.
For EACH choice that involves risk or effort, include a relevant skill check and DC. Use diverse skills — not just combat ones. For example:
- Dialogue with NPCs: Persuasion DC 12-16, Deception DC 12-18, Intimidation DC 10-16, Insight DC 13
- Physical obstacles: Athletics DC 12-18, Acrobatics DC 10-15
- Exploration/secrets: Perception DC 12-15, Investigation DC 13-16, Stealth DC 12-14, Survival DC 11
- Knowledge/magic: Arcana DC 13-17, History DC 12, Religion DC 13, Medicine DC 12
DCs should reflect actual difficulty (10=trivial, 15=moderate, 20=hard, 25=extreme). At least 2-3 of the 4 choices should have skill checks.

Begin your narrative with this exact header format (using actual character data):
**HP: ${character?.hp_current || '?'}/${character?.hp_max || '?'} | AC: ${character?.armor_class || '?'} | Level: ${character?.level || '?'} | Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore}) | ${session.current_location || 'Unknown'} | ${session.time_of_day || 'Morning'}**

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
              skill_check: { type: 'string', description: 'D&D 5e skill name e.g. Persuasion, Athletics, Perception, Deception, Stealth, Insight, Investigation, Arcana, etc.' },
              dc: { type: 'number', description: 'Difficulty Class 10-25' },
              risk_level: { type: 'string', enum: ['low','medium','high','extreme'] }
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

    prompt = `You are the Dungeon Master for a dark-fantasy, narrative-heavy RPG. Continue the story based on the player's choice.
${charSummary}
${worldSummary}
${gameDataContext}
Recent Story:
${storyLog}

Player Action: ${selectedChoice}
${skillCheckNote}

=== ALIGNMENT TRACKING (CRITICAL — enforce consistently) ===
The player's current alignment scores are: Law/Chaos axis = ${lcScore} (positive = Lawful, negative = Chaotic), Good/Evil axis = ${geScore} (positive = Good, negative = Evil).
Current alignment label: ${currentAlignment}.

After EVERY morally or philosophically significant decision, you MUST return alignment_shift values:
- law_chaos_shift: integer from -5 to +5. Positive = more Lawful, negative = more Chaotic.
- good_evil_shift: integer from -5 to +5. Positive = more Good, negative = more Evil.
- Set both to 0 if the action is morally neutral.

Examples of shifts:
• Torturing a prisoner → good_evil_shift: -5
• Keeping a sworn oath despite cost → law_chaos_shift: +4
• Freeing slaves by force → law_chaos_shift: -3, good_evil_shift: +4
• Ignoring suffering → good_evil_shift: -3
• Risking life to save innocents → good_evil_shift: +5

If the new score crosses a threshold (|score| crosses from <8 to >=8 on either axis), include a dramatic alignment shift narration in your narrative, like:
"A cold certainty settles in your soul..." or "You feel the stain of what you've done..."

Alignment has soft narrative effects: certain NPCs, factions, gods, and magic items react to alignment. Clerics/paladins may suffer divine consequences for major drift.

=== END ALIGNMENT ===

Begin your narrative response with this header:
**HP: ${character?.hp_current || '?'}/${character?.hp_max || '?'} | AC: ${character?.armor_class || '?'} | Level: ${character?.level || '?'} | Alignment: ${currentAlignment} (L/C: ${lcScore}, G/E: ${geScore}) | ${session.current_location || 'Unknown'} | ${session.time_of_day || 'Morning'}**

Write the consequence narrative (2-3 paragraphs) that directly reacts to the player's action and any skill check outcome. Then provide 4 new choices in the "choices" JSON array.
CRITICAL: The "narrative" field must contain ONLY the story text — NEVER include numbered choice lists or option menus in the narrative. Choices MUST go exclusively in the "choices" array.
Consider:
- Character's active conditions and how they affect outcomes
- Alignment impact if morally significant (return shift values!)
- Environmental conditions (${session.season}, ${session.time_of_day})
- Make skill check consequences feel meaningful and permanent
${session.adult_mode ? '- Mature/gritty content permitted' : ''}
- If combat should trigger, flag it
- Never decide the player's emotions, thoughts or words — only describe the world and consequences`;

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
        plot_flag: { type: 'string' },
        alignment_shift: {
          type: 'object',
          description: 'Alignment axis shifts from this action. law_chaos_shift: -5 to +5 (positive=Lawful). good_evil_shift: -5 to +5 (positive=Good). Set to 0 if morally neutral.',
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

  // ── Post-process: extract choices embedded in narrative text ──
  // The LLM sometimes embeds numbered choices as markdown inside the narrative string
  // instead of populating the choices array. Detect and extract them.
  if (result.narrative && (!result.choices || result.choices.length === 0)) {
    const lines = result.narrative.split('\n');
    const choiceLines = [];
    let firstChoiceIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      // Match patterns like "1. **Lead the way...**" or "1. Lead the way..."
      if (/^\s*\d+\.\s+/.test(lines[i])) {
        if (firstChoiceIdx === -1) firstChoiceIdx = i;
        choiceLines.push({ startIdx: i, lines: [lines[i]] });
      } else if (choiceLines.length > 0 && firstChoiceIdx !== -1 && lines[i].trim() !== '' && !/^\s*\d+\.\s+/.test(lines[i])) {
        // Continuation line (e.g. "   - *Skill Check: Stealth (DC 13)*")
        choiceLines[choiceLines.length - 1].lines.push(lines[i]);
      }
    }

    if (choiceLines.length >= 2) {
      const extracted = [];
      for (const block of choiceLines) {
        const fullText = block.lines.join(' ').trim();
        // Strip the leading number+dot: "1. **Lead the way...**" → "**Lead the way...**"
        const textOnly = fullText.replace(/^\s*\d+\.\s+/, '').replace(/\*\*/g, '').trim();

        // Try to extract skill check and DC from embedded text
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
      // Strip the choice block from the narrative
      result.narrative = lines.slice(0, firstChoiceIdx).join('\n').trim();
    }
  }

  // Also strip any trailing choice-like text that may remain in narrative
  if (result.narrative && result.choices && result.choices.length > 0) {
    result.narrative = result.narrative
      .replace(/(\n\s*\d+\.\s+\*{0,2}.+){2,}$/gs, '')
      .replace(/\n\s*(Desiree's|Your|The player's|The hero's)\s+choices?\s+(loomed|are|were|remain):?\s*$/i, '')
      .trim();
  }

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

    // Award XP and apply alignment shifts
    if (character) {
      const charUpdates = {};
      if (result.xp_earned) charUpdates.xp = (character.xp || 0) + result.xp_earned;

      // Apply alignment shifts
      if (result.alignment_shift) {
        const lcShift = result.alignment_shift.law_chaos_shift || 0;
        const geShift = result.alignment_shift.good_evil_shift || 0;
        if (lcShift !== 0 || geShift !== 0) {
          const oldLC = character.alignment_law_chaos || 0;
          const oldGE = character.alignment_good_evil || 0;
          const newLC = Math.max(-10, Math.min(10, oldLC + lcShift));
          const newGE = Math.max(-10, Math.min(10, oldGE + geShift));
          charUpdates.alignment_law_chaos = newLC;
          charUpdates.alignment_good_evil = newGE;

          // Compute new label and update alignment string
          const getLbl = (lc, ge) => {
            const a = lc >= 4 ? 'Lawful' : lc <= -4 ? 'Chaotic' : 'Neutral';
            const b = ge >= 4 ? 'Good' : ge <= -4 ? 'Evil' : 'Neutral';
            if (a === 'Neutral' && b === 'Neutral') return 'True Neutral';
            return `${a} ${b}`;
          };
          charUpdates.alignment = getLbl(newLC, newGE);
        }
      }

      if (Object.keys(charUpdates).length > 0) {
        await base44.asServiceRole.entities.Character.update(character.id, charUpdates);
      }
    }
  }

  return Response.json(result);
});
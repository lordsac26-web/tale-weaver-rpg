import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, character, session_context, in_combat, combat_context } = await req.json();

    // ============ COMBAT MODE ============
    // During combat the DM must decide whether a free-text action is a skill check,
    // continues/escalates the fight, or de-escalates it (talk / surrender / parley).
    if (in_combat) {
      const prompt = `You are a thoughtful Dungeon Master adjudicating a player's free-form action DURING an active combat encounter in D&D 5e. Stop and reason carefully using the scene context before deciding.

Character: ${character?.name}, ${character?.race} ${character?.class} Level ${character?.level}
Stats: STR ${character?.strength}, DEX ${character?.dexterity}, CON ${character?.constitution}, INT ${character?.intelligence}, WIS ${character?.wisdom}, CHA ${character?.charisma}
Skills trained: ${Object.entries(character?.skills || {}).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'none'}

CURRENT COMBAT SCENE:
${combat_context || 'A battle is underway.'}

Recent scene narration: ${session_context || 'Unknown'}

The player wants to: "${action}"

Think step by step about the player's intent, the enemies' likely disposition, and the tactical situation. Then decide ONE outcome_type:
- "skill_check": the action is uncertain and needs a roll (e.g. shove a brazier, swing on a chandelier, intimidate a wounded foe, feint, disarm). Pick the most fitting skill and a fair DC (5-25).
- "continue_combat": a straightforward aggressive/tactical move that doesn't need a special roll and keeps the fight going (the player should just use a normal Attack/Spell action instead). Briefly tell them to use their combat actions.
- "de_escalate": the action is an attempt to talk, surrender, parley, or stand down AND the situation plausibly allows enemies to consider stopping. This usually still needs a Persuasion/Intimidation/Deception check unless the enemies are clearly willing. If a roll is needed set requires_check true with the social skill + DC; success would END or pause combat.
- "narrative": a non-mechanical descriptive action (looking around, shouting a warning, dropping an item) that simply happens and the DM narrates.

Rules of thumb:
- Be fair and reward creativity with reasonable DCs.
- Mindless enemies (undead, beasts, constructs) rarely de-escalate; intelligent or losing foes might.
- Never auto-end combat without justification; prefer a check for de-escalation.

Return ONLY a JSON object:
- outcome_type: "skill_check" | "continue_combat" | "de_escalate" | "narrative"
- requires_check: boolean
- skill: one of (Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival) or null
- dc: integer 5-25 or null
- risk_level: "low" | "medium" | "high" | "extreme"
- reasoning: 1-3 sentences of in-character DM thinking that shows the thought process behind the ruling
- ends_combat_on_success: boolean (true only for de_escalate actions where a successful check would stop the fight)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            outcome_type: { type: 'string' },
            requires_check: { type: 'boolean' },
            skill: { type: 'string' },
            dc: { type: 'number' },
            risk_level: { type: 'string' },
            reasoning: { type: 'string' },
            ends_combat_on_success: { type: 'boolean' },
          },
          required: ['outcome_type', 'requires_check', 'reasoning', 'risk_level'],
        },
      });

      return Response.json({ ...result, action, in_combat: true });
    }

    // ============ EXPLORATION MODE (unchanged) ============
    const prompt = `You are a Dungeon Master evaluating a player's proposed action in a D&D 5e game.
    
Character: ${character?.name}, ${character?.race} ${character?.class} Level ${character?.level}
Background: ${character?.background || 'Unknown'}
Stats: STR ${character?.strength}, DEX ${character?.dexterity}, CON ${character?.constitution}, INT ${character?.intelligence}, WIS ${character?.wisdom}, CHA ${character?.charisma}
Skills trained: ${Object.entries(character?.skills || {}).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'none'}
Current scene: ${session_context || 'Unknown'}
Proposed action: "${action}"

Determine if this action requires a skill check. Rules:
- Simple/passive actions (looking around, walking, talking politely) = NO check needed
- Risky, deceptive, athletic, magical, social influence, or stealthy actions = check required
- Creative/clever actions should be rewarded with appropriate DCs

Return a JSON object with these fields only:
- requires_check: boolean
- skill: string (one of: Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival) or null
- dc: integer (5-25 range) or null
- reasoning: string (1-2 sentences of in-character GM flavor text explaining the ruling)
- risk_level: string ("low", "medium", "high", or "extreme")`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          requires_check: { type: 'boolean' },
          skill: { type: 'string' },
          dc: { type: 'number' },
          reasoning: { type: 'string' },
          risk_level: { type: 'string' }
        },
        required: ['requires_check', 'reasoning', 'risk_level']
      }
    });

    return Response.json({ ...result, action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, character, session_context, in_combat, combat_context, combat_enemies } = await req.json();

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

Enemies present (target one by exact name if the action attacks a foe): ${combat_enemies && combat_enemies.length ? combat_enemies.join(', ') : 'see scene context'}

The player wants to: "${action}"

Think step by step about the player's intent, the enemies' likely disposition, and the tactical situation. Then decide ONE outcome_type:
- "attack": the action is fundamentally an attempt to harm an enemy with a weapon, spell, or improvised means (e.g. "stab the goblin", "throw my dagger at the cultist", "tackle the bandit and bite him"). If the maneuver is tricky or unconventional, set requires_check true with a setup skill (e.g. Athletics to leap onto a foe, Acrobatics to tumble past, Sleight of Hand to draw a hidden blade) + DC — a SUCCESS on that check then grants the attack roll, a FAILURE wastes the action. If it's a plain attack, set requires_check false and the attack roll happens directly. Always set target_name to the exact enemy name being attacked.
- "skill_check": the action is uncertain and needs a roll but is NOT itself an attack (e.g. shove a brazier, swing on a chandelier to reposition, feint, disarm without striking). Pick the most fitting skill and a fair DC (5-25).
- "continue_combat": a straightforward aggressive move that the player should carry out with the normal Attack/Spell buttons. Briefly tell them to use their combat actions.
- "de_escalate": an attempt to talk, surrender, parley, or stand down AND the situation plausibly allows enemies to consider stopping. Usually needs a Persuasion/Intimidation/Deception check; success would END or pause combat.
- "narrative": a non-mechanical descriptive action (looking around, shouting a warning) that simply happens and the DM narrates. If the narration grants the player a tangible reward (loot, coins, or healing) — e.g. they grab a fallen foe's coin pouch or quaff a potion — fill in the "reward" object so it applies to real game stats.

Rules of thumb:
- Be fair and reward creativity with reasonable DCs.
- Mindless enemies (undead, beasts, constructs) rarely de-escalate; intelligent or losing foes might.
- Never auto-end combat without justification; prefer a check for de-escalation.
- Only fill "reward" when the action genuinely earns something concrete in the fiction. Keep amounts modest and plausible for a single combat action.

Return ONLY a JSON object:
- outcome_type: "attack" | "skill_check" | "continue_combat" | "de_escalate" | "narrative"
- requires_check: boolean
- skill: one of (Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival) or null
- dc: integer 5-25 or null
- target_name: exact name of the enemy being attacked (only for outcome_type "attack"), else null
- attack_type: "weapon" | "spell" | "improvised" or null (only for "attack")
- risk_level: "low" | "medium" | "high" | "extreme"
- reasoning: 1-3 sentences of in-character DM thinking that shows the thought process behind the ruling
- ends_combat_on_success: boolean (true only for de_escalate actions where a successful check would stop the fight)
- reward: object or null — when the action concretely grants the player something, set { gold, silver, copper, hp_heal, items } where gold/silver/copper/hp_heal are integers (0 if none) and items is an array of { name, type, description }. Use null when there is no reward.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            outcome_type: { type: 'string' },
            requires_check: { type: 'boolean' },
            skill: { type: 'string' },
            dc: { type: 'number' },
            target_name: { type: 'string' },
            attack_type: { type: 'string' },
            risk_level: { type: 'string' },
            reasoning: { type: 'string' },
            ends_combat_on_success: { type: 'boolean' },
            reward: {
              type: 'object',
              properties: {
                gold: { type: 'number' },
                silver: { type: 'number' },
                copper: { type: 'number' },
                hp_heal: { type: 'number' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
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
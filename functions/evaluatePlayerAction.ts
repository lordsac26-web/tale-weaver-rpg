import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, character, session_context } = await req.json();

    const prompt = `You are a Dungeon Master evaluating a player's proposed action in a D&D 5e game.
    
Character: ${character?.name}, ${character?.race} ${character?.class} Level ${character?.level}
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
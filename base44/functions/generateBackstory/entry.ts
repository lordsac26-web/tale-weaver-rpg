import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, race, class: charClass, background, level, prompt: userPrompt } = await req.json();

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Generate an immersive character backstory for a D&D 5E character.
Character Details:
- Name: ${name}
- Race: ${race}
- Class: ${charClass}
- Background: ${background || 'Unknown'}
- Level: ${level} (they have experience appropriate to this level)
- Player's Prompt/Ideas: ${userPrompt || 'Create something compelling and original'}

Write a 3-4 paragraph backstory that:
- Explains their origin and upbringing
- Describes the pivotal moment that led them to adventure
- Reveals a personal flaw or secret
- Hints at a long-term goal or motivation
- Fits naturally with their race, class, and background

Write in third person, past tense. Make it vivid and emotionally resonant.`,
    response_json_schema: {
      type: 'object',
      properties: {
        backstory: { type: 'string' },
        personality_trait: { type: 'string' },
        ideal: { type: 'string' },
        bond: { type: 'string' },
        flaw: { type: 'string' }
      }
    }
  });

  return Response.json(result);
});
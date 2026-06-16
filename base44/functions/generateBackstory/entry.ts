import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, race, class: charClass, background, level, prompt: userPrompt, skills, feats, ability_scores } = await req.json();

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate an immersive character backstory for a D&D 5E character.
Character Details:
- Name: ${name}
- Race: ${race}
- Class: ${charClass}
- Background: ${background || 'Unknown'}
- Level: ${level}
- Player's Prompt/Ideas: ${userPrompt || 'Create something compelling and original'}
- Key Skills: ${skills ? skills.join(', ') : 'Not specified'}
- Feats: ${feats ? feats.join(', ') : 'None'}
- Notable Abilities: ${ability_scores ? `STR ${ability_scores.strength||10}, DEX ${ability_scores.dexterity||10}, CON ${ability_scores.constitution||10}, INT ${ability_scores.intelligence||10}, WIS ${ability_scores.wisdom||10}, CHA ${ability_scores.charisma||10}` : 'Not specified'}

Write a 3-4 paragraph backstory that:
- Explains their origin and upbringing
- Describes the pivotal moment that led them to adventure
- Reveals a personal flaw or secret
- Hints at a long-term goal or motivation
- Fits naturally with their race, class, and background
- Weaves in their key skills and feats as part of their story

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
  } catch (error) {
    console.error('Backstory generation error:', error);
    return Response.json({ error: error.message || 'Backstory generation failed' }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, mature_content = false } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt required' }, { status: 400 });
    }

    const systemPrompt = `You are an expert at crafting detailed image generation prompts for D&D fantasy art.
Transform the user's basic description into a rich, detailed prompt optimized for image generation.

Guidelines:
- Add vivid details about lighting, atmosphere, composition, and artistic style
- Specify D&D fantasy art aesthetic (detailed, dramatic, epic)
- Include technical terms: "digital art", "detailed", "dramatic lighting", "cinematic"
- Keep the core concept but enhance with visual details
- Make it 2-3 sentences maximum
${mature_content ? '- User has enabled 18+ content: you may include violence, gore, battle scenes, dark themes' : '- Keep content family-friendly: no violence, gore, or dark themes'}
- NEVER include sexual content regardless of settings

Output ONLY the enhanced prompt, nothing else.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nUser's description: "${prompt}"\n\nEnhance this into a detailed D&D fantasy art prompt:`,
      response_json_schema: {
        type: 'object',
        properties: {
          enhanced_prompt: { type: 'string' }
        },
        required: ['enhanced_prompt']
      },
    });

    return Response.json({
      success: true,
      enhanced_prompt: result.enhanced_prompt,
      original_prompt: prompt,
    });
  } catch (error) {
    console.error('Prompt enhancement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
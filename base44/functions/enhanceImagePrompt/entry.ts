import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, mature_content = false, category = 'custom' } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'Prompt required' }, { status: 400 });
    }

    // Build system prompt based on mature content setting
    const systemPrompt = mature_content
      ? `You are a professional fantasy art prompt enhancer for mature D&D campaigns.
Enhance the user's prompt with vivid, dramatic details while keeping it R-rated maximum.

ALLOWED for mature fantasy art:
- Intense battle scenes with blood, gore, wounds, and visceral combat
- Dark themes: death, necromancy, demons, horror elements
- Revealing fantasy costumes: chainmail bikinis, low-cut dresses, muscular bare-chested warriors
- Artistic fantasy anatomy: exaggerated muscular definition, slight breast exposure on female warriors (sideboob, cleavage), artistic nudity in classical statue style
- Grim atmosphere: torture devices (no graphic torture), dark dungeons, ominous lighting
- Monster violence: impalement, dismemberment (stylized, not gratuitous)

STILL PROHIBITED:
- Explicit sexual acts or positions
- Genital exposure or full frontal nudity
- Pornographic content
- Gratuitous gore focused on suffering
- Real-world hate symbols or discrimination

Focus on PROFESSIONAL FANTASY ART context - think Magic: The Gathering, heavy metal album covers, classic Frazetta paintings, mature D&D sourcebooks.

Enhance with: dramatic lighting, dynamic composition, rich color palette, emotional intensity, and artistic merit.`
      : `You are a professional fantasy art prompt enhancer for D&D campaigns.
Enhance the user's prompt with vivid, dramatic details while keeping it family-friendly.

Focus on: heroic compositions, vibrant colors, dynamic action, professional fantasy illustration quality.
Avoid: excessive violence, gore, revealing clothing, dark/grim themes.

Think: classic D&D sourcebook art, heroic fantasy posters, vibrant adventure scenes.`;

    const enhancementPrompt = `Original prompt: "${prompt}"
Category: ${category}
Mature content: ${mature_content ? 'Yes (R-rated max)' : 'No (Family-friendly)'}

Enhance this prompt for AI image generation. Make it more vivid, detailed, and artistically directed. Include:
- Art style references (professional fantasy illustration)
- Lighting and atmosphere
- Composition guidance
- Color palette suggestions
- Emotional tone

Return ONLY the enhanced prompt, no explanations.`;

    // Use InvokeLLM with appropriate model
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: enhancementPrompt,
      add_context_from_internet: false,
      model: mature_content ? 'claude_sonnet_4_6' : 'automatic',
    });

    const enhancedPrompt = typeof result === 'string' ? result : result.response || prompt;

    return Response.json({
      success: true,
      enhanced_prompt: enhancedPrompt,
      original_prompt: prompt,
      mature_mode: mature_content,
    });
  } catch (error) {
    console.error('Prompt enhancement error:', error);
    return Response.json({ 
      error: error.message || 'Enhancement failed',
      original_prompt: prompt 
    }, { status: 500 });
  }
});
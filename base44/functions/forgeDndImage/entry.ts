import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const QUALITY_SIZES = {
  '1k': '1024x1024',
  '2k': '2048x2048',
  '4k': '4096x4096',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, reference_image_url, quality = '2k', mature_content = false } = await req.json();

    if (!prompt && !reference_image_url) {
      return Response.json({ error: 'Prompt or reference image required' }, { status: 400 });
    }

    // Build enhanced prompt with D&D styling
    let finalPrompt = prompt || 'Transform this into D&D fantasy art style';
    
    const stylePrefix = 'D&D fantasy art, epic digital painting, detailed, dramatic lighting, cinematic composition, ';
    const styleSuffix = mature_content 
      ? ', dark fantasy, intense, gritty realism'
      : ', heroic fantasy, vibrant, detailed background';

    finalPrompt = `${stylePrefix}${finalPrompt}${styleSuffix}`;

    // Content safety enforcement
    const safetyCheck = finalPrompt.toLowerCase();
    const bannedTerms = ['nude', 'naked', 'sexual', 'nsfw', 'porn', 'explicit'];
    if (bannedTerms.some(term => safetyCheck.includes(term))) {
      return Response.json({ error: 'Sexual content is not allowed' }, { status: 400 });
    }

    // Generate image using Core integration
    const imageData = reference_image_url 
      ? await base44.integrations.Core.GenerateImage({
          prompt: finalPrompt,
          existing_image_urls: [reference_image_url],
        })
      : await base44.integrations.Core.GenerateImage({
          prompt: finalPrompt,
        });

    if (!imageData?.url) {
      return Response.json({ error: 'Image generation failed' }, { status: 500 });
    }

    return Response.json({
      success: true,
      image_url: imageData.url,
      prompt_used: finalPrompt,
      quality,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Image forge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
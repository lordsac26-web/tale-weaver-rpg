import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Build enhanced prompt with D&D styling and mature content guidelines
    let finalPrompt = prompt || 'Transform this into D&D fantasy art style';
    
    const stylePrefix = 'D&D fantasy art, epic digital painting, detailed, dramatic lighting, cinematic composition, ';
    const styleSuffix = mature_content 
      ? ', dark fantasy, intense, gritty realism, mature artistic fantasy'
      : ', heroic fantasy, vibrant, detailed background';

    finalPrompt = `${stylePrefix}${finalPrompt}${styleSuffix}`;

    // Content safety enforcement with mature mode support
    const safetyCheck = finalPrompt.toLowerCase();
    
    if (mature_content) {
      // Mature mode: Allow artistic fantasy nudity (bare-chested warriors, etc.) but block explicit sexual content
      const hardBannedTerms = ['porn', 'pornographic', 'explicit', 'nsfw', 'erotica', 'sexual act', 'sex act'];
      if (hardBannedTerms.some(term => safetyCheck.includes(term))) {
        return Response.json({ error: 'Explicit sexual content is not allowed, even in mature mode' }, { status: 400 });
      }
      // Soften the prompt to allow artistic nudity while maintaining fantasy context
      finalPrompt += ', artistic fantasy illustration, tasteful composition, classical art style';
    } else {
      // Standard mode: Block all nudity and sexual content
      const bannedTerms = ['nude', 'naked', 'bare-chested', 'topless', 'breast', 'sexual', 'nsfw', 'porn', 'explicit'];
      if (bannedTerms.some(term => safetyCheck.includes(term))) {
        return Response.json({ error: 'Sexual or nude content is not allowed' }, { status: 400 });
      }
    }

    // Try generating with up to 2 attempts — content filters can be flaky
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const imageData = reference_image_url 
          ? await base44.integrations.Core.GenerateImage({
              prompt: finalPrompt,
              existing_image_urls: [reference_image_url],
            })
          : await base44.integrations.Core.GenerateImage({
              prompt: finalPrompt,
            });

        if (imageData?.url) {
          return Response.json({
            success: true,
            image_url: imageData.url,
            prompt_used: finalPrompt,
            quality,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (genError) {
        lastError = genError;
        const msg = (genError.message || '').toLowerCase();
        
        // If content filter triggered, handle based on mature mode
        if (msg.includes('filtered') || msg.includes('usage guidelines') || msg.includes('violated')) {
          if (mature_content) {
            // Mature mode: Soften but keep artistic intent
            finalPrompt = finalPrompt
              .replace(/gore|blood|grit|violent|intense|dark fantasy|gritty/gi, '')
              .replace(/nude|naked|bare-chested|topless/gi, 'artistic fantasy figure')
              .replace(/\s{2,}/g, ' ')
              .trim();
            finalPrompt += ', artistic fantasy illustration, tasteful classical composition';
          } else {
            // Standard mode: Full sanitization
            finalPrompt = finalPrompt
              .replace(/gore|blood|grit|violent|intense|dark fantasy|gritty/gi, '')
              .replace(/battle-worn|battle worn|weathered|harsh/gi, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            finalPrompt += ', family-friendly fantasy illustration, safe content';
          }
          continue;
        }
        // For non-filter errors, don't retry
        break;
      }
    }

    // If we exhausted retries, return a user-friendly message
    const errorMsg = lastError?.message || 'Image generation failed';
    const isFilterError = errorMsg.toLowerCase().includes('filtered') || errorMsg.toLowerCase().includes('usage guidelines');
    
    if (isFilterError) {
      return Response.json({ 
        error: 'The image was blocked by the AI content filter. Try rephrasing your prompt — remove any violent, dark, or potentially sensitive terms and try again.' 
      }, { status: 422 });
    }

    return Response.json({ error: errorMsg }, { status: 500 });
  } catch (error) {
    console.error('Image forge error:', error);
    return Response.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
});
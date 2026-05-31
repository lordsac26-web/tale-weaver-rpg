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

    // Build enhanced prompt with D&D styling
    let finalPrompt = prompt || 'Transform this into D&D fantasy art style';
    
    const stylePrefix = mature_content
      ? 'Mature D&D fantasy art, R-rated dark fantasy illustration, professional concept art, dramatic lighting, cinematic composition, '
      : 'D&D fantasy art, epic digital painting, detailed, dramatic lighting, cinematic composition, ';
    
    const styleSuffix = mature_content 
      ? ', dark fantasy, intense battle scene, gritty realism, visceral details, atmospheric horror, professional mature fantasy art, award-winning concept art'
      : ', heroic fantasy, vibrant, detailed background';

    finalPrompt = `${stylePrefix}${finalPrompt}${styleSuffix}`;

    // Content safety enforcement based on mature_content flag
    const safetyCheck = finalPrompt.toLowerCase();
    
    if (mature_content) {
      // R-rated mode: Allow dark fantasy, violence, revealing costumes
      // Block only explicit prohibited content
      const hardBannedTerms = ['porn', 'porno', 'pornography', 'explicit sex', 'intercourse', 'genital', 'penis', 'vagina', 'pubic'];
      if (hardBannedTerms.some(term => safetyCheck.includes(term))) {
        return Response.json({ 
          error: 'Content violates guidelines: No explicit sexual content or genital exposure allowed.' 
        }, { status: 400 });
      }
    } else {
      // Family-friendly mode: Strict filtering
      const bannedTerms = ['nude', 'naked', 'sexual', 'nsfw', 'porn', 'explicit', 'blood', 'gore', 'violence', 'death', 'dismember', 'impale'];
      if (bannedTerms.some(term => safetyCheck.includes(term))) {
        return Response.json({ error: 'Content not suitable for family-friendly mode. Enable mature content or rephrase your prompt.' }, { status: 400 });
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
        
        // If content filter triggered and NOT in mature mode, soften the prompt and retry
        if ((msg.includes('filtered') || msg.includes('usage guidelines') || msg.includes('violated')) && !mature_content) {
          // Strip aggressive terms and retry with softer phrasing
          finalPrompt = finalPrompt
            .replace(/gore|blood|grit|violent|intense|dark fantasy|gritty/gi, '')
            .replace(/battle-worn|battle worn|weathered|harsh/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          finalPrompt += ', family-friendly fantasy illustration, safe content';
          continue;
        }
        
        // In mature mode, if filter triggers, try once with slightly softer language but keep dark themes
        if ((msg.includes('filtered') || msg.includes('usage guidelines')) && mature_content) {
          finalPrompt = finalPrompt
            .replace(/excessive gore|gratuitous violence|torture/gi, 'intense dark fantasy')
            .replace(/\s{2,}/g, ' ')
            .trim();
          finalPrompt += ', professional mature fantasy concept art, artistic composition';
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
      if (mature_content) {
        return Response.json({ 
          error: 'The image was blocked by content filters even in mature mode. Try reducing explicit descriptions of violence or anatomy while keeping the dark fantasy theme.' 
        }, { status: 422 });
      } else {
        return Response.json({ 
          error: 'The image was blocked by the AI content filter. Try rephrasing your prompt — remove any violent, dark, or potentially sensitive terms, or enable "Mature Fantasy Art" mode for darker themes.' 
        }, { status: 422 });
      }
    }

    return Response.json({ error: errorMsg }, { status: 500 });
  } catch (error) {
    console.error('Image forge error:', error);
    return Response.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
});
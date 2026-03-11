import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generate voice narration using ElevenLabs TTS API.
  * Accepts: { text, voice_id?, setting?, mood? }
   * Returns: { audio_url } — a publicly accessible file URL
    *
     * Default voice: "Daniel" (deep male narrator, great for fantasy)
      * The function strips markdown formatting before sending to TTS.
       */

       const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

       // Curated fantasy-friendly voice presets (ElevenLabs built-in voice IDs)
       const VOICE_PRESETS = {
         narrator_male:   'e5WNhrdI30aXpS2RSGm1', // Ian — deep, authoritative narrator
           narrator_female: 'EXAVITQu4vr4xnSDxMaL', // Bella — warm, expressive female
             dark_fantasy:    'VR6AewLTigWG4xSOukaG', // Arnold — gravelly, intense
               whimsical:       'pNInz6obpgDQGcFmaJgB', // Adam — friendly, warm
                 ancient:         'ErXwobaYiN019PkySvjV', // Antoni — wise, measured
                 };

                 // Map game settings to voice presets
                 const SETTING_VOICE_MAP = {
                   'Dark Fantasy':  'dark_fantasy',
                     'High Fantasy':  'narrator_male',
                       'Sci-Fi':        'narrator_female',
                         'Cyberpunk':     'narrator_female',
                           'Historical':    'ancient',
                             'Anime':         'whimsical',
                               'Real World':    'narrator_male',
                               };

                               function stripMarkdown(text) {
                                 return text
                                     .replace(/\*\*[^*]+\*\*/g, '')       // Remove **bold headers** (stat lines)
                                         .replace(/\*([^*]+)\*/g, '$1')        // *italic* → italic
                                             .replace(/#{1,6}\s*/g, '')            // Remove # headers
                                                 .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
                                                     .replace(/[_~`]/g, '')                // Remove misc markdown chars
                                                         .trim();
                                                         }

                                                         Deno.serve(async (req) => {
                                                           const base44 = createClientFromRequest(req);
                                                             const user = await base44.auth.me();
                                                               if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

                                                                 if (!ELEVENLABS_API_KEY) {
                                                                     return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 });
                                                                       }

                                                                         const { text, voice_id, setting, mood } = await req.json();

                                                                           if (!text || text.trim().length === 0) {
                                                                               return Response.json({ error: 'No text provided' }, { status: 400 });
                                                                                 }

                                                                                   // Resolve voice: explicit voice_id > setting-based > default narrator
                                                                                     const presetKey = SETTING_VOICE_MAP[setting] || 'narrator_male';
                                                                                       const resolvedVoiceId = voice_id || VOICE_PRESETS[presetKey] || VOICE_PRESETS.narrator_male;

                                                                                         // Clean text for speech
                                                                                           const cleanText = stripMarkdown(text);

                                                                                             // Truncate to ~5000 chars to keep generation fast and within limits
                                                                                               const truncated = cleanText.length > 5000 ? cleanText.slice(0, 5000) + '...' : cleanText;

                                                                                                 // Adjust voice settings based on mood
                                                                                                   const stability = mood === 'tense' ? 0.35 : mood === 'calm' ? 0.75 : 0.5;
                                                                                                     const similarity = 0.75;
                                                                                                       const style = mood === 'tense' ? 0.6 : mood === 'calm' ? 0.3 : 0.45;

                                                                                                         // Call ElevenLabs TTS API
                                                                                                           const ttsResponse = await fetch(
                                                                                                               `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
                                                                                                                   {
                                                                                                                         method: 'POST',
                                                                                                                               headers: {
                                                                                                                                       'xi-api-key': ELEVENLABS_API_KEY,
                                                                                                                                               'Content-Type': 'application/json',
                                                                                                                                                       'Accept': 'audio/mpeg',
                                                                                                                                                             },
                                                                                                                                                                   body: JSON.stringify({
                                                                                                                                                                           text: truncated,
                                                                                                                                                                                   model_id: 'eleven_multilingual_v2',
                                                                                                                                                                                           output_format: 'mp3_22050_32',
                                                                                                                                                                                                   voice_settings: {
                                                                                                                                                                                                             stability,
                                                                                                                                                                                                                       similarity_boost: similarity,
                                                                                                                                                                                                                                 style,
                                                                                                                                                                                                                                           use_speaker_boost: true,
                                                                                                                                                                                                                                                   },
                                                                                                                                                                                                                                                         }),
                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                               );

                                                                                                                                                                                                                                                                 if (!ttsResponse.ok) {
                                                                                                                                                                                                                                                                     const errBody = await ttsResponse.text();
                                                                                                                                                                                                                                                                         console.error('ElevenLabs error:', ttsResponse.status, errBody);
                                                                                                                                                                                                                                                                             return Response.json(
                                                                                                                                                                                                                                                                                   { error: `TTS generation failed: ${ttsResponse.status}`, details: errBody },
                                                                                                                                                                                                                                                                                         { status: 502 }
                                                                                                                                                                                                                                                                                             );
                                                                                                                                                                                                                                                                                               }

                                                                                                                                                                                                                                                                                                 // Get audio bytes and upload to Base44 file storage
                                                                                                                                                                                                                                                                                                   const audioBlob = await ttsResponse.blob();
                                                                                                                                                                                                                                                                                                     const file = new File([audioBlob], 'narration.mp3', { type: 'audio/mpeg' });

                                                                                                                                                                                                                                                                                                       const { file_url } = await base44.integrations.Core.UploadFile({ file });

                                                                                                                                                                                                                                                                                                         return Response.json({ audio_url: file_url });
});
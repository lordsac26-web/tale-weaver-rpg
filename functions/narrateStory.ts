import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await req.json();
    
    if (!text?.trim()) {
      return Response.json({ error: 'No text provided' }, { status: 400 });
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return Response.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // Using "Adam" voice - deep, clear, storytelling voice (pre-made voice, always available)
    const voiceId = 'n1PvBOwxb8X6m7tahp2h';
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',  // fastest, lowest latency
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      return Response.json({ error: 'Failed to generate audio' }, { status: 500 });
    }

    const audioData = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioData);
let binary = '';
const chunkSize = 8192;
for (let i = 0; i < uint8Array.length; i += chunkSize) {
  const chunk = uint8Array.subarray(i, i + chunkSize);
  binary += String.fromCharCode(...chunk);
}
const base64Audio = btoa(binary);
    
    return Response.json({ audio: `data:audio/mpeg;base64,${base64Audio}` });
  } catch (error) {
    console.error('Narration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
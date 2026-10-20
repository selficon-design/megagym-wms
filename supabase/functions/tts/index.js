// Φωνή: κείμενο → ομιλία με ElevenLabs (mp3).
import { handler, fail, cors } from '../_shared/http.js';

Deno.serve(handler(async req => {
  const key = Deno.env.get('ELEVENLABS_API_KEY'), voice = Deno.env.get('ELEVENLABS_VOICE_ID');
  if (!key || !voice) return fail('Δεν έχει ρυθμιστεί το ElevenLabs.', 503);
  const { text } = await req.json(); const t = String(text || '').slice(0, 2500).trim(); if (!t) return fail('Κενό κείμενο.');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: t, model_id: Deno.env.get('ELEVENLABS_TTS_MODEL') || 'eleven_multilingual_v2' }),
  });
  if (!r.ok) return fail('Σφάλμα ElevenLabs (' + r.status + ').', 502);
  return new Response(r.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}));

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
  if (!r.ok) { const j = await r.json().catch(() => ({})); const d = (j && j.detail) || {}; const t = String(d.status || '') + ' ' + String(d.message || '');
    const why = /permission/i.test(t) ? 'το κλειδί δεν έχει άδεια «Text to Speech»' : /invalid_api_key|invalid api key/i.test(t) ? 'μη έγκυρο κλειδί ElevenLabs' : /voice/i.test(t) ? 'η φωνή (ELEVENLABS_VOICE_ID) δεν βρέθηκε ή δεν επιτρέπεται' : /quota|credits/i.test(t) ? 'τελείωσαν οι μονάδες του ElevenLabs' : String(d.message || '').slice(0, 200);
    return fail('Σφάλμα φωνής (ElevenLabs ' + r.status + ')' + (why ? ': ' + why : '.'), 502); }
  return new Response(r.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}));

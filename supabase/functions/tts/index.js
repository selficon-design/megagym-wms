// Φωνή: κείμενο → ομιλία με ElevenLabs (mp3).
import { handler, fail, cors } from '../_shared/http.js';

Deno.serve(handler(async req => {
  const key = Deno.env.get('ELEVENLABS_API_KEY'), voice = Deno.env.get('ELEVENLABS_VOICE_ID');
  if (!key || !voice) return fail('Δεν έχει ρυθμιστεί το ElevenLabs.', 503);
  const b = await req.json(); const t = String(b.text || '').slice(0, 2500).trim(); if (!t) return fail('Κενό κείμενο.');
  // ταχύτητα ομιλίας (ElevenLabs: 0,7 αργά … 1,2 γρήγορα) — σταθερή σε όλα τα κομμάτια
  const speed = Math.min(1.2, Math.max(0.7, Number(b.speed) || 0.8));
  const ctx = s => String(s || '').slice(-300);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: t, model_id: Deno.env.get('ELEVENLABS_TTS_MODEL') || 'eleven_multilingual_v2',
      voice_settings: { speed, stability: 0.8, similarity_boost: 0.75, style: 0, use_speaker_boost: true }, // υψηλή σταθερότητα = σταθερός ρυθμός
      // συνέχεια με το προηγούμενο/επόμενο κομμάτι, ώστε ο ρυθμός να μην «ξεκινά αργά και μετά τρέχει»
      previous_text: ctx(b.previous_text) || undefined, next_text: String(b.next_text || '').slice(0, 300) || undefined }),
  });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const d = (j && j.detail) || {}; const t = String(d.status || '') + ' ' + String(d.message || '');
    const why = /permission/i.test(t) ? 'το κλειδί δεν έχει άδεια «Text to Speech»' : /invalid_api_key|invalid api key/i.test(t) ? 'μη έγκυρο κλειδί ElevenLabs' : /voice/i.test(t) ? 'η φωνή (ELEVENLABS_VOICE_ID) δεν βρέθηκε ή δεν επιτρέπεται' : /quota|credits/i.test(t) ? 'τελείωσαν οι μονάδες του ElevenLabs' : String(d.message || '').slice(0, 200);
    return fail('Σφάλμα φωνής (ElevenLabs ' + r.status + ')' + (why ? ': ' + why : '.'), 502); }
  return new Response(r.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}));

// Μικρόφωνο: ομιλία → κείμενο με ElevenLabs (Scribe).
import { handler, json, fail } from '../_shared/http.js';

Deno.serve(handler(async req => {
  const key = Deno.env.get('ELEVENLABS_API_KEY'); if (!key) return fail('Δεν έχει ρυθμιστεί το ElevenLabs.', 503);
  const inForm = await req.formData(); const file = inForm.get('file');
  if (!file || typeof file === 'string') return fail('Δεν στάλθηκε ήχος.');
  if (file.size > 15 * 1024 * 1024) return fail('Πολύ μεγάλη ηχογράφηση.');
  const fd = new FormData();
  fd.append('model_id', Deno.env.get('ELEVENLABS_STT_MODEL') || 'scribe_v2');
  fd.append('file', file, file.name || 'speech.webm');
  const lang = Deno.env.get('ELEVENLABS_STT_LANGUAGE'); if (lang) fd.append('language_code', lang);
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return fail('Σφάλμα αναγνώρισης φωνής (' + r.status + ').', 502);
  return json({ text: String(j.text || '').trim() });
}));

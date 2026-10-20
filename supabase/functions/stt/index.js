// Μικρόφωνο: ομιλία → κείμενο με ElevenLabs (Scribe).
import { handler, json, fail } from '../_shared/http.js';

// Εξήγηση του σφάλματος του ElevenLabs στα ελληνικά
function elReason(j) {
  const d = (j && j.detail) || {}; const st = String(d.status || ''); const m = String(d.message || (typeof j.detail === 'string' ? j.detail : '') || '');
  if (/permission/i.test(st + m)) return ': το κλειδί δεν έχει άδεια «Speech to Text». Ενεργοποιήστε την στο ElevenLabs → API Keys.';
  if (/invalid_api_key|invalid api key/i.test(st + m)) return ': μη έγκυρο κλειδί ElevenLabs. Ελέγξτε το ELEVENLABS_API_KEY.';
  if (/quota|credits/i.test(st + m)) return ': τελείωσαν οι μονάδες του ElevenLabs.';
  return m ? ': ' + m.slice(0, 200) : '.';
}
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
  if (!r.ok) return fail('Σφάλμα αναγνώρισης φωνής (ElevenLabs ' + r.status + ')' + elReason(j), 502);
  return json({ text: String(j.text || '').trim() });
}));

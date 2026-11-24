// Ελέγχει ποιες ρυθμίσεις λεξιλογίου (keyterms) δέχεται η ζωντανή καταγραφή του ElevenLabs.
// Χρήση (CI): EK=<κλειδί> node tests/ci/stt_probe.mjs
const EK = process.env.EK;
async function token() {
  const r = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe?max_session_duration_seconds=10', { method: 'POST', headers: { 'xi-api-key': EK } });
  return (await r.json()).token;
}
function probe(name, terms) {
  return new Promise(async res => {
    const q = new URLSearchParams({ model_id: 'scribe_v2_realtime', token: await token(), audio_format: 'pcm_16000', commit_strategy: 'vad', language_code: 'el', no_verbatim: 'true' });
    q.append('secondary_languages', 'en'); terms.forEach(t => q.append('keyterms', t));
    const url = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime?' + q;
    let done = false; const end = m => { if (!done) { done = true; console.log(`${name} | όροι ${terms.length} | URL ${url.length} | ${m}`); try { ws.close(); } catch (e) {} res(); } };
    const ws = new WebSocket(url);
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.message_type === 'session_started') end('ΟΚ'); else if (m.error || /error|invalid/.test(m.message_type || '')) end('ΣΦΑΛΜΑ ' + JSON.stringify(m).slice(0, 200)); };
    ws.onerror = e => end('ΣΦΑΛΜΑ σύνδεσης'); ws.onclose = e => end('έκλεισε ' + (e.code || '') + ' ' + (e.reason || ''));
    setTimeout(() => end('χωρίς απάντηση'), 8000);
  });
}
const gr = i => 'Αποθήκη δοκιμής αριθμός ' + i;                                 // ~25 χαρακτήρες, ελληνικά
const long = i => 'LED STRIP 6000-6500K 5050-60P 14.4W τύπος ' + i;            // ~45 χαρακτήρες, 7 λέξεις
const short = i => 'ΤΑΤΟΙΟΥ' + i;
await probe('20 σύντομοι', Array.from({ length: 20 }, (_, i) => short(i)));
await probe('50 σύντομοι', Array.from({ length: 50 }, (_, i) => short(i)));
await probe('100 σύντομοι', Array.from({ length: 100 }, (_, i) => short(i)));
await probe('60 ελληνικοί ~25', Array.from({ length: 60 }, (_, i) => gr(i)));
await probe('1 μακρύς 7 λέξεων', [long(1)]);
await probe('1 με 5 λέξεις', ['Washer Magenta 200watt External use']);
await probe('1 με 4 λέξεις', ['Washer Magenta 200watt External']);
await probe('1 με 3 λέξεις', ['Washer Magenta 200watt']);
await probe('1 με τελεία/παύλα', ['14.4W', '6000-6500K']);

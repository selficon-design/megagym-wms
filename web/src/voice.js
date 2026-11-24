/* ================================================================
   Φωνή με ElevenLabs (μέσω των functions «tts» και «stt»).
   • Ανάγνωση απαντήσεων του AI με φυσική ελληνική φωνή
     (αν το ElevenLabs δεν απαντήσει, χρησιμοποιείται η φωνή της συσκευής)
   • Μικρόφωνο: μιλάτε, το κείμενο γράφεται και στέλνεται στον βοηθό
   ================================================================ */
const VOICE = { audio: null, url: null, rec: null, chunks: [], recording: false, busy: false, elOk: true, seq: 0 };
const deviceSpeak = ttsSpeak; // φωνή συσκευής ως εφεδρική
TTS.ok = true;

function ttsStop() {
  VOICE.seq++;
  try { if (VOICE.audio) { VOICE.audio.pause(); VOICE.audio = null; } } catch (e) {}
  if (VOICE.url) { URL.revokeObjectURL(VOICE.url); VOICE.url = null; }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
}
// Ταχύτητα ομιλίας: μένει στη συσκευή. 0,8 = αργά · 0,9 = κανονικά (προεπιλογή) · 1,05 = γρήγορα
const SPEEDS = [[0.75, 'Πολύ αργά'], [0.85, 'Αργά'], [0.95, 'Κανονικά'], [1.08, 'Γρήγορα']];
TTS.speed = (() => { try { const v = parseFloat(localStorage.getItem('mg-tts-speed')); return v >= 0.7 && v <= 1.2 ? v : 0.85; } catch (e) { return 0.85; } })();
function setTtsSpeed(v) { TTS.speed = Math.min(1.2, Math.max(0.7, v)); try { localStorage.setItem('mg-tts-speed', String(TTS.speed)); } catch (e) {} if (AI.open) renderAi(); return TTS.speed; }
const speedLabel = () => (SPEEDS.reduce((b, s) => Math.abs(s[0] - TTS.speed) < Math.abs(b[0] - TTS.speed) ? s : b))[1];
ACT.ttsSpeed = () => { const i = SPEEDS.findIndex(s => Math.abs(s[0] - TTS.speed) < 0.03); const n = SPEEDS[(i + 1) % SPEEDS.length]; setTtsSpeed(n[0]); toast('Ταχύτητα φωνής: ' + n[1]); if (TTS.on) ttsSpeak('Έτσι θα μιλάω. Κωδικός ΜG-00125.'); };
// Κείμενο για ομιλία: οι κωδικοί διαβάζονται χαρακτήρα-χαρακτήρα με παύσεις, οι λίστες με παύση ανάμεσα
const SAY_DIG = ['μηδέν', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννιά'];
function sayCode(c) {
  return c.split('').map(ch => /\d/.test(ch) ? SAY_DIG[+ch] : /[-_/.]/.test(ch) ? '' : ch.toUpperCase()).filter(Boolean).join(', ');
}
function ttsPrepare(t) {
  let s = String(t || '');
  s = s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, '\n'); // κουκκίδες λίστας → νέα γραμμή (παύση)
  s = ttsClean(s.replace(/\n+/g, ' ¶ '));
  // παραστατικά: ΕΙΣ-00012 → «εισαγωγή 12» (χωρίς τα μηδενικά)
  const DOC = { ΕΙΣ: 'εισαγωγή', ΠΑΡ: 'παραλαβή', ΤΟΠ: 'τοποθέτηση', ΕΠΓ: 'επιστροφή από γυμναστήριο', ΕΠΑ: 'επιστροφή σε αποθήκη', ΜΑΓ: 'μεταφορά σε αποθήκη γυμναστηρίου', ΜΕΤ: 'μεταφορά', ΜΟΧ: 'μεταφορά οχήματος', ΜΓΥ: 'μεταφορά από γυμναστήριο', ΕΠΞ: 'επεξεργασία', ΜΡΤ: 'μεταφορά ρεταλιών', ΚΑΤ: 'αλλαγή κατάστασης', ΑΠΣ: 'απόσυρση', ΑΠΓ: 'απογραφή' };
  s = s.replace(/(?<!\p{L})(ΕΙΣ|ΠΑΡ|ΤΟΠ|ΕΠΓ|ΕΠΑ|ΜΑΓ|ΜΕΤ|ΜΟΧ|ΜΓΥ|ΕΠΞ|ΜΡΤ|ΚΑΤ|ΑΠΣ|ΑΠΓ)-0*(\d+)/gu, (m, k, n) => DOC[k] + ' ' + n);
  // κωδικοί προϊόντων: λέξεις με γράμματα ΚΑΙ ψηφία, ή με παύλα/κάθετο και ψηφία, ή 5+ ψηφία στη σειρά
  s = s.replace(/(?<![\p{L}\d])(?=[\p{L}\d\-_/.]*\d)(?=[\p{L}\d\-_/.]*[\p{L}\-_/])[\p{L}\d][\p{L}\d\-_/.]*[\p{L}\d](?![\p{L}\d])|(?<![\d,.])\d{5,}(?![\d,]|\.\d)/gu, (m, off, str) => {
    if (/^\d+(mm|cm|m|kg|w|v|watt)$/i.test(m) || /^\d+[xχ×]\d+/i.test(m)) return m; // διαστάσεις/μονάδες: κανονικά
    const said = /κωδικ\p{L}*\s*:?\s*$/iu.test(str.slice(Math.max(0, off - 14), off)); // ήδη γράφει «κωδικός»
    return (said ? ' … ' : ' … κωδικός ') + sayCode(m) + ' … ';
  });
  return s.replace(/\s*¶\s*/g, ' … ').replace(/\s+/g, ' ').trim();
}
// Το κείμενο σπάει σε κομμάτια ώστε η ανάγνωση να ξεκινά γρήγορα
function ttsChunks(t) {
  const parts = ttsPrepare(t).match(/[^.!;…]+[.!;…]*/g) || []; const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 400 && cur) { out.push(cur.trim()); cur = ''; } cur += p; }
  if (cur.trim()) out.push(cur.trim()); return out.slice(0, 8);
}
async function elFetch(text, prev, next) { const r = await SB.fn('tts', { text, speed: TTS.speed, previous_text: prev || '', next_text: next || '' }, { raw: true }); return URL.createObjectURL(await r.blob()); }
ttsSpeak = async function (text) {
  ttsStop(); const my = VOICE.seq;
  if (!VOICE.elOk) return deviceSpeak(text);
  const chunks = ttsChunks(text); if (!chunks.length) return;
  try {
    let next = elFetch(chunks[0], '', chunks[1]);
    for (let i = 0; i < chunks.length; i++) {
      const url = await next; if (my !== VOICE.seq) { URL.revokeObjectURL(url); return; }
      if (i + 1 < chunks.length) next = elFetch(chunks[i + 1], chunks[i], chunks[i + 2]);
      VOICE.url = url; VOICE.audio = new Audio(url);
      await new Promise((res, rej) => { VOICE.audio.onended = res; VOICE.audio.onerror = rej; VOICE.audio.play().catch(rej); });
      URL.revokeObjectURL(url); VOICE.url = null; if (my !== VOICE.seq) return;
    }
  } catch (e) {
    if (my !== VOICE.seq) return;
    if (e && e.status === 503) VOICE.elOk = false; // δεν έχει ρυθμιστεί → φωνή συσκευής
    else if (e && e.status && !VOICE.warned) { VOICE.warned = true; toast(e.message + ' — χρησιμοποιείται η φωνή της συσκευής.', true); }
    if (e && e.name === 'NotAllowedError') return toast('Πατήστε «Ακρόαση» για να ακούσετε την απάντηση.', true);
    deviceSpeak(text);
  }
};
ACT.ttsToggle = () => {
  TTS.on = !TTS.on; try { localStorage.setItem('mg-tts', TTS.on ? '1' : '0'); } catch (e) {}
  if (TTS.on) ttsSpeak('Η φωνή ενεργοποιήθηκε.'); else ttsStop();
  renderAi();
};
const _closeAi = ACT.closeAi; ACT.closeAi = () => { ttsStop(); micCancel(); _closeAi(); };

/* ---------- μικρόφωνο ---------- */
const MIC_OK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
function micBtnHtml(disabled) {
  if (!MIC_OK) return '';
  const st = VOICE.recording ? 'rec' : VOICE.busy ? 'busy' : '';
  const label = VOICE.recording ? 'Τέλος ηχογράφησης' : VOICE.busy ? 'Αναγνώριση…' : 'Μιλήστε';
  return `<button type="button" class="btn mic ${st}" data-act="mic" aria-label="${label}" title="${label}" ${disabled || VOICE.busy || AI.busy ? 'disabled' : ''}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${VOICE.recording ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>' : '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'}</svg></button>`;
}
function micCancel() { if (VOICE.rec && VOICE.recording) { VOICE.cancelled = true; try { VOICE.rec.stop(); } catch (e) {} } }
ACT.mic = async () => {
  if (VOICE.recording) { try { VOICE.rec.stop(); } catch (e) {} return; }
  ttsStop();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return toast('Δεν δόθηκε πρόσβαση στο μικρόφωνο. Επιτρέψτε το από τις ρυθμίσεις του browser.', true); }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  VOICE.rec = rec; VOICE.chunks = []; VOICE.recording = true; VOICE.cancelled = false; VOICE.t0 = Date.now();
  rec.ondataavailable = e => { if (e.data && e.data.size) VOICE.chunks.push(e.data); };
  const auto = setTimeout(() => { if (VOICE.recording) try { rec.stop(); } catch (e) {} }, 60000); // έως 1 λεπτό
  rec.onstop = async () => {
    clearTimeout(auto); stream.getTracks().forEach(t => t.stop()); VOICE.recording = false;
    if (VOICE.cancelled || Date.now() - VOICE.t0 < 600) { renderAi(); return; }
    const type = rec.mimeType || mime || 'audio/webm';
    const blob = new Blob(VOICE.chunks, { type }); const ext = /mp4/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
    VOICE.busy = true; renderAi();
    try {
      const fd = new FormData(); fd.append('file', blob, 'speech.' + ext);
      const r = await SB.fn('stt', fd); const text = (r.text || '').trim();
      VOICE.busy = false;
      if (!text) { renderAi(); return toast('Δεν ακούστηκε κάτι. Δοκιμάστε ξανά.', true); }
      if (!TTS.on) { TTS.on = true; try { localStorage.setItem('mg-tts', '1'); } catch (e) {} } // μιλήσατε → απαντά με φωνή
      aiSend(text);
    } catch (e) { VOICE.busy = false; renderAi(); toast(e.message || 'Η αναγνώριση φωνής απέτυχε.', true); }
  };
  rec.start(); renderAi();
};

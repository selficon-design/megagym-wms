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
// Το κείμενο σπάει σε κομμάτια ώστε η ανάγνωση να ξεκινά γρήγορα
function ttsChunks(t) {
  const parts = ttsClean(t).match(/[^.!;\n]+[.!;]?/g) || []; const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 400 && cur) { out.push(cur.trim()); cur = ''; } cur += p; }
  if (cur.trim()) out.push(cur.trim()); return out.slice(0, 8);
}
async function elFetch(text) { const r = await SB.fn('tts', { text }, { raw: true }); return URL.createObjectURL(await r.blob()); }
ttsSpeak = async function (text) {
  ttsStop(); const my = VOICE.seq;
  if (!VOICE.elOk) return deviceSpeak(text);
  const chunks = ttsChunks(text); if (!chunks.length) return;
  try {
    let next = elFetch(chunks[0]);
    for (let i = 0; i < chunks.length; i++) {
      const url = await next; if (my !== VOICE.seq) { URL.revokeObjectURL(url); return; }
      if (i + 1 < chunks.length) next = elFetch(chunks[i + 1]);
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

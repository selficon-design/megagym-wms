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
  try { if (VOICE.audio) { const a = VOICE.audio; a.pause(); VOICE.audio = null; if (a.onended) { const f = a.onended; a.onended = null; f(); } } } catch (e) {}
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
// Κωδικός για ομιλία: τα γράμματα ένα-ένα, οι αριθμοί ως αριθμοί (π.χ. MG-00125 → «M G 125», AR111 → «A R 111»)
function sayCode(c) {
  return (String(c).match(/\p{L}+|\d+/gu) || []).map(g => /^\d+$/.test(g) ? String(parseInt(g, 10)) : g.toUpperCase().split('').join(' ')).join(', ');
}
// οι πραγματικοί κωδικοί του καταλόγου (οι μεγαλύτεροι πρώτοι, ώστε να μη «σπάνε» σε μικρότερους)
let _codeRe = null, _codeN = -1;
function codeRegex() {
  const codes = Object.values(S.prod || {}).map(p => String(p.code || '').trim()).filter(c => c.length >= 3 && c.length <= 16 && /\d/.test(c) && !/\s/.test(c) && !/^\d+(mm|cm|m|kg|w|v|watt)?$/i.test(c)); // σύντομοι, χωρίς κενά — όχι περιγραφές
  if (_codeRe && codes.length === _codeN) return _codeRe;
  _codeN = codes.length;
  const esc = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  _codeRe = codes.length ? new RegExp('(?<![\\p{L}\\d])(' + [...new Set(codes)].sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?![\\p{L}\\d])', 'giu') : null;
  return _codeRe;
}
function ttsPrepare(t) {
  let s = String(t || '');
  s = s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, '\n'); // κουκκίδες λίστας → νέα γραμμή (παύση)
  s = ttsClean(s.replace(/\n+/g, ' ¶ '));
  // παραστατικά: ΕΙΣ-00012 → «εισαγωγή 12» (χωρίς τα μηδενικά)
  const DOC = { ΕΙΣ: 'εισαγωγή', ΠΑΡ: 'παραλαβή', ΤΟΠ: 'τοποθέτηση', ΕΠΓ: 'επιστροφή από γυμναστήριο', ΕΠΑ: 'επιστροφή σε αποθήκη', ΜΑΓ: 'μεταφορά σε αποθήκη γυμναστηρίου', ΜΕΤ: 'μεταφορά', ΜΟΧ: 'μεταφορά οχήματος', ΜΓΥ: 'μεταφορά από γυμναστήριο', ΕΠΞ: 'επεξεργασία', ΜΡΤ: 'μεταφορά ρεταλιών', ΚΑΤ: 'αλλαγή κατάστασης', ΑΠΣ: 'απόσυρση', ΑΠΓ: 'απογραφή' };
  s = s.replace(/(?<!\p{L})(ΕΙΣ|ΠΑΡ|ΤΟΠ|ΕΠΓ|ΕΠΑ|ΜΑΓ|ΜΕΤ|ΜΟΧ|ΜΓΥ|ΕΠΞ|ΜΡΤ|ΚΑΤ|ΑΠΣ|ΑΠΓ)-0*(\d+)/gu, (m, k, n) => DOC[k] + ' ' + n);
  // ΜΟΝΟ οι κωδικοί του καταλόγου διαβάζονται ως κωδικοί· ονόματα (π.χ. AR111) και αριθμοί διαβάζονται φυσικά
  const re = codeRegex();
  if (re) s = s.replace(re, (m, _g, off, str) => {
    const said = /κωδικ\p{L}*\s*:?\s*$/iu.test(str.slice(Math.max(0, off - 14), off)); // ήδη γράφει «κωδικός»
    return (said ? ' ' : ' κωδικός ') + sayCode(m) + ' … ';
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
// Ακρόαση: μόλις ανοίξει, όλες οι απαντήσεις διαβάζονται μέχρι να πατηθεί «Κλείσιμο ακρόασης» (μένει αποθηκευμένη)
AI.listen = (() => { try { return localStorage.getItem('mg-listen') !== '0'; } catch (e) { return true; } })(); // ανοιχτή από προεπιλογή
function setListen(v) { AI.listen = v; try { localStorage.setItem('mg-listen', v ? '1' : '0'); } catch (e) {} }
function setPlaying(v) { if (VOICE.playing === v) return; VOICE.playing = v; const b = $('#aivoice'); if (b) b.innerHTML = voiceBarInner(); }
const lastAnswer = () => [...AI.items].reverse().find(x => x.k === 'a' && x.text);
function voiceBarInner() {
  const has = !!lastAnswer();
  return `<button type="button" class="vbtn ${AI.listen ? 'on' : ''}" data-act="ttsListenOn" aria-pressed="${AI.listen}">🔊 Ακρόαση</button>
    <button type="button" class="vbtn ${!AI.listen ? 'on' : ''}" data-act="ttsListenOff" aria-pressed="${!AI.listen}">🔇 Κλείσιμο ακρόασης</button>
    <button type="button" class="vbtn" data-act="ttsReplay" ${has ? '' : 'disabled'}>${VOICE.playing ? '⏹ Διακοπή' : '↻ Επανάληψη ακρόασης'}</button>`;
}
function voiceBarHtml() { return `<div class="aivoice" id="aivoice" role="group" aria-label="Ακρόαση απαντήσεων">${voiceBarInner()}</div>`; }
ACT.ttsListenOn = () => { setListen(true); const a = lastAnswer(); if (a && !VOICE.playing) ttsSpeak(a.text); else setPlaying(VOICE.playing); const b = $('#aivoice'); if (b) b.innerHTML = voiceBarInner(); };
ACT.ttsListenOff = () => { setListen(false); ttsStop(); const b = $('#aivoice'); if (b) b.innerHTML = voiceBarInner(); };
const _ttsStop = ttsStop; ttsStop = function () { _ttsStop(); setPlaying(false); };
ttsSpeak = async function (text) {
  ttsStop(); const my = VOICE.seq; setPlaying(true);
  try { await speakInner(text, my); } finally { if (my === VOICE.seq) setPlaying(false); }
};
// ---- iPhone/Safari: ήχος επιτρέπεται μόνο μετά από πάτημα. Ένα κοινό «κανάλι» ήχου ξεκλειδώνεται με το
// πρώτο πάτημα (σιωπή 0,1") και μετά χρησιμοποιείται για όλες τις απαντήσεις, χωρίς νέο πάτημα.
const SILENT_WAV = (() => { const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer); const w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let s = ''; b.forEach(x => s += String.fromCharCode(x)); return 'data:audio/wav;base64,' + btoa(s); })();
VOICE.el = new Audio(); VOICE.el.setAttribute('playsinline', ''); VOICE.el.preload = 'auto';
function unlockAudio() {
  if (VOICE.unlocked || VOICE.playing) return;
  const el = VOICE.el; el.muted = false; el.src = SILENT_WAV;
  const p = el.play(); if (p && p.then) p.then(() => { VOICE.unlocked = true; }).catch(() => {});
}
['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
function playUrl(url) {
  return new Promise((res, rej) => { const el = VOICE.el; el.onended = () => res(); el.onerror = () => rej(new Error('audio')); el.src = url; const p = el.play(); if (p && p.catch) p.catch(rej); });
}
async function speakInner(text, my) {
  if (!VOICE.elOk) return deviceSpeak(text);
  const chunks = ttsChunks(text); if (!chunks.length) return;
  try {
    let next = elFetch(chunks[0], '', chunks[1]);
    for (let i = 0; i < chunks.length; i++) {
      const url = await next; if (my !== VOICE.seq) { URL.revokeObjectURL(url); return; }
      if (i + 1 < chunks.length) next = elFetch(chunks[i + 1], chunks[i], chunks[i + 2]);
      VOICE.url = url; VOICE.audio = VOICE.el;
      await playUrl(url);
      URL.revokeObjectURL(url); VOICE.url = null; if (my !== VOICE.seq) return;
    }
  } catch (e) {
    if (my !== VOICE.seq) return;
    if (e && e.status === 503) VOICE.elOk = false; // δεν έχει ρυθμιστεί → φωνή συσκευής
    else if (e && e.status && !VOICE.warned) { VOICE.warned = true; toast(e.message + ' — χρησιμοποιείται η φωνή της συσκευής.', true); }
    if (e && e.name === 'NotAllowedError') { VOICE.unlocked = false; return toast('Ο ήχος μπλοκαρίστηκε από τη συσκευή. Πατήστε «Επανάληψη ακρόασης».', true); }
    deviceSpeak(text);
  }
}
// «Επανάληψη απάντησης» / «Διακοπή ανάγνωσης»: ένα κουμπί κάτω από την τελευταία απάντηση
ACT.ttsReplay = () => {
  if (VOICE.playing) { ttsStop(); return; }
  const last = lastAnswer(); if (last) ttsSpeak(last.text);
};
const _closeAi = ACT.closeAi; ACT.closeAi = () => { ttsStop(); micCancel(); _closeAi(); };

/* ---------- μικρόφωνο: ζωντανή καταγραφή ----------
   Πατάτε το μικρόφωνο → μιλάτε → τα λόγια γράφονται ζωντανά στο πεδίο (μπορείτε να τα διορθώσετε)
   → πατάτε το βελάκι → στέλνονται και η απάντηση διαβάζεται αυτόματα.
   Ζωντανά: ElevenLabs Scribe v2 Realtime (WebSocket, κλειδί μιας χρήσης από τον server).
   Αν η ζωντανή καταγραφή δεν είναι διαθέσιμη: ηχογράφηση και μετατροπή στο τέλος. */
const AC = window.AudioContext || window.webkitAudioContext;
const MIC_OK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (AC || window.MediaRecorder));
function micBtnHtml(disabled) {
  if (!MIC_OK) return '';
  const st = VOICE.recording ? 'rec' : VOICE.busy ? 'busy' : '';
  const label = VOICE.recording ? 'Τέλος ηχογράφησης' : VOICE.busy ? 'Αναγνώριση…' : 'Μιλήστε';
  return `<button type="button" class="btn mic ${st}" data-act="mic" aria-label="${label}" title="${label}" ${disabled || VOICE.busy || AI.busy ? 'disabled' : ''}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${VOICE.recording ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>' : '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'}</svg></button>`;
}
const joinTxt = (...a) => a.map(x => String(x || '').trim()).filter(Boolean).join(' ');
function liveShow() {
  const L = VOICE.live; if (!L) return;
  AI.draft = joinTxt(L.base, L.committed, L.partial);
  const t = $('#aiin'); if (t) { t.value = AI.draft; aiGrow(t); t.scrollTop = t.scrollHeight; }
}
function toPcm16B64(f32, inRate) {
  const ratio = inRate / 16000, n = Math.floor(f32.length / ratio), out = new Int16Array(n);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, f32[Math.floor(i * ratio)] || 0)); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
  const u8 = new Uint8Array(out.buffer); let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
function micCancel() { if (VOICE.recording) micStop(false, true); }
ACT.mic = () => { if (VOICE.recording) micStop(false); else micStart(); };
async function micStart() {
  ttsStop();
  const t = $('#aiin'); const base = t ? t.value : (AI.draft || '');
  // το AudioContext δημιουργείται μέσα στο πάτημα (απαραίτητο στο iPhone)
  let ctx = null; try { if (AC) { ctx = new AC(); ctx.resume && ctx.resume(); } } catch (e) { ctx = null; }
  const L = VOICE.live = { base, committed: '', partial: '', ctx, queue: [], ws: null, open: false, mode: ctx ? 'live' : 'batch', waiters: [] };
  VOICE.recording = true; VOICE.fromMic = true; renderAi();
  try { L.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { VOICE.recording = false; VOICE.live = null; try { ctx && ctx.close(); } catch (x) {} renderAi(); return toast('Δεν δόθηκε πρόσβαση στο μικρόφωνο. Επιτρέψτε το από τις ρυθμίσεις του browser.', true); }
  if (L !== VOICE.live) { L.stream.getTracks().forEach(x => x.stop()); return; }
  if (L.mode === 'live') {
    // ήχος → PCM 16kHz → WebSocket (μέχρι να ανοίξει, κρατιέται σε ουρά)
    L.src = ctx.createMediaStreamSource(L.stream); L.proc = ctx.createScriptProcessor(4096, 1, 1);
    L.proc.onaudioprocess = e => {
      const b64 = toPcm16B64(e.inputBuffer.getChannelData(0), ctx.sampleRate);
      const msg = JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: b64, commit: false, sample_rate: 16000 });
      if (L.open && L.ws && L.ws.readyState === 1) L.ws.send(msg); else if (L.queue.length < 400) L.queue.push(msg);
    };
    L.src.connect(L.proc); L.proc.connect(ctx.destination);
    try {
      const k = await SB.fn('stt', { action: 'token' });
      if (L !== VOICE.live) return;
      const q = new URLSearchParams({ model_id: 'scribe_v2_realtime', token: k.token, audio_format: 'pcm_16000', commit_strategy: 'vad', language_code: k.language || 'el' });
      const ws = L.ws = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime?' + q);
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        const ty = m.message_type;
        if (ty === 'session_started') { L.open = true; while (L.queue.length) ws.send(L.queue.shift()); }
        else if (ty === 'partial_transcript') { L.partial = m.text || ''; liveShow(); }
        else if (ty === 'committed_transcript' || ty === 'committed_transcript_with_timestamps') { L.committed = joinTxt(L.committed, m.text); L.partial = ''; liveShow(); L.waiters.splice(0).forEach(f => f()); }
        else if (m.error || /error|exceeded|limit|invalid/.test(ty || '')) { console.warn('stt', m); if (!L.open) liveFallback(L, m.error || ty); }
      };
      ws.onerror = () => { if (!L.open) liveFallback(L, 'σύνδεση'); };
      ws.onclose = () => { L.open = false; L.waiters.splice(0).forEach(f => f()); };
    } catch (e) { liveFallback(L, e.message); }
  }
  if (L.mode === 'batch') batchStart(L);
  L.timer = setTimeout(() => { if (VOICE.live === L) micStop(false); }, 120000); // έως 2 λεπτά
}
// εναλλακτικά: ηχογράφηση και μετατροπή στο τέλος (αν δεν γίνεται ζωντανά)
function liveFallback(L, why) {
  if (L.mode !== 'live' || VOICE.live !== L) return;
  console.warn('Ζωντανή καταγραφή μη διαθέσιμη:', why);
  L.mode = 'batch'; try { L.proc && L.proc.disconnect(); L.src && L.src.disconnect(); } catch (e) {}
  try { L.ws && L.ws.close(); } catch (e) {}
  toast('Μιλήστε· το κείμενο θα εμφανιστεί μόλις πατήσετε ξανά το μικρόφωνο.');
  batchStart(L);
}
function batchStart(L) {
  if (!window.MediaRecorder) return;
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  L.mime = mime; L.chunks = []; L.rec = new MediaRecorder(L.stream, mime ? { mimeType: mime } : undefined);
  L.rec.ondataavailable = e => { if (e.data && e.data.size) L.chunks.push(e.data); };
  L.rec.start(); L.t0 = Date.now();
}
async function micStop(sendAfter, cancel) {
  const L = VOICE.live; if (!L) return;
  clearTimeout(L.timer); VOICE.recording = false;
  try { L.proc && L.proc.disconnect(); L.src && L.src.disconnect(); } catch (e) {}
  if (L.mode === 'live' && !cancel) {
    // τελευταίο κομμάτι + «κλείσιμο» φράσης· περιμένουμε λίγο το τελικό κείμενο
    if (L.ws && L.ws.readyState === 1 && L.open) {
      VOICE.busy = true; renderAi(); liveShow();
      const done = new Promise(res => { L.waiters.push(res); setTimeout(res, 1800); });
      try { L.ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: toPcm16B64(new Float32Array(1600), 16000), commit: true, sample_rate: 16000 })); } catch (e) {}
      if (L.partial || !L.committed) await done;
      if (L.partial) { L.committed = joinTxt(L.committed, L.partial); L.partial = ''; }
    }
    try { L.ws && L.ws.close(); } catch (e) {}
  }
  if (L.mode === 'batch' && L.rec && !cancel) {
    const stopped = new Promise(res => { L.rec.onstop = res; }); try { L.rec.stop(); } catch (e) {}
    await stopped;
    if (Date.now() - L.t0 > 600 && L.chunks.length) {
      VOICE.busy = true; renderAi();
      try {
        const type = L.rec.mimeType || L.mime || 'audio/webm'; const ext = /mp4/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
        const fd = new FormData(); fd.append('file', new Blob(L.chunks, { type }), 'speech.' + ext);
        const r = await SB.fn('stt', fd); L.committed = joinTxt(L.committed, r.text);
      } catch (e) { toast(e.message || 'Η αναγνώριση φωνής απέτυχε.', true); }
    }
  }
  try { L.stream && L.stream.getTracks().forEach(x => x.stop()); } catch (e) {}
  try { L.ctx && L.ctx.close(); } catch (e) {}
  VOICE.busy = false; VOICE.live = null;
  if (cancel) { VOICE.fromMic = false; renderAi(); return; }
  AI.draft = joinTxt(L.base, L.committed);
  if (!L.committed && !sendAfter) { renderAi(); toast('Δεν ακούστηκε κάτι. Δοκιμάστε ξανά.', true); return; }
  if (sendAfter) { const txt = AI.draft; AI.draft = ''; aiSend(txt); }
  else { renderAi(); const t = $('#aiin'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
}

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
// Ταχύτητα = συνολικός ρυθμός (1 = κανονικός της φωνής). Το ElevenLabs δέχεται 0,7–1,2· για πιο αργά,
// ο ήχος παίζει και πιο αργά στη συσκευή (χωρίς αλλαγή χροιάς).
const SPEEDS = [[0.5, 'Πολύ αργά'], [0.6, 'Αργά'], [0.75, 'Κανονικά'], [0.95, 'Γρήγορα']];
TTS.speed = (() => { try { const v = parseFloat(localStorage.getItem('mg-tts-speed3')); return v >= 0.5 && v <= 1.2 ? v : 0.6; } catch (e) { return 0.6; } })();
function setTtsSpeed(v) { TTS.speed = Math.min(1.2, Math.max(0.45, v)); try { localStorage.setItem('mg-tts-speed3', String(TTS.speed)); } catch (e) {} if (AI.open) { const b = $('[data-act=ttsSpeed]'); if (b) b.textContent = 'Ταχύτητα: ' + speedLabel(); } return TTS.speed; }
const apiSpeed = e => Math.min(1.2, Math.max(0.7, e));            // ό,τι στέλνεται στο ElevenLabs
const playRate = e => Math.max(0.7, Math.min(1, e / apiSpeed(e))); // επιπλέον επιβράδυνση στη συσκευή
const speedLabel = () => (SPEEDS.reduce((b, s) => Math.abs(s[0] - TTS.speed) < Math.abs(b[0] - TTS.speed) ? s : b))[1];
ACT.ttsSpeed = () => { const i = SPEEDS.findIndex(s => Math.abs(s[0] - TTS.speed) < 0.03); const n = SPEEDS[(i + 1) % SPEEDS.length]; setTtsSpeed(n[0]); applyRateNow(); };
// η ανάγνωση που ήδη παίζει συνεχίζει από το ίδιο σημείο με τη νέα ταχύτητα
function applyRateNow() { const el = VOICE.el, c = VOICE.cur; if (!el || !c || !VOICE.playing) return; const r = rateFor(c); el.playbackRate = r; el.defaultPlaybackRate = r; }
const effFor = slow => slow ? Math.max(0.45, (TTS.speed || 0.6) * 0.85) : (TTS.speed || 0.6); // νούμερα/κωδικοί: 15% πιο αργά
// ρυθμός αναπαραγωγής = επιθυμητή ταχύτητα / ταχύτητα με την οποία έφτιαξε τον ήχο το ElevenLabs
const rateFor = c => Math.max(0.5, Math.min(2, effFor(c.slow) / (c.api || 1)));
// Κείμενο για ομιλία: οι κωδικοί διαβάζονται χαρακτήρα-χαρακτήρα με παύσεις, οι λίστες με παύση ανάμεσα
// Κωδικός για ομιλία: τα γράμματα ένα-ένα, οι αριθμοί ως αριθμοί (π.χ. MG-00125 → «M G 125», AR111 → «A R 111»)
// ελληνική προφορά λατινικών γραμμάτων (η ελληνική φωνή δεν ξέρει να τα λέει μεμονωμένα, π.χ. «W»)
const LAT = { A: 'έι', B: 'μπι', C: 'σι', D: 'ντι', E: 'ι', F: 'εφ', G: 'τζι', H: 'έιτς', I: 'άι', J: 'τζέι', K: 'κέι', L: 'ελ', M: 'εμ', N: 'εν', O: 'όου', P: 'πι', Q: 'κιου', R: 'αρ', S: 'ες', T: 'τι', U: 'γιου', V: 'βι', W: 'ντάμπλ γιου', X: 'εξ', Y: 'γουάι', Z: 'ζεντ' };
const sayLetter = ch => LAT[ch.toUpperCase()] || ch;
// λέξεις με συγκεκριμένη προφορά
const SAYW = { degree: 'μοίρες', degrees: 'μοίρες', deg: 'μοίρες', watt: 'βατ', watts: 'βατ', led: 'λεντ', inox: 'ινόξ', par: 'παρ', rgb: 'αρ τζι μπι', rgbw: 'αρ τζι μπι ντάμπλ γιου', dkp: 'ντι κέι πι', usb: 'γιου ες μπι', wifi: 'γουάι φάι', 'wi-fi': 'γουάι φάι', tv: 'τι βι', mm: 'χιλιοστά', cm: 'εκατοστά', kg: 'κιλά', kw: 'κιλοβάτ', v: 'βολτ', ac: 'έι σι', dc: 'ντι σι', ok: 'οκέι', spot: 'σποτ', track: 'τρακ', strip: 'στριπ', tubes: 'τιουμπς', tube: 'τιουμπ', super: 'σούπερ', mirror: 'μίρορ', external: 'εξτέρναλ', outdoor: 'άουτντορ', indoor: 'ίντορ' };
function sayCode(c) {
  return (String(c).match(/\p{L}+|\d+/gu) || []).map(g => /^\d+$/.test(g) ? String(parseInt(g, 10)) : g.toUpperCase().split('').map(sayLetter).join(', ')).join(', ');
}
function sayLatin(s) {
  // αριθμός + W / kW / V / mm κ.λπ. (π.χ. 200W → 200 βατ)
  s = s.replace(/(\d)\s*(w|kw|v|mm|cm|kg)(?![\p{L}\d])/giu, (m, d, u) => d + ' ' + ({ w: 'βατ', kw: 'κιλοβάτ', v: 'βολτ', mm: 'χιλιοστά', cm: 'εκατοστά', kg: 'κιλά' })[u.toLowerCase()]);
  return s.replace(/(?<![\p{L}\d])[A-Za-z][A-Za-z-]*(?![\p{L}\d])/g, w => {
    const k = w.toLowerCase(); if (SAYW[k]) return SAYW[k];
    if (w.length === 1) return sayLetter(w);                                                    // μεμονωμένο γράμμα
    if (w.length <= 5 && w === w.toUpperCase() && !/[AEIOUY]/.test(w.replace(/^[A-Z]/, ''))) return w.split('').map(sayLetter).join(' '); // συντομογραφία χωρίς φωνήεντα (π.χ. DMX)
    return w;                                                                                    // κανονική λέξη: τη λέει η φωνή
  });
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
  s = s.replace(/^\s*(\d+)[.)]\s+/gm, '\n$1, '); // αριθμημένη λίστα: «1. Λάμπα» → «1, Λάμπα» (ο αριθμός διαβάζεται)
  s = s.replace(/^\s*[-•*]\s+/gm, '\n'); // κουκκίδες → νέα γραμμή (παύση)
  s = s.replace(/(\d)\s*[xX×χΧ]\s*(?=\d)/g, '$1 επί '); // διαστάσεις: 1250X2500 → «1250 επί 2500»
  s = s.replace(/(\d)\s*°\s*C\b/g, '$1 βαθμούς Κελσίου').replace(/(\d)\s*°/g, '$1 μοίρες').replace(/°/g, ' μοίρες '); // 45° → 45 μοίρες
  s = s.replace(/(\d)\s*(degrees?|deg|kw|w|v|mm|cm|kg)(?![\p{L}\d])/giu, (m, d, u) => d + ' ' + ({ degree: 'μοίρες', degrees: 'μοίρες', deg: 'μοίρες', kw: 'κιλοβάτ', w: 'βατ', v: 'βολτ', mm: 'χιλιοστά', cm: 'εκατοστά', kg: 'κιλά' })[u.toLowerCase()]);
  s = s.replace(/\s*(?:›|»|→|\||–|—|\s-\s|\s\/\s)\s*/g, ' ⁞ '); // διαχωριστικά (Είδος › Κατηγορία › Τύπος) → παύση
  s = ttsClean(s.replace(/\n+/g, ' ¶ '));
  // παραστατικά: ΕΙΣ-00012 → «εισαγωγή 12» (χωρίς τα μηδενικά)
  const DOC = { ΕΙΣ: 'εισαγωγή', ΠΑΡ: 'παραλαβή', ΤΟΠ: 'τοποθέτηση', ΕΠΓ: 'επιστροφή από γυμναστήριο', ΕΠΑ: 'επιστροφή σε αποθήκη', ΜΑΓ: 'μεταφορά σε αποθήκη γυμναστηρίου', ΜΕΤ: 'μεταφορά', ΜΟΧ: 'μεταφορά οχήματος', ΜΓΥ: 'μεταφορά από γυμναστήριο', ΕΠΞ: 'επεξεργασία', ΜΡΤ: 'μεταφορά ρεταλιών', ΚΑΤ: 'αλλαγή κατάστασης', ΑΠΣ: 'απόσυρση', ΑΠΓ: 'απογραφή' };
  s = s.replace(/(?<!\p{L})(ΕΙΣ|ΠΑΡ|ΤΟΠ|ΕΠΓ|ΕΠΑ|ΜΑΓ|ΜΕΤ|ΜΟΧ|ΜΓΥ|ΕΠΞ|ΜΡΤ|ΚΑΤ|ΑΠΣ|ΑΠΓ)-0*(\d+)/gu, (m, k, n) => DOC[k] + ' ' + n);
  // ΜΟΝΟ οι κωδικοί του καταλόγου διαβάζονται ως κωδικοί· ονόματα (π.χ. AR111) και αριθμοί διαβάζονται φυσικά
  const re = codeRegex();
  if (re) s = s.replace(re, (m, _g, off, str) => {
    const said = /κωδικ\p{L}*\s*:?\s*$/iu.test(str.slice(Math.max(0, off - 14), off)); // ήδη γράφει «κωδικός»
    return (said ? ' ⟦' : ' κωδικός ⟦') + sayCode(m) + '⟧ ⏸ ';
  });
  // αριθμοί (και σειρές αριθμών «1, 2, 3») → αργό τμήμα, μαζί με τη μονάδα που ακολουθεί
  s = s.replace(/(?<![\p{L}\d⟦.,])(\d+(?:[.,]\d+)*(?:[xXχΧ×]\d+(?:[.,]\d+)*)*(?:\s*(?:,|και|-|έως|ως|μέχρι)\s*\d+(?:[.,]\d+)*)*)(\s*(?:τεμάχια|τεμάχιο|φύλλα|φύλλο|μέτρα|μέτρο|τετραγωνικά μέτρα|κιλά|μοίρες|βαθμούς Κελσίου|βατ|βολτ|κιλοβάτ|χιλιοστά|εκατοστά|mm|cm|watt|W)(?![\p{L}\d]))?(?![^⟦]*⟧)/gu,
    (m, n, u) => /\d[^\d]+\d/.test(n.replace(/[.,]\d/g, '')) && /(,|και|-|έως|ως|μέχρι)/.test(n)
      ? ' ⟦' + n + (u || '') + '⟧ '            // σειρά αριθμών → αργό τμήμα
      : ' ˙ ' + n + (u || '') + (u ? ' ' : ' ˙ '));   // μεμονωμένος αριθμός → παύση πριν· «25 μοίρες» μαζί
  s = sayLatin(s);
  return s.replace(/\s*¶\s*/g, ' ⏸ ').replace(/…/g, ' ⏸ ').replace(/(\s*⏸\s*)+/g, ' ⏸ ').replace(/\s+/g, ' ').replace(/^\s*⏸\s*|\s*⏸\s*$/g, '').trim();
}
// Το κείμενο σπάει σε κομμάτια ώστε η ανάγνωση να ξεκινά γρήγορα
function ttsChunks(t) {
  const parts = ttsPrepare(t).match(/[^.!;⏸]+[.!;⏸]*/g) || []; const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 400 && cur) { out.push(cur.trim()); cur = ''; } cur += p; }
  if (cur.trim()) out.push(cur.trim());
  return out.map(c => c.replace(/^[\s⏸.,;]+/, '').trim()).filter(Boolean).slice(0, 8);
}
// για ElevenLabs: πραγματικές παύσεις· στα αριθμητικά τμήματα παύση και ανάμεσα στους αριθμούς
const elText = (c, slow) => { let t = c.replace(/⟦([^⟧]*)⟧/g, (m, x) => ' <break time="0.25s" /> ' + x.replace(/\s*,\s*/g, ' <break time="0.6s" /> ') + ' <break time="0.25s" /> '); // νούμερα/γράμματα κωδικών: παύση ανάμεσα
  t = t.replace(/\s*⏸\s*/g, ' <break time="0.8s" /> ').replace(/\s*⁞\s*/g, ' <break time="0.6s" /> ').replace(/\s*˙\s*/g, ' <break time="0.25s" /> ');
  if (slow) t = t.replace(/\s*,\s*/g, ' <break time="0.6s" /> ');
  t = t.replace(/(?:\s*<break time="([\d.]+)s" \/>\s*){2,}/g, m => { const v = Math.max(...[...m.matchAll(/([\d.]+)s/g)].map(x => +x[1])); return ' <break time="' + v + 's" /> '; });
  return t.replace(/^\s*<break[^>]*>\s*|\s*<break[^>]*>\s*$/g, '').replace(/\s+([.,;:!?)])/g, '$1').trim(); };
// ένα κομμάτι → τμήματα: { text, slow } — τα ⟦…⟧ (νούμερα, κωδικοί) διαβάζονται πιο αργά
function segments(chunk) {
  // ΣΤΑΘΕΡΗ ταχύτητα: όλο το κομμάτι σε μία αίτηση (τα ⟦…⟧ μένουν για τις παύσεις στο elText)
  if (!/[\p{L}\d]/u.test(chunk.replace(/[⟦⟧⏸⁞˙]/g, ''))) return [];
  return [{ text: chunk.trim(), slow: false }];
}
function segmentsOld(chunk) {
  const out = []; chunk.split(/(⟦[^⟧]*⟧)/).forEach(p => {
    if (!p.trim()) return; const slow = p.startsWith('⟦'); const t = p.replace(/[⟦⟧]/g, '').trim(); if (!t) return;
    const last = out[out.length - 1];
    if (last && last.slow === slow) last.text += ' ' + t; else out.push({ text: t, slow });
  });
  // πολύ μικρά κανονικά κομμάτια ανάμεσα σε αργά (π.χ. «και») ενώνονται με το αργό, για λιγότερες διακοπές
  for (let i = out.length - 2; i > 0; i--) if (!out[i].slow && out[i - 1].slow && out[i + 1].slow && /^(,|και|ή|έως|ως|μέχρι|-)$/.test(out[i].text.trim())) { out[i - 1].text += ' ' + out[i].text + ' ' + out[i + 1].text; out.splice(i, 2); }
  return out.filter(x => /[\p{L}\d]/u.test(x.text));
}
async function elFetch(text, prev, next, slow, first) {
  const speed = apiSpeed(effFor(slow)); VOICE.apis = VOICE.apis || {}; VOICE.apis[text] = speed;
  const body = (first ? '<break time="0.35s" /> ' : '') + elText(text, slow); // σιωπή μόνο στην αρχή της ανάγνωσης (iPhone)
  const r = await SB.fn('tts', { text: body, speed, previous_text: String(prev || '').replace(/⏸/g, ','), next_text: String(next || '').replace(/⏸/g, ',') }, { raw: true }); return URL.createObjectURL(await r.blob()); }
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
function playUrl(url, rate) {
  return new Promise((res, rej) => { const el = VOICE.el; el.onended = () => res(); el.onerror = () => rej(new Error('audio'));
    el.preservesPitch = el.mozPreservesPitch = el.webkitPreservesPitch = true; // πιο αργά χωρίς «βαριά» φωνή
    const R = rate || 1; const fix = () => { if (Math.abs(el.playbackRate - R) > 0.01) el.playbackRate = R; el.defaultPlaybackRate = R; };
    el.onloadedmetadata = fix; el.oncanplay = fix; el.onplaying = fix;
    el.defaultPlaybackRate = R; el.src = url; el.defaultPlaybackRate = R; el.playbackRate = R;
    el.load && el.load(); fix();
    const p = el.play(); if (p && p.then) p.then(fix, rej); });
}
async function speakInner(text, my) {
  if (!VOICE.elOk) return deviceSpeak(text);
  const segs = ttsChunks(text).flatMap(segments).slice(0, 30); if (!segs.length) return;
  const plain = x => x ? x.text : '';
  const fetchSeg = i => elFetch(segs[i].text, plain(segs[i - 1]), plain(segs[i + 1]), segs[i].slow, i === 0);
  try {
    const pend = []; const ensure = k => { for (let j = 0; j <= k && j < segs.length; j++) if (!pend[j]) { pend[j] = fetchSeg(j); pend[j].catch(() => {}); } };
    ensure(2);
    for (let i = 0; i < segs.length; i++) {
      const url = await pend[i]; if (my !== VOICE.seq) { URL.revokeObjectURL(url); pend.slice(i + 1).forEach(p => p && p.then(u => URL.revokeObjectURL(u), () => {})); return; }
      ensure(i + 3);
      VOICE.url = url; VOICE.audio = VOICE.el;
      VOICE.cur = { slow: segs[i].slow, api: (VOICE.apis || {})[segs[i].text] || 1 };
      await playUrl(url, rateFor(VOICE.cur));
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
function micEdited(value) {
  const L = VOICE.live; if (!L) return;
  L.base = value; L.committed = '';
  if (L.partial) { L.skip = L.partial; L.partial = ''; } // η φράση που ήδη φαινόταν έχει ενσωματωθεί όπως τη διορθώσατε
}
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
// Λεξιλόγιο για την αναγνώριση: ονόματα αποθηκών, γυμναστηρίων, οχημάτων, ειδών/κατηγοριών/τύπων και προϊόντων
function sttKeyterms() {
  const out = new Set(); const add = v => { v = String(v || '').replace(/\s+/g, ' ').trim(); if (v.length >= 2 && v.length <= 30 && v.split(' ').length <= 4) out.add(v); };
  ['γράψε', 'γράψε μου', 'σβήσε', 'δείξε', 'δείξε μου', 'βρες', 'φέρε', 'ψάξε', 'πόσα', 'πόσες', 'πόσοι', 'καταχώρισε', 'μετάφερε', 'φόρτωσε', 'άνοιξε', 'σημείωσε', 'μοίρες'].forEach(add);
  [S.wh, S.gym, S.veh].forEach(m => Object.values(m || {}).forEach(x => { if (x.active !== false) add(x.name); }));
  Object.values(S.cat || {}).forEach(c => { add(c.name); (c.subs || []).forEach(sb => { add(sb.name); (sb.types || []).forEach(t => add(t.name)); }); });
  ['παραλαβή', 'εισαγωγή', 'τοποθέτηση', 'εγκατάσταση', 'αντικατάσταση', 'απόσυρση', 'επιστροφή', 'μεταφορά', 'απογραφή', 'ρετάλι', 'ρετάλια', 'λαμαρίνα', 'λαμαρίνες', 'αμάξι', 'απόθεμα', 'τεμάχια'].forEach(add);
  Object.values(S.prod || {}).filter(p => !p.deleted && p.active !== false).sort((a, b) => String(a.name).length - String(b.name).length).forEach(p => add(p.name));
  return [...out];
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
  if (ctx) { try { L.src = ctx.createMediaStreamSource(L.stream); L.an = ctx.createAnalyser(); L.an.fftSize = 512; L.src.connect(L.an); waveLoop(L); } catch (e) {} }
  if (L.mode === 'live') {
    // ήχος → PCM 16kHz → WebSocket (μέχρι να ανοίξει, κρατιέται σε ουρά)
    L.proc = ctx.createScriptProcessor(4096, 1, 1);
    L.proc.onaudioprocess = e => {
      const b64 = toPcm16B64(e.inputBuffer.getChannelData(0), ctx.sampleRate);
      const m = { message_type: 'input_audio_chunk', audio_base_64: b64, commit: false, sample_rate: 16000 };
      if (!L.ctxSent) { L.ctxSent = true; const prev = joinTxt(L.base) || ((AI.items.filter(x => x.k === 'u').pop() || {}).text || ''); if (prev) m.previous_text = prev.slice(-500); }
      const msg = JSON.stringify(m);
      if (L.open && L.ws && L.ws.readyState === 1) L.ws.send(msg); else if (L.queue.length < 400) L.queue.push(msg);
    };
    L.src.connect(L.proc); L.proc.connect(ctx.destination);
    connectLive(L, VOICE.sttVariant || 0);
  }
  if (L.mode === 'batch') batchStart(L);
  L.timer = setTimeout(() => { if (VOICE.live === L) micStop(false); }, 120000); // έως 2 λεπτά
}

// Ρυθμίσεις ζωντανής καταγραφής, από την πληρέστερη στην απλούστερη: αν το ElevenLabs δεν δεχτεί μία,
// δοκιμάζεται η επόμενη (με νέο κλειδί μιας χρήσης) — και μόνο στο τέλος ηχογράφηση/μετατροπή.
const STT_VARIANTS = [
  { en: true, kt: true },   // ελληνικά κυρίως + αγγλικά, με λεξιλόγιο καταλόγου
  { en: false, kt: true },  // μόνο ελληνικά, με λεξιλόγιο
  { en: false, kt: false }, // μόνο ελληνικά, χωρίς λεξιλόγιο
];
async function connectLive(L, vi) {
  if (L !== VOICE.live || L.mode !== 'live') return;
  let tried = false;
  const retryOrFallback = why => {
    if (tried || L !== VOICE.live || L.open) return; tried = true;
    if (vi + 1 < STT_VARIANTS.length) { VOICE.sttVariant = vi + 1; connectLive(L, vi + 1); } else liveFallback(L, why);
  };
  try {
    const k = await SB.fn('stt', { action: 'token' });
    if (L !== VOICE.live) return;
    const q = new URLSearchParams({ model_id: 'scribe_v2_realtime', token: k.token, audio_format: 'pcm_16000', commit_strategy: 'vad', language_code: k.language || 'el', no_verbatim: 'true' });
    const V = STT_VARIANTS[vi]; if (V.en) q.append('secondary_languages', 'en');
    // ονόματα του καταλόγου ως λεξιλόγιο (όσο χωρά στη διεύθυνση)
    const BASE = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime?'; let n = 0;
    if (V.kt) for (const t of sttKeyterms()) { if (n >= 100) break; const add = 10 + encodeURIComponent(t).length; if ((BASE + q).length + add > 4500) continue; q.append('keyterms', t); n++; }
    const ws = L.ws = new WebSocket(BASE + q);
      ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      const ty = m.message_type;
      if (ty === 'session_started') { L.open = true; while (L.queue.length) ws.send(L.queue.shift()); }
      else if (ty === 'partial_transcript' && !L.skip) { L.partial = m.text || ''; liveShow(); }
      else if (ty === 'committed_transcript' || ty === 'committed_transcript_with_timestamps') {
        if (L.skip) { // η φράση που διορθώσατε με το χέρι δεν ξαναγράφεται· κρατάμε μόνο όσα είπατε ΜΕΤΑ τη διόρθωση
          const rem = String(m.text || '').trim().split(/\s+/).slice(L.skip.trim().split(/\s+/).length).join(' ');
          L.skip = ''; L.partial = ''; if (rem) L.committed = joinTxt(L.committed, rem); }
        else { L.committed = joinTxt(L.committed, m.text); L.partial = ''; }
        liveShow(); L.waiters.splice(0).forEach(f => f()); }
      else if (ty === 'partial_transcript' && L.skip) { /* αγνοείται μέχρι να κλείσει η διορθωμένη φράση */ }
      else if (m.error || /error|exceeded|limit|invalid/.test(ty || '')) { console.warn('stt', m); if (!L.open) { try { ws.close(); } catch (e) {} retryOrFallback(m.error || ty); } }
    };
    ws.onerror = () => { if (!L.open) retryOrFallback('σύνδεση'); };
    ws.onclose = () => { L.open = false; L.waiters.splice(0).forEach(f => f()); };
  } catch (e) { liveFallback(L, e.message); }
}
// Κυματομορφή κάτω από το πεδίο: μπάρες που κυλούν προς τα αριστερά, με ύψος ανάλογο της έντασης
function waveLoop(L) {
  const buf = new Uint8Array(L.an.fftSize), hist = []; let last = 0;
  const tick = t => {
    if (VOICE.live !== L) return;
    requestAnimationFrame(tick);
    if (t - last < 45) return; last = t;                       // ~22 μπάρες το δευτερόλεπτο
    L.an.getByteTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    hist.push(Math.min(1, Math.sqrt(sum / buf.length) * 4.5));
    const c = document.getElementById('aiwave'); if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const bw = 3, gap = 2, n = Math.floor(w / (bw + gap)); while (hist.length > n) hist.shift();
    g.fillStyle = getComputedStyle(c).color;
    for (let i = 0; i < hist.length; i++) {
      const bh = Math.max(2, hist[i] * (h - 4)), x = w - (hist.length - i) * (bw + gap);
      g.globalAlpha = 0.35 + 0.65 * (i / hist.length); g.fillRect(x, (h - bh) / 2, bw, bh);
    }
    g.globalAlpha = 1;
  };
  requestAnimationFrame(tick);
}
// εναλλακτικά: ηχογράφηση και μετατροπή στο τέλος (αν δεν γίνεται ζωντανά)
function liveFallback(L, why) {
  if (L.mode !== 'live' || VOICE.live !== L) return;
  console.warn('Ζωντανή καταγραφή μη διαθέσιμη:', why);
  L.mode = 'batch'; try { L.proc && L.src && L.src.disconnect(L.proc); L.proc && L.proc.disconnect(); } catch (e) {}
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

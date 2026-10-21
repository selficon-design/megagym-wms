/* ================================================================
   ΠΥΡΗΝΑΣ: κατάσταση, βάση, δικαιώματα, ατομική εκτέλεση κινήσεων
   ================================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const K = ENG.K, DEF_SEC = ENG.DEF_SEC;
const nf = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 3 });
const fmtN = n => nf.format(n || 0);
const dtf = new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const tf = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' });
const fmtDT = ts => ts ? dtf.format(new Date(ts)) : '—';
const fmtD = ts => ts ? df.format(new Date(ts)) : '—';
const fmtT = ts => ts ? tf.format(new Date(ts)) : '—';
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');

const DEFAULT_UNITS = [
  { k: 'τεμ', n: 'Τεμάχια' }, { k: 'μ', n: 'Μέτρα' }, { k: 'μ²', n: 'Τετραγωνικά μέτρα' },
  { k: 'κιλά', n: 'Κιλά' }, { k: 'λίτρα', n: 'Λίτρα' }, { k: 'φύλλα', n: 'Φύλλα' },
];

const S = {
  ready: false, offline: false,
  company: {}, units: DEFAULT_UNITS, counters: {},
  wh: {}, gym: {}, veh: {}, cat: {}, prod: {}, bal: {}, pk: {}, pl: {}, rem: {}, sharedNotes: {}, privNotes: {},
  mov: [], movById: {}, movLimit: 300, notes: {}, inv: {}, roles: {}, members: {},
  me: { id: null, role: 'viewer', whs: [], isOwner: false, canWrite: true, name: '', avatar: '' },
  route: { v: 'dash', a: null }, form: null, dirty: false,
};
let db = null, userCap = null, sampleCap = null, dlCap = null;

/* ---------------- ονόματα & μορφοποίηση ---------------- */
const whName = id => (S.wh[id] && S.wh[id].name) || '—';
const vehName = id => (S.veh[id] && S.veh[id].name) || '—';
const gymName = id => (S.gym[id] && S.gym[id].name) || '—';
/* Χώροι αποθήκης (φυσικά τμήματα: Ισόγειο, Υπόγειο, Ράφι Α…). Προαιρετικοί· χωρίς χώρους
   χρησιμοποιείται ο «Γενικός χώρος». Η ταξινόμηση προϊόντων (είδος/κατηγορία/τύπος) είναι ανεξάρτητη. */
const GEN = { id: DEF_SEC, name: 'Γενικός χώρος' };
const hasSections = whId => ((S.wh[whId] && S.wh[whId].sections) || []).some(s => s.active !== false);
const sections = whId => { const l = ((S.wh[whId] && S.wh[whId].sections) || []).filter(s => s.active !== false); return l.length ? l : [GEN]; };
const genHasStock = whId => { for (const b of Object.values(S.bal)) for (const [k, v] of Object.entries(b.q || {})) if (v > 0 && k.startsWith(`W|${whId}|${DEF_SEC}|`)) return true; return false; };
// για αναζήτηση αποθέματος: οι χώροι + ο Γενικός χώρος αν έχει απόθεμα
const allSections = whId => hasSections(whId) ? (genHasStock(whId) ? [...sections(whId), GEN] : sections(whId)) : [GEN];
const secName = (whId, sec) => {
  if (!sec || sec === DEF_SEC) return GEN.name;
  const s = ((S.wh[whId] && S.wh[whId].sections) || []).find(x => x.id === sec);
  return s ? s.name : sec;
};
// για εμφάνιση σε γραμμές: κενό όταν η αποθήκη δεν έχει χώρους
const secLabel = (whId, sec) => (hasSections(whId) || (sec && sec !== DEF_SEC)) ? secName(whId, sec) : '';
// Είδος / Κατηγορία / Τύπος ως ξεχωριστές ετικέτες (διαφορετικό στυλ η καθεμία)
const catTags = p => { const x = S.prod[p]; if (!x) return ''; const a = catName(x.cat), b = subName(x.cat, x.sub), c = typeName(x.cat, x.sub, x.ptype);
  return `<span class="ctags">${a ? `<span class="ctag k1" title="Είδος">${esc(a)}</span>` : ''}${b ? `<span class="ctag k2" title="Κατηγορία">${esc(b)}</span>` : ''}${c ? `<span class="ctag k3" title="Τύπος">${esc(c)}</span>` : ''}</span>`; };
// επικεφαλίδα ομάδας: Είδος › Κατηγορία
const catGroup = p => { const x = S.prod[p]; if (!x) return ''; return [catName(x.cat) || 'Χωρίς είδος', subName(x.cat, x.sub)].filter(Boolean).join(' › '); };
const catLabel = p => { const x = S.prod[p]; return x ? [catName(x.cat), subName(x.cat, x.sub), typeName(x.cat, x.sub, x.ptype)].filter(Boolean).join(' / ') : ''; };
const prodName = p => (S.prod[p] && S.prod[p].name) || '(διαγραμμένο προϊόν)';
const prodCode = p => (S.prod[p] && S.prod[p].code) || '';
const unitOf = p => (S.prod[p] && S.prod[p].unit) || 'τεμ';
const qtyU = (n, p) => `${fmtN(n)} ${unitOf(p)}`;
const catName = id => (S.cat[id] && S.cat[id].name) || '';
const subName = (c, s) => { const x = ((S.cat[c] && S.cat[c].subs) || []).find(y => y.id === s); return x ? x.name : ''; };
const subOf = (c, s) => ((S.cat[c] && S.cat[c].subs) || []).find(y => y.id === s) || null;
const typeName = (c, s, t) => { if (!t) return ''; const x = ((subOf(c, s) || {}).types || []).find(y => y.id === t); return x ? x.name : ''; };
const locName = l => {
  if (!l) return '—';
  if (l.t === 'W') return whName(l.id) + (l.multi ? ' κ.ά.' : '');
  if (l.t === 'V') return vehName(l.id);
  if (l.t === 'G') return gymName(l.id);
  return l.name || '—';
};
const stTag = st => `<span class="tag ${st}">${esc(ENG.ST[st])}</span>`;
const pkLabel = pkId => { if (pkId === 'ADJ') return 'Διόρθωση απογραφής'; if (pkId && pkId.startsWith('OLD')) { const pl = S.pl[pkId.slice(5)]; return `Παλιά ${({ C: 'προς έλεγχο', D: 'κατεστραμμένα', U: 'μεταχειρισμένα' })[pkId[3]] || ''}${pl ? ' · ' + pl.docNo : ''}`; } return (S.pk[pkId] && S.pk[pkId].docNo) || 'ΠΑΡ-?'; };
function sumByUnit(entries) { // [{p,q}] -> "120 τεμ · 30 μ"
  const m = {};
  for (const { p, q } of entries) if (q) { const u = unitOf(p); m[u] = (m[u] || 0) + q; }
  const ks = Object.keys(m);
  if (!ks.length) return '0';
  return ks.map(u => `${fmtN(m[u])} ${esc(u)}`).join(' · ');
}

/* ---------------- χρήστες ---------------- */
const NAMES = {}; let namesPending = new Set(); let namesTimer = null;
function uname(id) {
  if (!id) return '—';
  if (NAMES[id] !== undefined) return NAMES[id] || 'Χρήστης';
  namesPending.add(id);
  if (!namesTimer) namesTimer = setTimeout(async () => {
    const ids = [...namesPending]; namesPending = new Set(); namesTimer = null;
    ids.forEach(i => NAMES[i] = NAMES[i] ?? '');
    if (!userCap) return;
    try { const ps = await userCap.profiles(ids); for (const i of ids) NAMES[i] = (ps[i] && ps[i].name) || ''; scheduleRender(); } catch (e) {}
  }, 30);
  return '…';
}

/* ---------------- δικαιώματα ---------------- */
const ROLE_LABEL = { admin: 'Administrator', manager: 'Warehouse Manager', employee: 'Warehouse Employee', viewer: 'Viewer' };
const PERMS = {
  admin: ['*'],
  manager: ['move', 'transfer', 'status', 'retire', 'inv_edit', 'inv_apply', 'return_other', 'product', 'catalog', 'setup', 'notes', 'notes_admin'],
  employee: ['move', 'inv_edit', 'product_create', 'notes'],
  viewer: [],
};
function can(action, wh) {
  if (!S.me.id || !S.me.canWrite) return false;
  const r = S.me.role; const ps = PERMS[r] || [];
  const ok = ps.includes('*') || ps.includes(action) || (action === 'product_create' && ps.includes('product'));
  if (!ok) return false;
  if (wh && r !== 'admin' && S.me.whs && S.me.whs.length && !S.me.whs.includes(wh)) return false;
  return true;
}
function opPermError(op) {
  const deny = 'Δεν έχετε δικαίωμα για αυτή την ενέργεια.';
  const denyWh = w => `Δεν έχετε δικαίωμα κινήσεων στην αποθήκη «${whName(w)}».`;
  if (!S.me.id) return 'Συνδεθείτε για να καταχωρίσετε κινήσεις.';
  switch (op.type) {
    case 'INSTALL': { if (!can('move')) return deny; if (!can('move', op.wh)) return denyWh(op.wh); for (const l of op.lines || []) if (l.oldDest && l.oldDest.t === 'W' && !can('move', l.oldDest.wh)) return denyWh(l.oldDest.wh); return null; }
    case 'IMP': case 'LOAD': return can('move') ? (can('move', op.wh) ? null : denyWh(op.wh)) : deny;
    case 'TOGWH': return can('move') ? (can('move', op.wh) ? null : denyWh(op.wh)) : deny;
    case 'SUPPLY': case 'PLACE': { if (!can('move')) return deny; for (const d of [op.oldDest, ...(op.lines || []).map(l => l.oldDest)]) if (d && d.t === 'W' && !can('move', d.wh)) return denyWh(d.wh); return null; }
    case 'UNPLACE': case 'VMOVE': case 'REM_MOVE': return can('move') ? null : deny;
    case 'PROCESS': { if (!can('move')) return deny; if (op.src && op.src.t === 'W' && !can('move', op.src.wh)) return denyWh(op.src.wh); for (const o of op.out || []) if (o.loc && o.loc.t === 'W' && !can('move', o.loc.wh)) return denyWh(o.loc.wh); return null; }
    case 'REM_RETIRE': return can('retire') ? null : deny;
    case 'GYM_MOVE': return !can('move') ? deny : (op.to && op.to.t === 'W' && !can('move', op.to.wh) ? denyWh(op.to.wh) : null);
    case 'RETURN': {
      if (!can('move')) return deny;
      for (const l of op.lines) {
        const pk = S.pk[l.pk]; const orig = pk ? pk.wh : null;
        const origSec = pk && pk.lines[l.li] ? pk.lines[l.li].sec : null;
        if (orig !== l.wh && !can('return_other')) return 'Η επιστροφή σε διαφορετική αποθήκη από την αρχική απαιτεί δικαίωμα Warehouse Manager.';
        if (!can('move', l.wh)) return denyWh(l.wh);
      }
      return null;
    }
    case 'TRANSFER': return !can('transfer') ? deny : (!can('transfer', op.wh) ? denyWh(op.wh) : (!can('transfer', op.toWh) ? denyWh(op.toWh) : null));
    case 'STATUS': return can('status', op.wh) ? null : deny;
    case 'RETIRE': return can('retire', op.wh) ? null : deny;
    case 'RETIRE_G': case 'RETIRE_V': return can('retire') ? null : deny;
    case 'INV': return can('inv_apply', op.inv && op.inv.scope.t === 'W' ? op.inv.scope.id : null) ? null : 'Η ολοκλήρωση απογραφής απαιτεί δικαίωμα Warehouse Manager.';
  }
  return deny;
}

/* ---------------- ctx για τον μηχανισμό ---------------- */
function baseCtx() {
  return { wh: S.wh, gym: S.gym, veh: S.veh, prod: S.prod, user: S.me.id, now: Date.now() };
}
function dryRun(op) { // προεπισκόπηση με τα τρέχοντα δεδομένα
  const ctx = Object.assign(baseCtx(), { bal: S.bal, pk: S.pk, pl: S.pl, rem: S.rem, counters: S.counters });
  return ENG.plan(op, ctx);
}

/* ---------------- εκτέλεση κίνησης στον server ----------------
   Η κίνηση στέλνεται στη function «execute»: εκεί γίνεται σε μία συναλλαγή
   με κλείδωμα, έλεγχο δικαιωμάτων και υπολοίπων. Ή γράφεται ολόκληρη ή καθόλου. */
async function execute(op) {
  const perr = opPermError(op); if (perr) throw new ENG.StockError(perr);
  if (!db) throw new ENG.StockError('Η βάση δεδομένων δεν είναι διαθέσιμη.');
  setBusy('Καταχώριση…');
  try {
    let r;
    try { r = await SB.fn('execute', { op }); }
    catch (e) { if (e.status === 401) throw new ENG.StockError('Η σύνδεση έληξε. Συνδεθείτε ξανά.'); throw new ENG.StockError(e.message || 'Η καταχώριση απέτυχε.'); }
    return r.mov;
  } finally { setBusy(null); }
}

/* ---------------- απλές εγγραφές (κύρια δεδομένα) ---------------- */
const notePath = id => (S.notes[id] && S.notes[id]._p) || `data/users/${S.me.id}/${id}`;
async function saveDoc(path, data) {
  if (!db) throw new Error('Η βάση δεν είναι διαθέσιμη.');
  try { await db.doc(path).set(data); }
  catch (e) {
    
    if (e && e.code === 'quota_exceeded') throw new Error('Η βάση έφτασε το όριο χωρητικότητας.');
    throw new Error((e && e.message) || 'Η αποθήκευση απέτυχε.');
  }
}

/* ---------------- φωτογραφίες ---------------- */
const PH = {};
function photo(pid) {
  const pr = S.prod[pid]; if (!pr || !pr.photo || !db) return Promise.resolve(null);
  const key = pid + ':' + pr.photo;
  if (!PH[key]) PH[key] = db.doc('photos/' + pid).get().then(s => (s.exists ? s.data().d : null)).catch(() => null);
  return PH[key];
}
function fillPhotos(root = document) {
  $$('[data-ph]', root).forEach(el => {
    const pid = el.dataset.ph; if (el.dataset.done === pid) return; el.dataset.done = pid;
    photo(pid).then(d => { if (d && el.isConnected) el.innerHTML = `<img alt="" src="${d}">`; });
  });
}
const thumb = (pid, cls = 'thumb') => `<div class="${cls}" data-ph="${esc(pid)}">${S.prod[pid] && S.prod[pid].photo ? '' : 'ΧΩΡΙΣ<br>ΦΩΤΟ'}</div>`;
function resizeImage(file, max = 480) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => rej(new Error('Η εικόνα δεν διαβάζεται.'));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error('Η εικόνα δεν διαβάζεται.'));
    fr.readAsDataURL(file);
  });
}

/* ---------------- υπολογισμοί αποθέματος ---------------- */
function balQ(p) { return (S.bal[p] && S.bal[p].q) || {}; }
function whN(p, w) { let n = 0; for (const [k, v] of Object.entries(balQ(p))) if (k.startsWith('W|' + w + '|') && k.endsWith('|N')) n += v; return n; }
function whAvail(p, wh, sec, st = 'N') { return balQ(p)[K.W(wh, sec, st)] || 0; }
function prodTotals(p) {
  const t = { WN: 0, WU: 0, WD: 0, WC: 0, V: 0, VN: 0, VO: 0, G: 0 };
  for (const [k, v] of Object.entries(balQ(p))) {
    const x = k.split('|');
    if (x[0] === 'W') t['W' + x[3]] += v; else t[x[0]] += v;
    if (x[0] === 'V') { if (String(x[2]).startsWith('OLD')) t.VO += v; else t.VN += v; }
  }
  t.W = t.WN + t.WU + t.WD + t.WC; t.all = t.W + t.V + t.G;
  t.avail = t.WN + t.VN;               // ΔΙΑΘΕΣΙΜΑ ΠΡΟΣ ΧΡΗΣΗ: κανονικά σε αποθήκες + καινούργια στα οχήματα
  t.old = t.WU + t.WD + t.WC + t.VO;   // παλιά / μεταχειρισμένα / κατεστραμμένα / προς έλεγχο — όχι προς χρήση
  return t;
}
function vehLots(vehId) { // [{p,pk,li,qty,wh,sec,pkNo}]
  const out = [];
  for (const [p, b] of Object.entries(S.bal)) {
    for (const [k, v] of Object.entries(b.q || {})) {
      if (!v || k[0] !== 'V') continue;
      const x = K.parse(k); if (x.a !== vehId) continue;
      if (x.b.startsWith('OLD')) { // παλιά τεμάχια από αντικατάσταση, επιστρέφουν
        const plId = x.b.slice(5); const pl = S.pl[plId]; const pll = pl && pl.lines[x.c]; const opk = pll && S.pk[pll.pk];
        out.push({ p, pk: x.b, li: Number(x.c), qty: v, old: x.b[3], plId, wh: opk ? opk.wh : null, sec: opk && opk.lines[pll.li] ? opk.lines[pll.li].sec : DEF_SEC, pkNo: 2e9 + ((pl && pl.no) || 0) });
        continue;
      }
      const pk = S.pk[x.b]; const line = pk && pk.lines[x.c];
      out.push({ p, pk: x.b, li: x.b === 'ADJ' ? x.c : Number(x.c), qty: v, wh: pk ? pk.wh : null, sec: line ? line.sec : DEF_SEC, pkNo: pk ? pk.no : 1e9 });
    }
  }
  return out.sort((a, b) => a.pkNo - b.pkNo || prodName(a.p).localeCompare(prodName(b.p), 'el'));
}
function pkRemaining(pkId) {
  const pk = S.pk[pkId]; const out = {};
  if (!pk) return out;
  pk.lines.forEach((l, i) => { out[i] = (balQ(l.p)[K.V(pk.veh, pkId, i)] || 0); });
  // σε άλλα οχήματα (σπάνιο)
  for (const [p, b] of Object.entries(S.bal)) for (const [k, v] of Object.entries(b.q || {})) {
    if (k[0] !== 'V') continue; const x = K.parse(k);
    if (x.b === pkId && x.a !== pk.veh) out[x.c] = (out[x.c] || 0) + v;
  }
  return out;
}
function pkStatus(pkId) {
  const pk = S.pk[pkId]; if (!pk) return { label: '—', cls: 'g', rem: 0 };
  const rem = Object.values(pkRemaining(pkId)).reduce((s, v) => s + v, 0);
  const tot = pk.lines.reduce((s, l) => s + l.qty, 0);
  if (rem <= 0) return { label: 'Ολοκληρωμένη', cls: 'g', rem };
  if (rem >= tot) return { label: 'Στο αμάξι', cls: 'y', rem };
  return { label: 'Μερικώς στο αμάξι', cls: 'C', rem };
}
function plInstalled(plId) {
  const pl = S.pl[plId]; const out = {};
  if (!pl) return out;
  pl.lines.forEach((l, i) => { out[i] = balQ(l.p)[K.G(pl.gym, plId, i)] || 0; });
  return out;
}
/* ---------- υλικά & ρετάλια ---------- */
const isMat = p => { const x = S.prod[p]; if (!x) return false; if (x.kind === 'mat') return true; if (x.kind === 'prod') return false; return !!(S.cat[x.cat] && S.cat[x.cat].mat); };
const remsWhere = (f = {}) => Object.entries(S.rem).filter(([, r]) => r.status === 'stock' && (!f.p || r.p === f.p) && (!f.t || r.loc.t === f.t) && (!f.wh || (r.loc.t === 'W' && r.loc.wh === f.wh)) && (!f.sec || r.loc.sec === f.sec) && (!f.veh || (r.loc.t === 'V' && r.loc.veh === f.veh)))
  .sort((a, b) => String(a[1].dims).localeCompare(String(b[1].dims), 'el', { numeric: true }));
const remLoc = r => r.loc.t === 'W' ? whName(r.loc.wh) + (secLabel(r.loc.wh, r.loc.sec) ? ' / ' + secLabel(r.loc.wh, r.loc.sec) : '') : 'Στο ' + vehName(r.loc.veh);
function gymInstLots(gym, p) { // εγκατεστημένα παρτίδες προϊόντος σε γυμναστήριο, παλαιότερη πρώτα
  return Object.keys(S.pl).filter(id => S.pl[id].gym === gym).sort((a, b) => S.pl[a].no - S.pl[b].no)
    .flatMap(id => S.pl[id].lines.map((l, i) => ({ pl: id, li: i, p: l.p, q: balQ(l.p)[K.G(gym, id, i)] || 0 }))).filter(x => x.p === p && x.q > 0);
}
function gymInstalled(gymId) { // {p: qty}
  const out = {};
  for (const [p, b] of Object.entries(S.bal)) for (const [k, v] of Object.entries(b.q || {})) {
    if (k[0] === 'G' && v && K.parse(k).a === gymId) out[p] = (out[p] || 0) + v;
  }
  return out;
}
const PURPOSE = { new: 'Νέα τοποθέτηση', repl: 'Αντικατάσταση', moved: 'Μεταφορά από άλλο γυμναστήριο' };
const purposeTag = p => p === 'moved' ? '<span class="tag U">Μεταφορά από άλλο γυμναστήριο</span>' : p === 'repl' ? '<span class="tag C">Αντικατάσταση</span>' : p === 'mixed' ? '<span class="tag C">Τοποθέτηση & αντικατάσταση</span>' : '<span class="tag N">Νέα τοποθέτηση</span>';
function purposeField(id, cur, reason) {
  return `<div class="f"><span class="lbl">Σκοπός (για όλα · αλλάζει ανά προϊόν στο επόμενο βήμα)</span><div class="chips" role="radiogroup" aria-label="Σκοπός τοποθέτησης">
    <button type="button" class="chip ${cur !== 'repl' ? 'on' : ''}" data-purpose="new" data-pf="${id}">Νέα τοποθέτηση</button>
    <button type="button" class="chip ${cur === 'repl' ? 'on' : ''}" data-purpose="repl" data-pf="${id}">Αντικατάσταση</button></div></div>
`;
}
// αντικαταστάσεις: [{gym, p, qty, ts, pl}] (καθαρή ποσότητα = τοποθετήθηκαν − επιστράφηκαν)
function replacementRows({ from, to, gym } = {}) {
  const out = [];
  for (const [id, pl] of Object.entries(S.pl)) {
    if (gym && pl.gym !== gym) continue;
    if (from && pl.ts < from) continue; if (to && pl.ts > to) continue;
    pl.lines.forEach(l => {
      const isRepl = l.purpose ? l.purpose === 'repl' : pl.purpose === 'repl'; if (!isRepl) return;
      const q = l.qty - (l.back || 0); const o = l.old || {};
      if (q > 0) out.push({ gym: pl.gym, p: l.p, qty: q, ts: pl.ts, pl: id, reason: l.problem || pl.reason || '', x: o.x || 0, u: o.u || 0, c: o.c || 0, d: o.d || 0 });
    });
  }
  return out;
}
const gymWarehouses = gymId => Object.entries(S.wh).filter(([, w]) => w.gym === gymId && w.active !== false).map(([id]) => id);
const activeList = (map, sortKey = 'name') => Object.entries(map).filter(([, x]) => x.active !== false).sort((a, b) => String(a[1][sortKey] || '').localeCompare(String(b[1][sortKey] || ''), 'el'));

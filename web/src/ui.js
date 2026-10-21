/* ================================================================
   UI: δρομολόγηση, μενού, modal, ειδοποιήσεις, εκκίνηση
   ================================================================ */
const VIEWS = {};   // name -> () => html
const AFTER = [];  // callbacks μετά το render
const ACT = {};    // data-act handlers
/* Τρόποι εργασίας: το μενού δείχνει μόνο ό,τι αφορά τον επιλεγμένο τρόπο.
   w = μέσω αποθήκης (αποθήκες, αμάξια, λίστες παραλαβής), s = κατευθείαν από προμηθευτή, p = επεξεργασίες υλικών, * = πάντα */
const MODES = [['w', 'Μέσω αποθήκης', 'Αποθήκες, αμάξια, λίστες παραλαβής'], ['s', 'Από προμηθευτή', 'Κατευθείαν στα γυμναστήρια'], ['p', 'Επεξεργασίες', 'Υλικά & ρετάλια'], ['a', 'Όλα', 'Ολόκληρο το μενού']];
const NAV = [
  ['Κύρια', [['dash', 'Πίνακας', '*'], ['repls', 'Αντικαταστάσεις', 'ws'], ['help', 'Οδηγός χρήσης', '*']]],
  ['Κινήσεις', [['imp', 'Εισαγωγή σε αποθήκη', 'wp'], ['load', 'Παραλαβή από αποθήκη', 'wp'], ['gymin', 'Εισαγωγή σε γυμναστήριο', 'w'], ['gymsup', 'Εισαγωγή από προμηθευτή', 's'], ['gymout', 'Μεταφορά από γυμναστήριο', 'ws'], ['ret', 'Επιστροφή', 'wp'], ['xfer', 'Μεταφορά μεταξύ αποθηκών', 'wp'], ['proc', 'Επεξεργασία υλικών', 'p'], ['status', 'Καταστάσεις & απόσυρση', 'wsp']]],
  ['Λίστες', [['pks', 'Λίστες παραλαβών', 'wp'], ['pls', 'Λίστες τοποθετήσεων', 'ws'], ['vehs', 'Τι υπάρχει στο αμάξι', 'wp']]],
  ['Απόθεμα', [['prods', 'Γενικός πίνακας προϊόντων', '*'], ['mats', 'Υλικά & ρετάλια', 'p'], ['whs', 'Αποθήκες', 'wp'], ['gyms', 'Γυμναστήρια', 'ws'], ['invs', 'Απογραφές', 'wp']]],
  ['Καταγραφή', [['hist', 'Ιστορικό κινήσεων', '*'], ['notes', 'Σημειωματάριο', '*'], ['reports', 'Αναφορές', '*']]],
  ['Ρυθμίσεις', [['setup', 'Εταιρεία & δομή', '*'], ['users', 'Χρήστες & δικαιώματα', '*']]],
];
let MODE = 'w'; try { const m = localStorage.getItem('mg-mode'); if (MODES.some(x => x[0] === m)) MODE = m; } catch (e) {}
const inMode = (m, mode = MODE) => mode === 'a' || m === '*' || m.includes(mode);
function setMode(m) { MODE = m; try { localStorage.setItem('mg-mode', m); } catch (e) {} renderNav(); if (S.route.v === 'dash') render(true); }
ACT.mode = el => setMode(el.dataset.m);
const NAV_PARENT = { prod: 'prods', pk: 'pks', pl: 'pls', veh: 'vehs', wh: 'whs', gym: 'gyms', inv: 'invs', vehact: 'gymin', place: 'gymin', retire: 'status', retireg: 'status', install: 'gymin', mov: 'hist' };

/* Ιστορικό πλοήγησης για το κουμπί «Πίσω»: κρατά οθόνη, φόρμα και θέση κύλισης */
const NAVHIST = [];
function pushHist() {
  const cur = S.route; if (!cur) return;
  NAVHIST.push({ route: { ...cur }, form: S.form, y: window.scrollY });
  if (NAVHIST.length > 60) NAVHIST.shift();
  updateBackBtn();
}
function updateBackBtn() { const b = $('#backbtn'); if (b) b.hidden = !NAVHIST.length; }
function goBack() {
  if ($('#modal').innerHTML) { closeModal(); return; }
  if (AI.open) { ACT.closeAi(); return; }
  const e = NAVHIST.pop(); updateBackBtn();
  if (!e) return;
  S.form = e.form; S.route = e.route; closeNav(); render();
  requestAnimationFrame(() => window.scrollTo(0, e.y || 0));
  try { localStorage.setItem('mg-route', JSON.stringify(S.route)); } catch (x) {}
}
function go(v, a = null, keepForm = false) {
  const same = S.route && S.route.v === v && S.route.a === a;
  if (!same) pushHist();
  if (!keepForm) S.form = null;
  S.route = { v, a };
  closeNav();
  render();
  window.scrollTo(0, 0);
  try { localStorage.setItem('mg-route', JSON.stringify(S.route)); } catch (e) {}
}

let rTimer = null;
function scheduleRender() {
  if (rTimer) return;
  rTimer = requestAnimationFrame(() => {
    rTimer = null;
    const ae = document.activeElement;
    const typing = ae && $('#main').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (typing) { S.dirty = true; return; }
    render(true);
  });
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty) { S.dirty = false; scheduleRender(); } }, 50));

function render(soft) {
  renderNav(); renderWho();
  const main = $('#main');
  if (!S.ready) { main.innerHTML = `<div class="boot">${esc(S.bootMsg || 'Φόρτωση δεδομένων…')}</div>`; return; }
  const v = VIEWS[S.route.v] ? S.route.v : 'dash';
  const y = window.scrollY;
  AFTER.length = 0;
  let html;
  try { html = VIEWS[v](S.route.a); }
  catch (e) { console.error(e); html = `<div class="wrap"><div class="errbox">Σφάλμα εμφάνισης: ${esc(e.message)}</div></div>`; }
  main.innerHTML = html;
  AFTER.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  fillPhotos(main);
  if (soft) window.scrollTo(0, y);
}

/* ---------- μέρα / νύχτα ---------- */
const themeNow = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('mg-theme', t); } catch (e) {} renderThemeBtn(); renderNav(); if (S.route && S.route.v === 'repls') render(true); }
function renderThemeBtn() { const b = $('#themebtn'); if (!b) return; const d = themeNow() === 'dark';
  b.innerHTML = d ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg><span class="t">Μέρα</span>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span class="t">Νύχτα</span>';
  b.title = d ? 'Αλλαγή σε φωτεινό θέμα (μέρα)' : 'Αλλαγή σε σκούρο θέμα (νύχτα)'; }
ACT.theme = () => setTheme(themeNow() === 'dark' ? 'light' : 'dark');
ACT.themeSet = el => setTheme(el.dataset.t);
function renderNav() {
  const cur = NAV_PARENT[S.route.v] || S.route.v;
  const counts = {
    pks: Object.keys(S.pk).filter(id => pkStatus(id).rem > 0).length || '',
    invs: Object.values(S.inv).filter(i => i.status === 'draft').length || '',
  };
  $('#nav').innerHTML = `<div class="modesw" role="group" aria-label="Τρόπος εργασίας"><span class="lbl">Τρόπος εργασίας</span>${MODES.map(([m, l]) => `<button class="${MODE === m ? 'on' : ''}" data-act="mode" data-m="${m}">${esc(l)}</button>`).join('')}</div>` +
    NAV.map(([g, items]) => [g, items.filter(it => inMode(it[2]) || it[0] === cur)]).filter(([, items]) => items.length).map(([g, items]) => `<h4>${g}</h4>` + items.map(([k, l]) =>
    `<a data-go="${k}" class="${cur === k ? 'on' : ''}" href="#${k}">${esc(l)}${counts[k] ? `<span class="ct">${counts[k]}</span>` : ''}</a>`).join('')).join('') +
    `<h4>Εμφάνιση</h4><div class="themeseg" role="group" aria-label="Θέμα"><button data-act="themeSet" data-t="light" class="${themeNow() === 'light' ? 'on' : ''}">☀ Μέρα</button><button data-act="themeSet" data-t="dark" class="${themeNow() === 'dark' ? 'on' : ''}">☾ Νύχτα</button></div>
    <div class="small muted" style="margin:18px 6px 0">Έκδοση ${esc(typeof APP_BUILD !== 'undefined' ? APP_BUILD : '')}</div>`;
  renderThemeBtn();
}
function renderWho() {
  const m = S.me;
  $('#who').innerHTML = m.id
    ? `${m.avatar ? `<img alt="" src="${esc(m.avatar)}">` : ''}<span class="nm">${esc(m.name || 'Εσείς')}</span><span class="rl"><span class="lg">${esc(ROLE_LABEL[m.role])}</span><span class="sh">${esc({ admin: 'Admin', manager: 'Manager', employee: 'Employee', viewer: 'Viewer' }[m.role])}</span></span>`
    : `<span class="rl">Επισκέπτης</span>`;
}
function openNav() { $('#nav').classList.add('open'); $('#scrim').classList.add('open'); }
function closeNav() { $('#nav').classList.remove('open'); $('#scrim').classList.remove('open'); }

/* ---------- modal / toast / busy ---------- */
let modalOnClose = null;
function openModal(html, onClose) {
  $('#modal').innerHTML = `<div class="mod" role="dialog" aria-modal="true"><div class="mbox">${html}</div></div>`;
  modalOnClose = onClose || null;
  fillPhotos($('#modal'));
  const f = $('#modal [autofocus]'); if (f) f.focus();
}
function closeModal() { $('#modal').innerHTML = ''; const f = modalOnClose; modalOnClose = null; if (f) f(); }
const mhead = (title, sub) => `<div class="mh"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><h2>${title}</h2>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><button class="iconbtn" data-act="closeModal" aria-label="Κλείσιμο">✕</button></div>`;
let toastT = null;
function toast(msg, err) {
  const t = $('#toast'); t.innerHTML = `<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => t.innerHTML = '', err ? 6000 : 3200);
}
function setBusy(msg) { $('#busy').innerHTML = msg ? `<div class="busy"><div>${esc(msg)}</div></div>` : ''; }

/* ---------- προεπισκόπηση & επιβεβαίωση κίνησης ---------- */
function oldText(o) { return [o.x ? fmtN(o.x) + ' πέταμα' : '', o.u ? fmtN(o.u) + ' μεταχειρ.' : '', o.d ? fmtN(o.d) + ' κατεστρ.' : '', o.c ? fmtN(o.c) + ' προς έλεγχο' : ''].filter(Boolean).join(', '); }
function destText(d, veh) { return d.t === 'W' ? whName(d.wh) + (secLabel(d.wh, d.sec) ? ' / ' + secLabel(d.wh, d.sec) : '') : vehName(veh); }
function remLocText(loc) { return !loc ? '' : loc.t === 'W' ? whName(loc.wh) + (secLabel(loc.wh, loc.sec) ? ' / ' + secLabel(loc.wh, loc.sec) : '') : vehName(loc.veh); }
function lineDesc(op, l) {
  const parts = [];
  if (op.type === 'PROCESS') {
    parts.push(l.src === 'rem' ? `από ρετάλι ${l.dims}` : 'ολόκληρο υλικό' + (l.sec && op.from && op.from.t === 'W' ? ' · ' + (secLabel(op.from.id, l.sec) || '') : '') + (l.pk ? ' · ' + pkLabel(l.pk) : ''));
    if (op.purpose) parts.push('για: ' + op.purpose);
    parts.push(l.out && l.out.length ? 'ρετάλια: ' + l.out.map(o => `${o.dims} → ${remLocText(o.loc)}`).join(', ') : 'χωρίς ρετάλι');
    return parts.filter(Boolean).join(' · ');
  }
  if (op.type === 'GYM_MOVE') { parts.push(l.cond === 'U' ? 'μεταχειρισμένο' : 'καλή κατάσταση'); if (l.pl && S.pl[l.pl]) parts.push('από ' + S.pl[l.pl].docNo); if (l.sec && op.to && op.to.t === 'W') parts.push(secLabel(op.to.id, l.sec)); return parts.filter(Boolean).join(' · '); }
  if (l.rem) { parts.push('ρετάλι ' + (l.dims || '')); if (l.fromLoc) parts.push('από ' + remLocText(l.fromLoc)); if (op.type === 'LOAD' && l.sec) parts.push(secLabel(op.wh, l.sec)); return parts.filter(Boolean).join(' · '); }
  if (l.sec && (op.type === 'IMP' || op.type === 'LOAD' || op.type === 'INSTALL' || op.type === 'STATUS' || op.type === 'RETIRE'))
    parts.push(secLabel(op.wh, l.sec));
  if (op.type === 'TRANSFER') { const a = secLabel(op.wh, l.sec), b = secLabel(op.toWh, l.toSec); if (a || b) parts.push(`${a || 'Γενικός χώρος'} → ${b || 'Γενικός χώρος'}`); parts.push(ENG.ST[l.st]); }
  if (op.type === 'STATUS') parts.push(`${ENG.ST[l.fromSt]} → ${ENG.ST[l.toSt]}`);
  if (op.type === 'RETIRE') parts.push(ENG.ST[l.st]);
  if (op.type === 'RETIRE_G' && l.pl && S.pl[l.pl]) parts.push('εγκατάσταση ' + S.pl[l.pl].docNo);
  if (l.pk && op.type !== 'LOAD') parts.push(pkLabel(l.pk));
  if ((op.type === 'PLACE' || op.type === 'INSTALL') && l.purpose === 'repl') {
    const o = l.old || {}; const ot = oldText(o); parts.push('Αντικατάσταση' + (ot ? ` · παλιά: ${ot}` : ''));
    const od = l.oldDest || op.oldDest; if ((o.u || o.c || o.d) && od) parts.push('παλιά → ' + destText(od, op.veh));
    if (l.problem) parts.push('πρόβλημα: ' + l.problem);
    if (l.oldInst) parts.push(`${fmtN(l.oldInst)} παλιά αφαιρέθηκαν από τα εγκατεστημένα`);
  }
  if (op.type === 'RETURN') {
    parts.push(`→ ${whName(l.wh)}${secLabel(l.wh, l.sec) ? ' / ' + secLabel(l.wh, l.sec) : ''}`);
    const st = ENG.STS.filter(s => l[s]).map(s => `${fmtN(l[s])} ${ENG.ST[s].toLowerCase()}`).join(', ');
    if (st) parts.push(st);
  }
  if (op.type === 'TOGWH') parts.push(secLabel(op.wh, l.sec));
  if (op.type === 'INV') {
    if (l.diffs) parts.push(Object.entries(l.diffs).map(([s, d]) => `${ENG.ST[s]}: ${fmtN(d.sys)} → ${fmtN(d.cnt)}`).join(' · '));
    if (l.diff != null) parts.push(`${fmtN(l.sysN)} → ${fmtN(l.cntN)}`);
  }
  return parts.filter(Boolean).join(' · ');
}
function movTable(m, opts = {}) {
  const lines = m.lines || [];
  if (!lines.length) return `<div class="empty">Καμία διαφορά.</div>`;
  return `<div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th>Λεπτομέρειες</th><th class="r">Ποσότητα</th></tr></thead><tbody>` +
    lines.map(l => `<tr><td style="width:56px">${thumb(l.p)}</td><td><b>${esc(prodName(l.p))}</b><div class="muted small mono">${esc(prodCode(l.p))}</div></td>
      <td class="small">${esc(lineDesc(m, l))}</td><td class="r"><b>${l.rem ? '1 ρετάλι' : (m.type === 'INV' && l.diff != null ? (l.diff > 0 ? '+' : '−') : '') + qtyU(l.qty, l.p)}</b></td></tr>`).join('') +
    `</tbody></table></div>`;
}
/* confirmOp: δείχνει προεπισκόπηση, εκτελεί μόνο με ρητή επιβεβαίωση */
function confirmOp(op, { title, intro = '', onDone } = {}) {
  let preview, err = null;
  try { preview = dryRun(op); } catch (e) { err = e.message; }
  const perr = opPermError(op);
  const T = ENG.TYPES[op.type];
  const m = preview ? preview.mov : null;
  const body = err ? `<div class="errbox">${esc(err)}</div>` : `
    <div class="row"><span class="tag k">${esc(T.label)}</span><span class="muted small">${esc(locName(m.from))} → ${esc(locName(m.to))}</span></div>
    ${intro}
    ${movTable(Object.assign({}, m, { wh: op.wh, toWh: op.toWh }))}
    <div class="muted small">Μετά την επιβεβαίωση θα δημιουργηθεί παραστατικό με αριθμό, ημερομηνία, ώρα και χρήστη. Η κίνηση δεν διαγράφεται· διορθώνεται μόνο με νέα, συνδεδεμένη κίνηση.</div>
    ${perr ? `<div class="errbox">${esc(perr)}</div>` : ''}`;
  openModal(`${mhead(esc(title || 'Προεπισκόπηση'), 'Ελέγξτε τα στοιχεία πριν από την οριστική καταχώριση')}${body}
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button>
    <button class="btn pri big" id="okbtn" ${err || perr ? 'disabled' : ''}>Επιβεβαίωση</button></div>`);
  const b = $('#okbtn');
  if (b) b.onclick = async () => {
    b.disabled = true;
    try {
      const res = await execute(op);
      closeModal();
      showReceipt(res);
      if (onDone) onDone(res);
    } catch (e) {
      b.disabled = false;
      const box = document.createElement('div'); box.className = 'errbox'; box.textContent = e.message || 'Η καταχώριση απέτυχε.';
      b.closest('.btns').before(box);
    }
  };
}
function showReceipt(m) {
  const link = m.refs && m.refs.pk && m.type === 'LOAD' ? `<button class="btn" data-act="modalGo" data-v="pk" data-a="${m.refs.pk}">Άνοιγμα λίστας παραλαβής</button>`
    : (m.refs && m.refs.pl && (m.type === 'PLACE' || m.type === 'INSTALL') ? `<button class="btn" data-act="modalGo" data-v="pl" data-a="${m.refs.pl}">Άνοιγμα λίστας τοποθέτησης</button>` : '');
  openModal(`${mhead('Η κίνηση καταχωρίστηκε')}
    <div class="okbox"><div class="row"><span class="docno">${esc(m.docNo)}</span><b>${esc(ENG.TYPES[m.type].label)}</b></div>
    <div class="small" style="margin-top:6px">${esc(fmtDT(m.ts))} · ${esc(uname(m.by))} · ${esc(locName(m.from))} → ${esc(locName(m.to))}</div></div>
    ${movTable(m)}
    <div class="btns" style="justify-content:flex-end">${link}<button class="btn pri" data-act="closeModal">Εντάξει</button></div>`);
}

/* ---------- κοινά στοιχεία φορμών ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
// επιλογές αποθήκης σε δύο ομάδες: κεντρικές αποθήκες και αποθήκες γυμναστηρίων
function whOpts(cur, { filter = null, onlyGym = false, label = w => w.name } = {}) {
  let list = activeList(S.wh);
  if (onlyGym) list = list.filter(([, w]) => w.gym);
  if (filter) list = list.filter(([k]) => filter(k));
  const n = list.filter(([, w]) => !w.gym), g = list.filter(([, w]) => w.gym).sort((a, b) => gymName(a[1].gym).localeCompare(gymName(b[1].gym), 'el'));
  const o = ([k, w]) => opt(k, label(w), k === cur);
  if (!g.length) return n.map(o).join('');
  if (!n.length) return g.map(o).join('');
  return `<optgroup label="Αποθήκες">${n.map(o).join('')}</optgroup><optgroup label="Αποθήκες γυμναστηρίων">${g.map(o).join('')}</optgroup>`;
}
function whSelect(id, cur, { all = false, filter = null, label = 'Αποθήκη', onlyGym = false } = {}) {
  return `<div class="f"><label for="${id}">${label}</label><select id="${id}">${all ? opt('', '— Όλες —', !cur) : ''}${whOpts(cur, { filter, onlyGym })}</select></div>`;
}
function secSelect(id, wh, cur, { all = false, label = 'Χώρος αποθήκης', src = false } = {}) {
  if (!hasSections(wh) && !all) return '';
  if (!hasSections(wh)) return '';
  const secs = src ? allSections(wh) : sections(wh);
  return `<div class="f"><label for="${id}">${label}</label><select id="${id}">${all ? opt('', '— Όλοι οι χώροι —', !cur) : ''}${secs.map(s => opt(s.id, s.name, s.id === cur)).join('')}</select></div>`;
}
function vehSelect(id, cur, label = 'Όχημα') {
  return `<div class="f"><label for="${id}">${label}</label><select id="${id}">${activeList(S.veh).map(([k, v]) => opt(k, v.name + (v.plate ? ' · ' + v.plate : ''), k === cur)).join('')}</select></div>`;
}
function gymSelect(id, cur, { blank = false, label = 'Γυμναστήριο' } = {}) {
  return `<div class="f"><label for="${id}">${label}</label><select id="${id}">${blank ? opt('', '— Επιλέξτε —', !cur) : ''}${activeList(S.gym).map(([k, g]) => opt(k, g.name, k === cur)).join('')}</select></div>`;
}
function defaultVeh() { const l = activeList(S.veh, 'code'); const v1 = l.find(([, v]) => /1$/.test(v.name)); return (v1 || l[0] || [null])[0]; }
function whStockCount(w) { let n = 0; for (const b of Object.values(S.bal)) for (const [k, v] of Object.entries(b.q || {})) if (v > 0 && k.startsWith('W|' + w + '|')) n++; return n; }
function defaultWh() {
  const l = activeList(S.wh).filter(([k]) => can('move', k) || S.me.role === 'viewer'); if (!l.length) return null;
  const pool = l;
  return pool.map(([k]) => [k, whStockCount(k)]).sort((a, b) => b[1] - a[1])[0][0];
}
function bestSec(wh, st = 'N') {
  const secs = allSections(wh); const cnt = s => { let n = 0; for (const b of Object.values(S.bal)) if ((b.q || {})[K.W(wh, s, st)] > 0) n++; return n; };
  return secs.map(s => [s.id, cnt(s.id)]).sort((a, b) => b[1] - a[1])[0][0];
}

/* ---------- εκκίνηση ---------- */
function listen(path, fn, q) {
  const ref = q || db.collection(path);
  ref.onSnapshot(snap => { fn(snap); scheduleRender(); }, e => { console.warn(path, e); });
}
function mapInto(target) { return snap => { for (const k of Object.keys(target)) delete target[k]; snap.docs.forEach(d => target[d.id] = d.data()); }; }

async function boot() {
  S.bootMsg = 'Σύνδεση με τη βάση δεδομένων…'; render();
  const claude = window.claude;
  if (!claude || !claude.use) { S.bootMsg = 'Η σύνδεση με τη βάση δεν είναι διαθέσιμη. Ανανεώστε τη σελίδα.'; render(); return; }
  [db, userCap] = await Promise.all([claude.use('db'), claude.use('user')]);
  claude.use('sample').then(s => { sampleCap = s; renderAiFab(); });
  claude.use('downloads').then(d => { dlCap = d; });
  if (!db) { S.bootMsg = 'Η βάση δεδομένων δεν είναι διαθέσιμη. Συνδεθείτε ξανά.'; render(); return; }
  if (userCap) {
    const me = await userCap.me();
    Object.assign(S.me, { id: me.id, name: me.name, avatar: me.avatarUrl, isOwner: me.isOwner });
    const w = await userCap.can('data.write'); S.me.canWrite = w !== false;
    if (me.id) NAMES[me.id] = me.name;
  }
  let loaded = 0; const need = 11;
  const done = () => { if (++loaded === need) { S.ready = true; afterLoad(); } };
  const once = fn => { let f = false; return s => { fn(s); if (!f) { f = true; done(); } }; };
  listen('cfg', once(snap => { S.counters = {}; snap.docs.forEach(d => {
    const x = d.data();
    if (d.id === 'company') S.company = x;
    if (d.id === 'units') S.units = (x.list && x.list.length) ? x.list : DEFAULT_UNITS;
    if (d.id === 'counters') S.counters = x;
    if (d.id === 'owner') S.ownerUid = x.uid;
  }); }));
  listen('wh', once(mapInto(S.wh)));
  listen('gyms', once(mapInto(S.gym)));
  listen('veh', once(mapInto(S.veh)));
  listen('cats', once(mapInto(S.cat)));
  listen('prods', once(mapInto(S.prod)));
  listen('bal', once(mapInto(S.bal)));
  listen('pk', once(mapInto(S.pk)));
  listen('pl', once(mapInto(S.pl)));
  listen('rem', once(mapInto(S.rem)));
  // σημειωματάριο: προσωπικό για κάθε χρήστη (ιδιωτικός χώρος data/users/<id>), συν παλιές κοινές σημειώσεις του ίδιου χρήστη
  const mergeNotes = () => { for (const k of Object.keys(S.notes)) delete S.notes[k];
    for (const [k, n] of Object.entries(S.sharedNotes)) if (n.by && n.by === S.me.id) S.notes[k] = Object.assign({}, n, { _p: 'notes/' + k });
    for (const [k, n] of Object.entries(S.privNotes)) if (k.startsWith('note_')) S.notes[k] = Object.assign({}, n, { _p: `data/users/${S.me.id}/${k}` }); };
  listen('notes', snap => { mapInto(S.sharedNotes)(snap); mergeNotes(); });
  if (S.me.id) listen('data/users/' + S.me.id, snap => { mapInto(S.privNotes)(snap); mergeNotes(); });
  listen('inv', mapInto(S.inv));
  listen('roles', once(snap => { mapInto(S.roles)(snap); applyRole(); }));
  listen('members', mapInto(S.members));
  subscribeMov();
}
let movUnsub = null;
function subscribeMov() {
  if (movUnsub) movUnsub();
  movUnsub = db.collection('mov').orderBy('no', 'desc').limit(S.movLimit).onSnapshot(snap => {
    S.mov = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    S.movById = {}; S.mov.forEach(m => S.movById[m.id] = m);
    scheduleRender();
  }, e => console.warn('mov', e));
}
function applyRole() {
  const r = S.me.id && S.roles[S.me.id];
  if (S.me.isOwner) { S.me.role = 'admin'; S.me.whs = []; }
  else if (r) { S.me.role = r.role || 'viewer'; S.me.whs = r.whs || []; }
  else S.me.role = 'viewer';
}
async function afterLoad() {
  applyRole();
  try { const r = JSON.parse(localStorage.getItem('mg-route') || 'null'); if (r && VIEWS[r.v]) S.route = r; } catch (e) {}
  const h = (location.hash || '').slice(1); if (VIEWS[h]) S.route = { v: h, a: null };
  render();
  // καταγραφή μέλους (μία φορά)
  if (S.me.id && S.me.canWrite && !S.members[S.me.id]) {
    try { await db.doc('members/' + S.me.id).set({ first: Date.now() }); } catch (e) {}
  }
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  const a = e.target.closest('[data-act]');
  if (g && !(a && g.contains(a) && a !== g)) { e.preventDefault(); go(g.dataset.go, g.dataset.a || null); return; }
  if (a && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a, e); }
});
ACT.closeModal = () => closeModal();
ACT.modalGo = el => { closeModal(); go(el.dataset.v, el.dataset.a || null); };
ACT.back = () => goBack();

/* ================================================================
   ΦΟΡΜΕΣ ΚΙΝΗΣΕΩΝ: επιλογή από αποθήκη (εισαγωγή, παραλαβή, εγκατάσταση,
   μεταφορά, κατάσταση, απόσυρση) και επιλογή από φορτίο οχήματος
   ================================================================ */
const WH_KINDS = {
  imp: { title: 'Εισαγωγή σε αποθήκη', eyebrow: 'Νέο φορτίο', btn: 'Εισαγωγή στην αποθήκη', st: () => 'N', needStock: false },
  load: { title: 'Παραλαβή από αποθήκη', eyebrow: 'Φόρτωση στο αμάξι με λίστα παραλαβής', btn: 'Φόρτωση στο αμάξι', st: () => 'N', needStock: true },
  install: { title: 'Εγκατάσταση από αποθήκη γυμναστηρίου', eyebrow: 'Εισαγωγή σε γυμναστήριο · από αποθήκη γυμναστηρίου', btn: 'Καταχώριση ως εγκατεστημένα', st: () => 'N', needStock: true },
  xfer: { title: 'Μεταφορά μεταξύ αποθηκών', eyebrow: 'Χωρίς όχημα', btn: 'Μεταφορά', st: f => f.st, needStock: true },
  status: { title: 'Αλλαγή κατάστασης', eyebrow: 'Μετά από έλεγχο', btn: 'Αλλαγή κατάστασης', st: f => f.fromSt, needStock: true },
  retire: { title: 'Απόσυρση από αποθήκη', eyebrow: 'Οριστική απόσυρση · μείωση φυσικού αποθέματος', btn: 'Οριστική απόσυρση', st: f => f.st, needStock: true },
};

function initWhForm(kind, a) {
  if (S.form && S.form.kind === kind) return S.form;
  let wh = defaultWh();
  if (kind === 'install') { const g = a || Object.keys(S.gym).find(gid => gymWarehouses(gid).length); wh = g ? gymWarehouses(g)[0] : null; }
  else if (a && S.wh[a]) wh = a;
  S.form = { kind, wh, sec: wh ? (kind === 'imp' ? sections(wh)[0].id : bestSec(wh, kind === 'retire' ? 'D' : 'N')) : DEF_SEC, cat: '', sub: '', q: '', cart: {}, veh: defaultVeh(), st: kind === 'retire' ? 'D' : 'N', fromSt: 'C', source: '', reason: '' };
  if (kind === 'xfer') { const others = activeList(S.wh).filter(([k]) => k !== wh); S.form.toWh = (others[0] || [wh])[0]; S.form.toSec = sections(S.form.toWh)[0].id; }
  return S.form;
}

function catChips(f) {
  const cats = activeList(S.cat);
  let h = `<div class="chips" role="group" aria-label="Είδη"><button class="chip ${!f.cat ? 'on' : ''}" data-act="fcat" data-c="">Όλα τα είδη</button>` +
    cats.map(([k, c]) => `<button class="chip ${f.cat === k ? 'on' : ''}" data-act="fcat" data-c="${k}">${esc(c.name)}</button>`).join('') + '</div>';
  const subs = f.cat ? ((S.cat[f.cat].subs || []).filter(s => s.active !== false)) : [];
  if (subs.length) h += `<div class="chips"><button class="chip ${!f.sub ? 'on' : ''}" data-act="fsub" data-s="">Όλες οι κατηγορίες</button>` +
    subs.map(s => `<button class="chip ${f.sub === s.id ? 'on' : ''}" data-act="fsub" data-s="${s.id}">${esc(s.name)}</button>`).join('') + '</div>';
  const types = f.sub ? ((subOf(f.cat, f.sub) || {}).types || []).filter(t => t.active !== false) : [];
  if (types.length) h += `<div class="chips"><button class="chip ${!f.ptype ? 'on' : ''}" data-act="ftype" data-t="">Όλοι οι τύποι</button>` +
    types.map(t => `<button class="chip ${f.ptype === t.id ? 'on' : ''}" data-act="ftype" data-t="${t.id}">${esc(t.name)}</button>`).join('') + '</div>';
  return h;
}
const hasAnyStock = p => Object.values((S.bal[p] || {}).q || {}).some(v => v > 0);
function prodMatches(p, f) {
  const x = S.prod[p]; if (!x || x.deleted || (x.active === false && !f.inactive && !hasAnyStock(p))) return false;
  if (f.cat && x.cat !== f.cat) return false;
  if (f.sub && x.sub !== f.sub) return false;
  if (f.ptype && x.ptype !== f.ptype) return false;
  if (f.q) {
    const q = norm(f.q);
    const hay = norm([x.code, x.name, x.desc, catLabel(p)].join(' '));
    if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
  }
  return true;
}
// ταξινόμηση: Είδος → Κατηγορία → Τύπος → όνομα (ώστε τα όμοια να είναι μαζί)
const sortProds = ids => ids.sort((a, b) => { const x = S.prod[a] || {}, y = S.prod[b] || {};
  return (catName(x.cat) || '~').localeCompare(catName(y.cat) || '~', 'el') || (subName(x.cat, x.sub) || '').localeCompare(subName(y.cat, y.sub) || '', 'el')
    || (typeName(x.cat, x.sub, x.ptype) || '').localeCompare(typeName(y.cat, y.sub, y.ptype) || '', 'el') || prodName(a).localeCompare(prodName(b), 'el', { numeric: true }); });

function qtyCtl(key, cur, max) {
  return `<div class="qty"><button type="button" data-act="qinc" data-k="${esc(key)}" data-d="-1" aria-label="Μείωση">−</button>
    <input type="number" inputmode="decimal" min="0" ${max != null ? `max="${max}"` : ''} step="any" data-k="${esc(key)}" ${max != null ? `data-max="${max}"` : ''} value="${cur || ''}" placeholder="0" aria-label="Ποσότητα">
    <button type="button" data-act="qinc" data-k="${esc(key)}" data-d="1" aria-label="Αύξηση">+</button>
    ${max != null ? `<button type="button" class="max" data-act="qmax" data-k="${esc(key)}">ΟΛΑ</button>` : ''}</div>`;
}

VIEWS.imp = a => whFormView('imp', a);
VIEWS.load = a => whFormView('load', a);
VIEWS.install = a => whFormView('install', a);
VIEWS.xfer = a => whFormView('xfer', a);
VIEWS.status = a => whFormView('status', a);
VIEWS.retire = a => whFormView('retire', a);

function whFormView(kind, a) {
  const f = initWhForm(kind, a); const D = WH_KINDS[kind];
  if (!activeList(S.wh).length) return `<div class="wrap"><h1>${D.title}</h1><div class="panel empty">Δεν υπάρχουν αποθήκες. Δημιουργήστε μία στις <a data-go="setup">Ρυθμίσεις</a>.</div></div>`;
  if (kind === 'install' && !f.wh) return `<div class="wrap"><h1>${D.title}</h1><div class="panel empty">Κανένα γυμναστήριο δεν έχει δική του αποθήκη. Μπορείτε να δημιουργήσετε μία από τη σελίδα του γυμναστηρίου.</div></div>`;
  const perm = kind === 'xfer' ? 'transfer' : kind === 'status' ? 'status' : kind === 'retire' ? 'retire' : 'move';
  const tabs = (kind === 'status' || kind === 'retire') ? stTabs(kind) : '';
  let fields = '';
  if (kind === 'install') {
    const gymId = S.wh[f.wh].gym;
    fields += `<div class="f"><label for="fwh">Αποθήκη γυμναστηρίου</label><select id="fwh">${activeList(S.wh).filter(([, w]) => w.gym).sort((a, b) => gymName(a[1].gym).localeCompare(gymName(b[1].gym), 'el')).map(([k, w]) => opt(k, `${w.name} → ${gymName(w.gym)}`, k === f.wh)).join('')}</select></div>`;
    fields += secSelect('fsec', f.wh, f.sec, { src: true });
    fields += `<div class="f"><span class="lbl">Γυμναστήριο εγκατάστασης</span><div style="padding:9px 0;font-weight:600">${esc(gymName(gymId))}</div></div>` + purposeField('ipur', f.purpose, f.reason);
  } else {
    fields += whSelect('fwh', f.wh, { label: kind === 'xfer' ? 'Από αποθήκη' : 'Αποθήκη' });
    fields += secSelect('fsec', f.wh, f.sec, { label: kind === 'xfer' ? 'Από χώρο' : 'Χώρος αποθήκης', src: kind !== 'imp' });
  }
  if (kind === 'load') fields += vehSelect('fveh', f.veh, 'Φόρτωση στο όχημα');
  if (kind === 'imp') fields += `<div class="f"><label for="fsrc">Προέλευση (προαιρετικά)</label><input type="text" id="fsrc" value="${esc(f.source)}" placeholder="π.χ. Προμηθευτής, παραγωγή"></div>`;
  if (kind === 'xfer') {
    fields += whSelect('ftowh', f.toWh, { label: 'Προς αποθήκη' }) + secSelect('ftosec', f.toWh, f.toSec, { label: 'Προς χώρο' });
    fields += `<div class="f"><label for="fst">Κατάσταση</label><select id="fst">${ENG.STS.map(s => opt(s, ENG.ST[s], s === f.st)).join('')}</select></div>`;
  }
  if (kind === 'status') fields += `<div class="f"><label for="ffrom">Από κατάσταση</label><select id="ffrom">${['C', 'U', 'D', 'N'].map(s => opt(s, ENG.ST[s], s === f.fromSt)).join('')}</select></div>`;
  if (kind === 'retire') {
    fields += `<div class="f"><label for="fst">Κατάσταση προς απόσυρση</label><select id="fst">${['D', 'C', 'U', 'N'].map(s => opt(s, ENG.ST[s], s === f.st)).join('')}</select></div>`;
    fields += `<div class="f"><label for="freason">Αιτιολογία</label><input type="text" id="freason" value="${esc(f.reason)}" placeholder="π.χ. Μη επισκευάσιμα"></div>`;
  }
  const noPerm = !can(perm, kind === 'install' ? f.wh : f.wh);
  AFTER.push(() => {
    const bindSel = (id, fn) => { const el = $('#' + id); if (el) el.onchange = () => { fn(el.value); render(true); }; };
    bindSel('fwh', v => { if (Object.keys(f.cart).length) toast('Η επιλογή καθαρίστηκε επειδή άλλαξε η αποθήκη.'); f.wh = v; f.sec = f.kind === 'imp' ? sections(v)[0].id : bestSec(v, WH_KINDS[f.kind].st(f)); f.cart = {}; });
    bindSel('fsec', v => { f.sec = v; });
    bindSel('fveh', v => { f.veh = v; });
    bindSel('ftowh', v => { f.toWh = v; f.toSec = sections(v)[0].id; });
    bindSel('ftosec', v => { f.toSec = v; });
    bindSel('fst', v => { f.st = v; f.cart = {}; });
    bindSel('ffrom', v => { f.fromSt = v; f.cart = {}; });
    const src = $('#fsrc'); if (src) src.oninput = () => f.source = src.value;
    const rs = $('#freason'); if (rs) rs.oninput = () => f.reason = rs.value;
    $$('[data-pf=ipur]').forEach(c => c.onclick = () => { f.purpose = c.dataset.purpose; render(true); });
    const ir = $('#ipurr'); if (ir) ir.oninput = () => f.reason = ir.value;
    const q = $('#fq'); if (q) q.oninput = () => { f.q = q.value; renderPickList(); };
    renderPickList(); updateCartBar();
  });
  return `<div class="wrap">
    <div class="ph"><div class="tt"><span class="eyebrow">${D.eyebrow}</span><h1>${D.title}</h1></div>
      ${kind === 'imp' && can('product_create') ? `<button class="btn" data-act="newProd">+ Νέο προϊόν στον γενικό πίνακα</button>` : ''}</div>
    ${tabs}
    ${noPerm ? `<div class="warnbox">Ο ρόλος σας (${esc(ROLE_LABEL[S.me.role])}) επιτρέπει μόνο προβολή σε αυτή την ενέργεια.</div>` : ''}
    <div class="panel"><div class="fields">${fields}</div></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      ${catChips(f)}
      <input type="search" id="fq" placeholder="Αναζήτηση με κωδικό, όνομα ή περιγραφή" value="${esc(f.q)}" aria-label="Αναζήτηση προϊόντων">
      ${kind === 'imp' ? `<div class="hint">Η λίστα είναι ο γενικός πίνακας προϊόντων. Επιλέξτε προϊόντα και ποσότητες για την αποθήκη· περιγραφή και φωτογραφία δεν ξαναπερνιούνται.</div>` : ''}
      ${kind === 'status' ? `<div class="hint">Για κάθε προϊόν συμπληρώστε σε ποια νέα κατάσταση περνά κάθε ποσότητα. Η συνολική ποσότητα δεν αλλάζει.</div>` : ''}
    </div>
    <div class="plist" id="plist"></div>
    ${kind === 'load' ? remPickHtml(f) : ''}
    <div class="cartbar" id="cartbar"></div>
  </div>`;
}
// ρετάλια στη λίστα παραλαβής: επιλογή κομμάτι-κομμάτι από την αποθήκη φόρτωσης
function remPickHtml(f) {
  const rs = remsWhere({ wh: f.wh }); f.rems = (f.rems || []).filter(id => rs.some(([k]) => k === id));
  if (!rs.length) return '';
  AFTER.push(() => $$('[data-rpk]').forEach(c => c.onchange = () => { const id = c.dataset.rpk; f.rems = c.checked ? [...new Set([...f.rems, id])] : f.rems.filter(x => x !== id); c.closest('.remopt').classList.toggle('on', c.checked); updateCartBar(); }));
  return `<div class="panel"><h2>Ρετάλια σε αυτή την αποθήκη <span class="muted small">(${rs.length})</span></h2><div class="small muted" style="margin-bottom:8px">Τσεκάρετε όσα φορτώνονται· μπαίνουν στην ίδια λίστα παραλαβής.</div>
    <div class="remlist">${rs.map(([id, r]) => `<label class="remopt ${f.rems.includes(id) ? 'on' : ''}"><input type="checkbox" data-rpk="${id}" ${f.rems.includes(id) ? 'checked' : ''}><b>${esc(prodName(r.p))}</b> <b class="mono">${esc(r.dims)}</b><span class="small muted">${esc(secLabel(r.loc.wh, r.loc.sec) || '')}</span></label>`).join('')}</div></div>`;
}

function renderPickList() {
  const f = S.form; if (!f) return; const D = WH_KINDS[f.kind]; const box = $('#plist'); if (!box) return;
  const st = D.st(f);
  let ids = Object.keys(S.prod).filter(p => prodMatches(p, f));
  if (D.needStock) ids = ids.filter(p => whAvail(p, f.wh, f.sec, st) > 0 || f.cart[`${p}|${f.sec}|${st}`]);
  sortProds(ids);
  if (!ids.length) {
    box.innerHTML = `<div class="empty">${D.needStock ? `Δεν υπάρχει διαθέσιμο απόθεμα (${esc(ENG.ST[st].toLowerCase())}) στην «${esc(whName(f.wh))}»${hasSections(f.wh) ? ' / ' + esc(secName(f.wh, f.sec)) : ''} για αυτά τα φίλτρα.` : 'Δεν βρέθηκαν προϊόντα. Δημιουργήστε νέο προϊόν.'}</div>`;
    return;
  }
  let lastG = null;
  box.innerHTML = ids.slice(0, 300).map(p => {
    const x = S.prod[p]; const avail = whAvail(p, f.wh, f.sec, st);
    const g = catGroup(p); const gh = g !== lastG ? `<div class="pgrp">${esc(g)}</div>` : ''; lastG = g;
    const key = `${p}|${f.sec}|${st}`; const c = f.cart[key];
    let ctl;
    if (f.kind === 'status') {
      const targets = ENG.STS.filter(s => s !== f.fromSt);
      ctl = `<div class="row">${targets.map(t => `<label class="small" style="display:flex;flex-direction:column;gap:3px"><span class="lbl">→ ${ENG.ST[t]}</span>
        <input type="number" min="0" step="any" style="width:84px" data-k="${esc(key)}" data-t="${t}" data-max="${avail}" value="${c && c.to[t] ? c.to[t] : ''}" placeholder="0"></label>`).join('')}</div>`;
    } else ctl = qtyCtl(key, c ? c.qty : '', D.needStock ? avail : null);
    const stockLine = D.needStock
      ? `<span><b class="num">${fmtN(avail)}</b> ${esc(x.unit)} διαθέσιμα</span>`
      : `<span>Σε αυτή την αποθήκη: <b class="num">${fmtN(whAvail(p, f.wh, f.sec, 'N'))}</b> ${esc(x.unit)}</span>`;
    return `${gh}<div class="prow ${c ? 'sel' : ''}" data-row="${esc(key)}">${thumb(p)}
      <div class="pinfo"><span class="nm">${esc(x.name)}</span>${catTags(p)}<span class="meta"><span class="mono">${esc(x.code)}</span>${stockLine}</span></div>
      ${ctl}</div>`;
  }).join('') + (ids.length > 300 ? `<div class="empty">Εμφανίζονται τα πρώτα 300. Περιορίστε την αναζήτηση.</div>` : '');
  fillPhotos(box);
}

function cartSetQty(key, val, max, target) {
  const f = S.form; const [p, sec, st] = key.split('|');
  let n = Number(val); if (!isFinite(n) || n < 0) n = 0;
  if (max != null && n > max) { n = max; toast(`Μέγιστη διαθέσιμη ποσότητα: ${fmtN(max)}`); }
  if (f.kind === 'status') {
    const c = f.cart[key] || { p, sec, from: st, to: {} }; c.to[target] = n;
    const sum = Object.values(c.to).reduce((s, v) => s + (v || 0), 0);
    if (sum > max) { c.to[target] = Math.max(0, n - (sum - max)); toast(`Σύνολο μέχρι ${fmtN(max)}`); }
    if (Object.values(c.to).some(v => v > 0)) f.cart[key] = c; else delete f.cart[key];
  } else {
    if (n > 0) f.cart[key] = { p, sec, st, qty: n }; else delete f.cart[key];
  }
  const row = $(`[data-row="${CSS.escape(key)}"]`); if (row) row.classList.toggle('sel', !!f.cart[key]);
  updateCartBar();
  return n;
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.closest('#plist') && el.dataset.k) {
    const max = el.dataset.max != null ? Number(el.dataset.max) : null;
    const n = cartSetQty(el.dataset.k, el.value, max, el.dataset.t);
    if (max != null && Number(el.value) > max) el.value = n;
  }
  if (el.closest('#vlist') && el.dataset.lot) vehSetQty(el);
});
ACT.qinc = el => {
  const inp = el.parentElement.querySelector('input'); const max = inp.dataset.max != null ? Number(inp.dataset.max) : null;
  const n = Math.max(0, (Number(inp.value) || 0) + Number(el.dataset.d));
  inp.value = cartSetQty(el.dataset.k, n, max) || '';
};
ACT.qmax = el => { const inp = el.parentElement.querySelector('input'); inp.value = cartSetQty(el.dataset.k, inp.dataset.max, Number(inp.dataset.max)); };
ACT.fcat = el => { S.form.cat = el.dataset.c; S.form.sub = ''; S.form.ptype = ''; render(true); };
ACT.fsub = el => { S.form.sub = el.dataset.s; S.form.ptype = ''; render(true); };
ACT.ftype = el => { (S.route.v === 'prods' ? S.listF : S.form).ptype = el.dataset.t; render(true); };
const stTabs = k => `<div class="tabs"><button class="${k === 'status' ? 'on' : ''}" data-act="stTab" data-k="status">Αλλαγή κατάστασης</button><button class="${k === 'retireg' ? 'on' : ''}" data-act="stTab" data-k="retireg">Απόσυρση από γυμναστήριο</button><button class="${k === 'retire' ? 'on' : ''}" data-act="stTab" data-k="retire">Απόσυρση από αποθήκη</button></div>`;
ACT.stTab = el => { if (el.dataset.k === 'retireg') { S.form = null; return go('retireg'); } const keep = S.form ? { wh: S.form.wh, sec: S.form.sec } : null; S.form = null; initWhForm(el.dataset.k); if (keep) Object.assign(S.form, keep); go(el.dataset.k, null, true); };

function cartLines() {
  const f = S.form; const out = [];
  for (const c of Object.values(f.cart)) {
    if (f.kind === 'status') { for (const [t, q] of Object.entries(c.to)) if (q > 0) out.push({ p: c.p, sec: c.sec, from: c.from, to: t, qty: q }); }
    else out.push(c);
  }
  return out;
}
function updateCartBar() {
  const bar = $('#cartbar'); const f = S.form; if (!bar || !f) return;
  const lines = cartLines(); const D = WH_KINDS[f.kind];
  const n = new Set(lines.map(l => l.p)).size; const nr = f.kind === 'load' ? (f.rems || []).length : 0;
  bar.innerHTML = `<div class="sum">${n ? `<b>${n}</b> ${n === 1 ? 'προϊόν' : 'προϊόντα'} · ${sumByUnit(lines.map(l => ({ p: l.p, q: l.qty })))}` : (nr ? '' : 'Δεν έχει επιλεγεί προϊόν')}${nr ? `${n ? ' · ' : ''}<b>${nr}</b> ρετάλι(α)` : ''}</div>
    ${n ? `<button class="btn sm" data-act="cartView">Λίστα</button><button class="btn sm" data-act="cartClear">Καθαρισμός</button>` : ''}
    <button class="btn pri" data-act="whSubmit" ${n || nr ? '' : 'disabled'}>${esc(D.btn)}</button>`;
}
ACT.cartClear = () => { S.form.cart = {}; renderPickList(); updateCartBar(); };
ACT.cartView = () => {
  const f = S.form; const lines = cartLines();
  openModal(`${mhead('Επιλεγμένα προϊόντα', 'Η επιλογή διατηρείται όταν αλλάζετε είδος ή κατηγορία')}
    <div class="tw"><table><thead><tr><th>Προϊόν</th><th>Χώρος</th><th class="r">Ποσότητα</th><th></th></tr></thead><tbody>
    ${lines.map(l => `<tr><td><b>${esc(prodName(l.p))}</b><div class="mono small muted">${esc(prodCode(l.p))}</div></td><td>${esc(secName(f.wh, l.sec))}${l.to ? ' · ' + ENG.ST[l.from] + ' → ' + ENG.ST[l.to] : ''}</td>
      <td class="r">${qtyU(l.qty, l.p)}</td><td><button class="btn sm ghost" data-act="cartDel" data-k="${esc(l.p + '|' + l.sec + '|' + (l.st || l.from))}">Αφαίρεση</button></td></tr>`).join('')}
    </tbody></table></div><div class="btns" style="justify-content:flex-end"><button class="btn pri" data-act="closeModal">Κλείσιμο</button></div>`);
};
ACT.cartDel = el => { delete S.form.cart[el.dataset.k]; closeModal(); renderPickList(); updateCartBar(); ACT.cartView(); };

ACT.whSubmit = () => {
  const f = S.form; const lines = cartLines(); if (!lines.length && !(f.kind === 'load' && (f.rems || []).length)) return;
  const id = uid(); let op;
  switch (f.kind) {
    case 'imp': op = { type: 'IMP', id, wh: f.wh, source: f.source, lines: lines.map(l => ({ p: l.p, sec: l.sec, qty: l.qty })) }; break;
    case 'load': op = { type: 'LOAD', id, wh: f.wh, veh: f.veh, lines: lines.map(l => ({ p: l.p, sec: l.sec, qty: l.qty })), rems: (f.rems || []).filter(r => S.rem[r] && S.rem[r].status === 'stock') }; break;
    case 'install': return openPlaceReview({ src: 'gwh', wh: f.wh, gym: S.wh[f.wh].gym, purpose: f.purpose || 'new', reason: f.reason || '', lines: lines.map(l => ({ p: l.p, sec: l.sec, qty: l.qty })), onDone: () => { f.cart = {}; render(true); } });
    case 'xfer': op = { type: 'TRANSFER', id, wh: f.wh, toWh: f.toWh, lines: lines.map(l => ({ p: l.p, sec: l.sec, toSec: f.toSec, st: l.st, qty: l.qty })) }; break;
    case 'status': op = { type: 'STATUS', id, wh: f.wh, lines: lines.map(l => ({ p: l.p, sec: l.sec, from: l.from, to: l.to, qty: l.qty })) }; break;
    case 'retire': op = { type: 'RETIRE', id, wh: f.wh, note: f.reason, lines: lines.map(l => ({ p: l.p, sec: l.sec, st: l.st, qty: l.qty })) }; break;
  }
  const extra = f.kind === 'load' ? `<div class="small">Όχημα: <b>${esc(vehName(f.veh))}</b> · Από: <b>${esc(whName(f.wh))}</b></div>` : '';
  confirmOp(op, { title: WH_KINDS[f.kind].btn, intro: extra, onDone: () => { f.cart = {}; f.rems = []; render(true); } });
};

/* ================= ΦΟΡΤΙΟ ΟΧΗΜΑΤΟΣ: τοποθέτηση / επιστροφή / αποθήκη γυμναστηρίου ================= */
VIEWS.place = a => { initVehForm('place', a); return vehFormView(); };
VIEWS.ret = a => { initVehForm('ret', a); return vehFormView(); };
VIEWS.vehact = a => { if (!S.form || S.form.kind !== 'veh') initVehForm('place', a); return vehFormView(); };
function initVehForm(tab, a) {
  if (S.form && S.form.kind === 'veh') return;
  S.form = { kind: 'veh', tab, veh: defaultVeh(), gym: '', view: 'prod', pk: '', cart: {}, gwh: '', gsec: DEF_SEC };
  if (a && S.veh[a]) S.form.veh = a;
}
function openVehForm(tab, opts = {}) {
  pushHist(); NAVHIST[NAVHIST.length - 1].form = S.form;
  S.form = { kind: 'veh', tab, veh: opts.veh || defaultVeh(), gym: opts.gym || '', view: opts.pk ? 'pk' : 'prod', pk: opts.pk || '', cart: {}, gwh: '', gsec: DEF_SEC };
  S.route = { v: 'vehact', a: null }; closeNav(); render(); window.scrollTo(0, 0);
}
const lotKey = l => `${l.pk}|${l.li}|${l.p}`;

function vehFormView() {
  const f = S.form;
  if (!activeList(S.veh).length) return `<div class="wrap"><h1>Φορτίο οχήματος</h1><div class="panel empty">Δεν υπάρχουν οχήματα.</div></div>`;
  const titles = { place: ['Τοποθέτηση σε γυμναστήριο', 'Εισαγωγή σε γυμναστήριο · από αμάξι'], ret: ['Επιστροφή σε αποθήκη', 'Αμάξι → αποθήκη'], togwh: ['Μεταφορά σε αποθήκη γυμναστηρίου', 'Αμάξι → αποθηκευμένα στο γυμναστήριο'], veh2: ['Μεταφορά σε άλλο όχημα', 'Αμάξι → αμάξι'], vret: ['Απόσυρση από αμάξι', 'Οριστική απόσυρση · πέταμα'] };
  const [title, eyebrow] = titles[f.tab];
  const lots = formLots();
  const pkOpts = [...new Set(vehLots(f.veh).filter(l => f.tab === 'ret' || f.tab === 'veh2' || f.tab === 'vret' || !l.old).map(l => l.pk))];
  let fields = vehSelect('vveh', f.veh) +
    `<div class="f"><label for="vpk">Λίστα παραλαβής</label><select id="vpk">${opt('', '— Όλο το φορτίο —', !f.pk)}${pkOpts.map(p => opt(p, `${pkLabel(p)}${S.pk[p] ? ' · ' + fmtD(S.pk[p].ts) + ' · ' + whName(S.pk[p].wh) : ''}`, p === f.pk)).join('')}</select></div>`;
  if (f.tab === 'place') fields += gymSelect('vgym', f.gym, { blank: true }) + purposeField('vpur', f.purpose, f.reason);
  if (f.tab === 'vret') fields += `<div class="f"><label for="vretr">Αιτία απόσυρσης</label><input type="text" id="vretr" value="${esc(f.reason || '')}" placeholder="π.χ. χτυπήθηκε στη μεταφορά, παλιά για πέταμα"></div>`;
  if (f.tab === 'veh2') {
    const others = activeList(S.veh).filter(([k]) => k !== f.veh);
    if (!others.some(([k]) => k === f.toVeh)) f.toVeh = (others[0] || [''])[0];
    fields += others.length ? `<div class="f"><label for="vtoveh">Προς όχημα</label><select id="vtoveh">${others.map(([k, v]) => opt(k, v.name + (v.plate ? ' · ' + v.plate : ''), k === f.toVeh)).join('')}</select></div>`
      : `<div class="warnbox">Δεν υπάρχει άλλο ενεργό όχημα.</div>`;
  }
  if (f.tab === 'togwh') {
    const gw = activeList(S.wh).filter(([, w]) => w.gym).sort((a, b) => gymName(a[1].gym).localeCompare(gymName(b[1].gym), 'el'));
    if (!f.gwh && gw.length) f.gwh = gw[0][0];
    fields += gw.length ? `<div class="f"><label for="vgwh">Αποθήκη γυμναστηρίου</label><select id="vgwh">${gw.map(([k, w]) => opt(k, `${w.name} (${gymName(w.gym)})`, k === f.gwh)).join('')}</select></div>` + (f.gwh ? secSelect('vgsec', f.gwh, f.gsec) : '')
      : `<div class="warnbox">Κανένα γυμναστήριο δεν έχει αποθήκη. Δημιουργήστε μία από τη σελίδα του γυμναστηρίου.</div>`;
  }
  AFTER.push(() => {
    const b = (id, fn) => { const el = $('#' + id); if (el) el.onchange = () => { fn(el.value); render(true); }; };
    b('vveh', v => { f.veh = v; f.pk = ''; f.cart = {}; });
    b('vpk', v => { f.pk = v; });
    b('vgym', v => { f.gym = v; });
    $$('[data-pf=vpur]').forEach(c => c.onclick = () => { f.purpose = c.dataset.purpose; render(true); });
    const vr = $('#vpurr'); if (vr) vr.oninput = () => f.reason = vr.value;
    b('vgwh', v => { f.gwh = v; f.gsec = sections(v)[0].id; });
    b('vgsec', v => { f.gsec = v; });
    b('vtoveh', v => { f.toVeh = v; });
    { const r = $('#vretr'); if (r) r.oninput = () => f.reason = r.value; }
    renderVehList(); updateVehBar();
  });
  return `<div class="wrap">
    <div class="ph"><div class="tt"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div></div>
    <div class="tabs"><button class="${f.tab === 'place' ? 'on' : ''}" data-act="vtab" data-t="place">Τοποθέτηση</button><button class="${f.tab === 'ret' ? 'on' : ''}" data-act="vtab" data-t="ret">Επιστροφή σε αποθήκη</button><button class="${f.tab === 'togwh' ? 'on' : ''}" data-act="vtab" data-t="togwh">Σε αποθήκη γυμναστηρίου</button><button class="${f.tab === 'veh2' ? 'on' : ''}" data-act="vtab" data-t="veh2">Σε άλλο όχημα</button>${can('retire') ? `<button class="${f.tab === 'vret' ? 'on' : ''}" data-act="vtab" data-t="vret">Απόσυρση</button>` : ''}</div>
    ${f.tab === 'vret' ? `<div class="hint">Για όσα χάλασαν ή πετιούνται χωρίς να περάσουν από αποθήκη. Αφαιρούνται οριστικά από το απόθεμα· η κίνηση καταγράφεται στο ιστορικό και στη λίστα παραλαβής.</div>` : ''}
    ${f.tab === 'veh2' ? `<div class="hint">Το φορτίο περνά σε άλλο όχημα και κρατά τη σύνδεση με την αρχική λίστα παραλαβής. Μεταφέρονται και τα παλιά που επιστρέφουν.</div>` : ''}
    ${f.tab === 'ret' ? `<div class="hint">Για επιστροφή από γυμναστήριο στο αμάξι, ανοίξτε τη <a data-go="pls">λίστα τοποθέτησης</a> και πατήστε «Επιστροφή στο αμάξι».</div>` : ''}
    ${f.tab === 'place' ? `<div class="hint">Όσα καταχωρίζονται με την τοποθέτηση θεωρούνται εγκατεστημένα. Δεν χρειάζεται δεύτερη επιβεβαίωση.</div>` : ''}
    <div class="panel"><div class="fields">${fields}</div></div>
    <div class="row"><div class="chips"><button class="chip ${f.view === 'prod' ? 'on' : ''}" data-act="vview" data-v="prod">Συνολικά ανά προϊόν</button><button class="chip ${f.view === 'pk' ? 'on' : ''}" data-act="vview" data-v="pk">Ανά λίστα παραλαβής</button></div>
    <span class="muted small">${lots.length ? `Στο ${esc(vehName(f.veh))}: ${sumByUnit(lots.map(l => ({ p: l.p, q: l.qty })))}` : ''}</span></div>
    <div id="vlist"></div>
    <div class="cartbar" id="cartbar"></div>
  </div>`;
}
function formLots() { const f = S.form; return vehLots(f.veh).filter(l => (!f.pk || l.pk === f.pk) && (f.tab === 'ret' || f.tab === 'veh2' || f.tab === 'vret' || !l.old)); }
function renderVehList() {
  const f = S.form; const box = $('#vlist'); if (!box) return;
  const lots = formLots();
  if (!lots.length) { box.innerHTML = `<div class="plist"><div class="empty">Το ${esc(vehName(f.veh))} είναι άδειο${f.pk ? ' για αυτή τη λίστα' : ''}.</div></div>`; return; }
  if (f.view === 'prod') {
    // ομάδες ανά προϊόν, χωριστά τα καινούργια από τα παλιά που επιστρέφουν
    const by = {}; lots.forEach(l => { const k = l.p + '~' + (l.old || ''); (by[k] = by[k] || []).push(l); });
    const keys = Object.keys(by).sort((a, b) => (a.split('~')[1] ? 1 : 0) - (b.split('~')[1] ? 1 : 0) || prodName(a.split('~')[0]).localeCompare(prodName(b.split('~')[0]), 'el'));
    let lastOld = null;
    box.innerHTML = `<div class="plist">` + keys.map(k => {
      const [p, old] = k.split('~'); const ls = by[k]; const tot = ls.reduce((s, l) => s + l.qty, 0);
      const cur = ls.reduce((s, l) => s + (f.cart[lotKey(l)] || 0), 0);
      const origin = [...new Set(ls.map(l => l.pk === 'ADJ' ? 'Διόρθωση' : l.old ? pkLabel(l.pk) : `${pkLabel(l.pk)} (${whName(l.wh)})`))].join(', ');
      const head = (old ? 'old' : 'new') !== lastOld ? `<div style="padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--line)" class="lbl">${old ? 'Παλιά που επιστρέφουν (από αντικαταστάσεις)' : 'Καινούργια'}</div>` : '';
      lastOld = old ? 'old' : 'new';
      return head + `<div class="prow ${cur ? 'sel' : ''}" data-prow="${esc(k)}">${thumb(p)}<div class="pinfo"><span class="nm">${esc(prodName(p))} ${old ? stTag(old) : ''}</span>
        <span class="meta"><span class="mono">${esc(prodCode(p))}</span><span><b class="num">${fmtN(tot)}</b> ${esc(unitOf(p))} στο αμάξι</span><span>Προέλευση: ${esc(origin)}</span></span></div>
        <div class="qty"><button type="button" data-act="vinc" data-d="-1">−</button><input type="number" min="0" step="any" data-lot="P:${esc(k)}" data-max="${tot}" value="${cur || ''}" placeholder="0" aria-label="Ποσότητα">
        <button type="button" data-act="vinc" data-d="1">+</button><button type="button" class="max" data-act="vmax">ΟΛΑ</button></div></div>`;
    }).join('') + `</div>`;
  } else {
    const by = {}; lots.forEach(l => (by[l.pk] = by[l.pk] || []).push(l));
    box.innerHTML = Object.entries(by).map(([pk, ls]) => {
      const P = S.pk[pk];
      return `<div class="panel" style="padding:0;overflow:hidden;margin-bottom:12px"><div class="row" style="padding:12px 14px;border-bottom:1px solid var(--line);background:var(--surface2)">
        <span class="docno">${esc(pkLabel(pk))}</span>${P ? `<span class="small">${esc(fmtDT(P.ts))} · από ${esc(whName(P.wh))}</span><button class="btn sm ghost" data-go="pk" data-a="${pk}">Άνοιγμα</button>` : ''}
        <button class="btn sm" data-act="vpkall" data-pk="${pk}">Επιλογή όλων</button></div>
        <div class="plist" style="border:0;border-radius:0">${ls.map(l => {
          const k = lotKey(l); const cur = f.cart[k] || 0;
          return `<div class="prow ${cur ? 'sel' : ''}" data-lrow="${esc(k)}">${thumb(l.p)}<div class="pinfo"><span class="nm">${esc(prodName(l.p))}</span>
            <span class="meta"><span class="mono">${esc(prodCode(l.p))}</span><span><b class="num">${fmtN(l.qty)}</b> ${esc(unitOf(l.p))} στο αμάξι</span>${l.wh ? `<span>Από: ${esc(whName(l.wh))}${secLabel(l.wh, l.sec) ? ' / ' + esc(secLabel(l.wh, l.sec)) : ''}</span>` : ''}</span></div>
            <div class="qty"><input type="number" min="0" step="any" data-lot="${esc(k)}" data-max="${l.qty}" value="${cur || ''}" placeholder="0" aria-label="Ποσότητα"><button type="button" class="max" data-act="vlotmax" data-k="${esc(k)}" data-max="${l.qty}">ΟΛΑ</button></div></div>`;
        }).join('')}</div></div>`;
    }).join('');
  }
  fillPhotos(box);
}
function allocProduct(key, n) {
  const [p, old] = key.split('~'); const f = S.form; const lots = formLots().filter(l => l.p === p && (l.old || '') === (old || ''));
  let left = n;
  for (const l of lots) { const t = Math.min(l.qty, left); if (t > 0) f.cart[lotKey(l)] = t; else delete f.cart[lotKey(l)]; left -= t; }
  return n - left;
}
function vehSetQty(el) {
  const f = S.form; const max = Number(el.dataset.max); let n = Number(el.value); if (!isFinite(n) || n < 0) n = 0;
  if (n > max) { n = max; el.value = n; toast(`Μέγιστη ποσότητα στο αμάξι: ${fmtN(max)}`); }
  if (el.dataset.lot.startsWith('P:')) { const k = el.dataset.lot.slice(2); allocProduct(k.includes('~') ? k : k + '~', n); const r = el.closest('.prow'); if (r) r.classList.toggle('sel', n > 0); }
  else { if (n > 0) f.cart[el.dataset.lot] = n; else delete f.cart[el.dataset.lot]; const r = el.closest('.prow'); if (r) r.classList.toggle('sel', n > 0); }
  updateVehBar();
}
ACT.vinc = el => { const inp = el.parentElement.querySelector('input'); inp.value = Math.max(0, (Number(inp.value) || 0) + Number(el.dataset.d)); vehSetQty(inp); };
ACT.vmax = el => { const inp = el.parentElement.querySelector('input'); inp.value = inp.dataset.max; vehSetQty(inp); };
ACT.vlotmax = el => { const inp = el.parentElement.querySelector('input'); inp.value = el.dataset.max; vehSetQty(inp); };
ACT.vpkall = el => { const f = S.form; vehLots(f.veh).filter(l => l.pk === el.dataset.pk).forEach(l => f.cart[lotKey(l)] = l.qty); renderVehList(); updateVehBar(); };
ACT.vview = el => { S.form.view = el.dataset.v; render(true); };
ACT.vtab = el => { S.form.tab = el.dataset.t; S.form.cart = {}; render(true); };
function vehCartLots() {
  const f = S.form; const lots = formLots(); const out = [];
  for (const l of lots) { const q = f.cart[lotKey(l)]; if (q > 0) out.push(Object.assign({}, l, { take: Math.min(q, l.qty) })); }
  return out;
}
function updateVehBar() {
  const bar = $('#cartbar'); const f = S.form; if (!bar || !f) return;
  const ls = vehCartLots(); const n = new Set(ls.map(l => l.p)).size;
  const label = { place: 'Τοποθέτηση', ret: 'Επιστροφή', togwh: 'Μεταφορά σε αποθήκη γυμν.', veh2: 'Μεταφορά σε όχημα', vret: 'Οριστική απόσυρση' }[f.tab];
  bar.innerHTML = `<div class="sum">${n ? `<b>${n}</b> ${n === 1 ? 'προϊόν' : 'προϊόντα'} · ${sumByUnit(ls.map(l => ({ p: l.p, q: l.take })))}` : 'Επιλέξτε προϊόντα από το φορτίο'}</div>
    ${n ? `<button class="btn sm" data-act="vclear">Καθαρισμός</button>` : ''}
    <button class="btn pri" data-act="vsubmit" ${n ? '' : 'disabled'}>${label}</button>`;
}
ACT.vclear = () => { S.form.cart = {}; renderVehList(); updateVehBar(); };
ACT.vsubmit = () => {
  const f = S.form; const ls = vehCartLots(); if (!ls.length) return;
  if (f.tab === 'place') {
    if (!f.gym) { toast('Επιλέξτε γυμναστήριο.', true); const g = $('#vgym'); if (g) g.focus(); return; }
    openPlaceReview({ src: 'veh', veh: f.veh, gym: f.gym, purpose: f.purpose || 'new', reason: f.reason || '', lines: ls.map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })), onDone: () => { f.cart = {}; render(true); } });
  } else if (f.tab === 'togwh') {
    if (!f.gwh) return toast('Επιλέξτε αποθήκη γυμναστηρίου.', true);
    confirmOp({ type: 'TOGWH', id: uid(), veh: f.veh, wh: f.gwh, sec: f.gsec, lines: ls.map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) },
      { title: 'Μεταφορά σε αποθήκη γυμναστηρίου', intro: `<div class="small">Τα προϊόντα παραμένουν αποθηκευμένα, δεν καταχωρίζονται ως εγκατεστημένα.</div>`, onDone: () => { f.cart = {}; render(true); } });
  } else if (f.tab === 'vret') {
    confirmOp({ type: 'RETIRE_V', id: uid(), veh: f.veh, note: f.reason || '', lines: ls.map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) },
      { title: 'Απόσυρση από αμάξι', intro: `<div class="small">Από <b>${esc(vehName(f.veh))}</b>${f.reason ? ' · ' + esc(f.reason) : ''}. Τα προϊόντα αφαιρούνται οριστικά από το απόθεμα.</div>`, onDone: () => { f.cart = {}; f.reason = ''; render(true); } });
  } else if (f.tab === 'veh2') {
    if (!f.toVeh) return toast('Επιλέξτε όχημα προορισμού.', true);
    confirmOp({ type: 'VMOVE', id: uid(), veh: f.veh, toVeh: f.toVeh, lines: ls.map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) },
      { title: 'Μεταφορά σε άλλο όχημα', intro: `<div class="small">${esc(vehName(f.veh))} → <b>${esc(vehName(f.toVeh))}</b>. Η σύνδεση με τις λίστες παραλαβής διατηρείται.</div>`, onDone: () => { f.cart = {}; render(true); } });
  } else openReturnReview(f.veh, ls.map(l => Object.assign({}, l, { qty: l.take })), () => { f.cart = {}; render(true); });
};

/* επιστροφή: ενιαία οθόνη ελέγχου (κατάσταση & προορισμός ανά γραμμή) */
function openReturnReview(veh, lots, onDone) {
  const rows = lots.map(l => ({ p: l.p, pk: l.pk, li: l.li, max: l.qty, N: l.old ? 0 : l.qty, U: l.old === 'U' ? l.qty : 0, D: l.old === 'D' ? l.qty : 0, C: l.old === 'C' ? l.qty : 0, wh: l.wh || defaultWh(), sec: l.wh ? l.sec : sections(defaultWh())[0].id, origWh: l.wh, origSec: l.sec }));
  const opId = uid();
  const other = can('return_other');
  const draw = (err) => {
    openModal(`${mhead('Επιστροφή σε αποθήκη', `Από ${esc(vehName(veh))} · προεπιλογή: η αρχική αποθήκη και ο αρχικός χώρος`)}
      <div class="tw"><table><thead><tr><th>Προϊόν</th><th>Προορισμός</th><th class="r">Κανονικά</th><th class="r">Μεταχειρ.</th><th class="r">Κατεστρ.</th><th class="r">Προς έλεγχο</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td style="min-width:160px"><b>${esc(prodName(r.p))}</b><div class="small muted">${esc(pkLabel(r.pk))} · στο αμάξι ${qtyU(r.max, r.p)}</div></td>
        <td style="min-width:180px"><select data-rw="${i}" ${other ? '' : 'disabled'} aria-label="Αποθήκη">${whOpts(r.wh)}</select>
        ${hasSections(r.wh) ? `<select data-rs="${i}" style="margin-top:4px" aria-label="Χώρος">${sections(r.wh).map(s => opt(s.id, s.name, s.id === r.sec)).join('')}</select>` : ''}</td>
        ${ENG.STS.map(s => `<td class="r"><input type="number" min="0" step="any" style="width:72px" data-ri="${i}" data-st="${s}" value="${r[s] || ''}" placeholder="0" aria-label="${ENG.ST[s]}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      ${other ? '' : `<div class="muted small">Η αλλαγή αποθήκης επιστροφής απαιτεί δικαίωμα Warehouse Manager.</div>`}
      <div id="reterr">${err ? `<div class="errbox">${esc(err)}</div>` : ''}</div>
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri big" id="retok">Επιβεβαίωση επιστροφής</button></div>`);
    $$('[data-ri]').forEach(inp => inp.oninput = () => { rows[inp.dataset.ri][inp.dataset.st] = Number(inp.value) || 0; });
    $$('[data-rw]').forEach(s => s.onchange = () => { const r = rows[s.dataset.rw]; r.wh = s.value; r.sec = sections(s.value)[0].id; draw(); });
    $$('[data-rs]').forEach(s => s.onchange = () => { rows[s.dataset.rs].sec = s.value; });
    $('#retok').onclick = async () => {
      for (const r of rows) { const t = r.N + r.U + r.D + r.C; if (t > r.max + 1e-9) return draw(`Για «${prodName(r.p)}» δηλώθηκαν ${fmtN(t)}, ενώ στο αμάξι υπάρχουν ${fmtN(r.max)}.`); }
      const op = { type: 'RETURN', id: opId, veh, lines: rows.filter(r => r.N + r.U + r.D + r.C > 0).map(r => ({ p: r.p, pk: r.pk, li: r.li, wh: r.wh, sec: r.sec, N: r.N, U: r.U, D: r.D, C: r.C })) };
      const perr = opPermError(op); if (perr) return draw(perr);
      try { dryRun(op); } catch (e) { return draw(e.message); }
      const b = $('#retok'); b.disabled = true;
      try { const res = await execute(op); closeModal(); showReceipt(res); if (onDone) onDone(res); }
      catch (e) { draw(e.message); }
    };
  };
  draw();
}

/* τοποθέτηση όλων από λίστα παραλαβής */
function openPlaceAll(pkId) {
  const pk = S.pk[pkId]; const rem = pkRemaining(pkId);
  const lines = pk.lines.map((l, i) => ({ p: l.p, pk: pkId, li: i, qty: balQ(l.p)[K.V(pk.veh, pkId, i)] || 0 })).filter(l => l.qty > 0);
  if (!lines.length) return toast('Δεν απομένει τίποτα στο αμάξι από αυτή τη λίστα.', true);
  openModal(`${mhead('Τοποθέτηση όλων σε γυμναστήριο', `${esc(pk.docNo)} · ${lines.length} γραμμές στο ${esc(vehName(pk.veh))}`)}
    ${gymSelect('pagym', '', { blank: true, label: 'Γυμναστήριο' })}
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="pago">Συνέχεια</button></div>`);
  $('#pago').onclick = () => {
    const g = $('#pagym').value; if (!g) return toast('Επιλέξτε γυμναστήριο.', true);
    openPlaceReview({ src: 'veh', veh: pk.veh, gym: g, purpose: 'new', reason: '', lines });
  };
}
function openReturnAll(pkId) {
  const pk = S.pk[pkId];
  const lots = pk.lines.map((l, i) => ({ p: l.p, pk: pkId, li: i, qty: balQ(l.p)[K.V(pk.veh, pkId, i)] || 0, wh: pk.wh, sec: l.sec })).filter(l => l.qty > 0);
  if (!lots.length) return toast('Δεν απομένει τίποτα στο αμάξι από αυτή τη λίστα.', true);
  openReturnReview(pk.veh, lots);
}

/* ================= ΝΕΟ / ΕΠΕΞΕΡΓΑΣΙΑ ΠΡΟΪΟΝΤΟΣ ================= */
function nextProdCode() {
  let max = 0; Object.values(S.prod).forEach(p => { const m = /^MG-(\d+)$/.exec(p.code || ''); if (m) max = Math.max(max, Number(m[1])); });
  return 'MG-' + String(max + 1).padStart(5, '0');
}
ACT.newProd = () => openProdEditor(null);
function openProdEditor(pid, onSaved, initialFile) {
  // νέο προϊόν: παίρνει είδος/κατηγορία/τύπο από τα φίλτρα της οθόνης (γενικός πίνακας ή φόρμα κίνησης)
  const flt = (S.route.v === 'mats' && S.matsF) ? S.matsF : (S.route.v === 'prods' && S.listF && S.listF.k === 'prods') ? S.listF : (S.form && S.form.cat !== undefined ? S.form : {});
  const fCat = flt.cat && S.cat[flt.cat] ? flt.cat : '';
  const fSub = fCat && flt.sub && subOf(fCat, flt.sub) ? flt.sub : '';
  const fType = fSub && flt.ptype ? flt.ptype : '';
  const x = pid ? Object.assign({}, S.prod[pid]) : { code: nextProdCode(), name: '', desc: '', cat: fCat || (activeList(S.cat)[0] || [''])[0], sub: fSub, ptype: fType, unit: 'τεμ', active: true, kind: (S.route.v === 'mats' || flt.kindF === 'mat') ? 'mat' : 'prod' };
  if (!pid && S.cat[x.cat] && S.cat[x.cat].mat) x.kind = 'mat';
  if (pid && !x.kind) x.kind = isMat(pid) ? 'mat' : 'prod';
  if (!pid && x.kind === 'mat' && S.units.some(u => u.k === 'φύλλα')) x.unit = 'φύλλα';
  let newPhoto = null, removePhoto = false;
  const typeOpts = (c, s) => `${opt('', '— Χωρίς τύπο —', !x.ptype)}${((subOf(c, s) || {}).types || []).filter(t => t.active !== false || t.id === x.ptype).map(t => opt(t.id, t.name, t.id === x.ptype)).join('')}`;
  const subOpts = c => `${opt('', '— Χωρίς κατηγορία —', !x.sub)}${((S.cat[c] && S.cat[c].subs) || []).filter(s => s.active !== false || s.id === x.sub).map(s => opt(s.id, s.name, s.id === x.sub)).join('')}`;
  openModal(`${mhead(pid ? 'Επεξεργασία προϊόντος' : 'Νέο προϊόν')}
    <div class="f"><span class="lbl">Καταχώριση ως</span><div class="chips" role="radiogroup"><button type="button" class="chip ${x.kind !== 'mat' ? 'on' : ''}" data-pk="prod">Έτοιμο προϊόν</button><button type="button" class="chip ${x.kind === 'mat' ? 'on' : ''}" data-pk="mat">Υλικό κατασκευής</button></div>
      <div class="small muted" id="pkhint">${x.kind === 'mat' ? 'Υλικό: καταναλώνεται με «Επεξεργασία» και μπορεί να αφήσει ρετάλια με διάσταση.' : 'Έτοιμο προϊόν: τοποθετείται / εγκαθίσταται.'}</div></div>
    <div class="f" id="pdimsw" style="${x.kind === 'mat' ? '' : 'display:none'}"><label for="pdims">Διάσταση ολόκληρου υλικού</label><input type="text" id="pdims" value="${esc(x.dims || '')}" placeholder="π.χ. 1000×2000×1,5 mm"></div>
    <div class="fields">
      <div class="f"><label for="pcode">Κωδικός</label><input type="text" id="pcode" value="${esc(x.code)}"></div>
      <div class="f" style="grid-column:span 2"><label for="pname">Ονομασία</label><input type="text" id="pname" value="${esc(x.name)}" autofocus></div>
      <div class="f"><label for="pcat">Είδος</label><select id="pcat">${activeList(S.cat).map(([k, c]) => opt(k, c.name, k === x.cat)).join('')}</select></div>
      <div class="f"><label for="psub">Κατηγορία</label><select id="psub">${subOpts(x.cat)}</select></div>
      <div class="f"><label for="ptype">Τύπος</label><select id="ptype">${typeOpts(x.cat, x.sub)}</select></div>
      <div class="f"><label for="punit">Μονάδα μέτρησης</label><select id="punit">${S.units.map(u => opt(u.k, `${u.n} (${u.k})`, u.k === x.unit)).join('')}</select></div>
    </div>
    <div class="f"><label for="pdesc">Περιγραφή</label><textarea id="pdesc">${esc(x.desc)}</textarea></div>
    <div class="row"><div class="thumb" id="pphv" style="width:80px;height:80px" ${pid && x.photo ? `data-ph="${pid}"` : ''}>${pid && x.photo ? '' : 'ΧΩΡΙΣ<br>ΦΩΤΟ'}</div>
      <div class="f" style="flex:1;min-width:200px"><label for="pph">Φωτογραφία</label><input type="file" id="pph" accept="image/*">
        <div class="pastezone" id="ppaste" contenteditable="true" role="textbox" aria-label="Επικόλληση φωτογραφίας" spellcheck="false"></div></div>
      ${pid && x.photo ? `<button class="btn sm ghost" id="pphx">Αφαίρεση φωτογραφίας</button>` : ''}</div>
    ${pid ? `<label class="check"><input type="checkbox" id="pact" ${x.active !== false ? 'checked' : ''}> Ενεργό προϊόν</label>` : ''}
    <div id="perr"></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="psave">Αποθήκευση</button></div>`);
  $('#pcat').onchange = () => { x.cat = $('#pcat').value; x.sub = ''; x.ptype = ''; $('#psub').innerHTML = subOpts(x.cat); $('#ptype').innerHTML = typeOpts(x.cat, ''); if (S.cat[x.cat] && S.cat[x.cat].mat && x.kind !== 'mat') { const b = $('[data-pk=mat]'); if (b) b.click(); } };
  $('#psub').onchange = () => { x.sub = $('#psub').value; x.ptype = ''; $('#ptype').innerHTML = typeOpts(x.cat, x.sub); };
  const setPhoto = async file => {
    if (!file || !/^image\//.test(file.type)) return toast('Το αρχείο δεν είναι εικόνα.', true);
    try { newPhoto = await resizeImage(file); removePhoto = false; $('#pphv').innerHTML = `<img alt="" src="${newPhoto}">`; toast('Η φωτογραφία προστέθηκε. Πατήστε Αποθήκευση.'); } catch (e) { toast(e.message, true); }
  };
  $('#pph').onchange = () => setPhoto($('#pph').files[0]);
  // επικόλληση (Ctrl+V / παρατεταμένο πάτημα → Επικόλληση) οπουδήποτε στο παράθυρο, και σύρσιμο αρχείου
  const box = $('#modal .mbox'); const zone = $('#ppaste');
  box.addEventListener('paste', e => {
    // σε πεδίο κειμένου: κανονική επικόλληση κειμένου (Word/Excel βάζουν και «εικόνα» στο πρόχειρο)
    const t = e.target; const inText = t !== zone && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'file'));
    if (inText && clipboardHasText(e.clipboardData)) return;
    const img = imageFromClipboard(e.clipboardData);
    if (img) { e.preventDefault(); setPhoto(img); }
    else if (e.target === zone) { e.preventDefault(); toast('Δεν βρέθηκε εικόνα στο πρόχειρο. Χρησιμοποιήστε «Αντιγραφή εικόνας», όχι αντιγραφή διεύθυνσης.', true); }
  });
  zone.addEventListener('beforeinput', e => { if (e.inputType !== 'insertFromPaste') e.preventDefault(); });
  zone.addEventListener('input', () => { zone.textContent = ''; });
  box.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  box.addEventListener('dragleave', () => zone.classList.remove('over'));
  box.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (f) setPhoto(f); });
  if (initialFile) setPhoto(initialFile);
  const px = $('#pphx'); if (px) px.onclick = () => { removePhoto = true; newPhoto = null; $('#pphv').innerHTML = 'ΧΩΡΙΣ<br>ΦΩΤΟ'; };
  $$('[data-pk]').forEach(b => b.onclick = () => { x.kind = b.dataset.pk; $$('[data-pk]').forEach(c => c.classList.toggle('on', c === b)); $('#pdimsw').style.display = x.kind === 'mat' ? '' : 'none';
    $('#pkhint').textContent = x.kind === 'mat' ? 'Υλικό: καταναλώνεται με «Επεξεργασία» και μπορεί να αφήσει ρετάλια με διάσταση.' : 'Έτοιμο προϊόν: τοποθετείται / εγκαθίσταται.';
    if (x.kind === 'mat' && !pid && $('#punit').value === 'τεμ' && S.units.some(u => u.k === 'φύλλα')) $('#punit').value = 'φύλλα'; });
  $('#psave').onclick = async () => {
    const code = $('#pcode').value.trim(), name = $('#pname').value.trim();
    const err = m => $('#perr').innerHTML = `<div class="errbox">${esc(m)}</div>`;
    if (!code || !name) return err('Συμπληρώστε κωδικό και ονομασία.');
    if (!$('#pcat').value) return err('Δημιουργήστε πρώτα ένα είδος στις Ρυθμίσεις.');
    const dup = Object.entries(S.prod).find(([k, p]) => k !== pid && !p.deleted && norm(p.code) === norm(code));
    if (dup) return err(`Ο κωδικός ${code} χρησιμοποιείται ήδη από το «${dup[1].name}».`);
    const same = Object.entries(S.prod).find(([k, p]) => k !== pid && !p.deleted && norm(p.name) === norm(name));
    if (same && !$('#psave').dataset.force) { $('#psave').dataset.force = '1'; $('#psave').textContent = 'Αποθήκευση ούτως ή άλλως'; return err(`Υπάρχει ήδη προϊόν με το ίδιο όνομα (${same[1].code}). Το ίδιο προϊόν καταχωρίζεται μία φορά και μπαίνει σε όσες αποθήκες χρειάζεται με «+ Ποσότητες». Αν είναι πράγματι διαφορετικό, πατήστε ξανά.`); }
    const id = pid || 'p' + uid();
    const data = Object.assign({}, pid ? S.prod[pid] : { created: Date.now(), by: S.me.id }, {
      code, name, desc: $('#pdesc').value.trim(), cat: $('#pcat').value, sub: $('#psub').value, ptype: $('#ptype').value, unit: $('#punit').value,
      active: pid ? $('#pact').checked : true, updated: Date.now(), kind: x.kind === 'mat' ? 'mat' : 'prod', dims: x.kind === 'mat' ? $('#pdims').value.trim() : '',
    });
    try {
      $('#psave').disabled = true;
      if (newPhoto) { await saveDoc('photos/' + id, { d: newPhoto }); data.photo = Date.now(); }
      if (removePhoto) { data.photo = null; try { await db.doc('photos/' + id).delete(); } catch (e) {} }
      await saveDoc('prods/' + id, data);
      closeModal(); toast(pid ? 'Το προϊόν ενημερώθηκε.' : 'Το προϊόν δημιουργήθηκε.');
      if (onSaved) onSaved(id);
    } catch (e) { $('#psave').disabled = false; err(e.message); }
  };
}

function clipboardHasText(cd) {
  if (!cd) return false;
  try { return !!(cd.getData('text/plain') || '').trim(); } catch (e) { return false; }
}
function imageFromClipboard(cd) {
  if (!cd) return null;
  for (const it of cd.items || []) if (it.kind === 'file' && /^image\//.test(it.type)) return it.getAsFile();
  return [...(cd.files || [])].find(f => /^image\//.test(f.type)) || null;
}
// στην καρτέλα προϊόντος: Ctrl+V μιας εικόνας ανοίγει την επεξεργασία με τη νέα φωτογραφία
document.addEventListener('paste', e => {
  if (S.route.v !== 'prod' || $('#modal').innerHTML) return;
  const pid = S.route.a; const x = S.prod[pid]; if (!x) return;
  if (!(can('product') || (can('product_create') && x.by === S.me.id))) return;
  const t = e.target; if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
  if (clipboardHasText(e.clipboardData)) return;
  const img = imageFromClipboard(e.clipboardData); if (!img) return;
  e.preventDefault(); openProdEditor(pid, null, img);
});

/* ================= ΑΠΟΣΥΡΣΗ ΑΠΟ ΓΥΜΝΑΣΤΗΡΙΟ (εγκατεστημένα) ================= */
function gymLots(gym) { // [{p, pl, li, qty, no}] παλαιότερη τοποθέτηση πρώτα
  const out = [];
  for (const [p, b] of Object.entries(S.bal)) for (const [k, v] of Object.entries(b.q || {})) {
    if (k[0] !== 'G' || !v) continue; const x = K.parse(k); if (x.a !== gym) continue;
    out.push({ p, pl: x.b, li: Number(x.c), qty: v, no: (S.pl[x.b] && S.pl[x.b].no) || 0 });
  }
  return out.sort((a, b) => a.no - b.no);
}
VIEWS.retireg = a => {
  if (!S.form || S.form.kind !== 'retireg') S.form = { kind: 'retireg', gym: a && S.gym[a] ? a : (activeList(S.gym)[0] || [''])[0], cat: '', sub: '', ptype: '', q: '', cart: {}, reason: '' };
  const f = S.form;
  if (!activeList(S.gym).length) return `<div class="wrap"><h1>Απόσυρση από γυμναστήριο</h1><div class="panel empty">Δεν υπάρχουν γυμναστήρια.</div></div>`;
  AFTER.push(() => {
    $('#rggym').onchange = e => { f.gym = e.target.value; f.cart = {}; render(true); };
    $('#rgreason').oninput = e => f.reason = e.target.value;
    $('#fq').oninput = e => { f.q = e.target.value; renderGymRetList(); };
    renderGymRetList(); updateGymRetBar();
  });
  const gw = gymWarehouses(f.gym);
  return `<div class="wrap">
    <div class="ph"><div class="tt"><span class="eyebrow">Εγκατεστημένα → οριστική απόσυρση</span><h1>Απόσυρση από γυμναστήριο</h1></div></div>
    ${stTabs('retireg')}
    ${!can('retire') ? `<div class="warnbox">Ο ρόλος σας (${esc(ROLE_LABEL[S.me.role])}) επιτρέπει μόνο προβολή σε αυτή την ενέργεια.</div>` : ''}
    <div class="panel"><div class="fields">${gymSelect('rggym', f.gym)}
      <div class="f"><label for="rgreason">Αιτιολογία</label><input type="text" id="rgreason" value="${esc(f.reason)}" placeholder="π.χ. Καμμένα, σπασμένα"></div></div>
      <p class="hint" style="margin-top:10px">Αφορά όσα είναι εγκατεστημένα στο γυμναστήριο. Τα αποθηκευμένα σε αποθήκη του γυμναστηρίου${gw.length ? ` (${gw.map(whName).map(esc).join(', ')})` : ''} αποσύρονται από την καρτέλα «Απόσυρση από αποθήκη».</p></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">${catChips(f)}
      <input type="search" id="fq" placeholder="Αναζήτηση με κωδικό, όνομα ή περιγραφή" value="${esc(f.q)}" aria-label="Αναζήτηση προϊόντων"></div>
    <div class="plist" id="glist"></div>
    <div class="cartbar" id="cartbar"></div></div>`;
};
function renderGymRetList() {
  const f = S.form; const box = $('#glist'); if (!box) return;
  const by = {}; gymLots(f.gym).forEach(l => by[l.p] = (by[l.p] || 0) + l.qty);
  const ids = sortProds(Object.keys(by).filter(p => prodMatches(p, f) || (S.prod[p] && S.prod[p].active === false)));
  if (!ids.length) { box.innerHTML = `<div class="empty">Δεν υπάρχουν εγκατεστημένα προϊόντα στο «${esc(gymName(f.gym))}» για αυτά τα φίλτρα.</div>`; return; }
  box.innerHTML = ids.map(p => `<div class="prow ${f.cart[p] ? 'sel' : ''}">${thumb(p)}<div class="pinfo"><span class="nm">${esc(prodName(p))}</span>
    ${catTags(p)}<span class="meta"><span class="mono">${esc(prodCode(p))}</span><span><b class="num">${fmtN(by[p])}</b> ${esc(unitOf(p))} εγκατεστημένα</span></span></div>
    <div class="qty"><input type="number" min="0" step="any" data-gp="${p}" data-max="${by[p]}" value="${f.cart[p] || ''}" placeholder="0" aria-label="Ποσότητα"><button type="button" class="max" data-act="gmax" data-p="${p}" data-max="${by[p]}">ΟΛΑ</button></div></div>`).join('');
  fillPhotos(box);
  $$('[data-gp]', box).forEach(inp => inp.oninput = () => gymSet(inp));
}
function gymSet(inp) {
  const f = S.form; const max = Number(inp.dataset.max); let n = Number(inp.value) || 0;
  if (n > max) { n = max; inp.value = n; toast(`Μέγιστη ποσότητα: ${fmtN(max)}`); }
  if (n > 0) f.cart[inp.dataset.gp] = n; else delete f.cart[inp.dataset.gp];
  inp.closest('.prow').classList.toggle('sel', n > 0); updateGymRetBar();
}
ACT.gmax = el => { const inp = el.parentElement.querySelector('input'); inp.value = el.dataset.max; gymSet(inp); };
function updateGymRetBar() {
  const bar = $('#cartbar'); const f = S.form; if (!bar) return;
  const ps = Object.keys(f.cart);
  bar.innerHTML = `<div class="sum">${ps.length ? `<b>${ps.length}</b> ${ps.length === 1 ? 'προϊόν' : 'προϊόντα'} · ${sumByUnit(ps.map(p => ({ p, q: f.cart[p] })))}` : 'Επιλέξτε εγκατεστημένα προϊόντα'}</div>
    <button class="btn pri" data-act="${f.kind === 'gymout' ? 'gmoveGo' : 'gretGo'}" ${ps.length ? '' : 'disabled'}>${f.kind === 'gymout' ? 'Μεταφορά' : 'Οριστική απόσυρση'}</button>`;
}
ACT.gretGo = () => {
  const f = S.form; const lots = gymLots(f.gym); const lines = [];
  for (const [p, q] of Object.entries(f.cart)) {
    let left = q;
    for (const l of lots.filter(x => x.p === p)) { const t = Math.min(l.qty, left); if (t > 0) lines.push({ p, pl: l.pl, li: l.li, qty: t }); left -= t; if (!left) break; }
  }
  confirmOp({ type: 'RETIRE_G', id: uid(), gym: f.gym, note: f.reason, lines },
    { title: 'Απόσυρση από γυμναστήριο', intro: `<div class="small">Γυμναστήριο: <b>${esc(gymName(f.gym))}</b>${f.reason ? ' · ' + esc(f.reason) : ''}. Τα προϊόντα αφαιρούνται από τα εγκατεστημένα· το ιστορικό διατηρείται.</div>`, onDone: () => { f.cart = {}; render(true); } });
};

/* ================= ΕΛΕΓΧΟΣ ΤΟΠΟΘΕΤΗΣΗΣ: σκοπός ανά προϊόν & παλιά τεμάχια ================= */
const OLD_KINDS = [['x', 'Πετάχτηκαν επιτόπου', 'Πέταμα'], ['u', 'Μεταχειρισμένα', 'Μεταχειρισμένα'], ['d', 'Κατεστραμμένα', 'Κατεστραμμένα'], ['c', 'Προς έλεγχο', 'Προς έλεγχο']];
const oldSum = r => (r.x || 0) + (r.u || 0) + (r.d || 0) + (r.c || 0);
const oldBack = r => (r.u || 0) + (r.d || 0) + (r.c || 0);
function openPlaceReview({ src, veh, wh, gym, purpose, reason, lines, onDone, supplier }) {
  // αποθήκη προέλευσης κάθε γραμμής = από εκεί που ήρθε το καινούργιο
  const originOf = l => {
    if (src === 'gwh') return `W|${wh}|${l.sec || sections(wh)[0].id}`;
    const pk = S.pk[l.pk]; if (pk && S.wh[pk.wh] && S.wh[pk.wh].active !== false) { const sc = pk.lines[l.li] ? pk.lines[l.li].sec : null; return `W|${pk.wh}|${sc && sections(pk.wh).some(s => s.id === sc) ? sc : sections(pk.wh)[0].id}`; }
    return null;
  };
  const destLabel = k => { if (k === 'V') return `Στο ${vehName(veh)}`; const [, w, sc] = k.split('|'); return whName(w) + (hasSections(w) ? ' / ' + secName(w, sc) : ''); };
  const allW = []; activeList(S.wh).forEach(([w]) => sections(w).forEach(sc => allW.push(`W|${w}|${sc.id}`)));
  const gwh = gymWarehouses(gym)[0]; const supDef = gwh ? `W|${gwh}|${sections(gwh)[0].id}` : allW[0];
  const rows = lines.map(l => { const o = src === 'sup' ? null : originOf(l); return { ...l, purpose: purpose === 'repl' ? 'repl' : 'new', x: 0, u: 0, d: 0, c: 0, problem: reason || '', useInst: true, origin: o, dest: o || (src === 'veh' ? 'V' : src === 'sup' ? supDef : allW[0]) }; });
  const opId = uid();
  const instLots = p => gymInstLots(gym, p);
  const instTotal = p => instLots(p).reduce((s, x) => s + x.q, 0);
  const allocInst = () => { // κατανομή ανά γραμμή χωρίς διπλομέτρημα για ίδιο προϊόν
    const used = {}; return rows.map(r => {
      if (r.purpose !== 'repl' || !r.useInst) return [];
      let want = oldSum(r); const out = [];
      for (const x of instLots(r.p)) { const k = x.pl + '|' + x.li; const free = x.q - (used[k] || 0); const t = Math.min(free, want); if (t > 0) { out.push({ pl: x.pl, li: x.li, q: t }); used[k] = (used[k] || 0) + t; want -= t; } if (!want) break; }
      return out; }); };
  const destSelect = (r, i) => {
    const opts = [];
    if (r.origin) opts.push(opt(r.origin, `Επιστροφή στην αποθήκη προέλευσης · ${destLabel(r.origin)}`, r.dest === r.origin));
    if (src === 'veh') opts.push(opt('V', `Στο ${vehName(veh)} (θα επιστραφούν σε αποθήκη αργότερα)`, r.dest === 'V'));
    const others = allW.filter(k => k !== r.origin); const isG = k => !!(S.wh[k.split('|')[1]] || {}).gym;
    const oN = others.filter(k => !isG(k)), oG = others.filter(isG);
    if (oN.length) opts.push(`<optgroup label="Άλλη αποθήκη">${oN.map(k => opt(k, destLabel(k), r.dest === k)).join('')}</optgroup>`);
    if (oG.length) opts.push(`<optgroup label="Αποθήκη γυμναστηρίου">${oG.map(k => opt(k, destLabel(k), r.dest === k)).join('')}</optgroup>`);
    return `<div class="f" data-dw="${i}" style="${oldBack(r) ? '' : 'display:none'}"><label for="pd${i}">Πού πάνε τα παλιά που επιστρέφουν</label><select id="pd${i}" data-pd="${i}">${opts.join('')}</select></div>`;
  };
  const draw = err => {
    openModal(`${mhead(src === 'sup' ? 'Εισαγωγή σε γυμναστήριο από προμηθευτή' : 'Τοποθέτηση σε γυμναστήριο', `${esc(gymName(gym))} · από ${src === 'veh' ? esc(vehName(veh)) : src === 'sup' ? esc(supplier || 'προμηθευτή') : esc(whName(wh))}`)}
      <div class="row"><span class="lbl">Για όλα</span><button class="btn sm" id="allNew">Όλα νέα τοποθέτηση</button><button class="btn sm" id="allRepl">Όλα αντικατάσταση</button></div>
      <div class="rvlist">${rows.map((r, i) => `<div class="rv ${r.purpose === 'repl' ? 'repl' : ''}">
        <div class="hd">${thumb(r.p)}<div class="nm"><b>${esc(prodName(r.p))}</b>${catTags(r.p)}</div><b class="num" style="white-space:nowrap">${qtyU(r.qty, r.p)}</b></div>
        <div class="f"><label for="pp${i}">Σκοπός</label><select id="pp${i}" data-pp="${i}">${opt('new', 'Νέα τοποθέτηση', r.purpose !== 'repl')}${opt('repl', 'Αντικατάσταση', r.purpose === 'repl')}</select></div>
        ${r.purpose === 'repl' ? `<div class="small" style="margin:2px 0 6px">Τι έγιναν τα ${qtyU(r.qty, r.p)} παλιά; Σύνολο ${fmtN(r.qty)}. <span data-osum="${i}"></span></div>
          <div class="chips" style="margin-bottom:6px">${OLD_KINDS.map(([k, , s]) => `<button type="button" class="chip" data-oall="${i}" data-k="${k}">Όλα: ${s}</button>`).join('')}</div>
          <div class="olds">${OLD_KINDS.map(([k, l]) => `<div class="f"><label for="po${i}${k}">${l}</label><input type="number" inputmode="decimal" min="0" step="any" id="po${i}${k}" data-po="${i}" data-k="${k}" value="${r[k] || ''}" placeholder="0"></div>`).join('')}</div>
          ${destSelect(r, i)}
          <div class="f"><label for="prb${i}">Πρόβλημα παλιών</label><input type="text" id="prb${i}" data-prob="${i}" value="${esc(r.problem)}" placeholder="π.χ. καμμένο, σπασμένο"></div>
          ${instTotal(r.p) ? `<label class="check"><input type="checkbox" data-ui="${i}" ${r.useInst ? 'checked' : ''}> Τα παλιά ήταν καταχωρισμένα ως εγκατεστημένα εδώ (υπάρχουν ${qtyU(instTotal(r.p), r.p)}) — αφαίρεσή τους από τα εγκατεστημένα</label>` : ''}` : ''}
      </div>`).join('')}</div>
      ${rows.some(r => r.purpose === 'repl') ? `<div class="hint">Μεταχειρισμένα, κατεστραμμένα και προς έλεγχο μπαίνουν στον προορισμό με αυτή την κατάσταση. Όσα πετάχτηκαν επιτόπου μόνο καταγράφονται. Στη στατιστική μετράει πάντα η ποσότητα που αντικαταστάθηκε.</div>` : ''}
      <div id="prerr">${err ? `<div class="errbox">${esc(err)}</div>` : ''}</div>
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri big" id="prok">Επιβεβαίωση</button></div>`);
    $('#allNew').onclick = () => { rows.forEach(r => { r.purpose = 'new'; }); draw(); };
    $('#allRepl').onclick = () => { rows.forEach(r => { r.purpose = 'repl'; }); draw(); };
    $$('[data-pp]').forEach(sl => sl.onchange = () => { rows[sl.dataset.pp].purpose = sl.value; draw(); });
    const showSum = i => { const r = rows[i]; const s = oldSum(r); const el = document.querySelector(`[data-osum="${i}"]`);
      if (el) el.innerHTML = Math.abs(s - r.qty) < 1e-9 ? '<b style="color:var(--ok)">✓ Σωστό</b>' : `<b style="color:var(--danger)">Συμπληρωμένα: ${fmtN(s)}</b>`;
      const dw = document.querySelector(`[data-dw="${i}"]`); if (dw) dw.style.display = oldBack(r) ? '' : 'none'; };
    // αυτόματη εξισορρόπηση: ό,τι γράφεται σε ένα πεδίο αφαιρείται από τα άλλα, ώστε το σύνολο να μη ξεπερνά την ποσότητα
    $$('[data-po]').forEach(inp => inp.oninput = () => {
      const i = inp.dataset.po, k = inp.dataset.k, r = rows[i];
      let n = Number(inp.value) || 0; if (n < 0) n = 0; if (n > r.qty) { n = r.qty; inp.value = n; }
      r[k] = n; let over = oldSum(r) - r.qty;
      for (const o of ['d', 'c', 'u', 'x'].filter(o => o !== k)) { if (over <= 1e-9) break; const t = Math.min(r[o] || 0, over); if (t > 0) { r[o] -= t; over -= t; const el = document.getElementById('po' + i + o); if (el) el.value = r[o] || ''; } }
      showSum(i);
    });
    $$('[data-oall]').forEach(b => b.onclick = () => { const i = b.dataset.oall, r = rows[i]; OLD_KINDS.forEach(([k]) => { r[k] = k === b.dataset.k ? r.qty : 0; const el = document.getElementById('po' + i + k); if (el) el.value = r[k] || ''; }); showSum(i); });
    $$('[data-pd]').forEach(sl => sl.onchange = () => { rows[sl.dataset.pd].dest = sl.value; });
    $$('[data-prob]').forEach(inp => inp.oninput = () => { rows[inp.dataset.prob].problem = inp.value; });
    $$('[data-ui]').forEach(c => c.onchange = () => { rows[c.dataset.ui].useInst = c.checked; });
    rows.forEach((r, i) => { if (r.purpose === 'repl') showSum(i); });
    $('#prok').onclick = async () => {
      for (const r of rows) if (r.purpose === 'repl' && Math.abs(oldSum(r) - r.qty) > 1e-9)
        return draw(`«${prodName(r.p)}»: αντικαταστάθηκαν ${fmtN(r.qty)}. Δηλώστε τι έγιναν τα ${fmtN(r.qty)} παλιά (πετάχτηκαν, μεταχειρισμένα, κατεστραμμένα ή προς έλεγχο) — τώρα είναι ${fmtN(oldSum(r))}.`);
      const fi = allocInst();
      const toDest = k => k === 'V' ? { t: 'V' } : (() => { const [, w, sc] = k.split('|'); return { t: 'W', wh: w, sec: sc }; })();
      const ls = rows.map((r, i) => { const base = src === 'veh' ? { p: r.p, pk: r.pk, li: r.li, qty: r.qty } : src === 'sup' ? { p: r.p, qty: r.qty } : { p: r.p, sec: r.sec, qty: r.qty };
        return Object.assign(base, r.purpose === 'repl' ? { purpose: 'repl', old: { x: r.x || 0, u: r.u || 0, c: r.c || 0, d: r.d || 0 }, problem: r.problem || '', oldDest: oldBack(r) ? toDest(r.dest) : undefined } : { purpose: 'new' }, fi[i].length ? { fromInst: fi[i] } : {}); });
      const op = src === 'veh' ? { type: 'PLACE', id: opId, veh, gym, lines: ls } : src === 'sup' ? { type: 'SUPPLY', id: opId, gym, supplier, lines: ls } : { type: 'INSTALL', id: opId, wh, gym, lines: ls };
      const perr = opPermError(op); if (perr) return draw(perr);
      try { dryRun(op); } catch (e) { return draw(e.message); }
      $('#prok').disabled = true;
      try { const res = await execute(op); closeModal(); showReceipt(res); if (onDone) onDone(res); } catch (e) { draw(e.message); }
    };
  };
  draw();
}

/* ================= ΕΙΣΑΓΩΓΗ ΣΕ ΓΥΜΝΑΣΤΗΡΙΟ: επιλογή τρόπου ================= */
VIEWS.gymin = () => `<div class="wrap">${pageHead('Τοποθέτηση ή εγκατάσταση', 'Εισαγωγή σε γυμναστήριο')}
  <div class="hint">Επιλέξτε από πού έρχονται τα προϊόντα που μπαίνουν στο γυμναστήριο. Σε κάθε τρόπο ορίζετε αν είναι νέα τοποθέτηση ή αντικατάσταση.</div>
  <div class="choice">
    <button class="act" data-act="ginGo" data-v="place"><b>Από αμάξι</b><span>Τοποθέτηση · ό,τι φορτώθηκε με λίστα παραλαβής</span></button>
    <button class="act" data-act="ginGo" data-v="install"><b>Από αποθήκη γυμναστηρίου</b><span>Εγκατάσταση · ό,τι είναι αποθηκευμένο μέσα στο γυμναστήριο</span></button>
    <button class="act" data-act="ginGo" data-v="gymsup"><b>Από προμηθευτή</b><span>Κατευθείαν εγκατάσταση · χωρίς αποθήκη και αμάξι</span></button>
    <button class="act" data-go="gymout"><b>Από άλλο γυμναστήριο</b><span>Μεταφορά εγκατεστημένων από γυμναστήριο σε γυμναστήριο</span></button>
  </div></div>`;
ACT.ginGo = el => { S.form = null; go(el.dataset.v); };

/* ================= ΜΕΤΑΦΟΡΑ ΑΠΟ ΓΥΜΝΑΣΤΗΡΙΟ: σε άλλο γυμναστήριο ή σε αποθήκη ================= */
VIEWS.gymout = a => {
  if (!S.form || S.form.kind !== 'gymout') S.form = { kind: 'gymout', gym: a && S.gym[a] ? a : (activeList(S.gym).find(([g]) => gymLots(g).length) || activeList(S.gym)[0] || [''])[0], cat: '', sub: '', ptype: '', q: '', cart: {}, reason: '', dest: 'W', toGym: '', toWh: '', toSec: '', cond: 'N' };
  const f = S.form;
  if (!activeList(S.gym).length) return `<div class="wrap"><h1>Μεταφορά από γυμναστήριο</h1><div class="panel empty">Δεν υπάρχουν γυμναστήρια.</div></div>`;
  const others = activeList(S.gym).filter(([g]) => g !== f.gym);
  if (f.dest === 'G' && !others.some(([g]) => g === f.toGym)) f.toGym = (others[0] || [''])[0];
  if (f.dest === 'W') { if (!f.toWh || !S.wh[f.toWh]) f.toWh = gymWarehouses(f.gym)[0] || defaultWh(); if (!sections(f.toWh).some(s => s.id === f.toSec)) f.toSec = sections(f.toWh)[0].id; }
  AFTER.push(() => {
    $('#rggym').onchange = e => { f.gym = e.target.value; f.cart = {}; render(true); };
    $('#rgreason').oninput = e => f.reason = e.target.value;
    $('#fq').oninput = e => { f.q = e.target.value; renderGymRetList(); };
    const b = (id, fn) => { const e = $('#' + id); if (e) e.onchange = () => { fn(e.value); render(true); }; };
    b('gmtg', v => f.toGym = v); b('gmwh', v => { f.toWh = v; f.toSec = sections(v)[0].id; }); b('gmsec', v => f.toSec = v);
    renderGymRetList(); updateGymRetBar();
  });
  return `<div class="wrap">
    <div class="ph"><div class="tt"><span class="eyebrow">Εγκατεστημένα → άλλο γυμναστήριο ή αποθήκη</span><h1>Μεταφορά από γυμναστήριο</h1></div></div>
    ${!can('move') ? `<div class="warnbox">Ο ρόλος σας (${esc(ROLE_LABEL[S.me.role])}) επιτρέπει μόνο προβολή σε αυτή την ενέργεια.</div>` : ''}
    <div class="panel"><div class="fields">${gymSelect('rggym', f.gym, { label: 'Από γυμναστήριο' })}</div>
      <span class="lbl" style="display:block;margin-top:12px">Προς</span>
      <div class="chips" style="margin:6px 0 10px"><button class="chip ${f.dest === 'W' ? 'on' : ''}" data-act="gmDest" data-v="W">Σε αποθήκη</button><button class="chip ${f.dest === 'G' ? 'on' : ''}" data-act="gmDest" data-v="G">Σε άλλο γυμναστήριο</button></div>
      <div class="fields">${f.dest === 'G' ? (others.length ? `<div class="f"><label for="gmtg">Γυμναστήριο προορισμού</label><select id="gmtg">${others.map(([g, x]) => opt(g, x.name, g === f.toGym)).join('')}</select></div>` : '<div class="warnbox">Δεν υπάρχει άλλο γυμναστήριο.</div>')
        : `<div class="f"><label for="gmwh">Αποθήκη</label><select id="gmwh">${whOpts(f.toWh)}</select></div>${hasSections(f.toWh) ? `<div class="f"><label for="gmsec">Χώρος</label><select id="gmsec">${sections(f.toWh).map(s => opt(s.id, s.name, s.id === f.toSec)).join('')}</select></div>` : ''}`}
        <div class="f"><label for="rgreason">Σημείωση / αιτία</label><input type="text" id="rgreason" value="${esc(f.reason)}" placeholder="π.χ. κλείσιμο χώρου, ανακατανομή"></div></div>
      <span class="lbl" style="display:block;margin-top:12px">Κατάσταση προϊόντων</span>
      <div class="chips" style="margin-top:6px"><button class="chip ${f.cond === 'N' ? 'on' : ''}" data-act="gmCond" data-v="N">Καλή κατάσταση</button><button class="chip ${f.cond === 'U' ? 'on' : ''}" data-act="gmCond" data-v="U">Μεταχειρισμένο</button></div>
      <p class="hint" style="margin-top:10px">${f.dest === 'W' ? 'Στην αποθήκη μπαίνουν ως «' + (f.cond === 'U' ? 'Μεταχειρισμένα' : 'Κανονικά') + '».' : 'Στο άλλο γυμναστήριο καταχωρίζονται ως εγκατεστημένα, με νέα λίστα τοποθέτησης (σκοπός «Μεταφορά από άλλο γυμναστήριο»).'} Χαλασμένα αποσύρονται από «Καταστάσεις & απόσυρση → Απόσυρση από γυμναστήριο».</p></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">${catChips(f)}
      <input type="search" id="fq" placeholder="Αναζήτηση με κωδικό, όνομα ή περιγραφή" value="${esc(f.q)}" aria-label="Αναζήτηση προϊόντων"></div>
    <div class="plist" id="glist"></div>
    <div class="cartbar" id="cartbar"></div></div>`;
};
ACT.gmDest = el => { S.form.dest = el.dataset.v; render(true); };
ACT.gmCond = el => { S.form.cond = el.dataset.v; render(true); };
ACT.gmoveGo = () => {
  const f = S.form; const lots = gymLots(f.gym); const lines = [];
  for (const [p, q] of Object.entries(f.cart)) { let left = q; for (const l of lots.filter(x => x.p === p)) { const t = Math.min(l.qty, left); if (t > 0) lines.push({ p, pl: l.pl, li: l.li, qty: t }); left -= t; if (!left) break; } }
  const to = f.dest === 'G' ? { t: 'G', gym: f.toGym } : { t: 'W', wh: f.toWh, sec: f.toSec };
  if (f.dest === 'G' && !f.toGym) return toast('Επιλέξτε γυμναστήριο προορισμού.', true);
  confirmOp({ type: 'GYM_MOVE', id: uid(), gym: f.gym, to, cond: f.cond, note: f.reason, lines },
    { title: 'Μεταφορά από γυμναστήριο', intro: `<div class="small">${esc(gymName(f.gym))} → <b>${esc(f.dest === 'G' ? gymName(f.toGym) : whName(f.toWh) + (hasSections(f.toWh) ? ' / ' + secName(f.toWh, f.toSec) : ''))}</b> · ${f.cond === 'U' ? 'Μεταχειρισμένα' : 'Καλή κατάσταση'}${f.reason ? ' · ' + esc(f.reason) : ''}</div>`, onDone: () => { f.cart = {}; render(true); } });
};

/* ================= ΕΙΣΑΓΩΓΗ ΣΕ ΓΥΜΝΑΣΤΗΡΙΟ ΑΠΟ ΠΡΟΜΗΘΕΥΤΗ ================= */
VIEWS.gymsup = a => {
  if (!S.form || S.form.kind !== 'gymsup') S.form = { kind: 'gymsup', gym: a && S.gym[a] ? a : '', supplier: '', purpose: 'new', reason: '', cat: '', sub: '', ptype: '', q: '', cart: {} };
  const f = S.form;
  if (!activeList(S.gym).length) return `<div class="wrap"><h1>Εισαγωγή από προμηθευτή</h1><div class="panel empty">Δεν υπάρχουν γυμναστήρια.</div></div>`;
  AFTER.push(() => {
    $('#sgym').onchange = e => { f.gym = e.target.value; };
    $('#ssup').oninput = e => f.supplier = e.target.value;
    $$('[data-pf=spur]').forEach(c => c.onclick = () => { f.purpose = c.dataset.purpose; render(true); });
    const r = $('#spurr'); if (r) r.oninput = () => f.reason = r.value;
    $('#fq').oninput = e => { f.q = e.target.value; renderSupList(); };
    renderSupList(); updateSupBar();
  });
  return `<div class="wrap">
    <div class="ph"><div class="tt"><span class="eyebrow">Εισαγωγή σε γυμναστήριο · από προμηθευτή</span><h1>Κατευθείαν εγκατάσταση</h1></div></div>
    <div class="hint">Για προϊόντα που ο προμηθευτής παραδίδει απευθείας στο γυμναστήριο. Καταχωρίζονται ως εγκατεστημένα, με νέα λίστα τοποθέτησης. Αν θέλετε να μείνουν αποθηκευμένα στο γυμναστήριο, κάντε «Εισαγωγή σε αποθήκη» στην αποθήκη του γυμναστηρίου.</div>
    ${!can('move') ? `<div class="warnbox">Ο ρόλος σας (${esc(ROLE_LABEL[S.me.role])}) επιτρέπει μόνο προβολή σε αυτή την ενέργεια.</div>` : ''}
    <div class="panel"><div class="fields">${gymSelect('sgym', f.gym, { blank: true })}
      <div class="f"><label for="ssup">Προμηθευτής</label><input type="text" id="ssup" value="${esc(f.supplier)}" placeholder="π.χ. Technogym Hellas"></div>
      ${purposeField('spur', f.purpose, f.reason)}</div></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">${catChips(f)}
      <input type="search" id="fq" placeholder="Αναζήτηση στον γενικό πίνακα προϊόντων" value="${esc(f.q)}" aria-label="Αναζήτηση προϊόντων"></div>
    <div class="plist" id="slist"></div>
    <div class="cartbar" id="cartbar"></div></div>`;
};
function renderSupList() {
  const f = S.form; const box = $('#slist'); if (!box) return;
  const ids = sortProds(Object.keys(S.prod).filter(p => prodMatches(p, f) && !isMat(p)));
  if (!ids.length) { box.innerHTML = '<div class="empty">Δεν βρέθηκαν προϊόντα.</div>'; return; }
  box.innerHTML = ids.slice(0, 300).map(p => `<div class="prow ${f.cart[p] ? 'sel' : ''}">${thumb(p)}<div class="pinfo"><span class="nm">${esc(prodName(p))}</span>
    ${catTags(p)}<span class="meta"><span class="mono">${esc(prodCode(p))}</span><span>${esc(unitOf(p))}</span></span></div>
    <div class="qty"><input type="number" min="0" step="any" data-sp="${p}" value="${f.cart[p] || ''}" placeholder="0" aria-label="Ποσότητα"></div></div>`).join('');
  fillPhotos(box);
  $$('[data-sp]', box).forEach(inp => inp.oninput = () => { const n = Number(inp.value) || 0; if (n > 0) f.cart[inp.dataset.sp] = n; else delete f.cart[inp.dataset.sp]; inp.closest('.prow').classList.toggle('sel', n > 0); updateSupBar(); });
}
function updateSupBar() {
  const bar = $('#cartbar'); const f = S.form; if (!bar) return; const ps = Object.keys(f.cart);
  bar.innerHTML = `<div class="sum">${ps.length ? `<b>${ps.length}</b> ${ps.length === 1 ? 'προϊόν' : 'προϊόντα'} · ${sumByUnit(ps.map(p => ({ p, q: f.cart[p] })))}` : 'Επιλέξτε προϊόντα και ποσότητες'}</div>
    <button class="btn pri" data-act="supGo" ${ps.length && can('move') ? '' : 'disabled'}>Συνέχεια</button>`;
}
ACT.supGo = () => {
  const f = S.form; if (!f.gym) { toast('Επιλέξτε γυμναστήριο.', true); const g = $('#sgym'); if (g) g.focus(); return; }
  openPlaceReview({ src: 'sup', gym: f.gym, supplier: f.supplier, purpose: f.purpose || 'new', reason: f.reason || '', lines: Object.entries(f.cart).map(([p, q]) => ({ p, qty: q })), onDone: () => { f.cart = {}; render(true); } });
};

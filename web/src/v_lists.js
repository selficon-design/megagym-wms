/* ================================================================
   ΠΙΝΑΚΑΣ, ΛΙΣΤΕΣ, ΚΑΡΤΕΛΕΣ
   ================================================================ */
const pageHead = (eyebrow, title, right = '', crumb = '') =>
  `<div class="ph"><div class="tt">${crumb ? `<span class="crumb">${crumb}</span>` : ''}<span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div>${right ? `<div class="btns">${right}</div>` : ''}</div>`;
const movsFor = pred => S.mov.filter(m => m.state !== 'pending' && pred(m));
function movRows(list, { showProd = null } = {}) {
  if (!list.length) return `<div class="empty">Δεν υπάρχουν κινήσεις.</div>`;
  return `<div class="tw"><table><thead><tr><th>Αριθμός</th><th>Τύπος</th><th>Ημερομηνία</th><th>Από → Προς</th>${showProd ? '<th class="r">Ποσότητα</th>' : '<th class="r">Γραμμές</th>'}<th>Χρήστης</th></tr></thead><tbody>` +
    list.map(m => {
      const q = showProd ? m.lines.filter(l => l.p === showProd).reduce((s, l) => s + (m.type === 'INV' && l.diff != null ? l.diff : l.qty), 0) : null;
      return `<tr class="click" data-act="openMov" data-id="${m.id}"><td><span class="docno">${esc(m.docNo)}</span></td><td>${esc(ENG.TYPES[m.type].label)}</td>
      <td class="num">${esc(fmtDT(m.ts))}</td><td>${esc(locName(m.from))} → ${esc(locName(m.to))}</td>
      <td class="r">${showProd ? qtyU(q, showProd) : m.lines.length}</td><td>${esc(uname(m.by))}</td></tr>`;
    }).join('') + `</tbody></table></div>`;
}
ACT.openMov = el => openMovModal(el.dataset.id);
function openMovModal(id) {
  const m = S.movById[id]; if (!m) return toast('Η κίνηση δεν βρέθηκε στις φορτωμένες.', true);
  const refs = [];
  if (m.refs && m.refs.pk) refs.push(`<button class="btn sm" data-act="modalGo" data-v="pk" data-a="${m.refs.pk}">${esc(pkLabel(m.refs.pk))}</button>`);
  (m.refs && m.refs.pks || []).filter(x => x !== (m.refs.pk)).forEach(p => refs.push(`<button class="btn sm" data-act="modalGo" data-v="pk" data-a="${p}">${esc(pkLabel(p))}</button>`));
  if (m.refs && m.refs.pl && S.pl[m.refs.pl]) refs.push(`<button class="btn sm" data-act="modalGo" data-v="pl" data-a="${m.refs.pl}">${esc(S.pl[m.refs.pl].docNo)}</button>`);
  if (m.refs && m.refs.inv) refs.push(`<button class="btn sm" data-act="modalGo" data-v="inv" data-a="${m.refs.inv}">Απογραφή</button>`);
  openModal(`${mhead(`<span class="docno">${esc(m.docNo)}</span> ${esc(ENG.TYPES[m.type].label)}`, `${esc(fmtDT(m.ts))} · ${esc(uname(m.by))} · Α/Α κίνησης ${m.no}`)}
    <div class="row"><b>${esc(locName(m.from))}</b><span>→</span><b>${esc(locName(m.to))}</b></div>
    ${m.note ? `<div class="small"><span class="lbl">Σημείωση</span> ${esc(m.note)}</div>` : ''}
    ${movTable(Object.assign({}, m, { wh: m.from && m.from.id, toWh: m.to && m.to.id }))}
    ${refs.length ? `<div class="row"><span class="lbl">Συνδεδεμένα</span>${refs.join('')}</div>` : ''}
    <div class="btns" style="justify-content:flex-end"><button class="btn pri" data-act="closeModal">Κλείσιμο</button></div>`);
}

/* ---------------- ΠΙΝΑΚΑΣ ---------------- */
VIEWS.dash = () => {
  const prods = Object.keys(S.prod).filter(p => S.prod[p].active !== false && !S.prod[p].deleted);
  const ent = k => Object.keys(S.bal).map(p => ({ p, q: prodTotals(p)[k] }));
  const pend = S.mov.filter(m => m.state === 'pending' && Date.now() - m.ts > 20000);
  const recentPk = Object.entries(S.pk).sort((a, b) => b[1].no - a[1].no).slice(0, 5);
  const recentPl = Object.entries(S.pl).sort((a, b) => b[1].no - a[1].no).slice(0, 5);
  const recentRet = S.mov.filter(m => m.type === 'RETURN' || m.type === 'UNPLACE').slice(0, 5);
  const empty = !prods.length && !Object.keys(S.wh).length;
  return `<div class="wrap">
    ${pageHead(esc(S.company.name || 'MEGA GYM'), 'Πίνακας αποθήκης', `<button class="btn pri" data-act="replOpen" data-g="">Αντικαταστάσεις</button>`, esc(new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())))}
    ${pend.length ? `<div class="warnbox">Υπάρχει ${pend.length} κίνηση που δεν ολοκληρώθηκε (π.χ. διακοπή σύνδεσης). <button class="btn sm" data-act="recover">Ολοκλήρωση τώρα</button></div>` : ''}
    ${!S.me.id ? `<div class="warnbox">Δεν είστε συνδεδεμένοι. Μπορείτε μόνο να δείτε δεδομένα.</div>` : ''}
    ${S.me.id && S.me.role === 'viewer' && !S.me.isOwner ? `<div class="warnbox">Έχετε δικαίωμα προβολής. Για καταχώριση κινήσεων, ζητήστε από τον διαχειριστή να σας ορίσει ρόλο στην ενότητα «Χρήστες & δικαιώματα».</div>` : ''}
    ${empty ? `<div class="panel"><h2>Η βάση είναι άδεια</h2><p class="hint">Ξεκινήστε από τις <a data-go="setup">Ρυθμίσεις</a>: εταιρεία, αποθήκες, γυμναστήρια, οχήματα και είδη/κατηγορίες. Μετά προσθέστε προϊόντα από την Εισαγωγή.</p></div>` : ''}
    <div class="panel"><span class="lbl">Τι δουλειά κάνετε τώρα;</span><div class="modecards" style="margin-top:8px">${MODES.map(([m, l, d]) => `<button class="modecard ${MODE === m ? 'on' : ''}" data-act="mode" data-m="${m}"><b>${esc(l)}</b><span>${esc(d)}</span></button>`).join('')}</div></div>
    <div class="acts">
      ${[['imp', 'Εισαγωγή σε αποθήκη', 'Νέο φορτίο σε αποθήκη', 'wp'], ['load', 'Παραλαβή από αποθήκη', 'Φόρτωση στο αμάξι με λίστα', 'wp'], ['gymin', 'Εισαγωγή σε γυμναστήριο', 'Από αμάξι ή αποθήκη γυμναστηρίου', 'w'],
        ['gymsup', 'Εισαγωγή από προμηθευτή', 'Κατευθείαν εγκατάσταση στο γυμναστήριο', 's'], ['gymout', 'Μεταφορά από γυμναστήριο', 'Σε άλλο γυμναστήριο ή αποθήκη', 's'], ['retireg', 'Απόσυρση από γυμναστήριο', 'Οριστική αφαίρεση εγκατεστημένων', 's'],
        ['proc', 'Επεξεργασία υλικού', 'Κοπή · κατανάλωση · ρετάλια', 'p'], ['mats', 'Υλικά & ρετάλια', 'Τι υπάρχει και πού', 'p'],
        ['ret', 'Επιστροφή', 'Από αμάξι σε αποθήκη', 'w'], ['vehs', 'Φορτίο αμαξιού', 'Τι υπάρχει στο αμάξι', 'wp'], ['invs', 'Απογραφή', 'Καταμέτρηση & διορθώσεις', 'w']]
        .filter(x => inMode(x[3])).map(([k, l, d]) => `<button class="act" data-go="${k}"><b>${l}</b><span>${d}</span></button>`).join('')}
      <button class="act ai" data-act="openAi"><b>AI Assistant</b><span>Ερωτήσεις & εντολές</span></button>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="l">Προϊόντα</span><span class="v">${prods.length}</span><span class="u">ενεργοί κωδικοί</span></div>
      <div class="kpi"><span class="l">Αποθήκες</span><span class="v">${activeList(S.wh).length}</span><span class="u">${Object.values(S.wh).reduce((s, w) => s + (w.sections || []).filter(x => x.active !== false).length, 0)} χώροι</span></div>
      <div class="kpi"><span class="l">Οχήματα</span><span class="v">${activeList(S.veh).length}</span><span class="u">${activeList(S.gym).length} γυμναστήρια</span></div>
      <div class="kpi s"><span class="l">Διαθέσιμα προς χρήση</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('avail'))}</span><span class="u">αποθήκες + οχήματα · καλή κατάσταση</span></div>
      <div class="kpi"><span class="l">Διαθέσιμα στα οχήματα</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('VN'))}</span></div>
      <div class="kpi c click" data-act="replOpen" data-g="" title="Άνοιγμα στατιστικής αντικαταστάσεων"><span class="l">Αντικαταστάσεις μήνα ›</span><span class="v" style="font-size:1.1rem">${(() => { const d = new Date(); return sumByUnit(replacementRows({ from: new Date(d.getFullYear(), d.getMonth(), 1).getTime() }).map(r => ({ p: r.p, q: r.qty }))); })()}</span></div>
      <div class="kpi"><span class="l">Διαθέσιμα σε αποθήκες γυμν.</span><span class="v" style="font-size:1.1rem">${sumByUnit(Object.keys(S.bal).flatMap(p => Object.keys(S.gym).flatMap(g => gymWarehouses(g)).map(w => ({ p, q: whN(p, w) }))))}</span></div>
      <div class="kpi x"><span class="l">Εγκατεστημένα</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('G'))}</span><span class="u">όχι προς χρήση</span></div>
      <div class="kpi x"><span class="l">Παλιά στα οχήματα</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('VO'))}</span><span class="u">από αντικαταστάσεις</span></div>
      <div class="kpi u"><span class="l">Μεταχειρισμένα</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('WU'))}</span></div>
      <div class="kpi d"><span class="l">Κατεστραμμένα</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('WD'))}</span></div>
      <div class="kpi c"><span class="l">Προς έλεγχο</span><span class="v" style="font-size:1.1rem">${sumByUnit(ent('WC'))}</span></div>
    </div>
    <div class="grid2">
      <div class="panel"><h2>Πρόσφατες παραλαβές</h2>${recentPk.length ? `<div class="list">${recentPk.map(([id, p]) => pkItem(id, p)).join('')}</div>` : '<div class="empty">Καμία παραλαβή ακόμη.</div>'}</div>
      <div class="panel"><h2>Πρόσφατες τοποθετήσεις</h2>${recentPl.length ? `<div class="list">${recentPl.map(([id, p]) => plItem(id, p)).join('')}</div>` : '<div class="empty">Καμία τοποθέτηση ακόμη.</div>'}</div>
    </div>
    <div class="panel"><h2>Πρόσφατες επιστροφές</h2>${movRows(recentRet)}</div>
  </div>`;
};
ACT.recover = async () => {
  setBusy('Ολοκλήρωση εκκρεμών κινήσεων…');
  try { await SB.resync(); toast('Τα δεδομένα ενημερώθηκαν.'); } catch (e) { toast(e.message, true); } finally { setBusy(null); }
};

/* ---------------- ΛΙΣΤΕΣ ΠΑΡΑΛΑΒΩΝ ---------------- */
function pkItem(id, p) {
  const st = pkStatus(id);
  return `<div class="li" data-go="pk" data-a="${id}"><span class="docno">${esc(p.docNo)}</span>
    <div class="main"><b>${esc(whName(p.wh))} → ${esc(vehName(p.veh))}</b><span class="muted small">${esc(fmtD(p.ts))} · ${esc(fmtT(p.ts))} · ${p.lines.length} ${p.lines.length === 1 ? 'προϊόν' : 'προϊόντα'} · ${esc(uname(p.by))}</span></div>
    <div class="side"><span class="tag ${st.cls}">${st.label}</span>${st.rem > 0 ? `<span class="small muted">στο αμάξι: ${sumByUnit(p.lines.map((l, i) => ({ p: l.p, q: pkRemaining(id)[i] || 0 })))}</span>` : ''}</div></div>`;
}
VIEWS.pks = () => {
  const f = S.listF = (S.listF && S.listF.k === 'pks') ? S.listF : { k: 'pks', st: '', veh: '', wh: '', q: '' };
  let list = Object.entries(S.pk).sort((a, b) => b[1].no - a[1].no);
  if (f.veh) list = list.filter(([, p]) => p.veh === f.veh);
  if (f.wh) list = list.filter(([, p]) => p.wh === f.wh);
  if (f.st === 'open') list = list.filter(([id]) => pkStatus(id).rem > 0);
  if (f.st === 'done') list = list.filter(([id]) => pkStatus(id).rem <= 0);
  if (f.q) { const q = norm(f.q); list = list.filter(([, p]) => norm(p.docNo).includes(q) || String(p.no).includes(q) || p.lines.some(l => norm(prodName(l.p)).includes(q))); }
  AFTER.push(() => {
    ['lfveh', 'lfwh', 'lfst'].forEach(id => $('#' + id).onchange = e => { f[{ lfveh: 'veh', lfwh: 'wh', lfst: 'st' }[id]] = e.target.value; render(true); });
    $('#lfq').onchange = e => { f.q = e.target.value; render(true); };
  });
  return `<div class="wrap">${pageHead('Από αποθήκη στο αμάξι', 'Λίστες παραλαβών', `<button class="btn pri" data-go="load">+ Νέα παραλαβή</button>`)}
    <div class="panel"><div class="fields">
      <div class="f"><label for="lfq">Αναζήτηση</label><input type="search" id="lfq" value="${esc(f.q)}" placeholder="Αριθμός ή προϊόν"></div>
      <div class="f"><label for="lfveh">Όχημα</label><select id="lfveh">${opt('', 'Όλα', !f.veh)}${activeList(S.veh).map(([k, v]) => opt(k, v.name, k === f.veh)).join('')}</select></div>
      <div class="f"><label for="lfwh">Αποθήκη</label><select id="lfwh">${opt('', 'Όλες', !f.wh)}${whOpts(f.wh)}</select></div>
      <div class="f"><label for="lfst">Κατάσταση</label><select id="lfst">${opt('', 'Όλες', !f.st)}${opt('open', 'Με προϊόντα στο αμάξι', f.st === 'open')}${opt('done', 'Ολοκληρωμένες', f.st === 'done')}</select></div>
    </div></div>
    ${list.length ? `<div class="list">${list.map(([id, p]) => pkItem(id, p)).join('')}</div>` : '<div class="panel empty">Δεν βρέθηκαν λίστες παραλαβής.</div>'}</div>`;
};
VIEWS.pk = id => {
  const p = S.pk[id]; if (!p) return `<div class="wrap"><div class="panel empty">Η λίστα δεν βρέθηκε.</div></div>`;
  const rem = pkRemaining(id); const st = pkStatus(id); const totRem = Object.values(rem).reduce((s, v) => s + v, 0);
  const hist = movsFor(m => m.refs && (m.refs.pk === id || (m.refs.pks || []).includes(id)));
  return `<div class="wrap">
    ${pageHead(`Λίστα παραλαβής · <span class="tag ${st.cls}">${st.label}</span>`, `<span class="docno" style="font-size:1.1rem">${esc(p.docNo)}</span> ${esc(whName(p.wh))} → ${esc(vehName(p.veh))}`, '', `<a data-go="pks">Λίστες παραλαβών</a>`)}
    <div class="muted">${esc(fmtD(p.ts))} · ${esc(fmtT(p.ts))} · ${esc(uname(p.by))} · ${p.lines.length} διαφορετικά προϊόντα</div>
    ${totRem > 0 && can('move') ? `<div class="panel"><h3>Τι γίνεται με όσα απομένουν στο αμάξι;</h3><div class="btns" style="margin-top:10px">
      <button class="btn pri" data-act="pkRetAll" data-id="${id}">Επιστροφή όλων στην αποθήκη</button>
      <button class="btn pri" data-act="pkPlaceAll" data-id="${id}">Τοποθέτηση όλων σε γυμναστήριο</button>
      <button class="btn" data-act="pkPick" data-id="${id}">Επιλογή προϊόντων</button>
      <button class="btn ghost" data-act="pkStay">Παραμονή στο αμάξι</button></div>
      <div class="hint" style="margin-top:8px">Οι επιλογές «όλα» αφορούν μόνο όσα βρίσκονται ακόμη στο αμάξι από αυτή τη λίστα. Πάντα εμφανίζεται προεπισκόπηση.</div></div>` : ''}
    <div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th>Είδος / Κατηγορία</th><th class="r">Παραλαβή</th><th class="r">Στο αμάξι</th><th class="r">Εγκατεστημένα</th><th class="r">Επιστράφηκαν</th><th class="r">Σε αποθ. γυμν.</th><th class="r">Αποσύρθ.</th></tr></thead><tbody>
    ${p.lines.map((l, i) => `<tr><td style="width:56px">${thumb(l.p)}</td><td><a data-go="prod" data-a="${l.p}" href="#"><b>${esc(prodName(l.p))}</b></a><div class="mono small muted">${esc(prodCode(l.p))}</div></td>
      <td class="small">${catTags(l.p)}${secLabel(p.wh, l.sec) ? `<div class="muted">Χώρος: ${esc(secLabel(p.wh, l.sec))}</div>` : ''}</td><td class="r">${qtyU(l.qty, l.p)}</td><td class="r"><b>${fmtN(rem[i] || 0)}</b></td>
      <td class="r">${fmtN(l.placed - l.back)}${l.back ? `<div class="small muted">${fmtN(l.placed)} τοποθ. · ${fmtN(l.back)} επέστρ. στο αμάξι</div>` : ''}</td><td class="r">${fmtN(l.returned)}</td><td class="r">${fmtN(l.toWh)}</td><td class="r">${fmtN(l.retired || 0)}</td></tr>`).join('')}
    </tbody></table></div>
    ${(p.rems || []).length ? `<div class="panel"><h2>Ρετάλια στη λίστα (${p.rems.length})</h2><div class="tw"><table><thead><tr><th>Υλικό</th><th>Διάσταση</th><th>Τώρα</th></tr></thead><tbody>${p.rems.map(x => { const r = S.rem[x.rem];
      return `<tr><td><b>${esc(prodName(x.p))}</b></td><td class="mono"><b>${esc(x.dims)}</b></td><td class="small">${!r ? '—' : r.status === 'used' ? 'Χρησιμοποιήθηκε' + (S.movById[r.usedMov] ? ' · ' + esc(S.movById[r.usedMov].docNo) : '') : r.status === 'retired' ? 'Αποσύρθηκε' : esc(remLoc(r))}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
    <div class="panel"><h2>Ιστορικό κινήσεων της λίστας</h2>${movRows(hist)}</div></div>`;
};
ACT.pkRetAll = el => openReturnAll(el.dataset.id);
ACT.pkPlaceAll = el => openPlaceAll(el.dataset.id);
ACT.pkPick = el => { const p = S.pk[el.dataset.id]; openVehForm('place', { veh: p.veh, pk: el.dataset.id }); };
ACT.pkStay = () => { toast('Τα προϊόντα παραμένουν στο αμάξι. Δεν έγινε καμία μεταβολή.'); go('pks'); };

/* ---------------- ΛΙΣΤΕΣ ΤΟΠΟΘΕΤΗΣΕΩΝ ---------------- */
function plItem(id, p) {
  const inst = plInstalled(id); const left = Object.values(inst).reduce((s, v) => s + v, 0);
  const pks = [...new Set(p.lines.map(l => l.pk).filter(Boolean))];
  return `<div class="li" data-go="pl" data-a="${id}"><span class="docno">${esc(p.docNo)}</span>
    <div class="main"><b>${esc(gymName(p.gym))} ${p.purpose === 'repl' || p.purpose === 'mixed' ? purposeTag(p.purpose) : ''}</b><span class="muted small">${esc(fmtD(p.ts))} · ${esc(fmtT(p.ts))} · ${p.src === 'veh' ? 'από ' + esc(vehName(p.veh)) : 'από ' + esc(whName(p.wh))}${pks.length ? ' · ' + pks.map(pkLabel).map(esc).join(', ') : ''}</span></div>
    <div class="side"><span class="small">${sumByUnit(p.lines.map((l, i) => ({ p: l.p, q: inst[i] })))} εγκατεστ.</span>${left <= 0 ? '<span class="tag g">Επιστράφηκαν όλα</span>' : ''}</div></div>`;
}
VIEWS.pls = () => {
  const f = S.listF = (S.listF && S.listF.k === 'pls') ? S.listF : { k: 'pls', gym: '', q: '' };
  let list = Object.entries(S.pl).sort((a, b) => b[1].no - a[1].no);
  if (f.gym) list = list.filter(([, p]) => p.gym === f.gym);
  if (f.q) { const q = norm(f.q); list = list.filter(([, p]) => norm(p.docNo).includes(q) || p.lines.some(l => norm(prodName(l.p)).includes(q) || norm(pkLabel(l.pk)).includes(q))); }
  AFTER.push(() => { $('#lfgym').onchange = e => { f.gym = e.target.value; render(true); }; $('#lfq').onchange = e => { f.q = e.target.value; render(true); }; });
  return `<div class="wrap">${pageHead('Εγκατεστημένα σε γυμναστήρια', 'Λίστες τοποθετήσεων', `<button class="btn pri" data-go="place">+ Νέα τοποθέτηση</button>`)}
    <div class="panel"><div class="fields"><div class="f"><label for="lfq">Αναζήτηση</label><input type="search" id="lfq" value="${esc(f.q)}" placeholder="Αριθμός, προϊόν ή παραλαβή"></div>
    <div class="f"><label for="lfgym">Γυμναστήριο</label><select id="lfgym">${opt('', 'Όλα', !f.gym)}${activeList(S.gym).map(([k, g]) => opt(k, g.name, k === f.gym)).join('')}</select></div></div></div>
    ${list.length ? `<div class="list">${list.map(([id, p]) => plItem(id, p)).join('')}</div>` : '<div class="panel empty">Δεν βρέθηκαν τοποθετήσεις.</div>'}</div>`;
};
VIEWS.pl = id => {
  const p = S.pl[id]; if (!p) return `<div class="wrap"><div class="panel empty">Η λίστα δεν βρέθηκε.</div></div>`;
  const inst = plInstalled(id); const left = Object.values(inst).reduce((s, v) => s + v, 0);
  const hist = movsFor(m => m.refs && (m.refs.pl === id || (m.refs.pls || []).includes(id)));
  const backLabel = p.src === 'veh' ? 'Επιστροφή στο αμάξι' : 'Επιστροφή στην αποθήκη γυμναστηρίου';
  return `<div class="wrap">
    ${pageHead('Λίστα τοποθέτησης', `<span class="docno" style="font-size:1.1rem">${esc(p.docNo)}</span> ${esc(gymName(p.gym))}`, left > 0 && can('move') && p.src !== 'gym' && p.src !== 'sup' ? `<button class="btn pri" data-act="plBack" data-id="${id}">${backLabel}</button>` : '', `<a data-go="pls">Λίστες τοποθετήσεων</a>`)}
    <div class="row">${purposeTag(p.purpose)}${(() => { const ds = [...new Set(p.lines.filter(l => l.old && (l.old.u || l.old.c || l.old.d)).map(l => destText(l.oldDest || p.oldDest || { t: 'V' }, p.veh)))]; return ds.length ? `<span class="small">Παλιά που επέστρεψαν → <b>${esc(ds.join(', '))}</b></span>` : ''; })()}</div>
    <div class="muted">${esc(fmtD(p.ts))} · ${esc(fmtT(p.ts))} · ${esc(uname(p.by))} · ${p.src === 'veh' ? 'Όχημα προέλευσης: ' + esc(vehName(p.veh)) : p.src === 'sup' ? 'Από προμηθευτή: ' + esc(p.supplier || '') : p.src === 'gym' ? 'Από γυμναστήριο: ' + esc(gymName(p.fromGym)) + ' · ' + (p.cond === 'U' ? 'μεταχειρισμένα' : 'καλή κατάσταση') : 'Από αποθήκη: ' + esc(whName(p.wh))}</div>
    <div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th>Αρχική παραλαβή</th><th>Σκοπός</th><th class="r">Τοποθετήθηκαν</th><th class="r">Επιστράφηκαν</th><th class="r">Αποσύρθ. / αντικατ. / μεταφ.</th><th class="r">Παραμένουν εγκατεστ.</th></tr></thead><tbody>
    ${p.lines.map((l, i) => `<tr><td style="width:56px">${thumb(l.p)}</td><td><a data-go="prod" data-a="${l.p}" href="#"><b>${esc(prodName(l.p))}</b></a><div class="mono small muted">${esc(prodCode(l.p))}</div></td>
      <td>${l.pk && S.pk[l.pk] ? `<a data-go="pk" data-a="${l.pk}" href="#">${esc(pkLabel(l.pk))}</a> <span class="small muted">${esc(whName(S.pk[l.pk].wh))}</span>` : (l.pk === 'ADJ' ? 'Διόρθωση απογραφής' : esc(whName(p.wh)))}</td>
      <td class="small">${(l.purpose || p.purpose) === 'repl' ? `<span class="tag C">Αντικατάσταση</span>${l.old && oldText(l.old) ? `<div class="muted" style="margin-top:4px">Παλιά: ${esc(oldText(l.old))}${(l.old.u || l.old.c || l.old.d) && (l.oldDest || p.oldDest) ? ' → ' + esc(destText(l.oldDest || p.oldDest, p.veh)) : ''}</div>` : ''}${l.problem ? `<div class="muted">Πρόβλημα: ${esc(l.problem)}</div>` : ''}` : '<span class="tag N">Νέα</span>'}</td><td class="r">${qtyU(l.qty, l.p)}</td><td class="r">${fmtN(l.back)}</td><td class="r">${fmtN((l.retired || 0) + (l.replaced || 0) + (l.moved || 0))}${l.replaced ? `<div class="small muted">αντικατ. ${fmtN(l.replaced)}</div>` : ''}${l.moved ? `<div class="small muted">μεταφ. ${fmtN(l.moved)}</div>` : ''}</td><td class="r"><b>${fmtN(inst[i])}</b></td></tr>`).join('')}
    </tbody></table></div>
    <div class="panel"><h2>Ιστορικό</h2>${movRows(hist)}</div></div>`;
};
ACT.plBack = el => {
  const id = el.dataset.id; const p = S.pl[id]; const inst = plInstalled(id);
  const rows = p.lines.map((l, i) => ({ li: i, p: l.p, max: inst[i], q: 0 })).filter(r => r.max > 0);
  openModal(`${mhead(p.src === 'veh' ? 'Επιστροφή στο αμάξι' : 'Επιστροφή στην αποθήκη γυμναστηρίου', `${esc(p.docNo)} · ${esc(gymName(p.gym))}${p.src === 'veh' ? ' → ' + esc(vehName(p.veh)) : ''}`)}
    <div class="tw"><table><thead><tr><th>Προϊόν</th><th class="r">Εγκατεστημένα</th><th class="r">Επιστροφή</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><b>${esc(prodName(r.p))}</b><div class="small muted">${esc(pkLabel(p.lines[r.li].pk))}</div></td><td class="r">${qtyU(r.max, r.p)}</td>
      <td class="r"><input type="number" min="0" max="${r.max}" step="any" style="width:90px" data-bi="${i}" placeholder="0" aria-label="Ποσότητα"></td></tr>`).join('')}
    </tbody></table></div>
    <div class="btns" style="justify-content:space-between"><button class="btn" id="bball">Όλα</button><span class="btns"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="bbgo">Προεπισκόπηση</button></span></div>`);
  $('#bball').onclick = () => $$('[data-bi]').forEach(inp => inp.value = rows[inp.dataset.bi].max);
  $('#bbgo').onclick = () => {
    const lines = []; let bad = null;
    $$('[data-bi]').forEach(inp => { const r = rows[inp.dataset.bi]; const q = Number(inp.value) || 0; if (q > r.max) bad = `Για «${prodName(r.p)}» μπορείτε να επιστρέψετε έως ${fmtN(r.max)}.`; if (q > 0) lines.push({ li: r.li, qty: q }); });
    if (bad) return toast(bad, true); if (!lines.length) return toast('Συμπληρώστε ποσότητα.', true);
    confirmOp({ type: 'UNPLACE', id: uid(), pl: id, lines }, { title: p.src === 'veh' ? 'Επιστροφή στο αμάξι' : 'Επιστροφή στην αποθήκη γυμναστηρίου' });
  };
};

/* ---------------- ΟΧΗΜΑΤΑ ---------------- */
VIEWS.vehs = () => {
  const list = activeList(S.veh, 'code');
  return `<div class="wrap">${pageHead('Οχήματα', 'Τι υπάρχει στο αμάξι', can('setup') ? `<button class="btn" data-act="setupTab" data-t="veh">+ Νέο όχημα</button>` : '')}
    <div class="list">${list.map(([id, v]) => {
      const lots = vehLots(id); const pks = new Set(lots.filter(l => !l.old).map(l => l.pk));
      return `<div class="li" data-go="veh" data-a="${id}"><span class="tag k">${esc(v.code || '')}</span><div class="main"><b>${esc(v.name)}</b><span class="muted small">${esc(v.plate || 'Χωρίς αριθμό κυκλοφορίας')}</span></div>
        <div class="side"><b>${lots.length ? sumByUnit(lots.filter(l => !l.old).map(l => ({ p: l.p, q: l.qty }))) || '0' : 'Άδειο'}</b>${lots.some(l => l.old) ? `<span class="small" style="color:var(--warn)">+ παλιά: ${sumByUnit(lots.filter(l => l.old).map(l => ({ p: l.p, q: l.qty })))}</span>` : ''}${lots.length ? `<span class="small muted">${new Set(lots.filter(l => !l.old).map(l => l.p)).size} προϊόντα από ${pks.size} ${pks.size === 1 ? 'παραλαβή' : 'παραλαβές'}</span>` : ''}</div></div>`;
    }).join('') || '<div class="panel empty">Δεν υπάρχουν οχήματα.</div>'}</div></div>`;
};
VIEWS.veh = id => {
  const v = S.veh[id]; if (!v) return `<div class="wrap"><div class="panel empty">Το όχημα δεν βρέθηκε.</div></div>`;
  const view = S.vehView || 'prod'; const lots = vehLots(id);
  let body;
  const vrems = remsWhere({ veh: id });
  if (!lots.length) body = vrems.length ? '' : `<div class="panel empty">Το ${esc(v.name)} είναι άδειο.</div>`;
  else if (view === 'prod') {
    const table = (sub, isOld) => {
      const by = {}; sub.forEach(l => (by[l.p] = by[l.p] || []).push(l));
      return `<div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th>${isOld ? 'Από αντικατάσταση' : 'Προέλευση'}</th><th class="r">Ποσότητα</th><th>Ενέργειες</th></tr></thead><tbody>${sortProds(Object.keys(by)).map(p => {
        const ls = by[p];
        return `<tr><td style="width:56px">${thumb(p)}</td><td><a data-go="prod" data-a="${p}" href="#"><b>${esc(prodName(p))}</b></a><div class="mono small muted">${esc(prodCode(p))}</div></td>
          <td class="small">${ls.map(l => `${isOld ? stTag(l.old) + ' ' : ''}${esc(pkLabel(l.pk))}${l.wh && !isOld ? ' · ' + esc(whName(l.wh)) : ''}: ${fmtN(l.qty)}`).join('<br>')}</td>
          <td class="r"><b>${qtyU(ls.reduce((s, l) => s + l.qty, 0), p)}</b></td>
          <td><div class="btns">${isOld ? '' : `<button class="btn sm" data-act="vehDo" data-t="place" data-v="${id}" data-p="${p}">Τοποθέτηση</button>`}<button class="btn sm" data-act="vehDo" data-t="ret" data-v="${id}" data-p="${p}" data-old="${isOld ? 1 : ''}">Επιστροφή</button>${can('retire') ? `<button class="btn sm ghost" data-act="vehDo" data-t="vret" data-v="${id}" data-p="${p}" data-old="${isOld ? 1 : ''}">Απόσυρση</button>` : ''}<button class="btn sm ghost" data-act="vehHist" data-v="${id}" data-p="${p}">Ιστορικό</button></div></td></tr>`;
      }).join('')}</tbody></table></div>`;
    };
    const fresh = lots.filter(l => !l.old), olds = lots.filter(l => l.old);
    body = `${fresh.length ? `<h2>Καινούργια</h2>${table(fresh, false)}` : ''}${olds.length ? `<h2>Παλιά που επιστρέφουν (από αντικαταστάσεις)</h2><div class="hint">Επιστρέφονται σε αποθήκη ως μεταχειρισμένα, κατεστραμμένα ή προς έλεγχο. Δεν τοποθετούνται από εδώ.</div>${table(olds, true)}` : ''}`;
  } else {
    const by = {}; lots.forEach(l => (by[l.pk] = by[l.pk] || []).push(l));
    body = Object.entries(by).map(([pk, ls]) => `<div class="panel" style="display:flex;flex-direction:column;gap:10px"><div class="row"><span class="docno">${esc(pkLabel(pk))}</span>
      ${S.pk[pk] ? `<span class="small muted">${esc(fmtDT(S.pk[pk].ts))} · από ${esc(whName(S.pk[pk].wh))}</span><button class="btn sm ghost" data-go="pk" data-a="${pk}">Άνοιγμα λίστας</button>` : ''}</div>
      <div class="tw"><table><tbody>${ls.map(l => `<tr><td style="width:56px">${thumb(l.p)}</td><td><b>${esc(prodName(l.p))}</b>${catTags(l.p)}<div class="small muted">${l.wh && secLabel(l.wh, l.sec) ? ' · ' + esc(secLabel(l.wh, l.sec)) : ''}</div></td><td class="r"><b>${qtyU(l.qty, l.p)}</b></td></tr>`).join('')}</tbody></table></div></div>`).join('');
  }
  return `<div class="wrap">${pageHead(esc(v.code || 'Όχημα') + (v.plate ? ' · ' + esc(v.plate) : ''), `Τι υπάρχει στο ${esc(v.name)}`, can('move') && lots.length ? `<button class="btn pri" data-act="vehDo" data-t="place" data-v="${id}">Τοποθέτηση</button><button class="btn" data-act="vehDo" data-t="ret" data-v="${id}">Επιστροφή</button><button class="btn" data-act="vehDo" data-t="togwh" data-v="${id}">Σε αποθήκη γυμν.</button><button class="btn" data-act="vehDo" data-t="veh2" data-v="${id}">Σε άλλο όχημα</button>${can('retire') ? `<button class="btn danger" data-act="vehDo" data-t="vret" data-v="${id}">Απόσυρση</button>` : ''}` : '', `<a data-go="vehs">Οχήματα</a>`)}
    <div class="row"><div class="chips"><button class="chip ${view === 'prod' ? 'on' : ''}" data-act="vehView" data-v="prod">Α. Συνολικά ανά προϊόν</button><button class="chip ${view === 'pk' ? 'on' : ''}" data-act="vehView" data-v="pk">Β. Ανά αρχική λίστα παραλαβής</button></div>
    ${can('inv_edit') ? `<button class="btn sm" data-act="newInvVeh" data-v="${id}">Απογραφή φορτίου</button>` : ''}<button class="btn sm ghost" data-act="vehHist" data-v="${id}">Ιστορικό οχήματος</button></div>
    ${lots.length ? `<div class="muted">Καινούργια: ${sumByUnit(lots.filter(l => !l.old).map(l => ({ p: l.p, q: l.qty })))}${lots.some(l => l.old) ? ` · Παλιά που επιστρέφουν: ${sumByUnit(lots.filter(l => l.old).map(l => ({ p: l.p, q: l.qty })))}` : ''}</div>` : ''}
    ${body}${vrems.length ? `<div class="panel"><div class="row" style="margin-bottom:8px"><h2 style="flex:1">Ρετάλια στο αμάξι (${vrems.length})</h2>${can('move') ? `<button class="btn sm" data-act="remMove" data-ids="${vrems.map(r => r[0]).join(',')}">Επιστροφή / μεταφορά όλων</button>` : ''}</div>${remRows(vrems)}</div>` : ''}</div>`;
};
ACT.replOpen = el => { S.replF = Object.assign(S.replF || { per: '12m', cat: '', unit: '', from: '', to: '' }, { gym: el.dataset.g || '' }); go('repls'); };
ACT.replReport = el => { S.repF = Object.assign(S.repF || {}, { k: 'repl', gym: el.dataset.g || '', group: 'prod' }); go('reports'); };
ACT.vehView = el => { S.vehView = el.dataset.v; render(true); };
ACT.vehDo = el => {
  openVehForm(el.dataset.t, { veh: el.dataset.v });
  if (el.dataset.p) { vehLots(el.dataset.v).filter(l => l.p === el.dataset.p && (el.dataset.old ? !!l.old : !l.old)).forEach(l => S.form.cart[lotKey(l)] = l.qty); render(true); }
};
ACT.vehHist = el => { S.histF = { veh: el.dataset.v, prod: el.dataset.p || '', type: '', from: '', to: '', q: '', loc: '' }; go('hist', null); };

/* ---------------- ΠΡΟΪΟΝΤΑ ---------------- */
function gymProd(g, p) { // εγκατεστημένα + αποθηκευμένα σε αποθήκες του γυμναστηρίου
  let inst = 0, stored = 0; for (const [k, v] of Object.entries(balQ(p))) { const x = k.split('|'); if (x[0] === 'G' && x[1] === g) inst += v; }
  gymWarehouses(g).forEach(w => stored += whQty(p, w)); return { inst, stored };
}
function whQty(p, w) { let n = 0; for (const [k, v] of Object.entries(balQ(p))) if (k.startsWith('W|' + w + '|')) n += v; return n; }
VIEWS.prods = () => {
  const f = S.listF = (S.listF && S.listF.k === 'prods') ? S.listF : { k: 'prods', cat: '', sub: '', q: '', zero: false, inactive: false, mode: 'wh', gym: '', inGym: true };
  if (f.inGym == null) f.inGym = true;
  const gyms = activeList(S.gym);
  if (f.gym && !S.gym[f.gym]) f.gym = '';
  let ids = Object.keys(S.prod).filter(p => prodMatches(p, f));
  if (f.kindF) ids = ids.filter(p => f.kindF === 'mat' ? isMat(p) : !isMat(p));
  if (f.zero) ids = ids.filter(p => prodTotals(p).avail <= 0);
  if (f.mode === 'gym' && f.inGym) ids = ids.filter(p => (f.gym ? [f.gym] : gyms.map(g => g[0])).some(g => { const i = gymProd(g, p); return i.inst || i.stored; }));
  sortProds(ids);
  // αποθήκες: πρώτα οι κανονικές, μετά οι αποθήκες γυμναστηρίων
  const whsAll = activeList(S.wh); const whsN = whsAll.filter(([, w]) => !w.gym); const whsG = whsAll.filter(([, w]) => w.gym);
  AFTER.push(() => {
    $('#pq').oninput = e => { f.q = e.target.value; clearTimeout(f.t); f.t = setTimeout(() => { const pos = e.target.selectionStart; render(true); const q = $('#pq'); q.focus(); q.setSelectionRange(pos, pos); }, 250); };
    $('#pzero').onchange = e => { f.zero = e.target.checked; render(true); };
    $('#pina').onchange = e => { f.inactive = e.target.checked; render(true); };
    const pg = $('#pgym'); if (pg) pg.onchange = e => { f.gym = e.target.value; render(true); };
    const pi = $('#pingym'); if (pi) pi.onchange = e => { f.inGym = e.target.checked; render(true); };
  });
  const canQty = can('move');
  const nz = n => n ? `<b>${fmtN(n)}</b>` : '<span class="muted">—</span>';
  const thName = '<th rowspan="2"></th><th rowspan="2">Κωδικός</th><th rowspan="2">Προϊόν</th>';
  let head;
  if (f.mode === 'wh') {
    const nS = whsN.length + (whsG.length ? 1 : 0) + 1;
    head = `<tr>${thName}<th rowspan="2" class="r grp gs">Διαθέσιμα<br>προς χρήση</th><th colspan="${nS}" class="grp gs">Πού είναι τα διαθέσιμα</th><th colspan="2" class="grp gx">Όχι προς χρήση</th>${canQty ? '<th rowspan="2"></th>' : ''}</tr>
      <tr>${whsN.map(([, w]) => `<th class="r">${esc(w.name)}</th>`).join('')}${whsG.length ? `<th class="r">Αποθήκες γυμν.<br><span class="thsub">${whsG.length} · ανάλυση «Ανά γυμναστήριο»</span></th>` : ''}<th class="r">Οχήματα</th><th class="r gx">Παλιά<br><span class="thsub">μεταχ. · κατεστρ. · έλεγχος</span></th><th class="r gx">Εγκατε&shy;στημένα</th></tr>`;
  } else if (f.mode === 'gym') {
    head = f.gym ? `<tr>${thName.replace(/ rowspan="2"/g, '')}<th class="r gi">Εγκατεστημένα</th><th class="r gs">Αποθηκευμένα<br><span class="thsub">στην αποθήκη του</span></th><th class="r">Σύνολο</th></tr>`
      : `<tr>${thName}<th colspan="2" class="grp">Σύνολο γυμναστηρίων</th>${gyms.map(([g, x]) => `<th colspan="2" class="grp"><a data-go="gym" data-a="${g}">${esc(x.name)}</a></th>`).join('')}</tr>
        <tr><th class="r gi">Εγκατ.</th><th class="r gs">Αποθ.</th>${gyms.map(() => '<th class="r gi">Εγκατ.</th><th class="r gs">Αποθ.</th>').join('')}</tr>`;
  } else head = `<tr>${thName}<th rowspan="2">Είδος / Κατηγορία</th><th colspan="5" class="grp gs">Αποθηκευμένα</th><th rowspan="2" class="r grp gi">Εγκατε&shy;στημένα</th></tr>
      <tr><th class="r">Κανονικά</th><th class="r">Μεταχειρ.</th><th class="r">Κατεστρ.</th><th class="r">Προς έλεγχο</th><th class="r">Οχήματα</th></tr>`;
  const row = p => { const x = S.prod[p]; const t = prodTotals(p);
    const name = `<td style="width:56px">${thumb(p)}</td><td class="mono small" style="white-space:nowrap">${esc(x.code)}</td><td style="min-width:180px"><b>${esc(x.name)}</b>${x.active === false ? ' <span class="tag g">Ανενεργό</span>' : ''}${x.kind === 'mat' ? ` <span class="tag k">Υλικό</span>${remsWhere({ p }).length ? ` <span class="small muted">+${remsWhere({ p }).length} ρετάλια</span>` : ''}` : ''}${catTags(p)}<div class="small muted">${esc(x.unit)}${x.dims ? ' · ' + esc(x.dims) : ''}</div></td>`;
    if (f.mode === 'wh') return `<tr class="click" data-go="prod" data-a="${p}">${name}<td class="r cs"><b>${fmtN(t.avail)}</b></td>${whsN.map(([w]) => `<td class="r">${nz(whN(p, w))}</td>`).join('')}${whsG.length ? `<td class="r">${nz(whsG.reduce((s, [w]) => s + whN(p, w), 0))}</td>` : ''}
      <td class="r">${nz(t.VN)}</td><td class="r cx">${t.old ? `<span class="muted">${fmtN(t.old)}</span>` : '<span class="muted">—</span>'}</td><td class="r cx">${t.G ? `<span class="muted">${fmtN(t.G)}</span>` : '<span class="muted">—</span>'}</td>${canQty ? `<td><button class="btn sm" data-act="distrib" data-p="${p}">+ Ποσότητες</button></td>` : ''}</tr>`;
    if (f.mode === 'gym') {
      if (f.gym) { const i = gymProd(f.gym, p); return `<tr class="click" data-go="prod" data-a="${p}">${name}<td class="r ci">${nz(i.inst)}</td><td class="r cs">${nz(i.stored)}</td><td class="r"><b>${fmtN(i.inst + i.stored)}</b></td></tr>`; }
      let ti = 0, ts = 0; const cells = gyms.map(([g]) => { const i = gymProd(g, p); ti += i.inst; ts += i.stored; return `<td class="r ci">${nz(i.inst)}</td><td class="r cs">${nz(i.stored)}</td>`; }).join('');
      return `<tr class="click" data-go="prod" data-a="${p}">${name}<td class="r ci"><b>${fmtN(ti)}</b></td><td class="r cs"><b>${fmtN(ts)}</b></td>${cells}</tr>`; }
    return `<tr class="click" data-go="prod" data-a="${p}">${name}<td class="small">${catTags(p)}</td><td class="r"><b>${fmtN(t.WN)}</b></td><td class="r">${t.WU ? `<span class="tag U">${fmtN(t.WU)}</span>` : '0'}</td><td class="r">${t.WD ? `<span class="tag D">${fmtN(t.WD)}</span>` : '0'}</td>
      <td class="r">${t.WC ? `<span class="tag C">${fmtN(t.WC)}</span>` : '0'}</td><td class="r">${fmtN(t.V)}</td><td class="r ci"><b>${fmtN(t.G)}</b></td></tr>`; };
  const gymBar = f.mode === 'gym' ? `<div class="row" style="gap:12px;align-items:flex-end"><div class="f" style="min-width:220px"><label for="pgym">Γυμναστήριο</label><select id="pgym">${opt('', 'Όλα τα γυμναστήρια', !f.gym)}${gyms.map(([g, x]) => opt(g, x.name, g === f.gym)).join('')}</select></div>
      <label class="check"><input type="checkbox" id="pingym" ${f.inGym ? 'checked' : ''}> Μόνο όσα υπάρχουν ${f.gym ? 'στο γυμναστήριο' : 'σε γυμναστήρια'}</label>
      ${f.gym ? `<button class="btn sm" data-go="gym" data-a="${f.gym}">Σελίδα γυμναστηρίου</button>` : ''}</div>` : '';
  const legend = f.mode === 'gym' ? 'Αποθηκευμένα = στην αποθήκη του γυμναστηρίου, όχι εγκατεστημένα. Εγκατεστημένα = τοποθετημένα και σε λειτουργία.'
    : 'Διαθέσιμα προς χρήση = κανονικά (καλή κατάσταση) σε αποθήκες, αποθήκες γυμναστηρίων και οχήματα. Όχι προς χρήση = παλιά (μεταχειρισμένα, κατεστραμμένα, προς έλεγχο) και εγκατεστημένα σε γυμναστήρια, μόνο για ενημέρωση.';
  return `<div class="wrap">${pageHead(`${ids.length} κωδικοί · κοινός για όλες τις αποθήκες και τα γυμναστήρια`, 'Γενικός πίνακας προϊόντων', can('product_create') ? `<button class="btn pri" data-act="newProdNav">+ Νέο προϊόν</button>` : '')}
    <p class="hint">Κάθε προϊόν καταχωρίζεται μία φορά εδώ, με περιγραφή και φωτογραφία. Οι ποσότητες σε κάθε αποθήκη ορίζονται από το κουμπί «+ Ποσότητες» ή από την Εισαγωγή, χωρίς να ξαναπεράσετε στοιχεία του προϊόντος.</p>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px"><div class="chiprow lv0"><span class="chiplbl">Καταχώριση</span><div class="chips" role="group" aria-label="Κατηγορία καταχώρισης">${[['', 'Όλα'], ['prod', 'Έτοιμα προϊόντα'], ['mat', 'Υλικά κατασκευών']].map(([k, l]) => `<button class="chip ${(f.kindF || '') === k ? 'on' : ''}" data-act="pkind" data-v="${k}">${l}</button>`).join('')}</div></div>${catChips(f).replace(/data-act="fcat"/g, 'data-act="lcat"').replace(/data-act="fsub"/g, 'data-act="lsub"')}
      <input type="search" id="pq" value="${esc(f.q)}" placeholder="Αναζήτηση με κωδικό, όνομα, περιγραφή" aria-label="Αναζήτηση">
      <div class="row"><div class="chiprow lv4"><span class="chiplbl">Προβολή</span><div class="chips"><button class="chip ${f.mode === 'wh' ? 'on' : ''}" data-act="pmode" data-m="wh">Διαθέσιμα προς χρήση</button><button class="chip ${f.mode === 'gym' ? 'on' : ''}" data-act="pmode" data-m="gym">Ανά γυμναστήριο</button><button class="chip ${f.mode === 'st' ? 'on' : ''}" data-act="pmode" data-m="st">Ανά κατάσταση</button></div></div>
        <label class="check"><input type="checkbox" id="pzero" ${f.zero ? 'checked' : ''}> Μόνο όσα δεν έχουν διαθέσιμα</label><label class="check"><input type="checkbox" id="pina" ${f.inactive ? 'checked' : ''}> Εμφάνιση ανενεργών</label></div>
      ${gymBar}<div class="small muted"><span class="lgd ${f.mode === 'wh' ? 'gs' : 'gs'}"></span> ${legend.split('. ')[0]}. <span class="lgd ${f.mode === 'wh' ? 'gx' : 'gi'}"></span> ${legend.split('. ')[1]}</div></div>
    <div class="tw"><table class="ptab"><thead>${head}</thead><tbody>
    ${(() => { let lg = null; return ids.slice(0, 400).map(p => { const g = catGroup(p); const h = g !== lg ? `<tr class="grprow"><td colspan="40"><span>${esc(g)}</span></td></tr>` : ''; lg = g; return h + row(p); }).join(''); })() || `<tr><td colspan="30" class="empty">${f.mode === 'gym' && f.inGym ? 'Κανένα προϊόν σε ' + (f.gym ? 'αυτό το γυμναστήριο' : 'γυμναστήρια') + '.' : 'Δεν βρέθηκαν προϊόντα.'}</td></tr>`}
    </tbody></table></div></div>`;
};
ACT.pmode = el => { S.listF.mode = el.dataset.m; render(true); };
ACT.pkind = el => { S.listF.kindF = el.dataset.v; render(true); };
ACT.distrib = (el, e) => { e.stopPropagation(); openDistribute(el.dataset.p); };
/* Ποσότητες ενός προϊόντος σε πολλές αποθήκες μαζί: μία εισαγωγή ανά αποθήκη */
function openDistribute(p, isNew) {
  const whs = activeList(S.wh).filter(([w]) => can('move', w));
  if (!whs.length) return toast('Δεν έχετε δικαίωμα εισαγωγής σε καμία αποθήκη.', true);
  const vals = {}, secs = {};
  const draw = (err) => {
    openModal(`${mhead(isNew ? 'Το προϊόν δημιουργήθηκε · ποσότητες ανά αποθήκη' : 'Ποσότητες ανά αποθήκη', `${esc(prodCode(p))} · ${esc(prodName(p))}`)}
      <div class="row">${thumb(p)}<div class="hint">Συμπληρώστε πόσα μπαίνουν σε κάθε αποθήκη. Δημιουργείται μία εισαγωγή ανά αποθήκη. Αφήστε κενό όπου δεν μπαίνει τίποτα.</div></div>
      <div class="tw"><table><thead><tr><th>Αποθήκη</th><th class="r">Υπάρχουν τώρα</th><th class="r">Προσθήκη (${esc(unitOf(p))})</th></tr></thead><tbody>
      ${whs.filter(([, x]) => !x.gym || S.distG).map(([w, x]) => `<tr><td><b>${esc(x.gym ? gymName(x.gym) : x.name)}</b>${x.gym ? `<div class="small muted">${esc(x.name)}</div>` : ''}</td><td class="r">${fmtN(whQty(p, w))}</td>
        <td class="r">${hasSections(w) ? `<select data-ds="${w}" style="width:auto;margin-bottom:4px" aria-label="Χώρος">${sections(w).map(s => opt(s.id, s.name, s.id === (secs[w] || sections(w)[0].id))).join('')}</select><br>` : ''}<input type="number" min="0" step="any" style="width:100px" data-dw="${w}" value="${vals[w] || ''}" placeholder="0" aria-label="Ποσότητα για ${esc(x.name)}"></td></tr>`).join('')}</tbody></table></div>
      ${whs.some(([, x]) => x.gym) ? `<button class="btn sm ghost" id="dgym">${S.distG ? 'Απόκρυψη αποθηκών γυμναστηρίων' : `Εμφάνιση αποθηκών γυμναστηρίων (${whs.filter(([, x]) => x.gym).length})`}</button>` : ''}
      <div class="f"><label for="dsrc">Προέλευση (προαιρετικά)</label><input type="text" id="dsrc" placeholder="π.χ. Προμηθευτής"></div>
      ${err ? `<div class="errbox">${esc(err)}</div>` : ''}
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">${isNew ? 'Αργότερα' : 'Ακύρωση'}</button><button class="btn pri big" id="dgo">Καταχώριση</button></div>`);
    $$('[data-dw]').forEach(i => i.oninput = () => { vals[i.dataset.dw] = Number(i.value) || 0; });
    { const b = $('#dgym'); if (b) b.onclick = () => { S.distG = !S.distG; draw(); }; }
    $$('[data-ds]').forEach(i => i.onchange = () => { secs[i.dataset.ds] = i.value; });
    $('#dgo').onclick = async () => {
      const list = Object.entries(vals).filter(([, q]) => q > 0);
      if (!list.length) return draw('Συμπληρώστε ποσότητα σε τουλάχιστον μία αποθήκη.');
      const src = $('#dsrc').value; const done = [];
      $('#dgo').disabled = true;
      for (const [w, q] of list) {
        try { const r = await execute({ type: 'IMP', id: uid(), wh: w, source: src, lines: [{ p, sec: secs[w] || sections(w)[0].id, qty: q }] }); done.push([w, q, r.docNo]); delete vals[w]; }
        catch (e) { return draw(`${done.length ? 'Καταχωρίστηκαν: ' + done.map(d => whName(d[0])).join(', ') + '. ' : ''}Απέτυχε για «${whName(w)}»: ${e.message}`); }
      }
      openModal(`${mhead('Οι ποσότητες καταχωρίστηκαν')}<div class="okbox">${done.map(([w, q, no]) => `<div class="row"><span class="docno">${esc(no)}</span><b>${esc(whName(w))}</b><span>+${qtyU(q, p)}</span></div>`).join('')}</div>
        <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="modalGo" data-v="prod" data-a="${p}">Καρτέλα προϊόντος</button><button class="btn pri" data-act="closeModal">Εντάξει</button></div>`);
    };
  };
  draw();
}
ACT.lcat = el => { S.listF.cat = el.dataset.c; S.listF.sub = ''; S.listF.ptype = ''; render(true); };
ACT.lsub = el => { S.listF.sub = el.dataset.s; S.listF.ptype = ''; render(true); };
ACT.newProdNav = () => openProdEditor(null, id => { go('prod', id); if (can('move')) setTimeout(() => openDistribute(id, true), 50); });
VIEWS.prod = id => {
  const x = S.prod[id]; if (!x) return `<div class="wrap"><div class="panel empty">Το προϊόν δεν βρέθηκε.</div></div>`;
  const t = prodTotals(id); const q = balQ(id);
  const whRows = {}, vehRows = {}, gymRows = {};
  for (const [k, v] of Object.entries(q)) {
    const s = k.split('|');
    if (s[0] === 'W') { const r = whRows[s[1] + '|' + s[2]] = whRows[s[1] + '|' + s[2]] || { wh: s[1], sec: s[2], N: 0, U: 0, D: 0, C: 0 }; r[s[3]] += v; }
    if (s[0] === 'V') (vehRows[s[1]] = vehRows[s[1]] || []).push({ pk: s[2], qty: v });
    if (s[0] === 'G') gymRows[s[1]] = (gymRows[s[1]] || 0) + v;
  }
  const hist = movsFor(m => m.lines.some(l => l.p === id)).slice(0, 60);
  return `<div class="wrap">${pageHead(`<span class="mono">${esc(x.code)}</span> · ${esc(catLabel(id))}`, esc(x.name), x.deleted ? '' : (can('product') || (can('product_create') && x.by === S.me.id) ? `<button class="btn" data-act="editProd" data-id="${id}">Επεξεργασία</button>` : '') + (!x.deleted && can('product') ? `<button class="btn danger" data-act="delProd" data-id="${id}">Διαγραφή</button>` : ''), `<a data-go="prods">Προϊόντα</a>`)}
    <div class="prodhero"><div class="big" ${x.photo ? `data-ph="${id}"` : ''}>${x.photo ? '' : '<span class="muted small">Χωρίς φωτογραφία</span>'}</div>
      <div style="display:flex;flex-direction:column;gap:12px;min-width:0"><p style="margin:0;white-space:pre-wrap;max-width:65ch">${esc(x.desc || 'Χωρίς περιγραφή.')}</p>${can('product') || (can('product_create') && x.by === S.me.id) ? '<div class="hint">Για νέα φωτογραφία: αντιγράψτε μια εικόνα και πατήστε Ctrl+V σε αυτή τη σελίδα.</div>' : ''}
      ${x.kind === 'mat' ? `<div class="small"><span class="tag k">Υλικό κατασκευής</span>${x.dims ? ' Ολόκληρο: <b>' + esc(x.dims) + '</b>' : ''}</div>` : ''}
      <div class="muted small">Μονάδα: ${esc(x.unit)}${x.active === false ? ' · <span class="tag g">Ανενεργό</span>' : ''}</div>
      <div class="kpis"><div class="kpi s"><span class="l">Διαθέσιμα προς χρήση</span><span class="v">${fmtN(t.avail)}</span><span class="u">αποθήκες ${fmtN(t.WN)} · οχήματα ${fmtN(t.VN)}</span></div>
        <div class="kpi u"><span class="l">Μεταχειρισμένα</span><span class="v">${fmtN(t.WU)}</span></div><div class="kpi d"><span class="l">Κατεστραμμένα</span><span class="v">${fmtN(t.WD)}</span></div><div class="kpi c"><span class="l">Προς έλεγχο</span><span class="v">${fmtN(t.WC)}</span></div>
        ${t.VO ? `<div class="kpi x"><span class="l">Παλιά στα οχήματα</span><span class="v">${fmtN(t.VO)}</span></div>` : ''}<div class="kpi x"><span class="l">Εγκατεστημένα</span><span class="v">${fmtN(t.G)}</span><span class="u">όχι προς χρήση</span></div></div>
      <div class="small"><span class="lgd gs"></span> <b>Διαθέσιμα προς χρήση: ${qtyU(t.avail, id)}</b> &nbsp; <span class="lgd gx"></span> <span class="muted">Όχι προς χρήση: παλιά ${fmtN(t.old)} · εγκατεστημένα ${fmtN(t.G)}</span></div></div></div>
    <div class="grid2">
      <div class="panel"><div class="row" style="margin-bottom:12px"><h2 style="flex:1">Ανά αποθήκη</h2>${can('move') ? `<button class="btn sm pri" data-act="distrib" data-p="${id}">+ Ποσότητες</button>` : ''}</div><div class="tw"><table><thead><tr><th>Αποθήκη</th><th class="r">Καν.</th><th class="r">Μεταχ.</th><th class="r">Κατ.</th><th class="r">Έλεγχ.</th></tr></thead><tbody>
        ${activeList(S.wh).filter(([w, x]) => !x.gym || Object.values(whRows).some(y => y.wh === w)).map(([w, x]) => { const rs = Object.values(whRows).filter(y => y.wh === w); if (!rs.length) return `<tr><td>${esc(x.name)}</td><td class="r muted">0</td><td class="r muted">0</td><td class="r muted">0</td><td class="r muted">0</td></tr>`;
          return rs.map(r => `<tr><td>${esc(x.name)}${secLabel(w, r.sec) ? `<div class="small muted">${esc(secLabel(w, r.sec))}</div>` : ''}</td><td class="r"><b>${fmtN(r.N)}</b></td><td class="r">${fmtN(r.U)}</td><td class="r">${fmtN(r.D)}</td><td class="r">${fmtN(r.C)}</td></tr>`).join(''); }).join('')}</tbody></table></div></div>
      <div class="panel"><h2>Οχήματα & γυμναστήρια</h2>
        ${Object.keys(vehRows).length ? `<div class="tw"><table><thead><tr><th>Όχημα</th><th>Από παραλαβή</th><th class="r">Ποσότητα</th></tr></thead><tbody>${Object.entries(vehRows).map(([v, ls]) => ls.map(l => `<tr><td>${esc(vehName(v))}</td><td>${esc(pkLabel(l.pk))}</td><td class="r">${fmtN(l.qty)}</td></tr>`).join('')).join('')}</tbody></table></div>` : '<div class="empty">Δεν υπάρχει σε οχήματα.</div>'}
        <div style="height:12px"></div>
        ${(() => { const gr = activeList(S.gym).map(([g, x]) => [g, x, gymProd(g, id)]).filter(([, , v]) => v.inst || v.stored);
          return gr.length ? `<div class="tw"><table><thead><tr><th>Γυμναστήριο</th><th class="r">Εγκατεστημένα</th><th class="r">Αποθηκευμένα</th></tr></thead><tbody>${gr.map(([g, x, v]) => `<tr class="click" data-go="gym" data-a="${g}"><td>${esc(x.name)}</td><td class="r">${fmtN(v.inst)}</td><td class="r">${fmtN(v.stored)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Δεν υπάρχει σε γυμναστήρια.</div>'; })()}</div>
    </div>
    ${isMat(id) ? `<div class="panel"><div class="row" style="margin-bottom:8px"><h2 style="flex:1">Ρετάλια (${remsWhere({ p: id }).length})</h2>${can('move') ? `<button class="btn sm pri" data-act="matProc" data-p="${id}">Επεξεργασία</button>` : ''}</div>${remRows(remsWhere({ p: id }), { showMat: false })}</div>` : ''}
    <div class="panel"><h2>Ιστορικό κινήσεων</h2>${movRows(hist, { showProd: id })}</div></div>`;
};
ACT.editProd = el => openProdEditor(el.dataset.id);
/* Διαγραφή προϊόντος (Administrator / Warehouse Manager):
   - χωρίς ποτέ κίνηση → οριστική διαγραφή (και φωτογραφίας)
   - με κινήσεις → μόνο αν το απόθεμα είναι μηδέν παντού· κρύβεται από παντού, το ιστορικό κρατά το όνομα */
ACT.delProd = el => {
  const id = el.dataset.id; const x = S.prod[id]; if (!x || !can('product')) return;
  const used = !!S.bal[id] || Object.values(S.rem).some(r => r.p === id); const t = prodTotals(id);
  if (remsWhere({ p: id }).length) return openModal(`${mhead('Δεν μπορεί να διαγραφεί ακόμη', esc(x.name))}<div class="warnbox">Το υλικό έχει ακόμη ${remsWhere({ p: id }).length} ρετάλια σε απόθεμα. Χρησιμοποιήστε ή αποσύρετέ τα πρώτα.</div><div class="btns" style="justify-content:flex-end"><button class="btn pri" data-act="closeModal">Εντάξει</button></div>`);
  if (used && t.all > 0) {
    return openModal(`${mhead('Δεν μπορεί να διαγραφεί ακόμη', esc(x.name))}
      <div class="warnbox">Το προϊόν έχει ακόμη ${qtyU(t.all, id)} (αποθήκες ${fmtN(t.W)}, οχήματα ${fmtN(t.V)}, εγκατεστημένα ${fmtN(t.G)}). Μηδενίστε πρώτα το απόθεμα με επιστροφή, απόσυρση ή απογραφή, ή κάντε το μη ενεργό από την Επεξεργασία.</div>
      <div class="btns" style="justify-content:flex-end"><button class="btn pri" data-act="closeModal">Εντάξει</button></div>`);
  }
  openModal(`${mhead('Διαγραφή προϊόντος;', `${esc(x.code)} · ${esc(x.name)}`)}
    <p>${used ? 'Το προϊόν έχει ιστορικό κινήσεων. Θα αφαιρεθεί από τον γενικό πίνακα, τις φόρμες και τις αναφορές. Τα παλιά παραστατικά θα συνεχίσουν να δείχνουν το όνομά του.' : 'Το προϊόν δεν έχει καμία κίνηση. Θα διαγραφεί οριστικά, μαζί με τη φωτογραφία του.'}</p>
    <div id="dperr"></div><div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn danger" id="dpgo">Διαγραφή</button></div>`);
  $('#dpgo').onclick = async () => {
    $('#dpgo').disabled = true;
    try {
      if (used) await saveDoc('prods/' + id, Object.assign({}, x, { deleted: true, active: false, deletedAt: Date.now(), deletedBy: S.me.id }));
      else { if (x.photo) { try { await db.doc('photos/' + id).delete(); } catch (e) {} } await db.doc('prods/' + id).delete(); }
      closeModal(); toast('Το προϊόν διαγράφηκε.'); go('prods');
    } catch (e) { $('#dpgo').disabled = false; $('#dperr').innerHTML = `<div class="errbox">${esc(e.message || 'Η διαγραφή απέτυχε.')}</div>`; }
  };
};

/* ---------------- ΑΠΟΘΗΚΕΣ ---------------- */
function whStock(whId, sec) { // [{p,sec,N,D,C}]
  const rows = {};
  for (const [p, b] of Object.entries(S.bal)) for (const [k, v] of Object.entries(b.q || {})) {
    if (k[0] !== 'W' || !v) continue; const s = k.split('|');
    if (s[1] !== whId || (sec && s[2] !== sec)) continue;
    const r = rows[p + '|' + s[2]] = rows[p + '|' + s[2]] || { p, sec: s[2], N: 0, U: 0, D: 0, C: 0 }; r[s[3]] += v;
  }
  return Object.values(rows).sort((a, b) => prodName(a.p).localeCompare(prodName(b.p), 'el'));
}
VIEWS.whs = () => {
  const item = ([id, w]) => {
    const st = whStock(id); const secs = (w.sections || []).filter(s => s.active !== false);
    return `<div class="li" data-go="wh" data-a="${id}"><span class="tag k">${esc(w.code)}</span>
      <div class="main"><b>${esc(w.gym ? gymName(w.gym) : w.name)}</b><span class="muted small">${w.gym ? esc(w.name) + ' · ' : ''}${secs.length ? 'Χώροι: ' + secs.map(s => esc(s.name)).join(', ') : 'Χωρίς χώρους (Γενικός χώρος)'}${!w.gym && w.address ? ' · ' + esc(w.address) : ''}${w.active === false ? ' · ΑΝΕΝΕΡΓΗ' : ''}</span></div>
      <div class="side"><b>${st.length ? sumByUnit(st.map(r => ({ p: r.p, q: r.N + r.U + r.D + r.C }))) : '—'}</b><span class="small muted">${new Set(st.map(r => r.p)).size} προϊόντα</span></div></div>`; };
  const all = Object.entries(S.wh); const n = all.filter(([, w]) => !w.gym).sort((a, b) => a[1].name.localeCompare(b[1].name, 'el'));
  const q = norm(S.whsQ || ''); const gAll = all.filter(([, w]) => w.gym).sort((a, b) => gymName(a[1].gym).localeCompare(gymName(b[1].gym), 'el'));
  const g = gAll.filter(([, w]) => !q || norm(gymName(w.gym) + ' ' + w.name + ' ' + w.code).includes(q)).filter(([id]) => !S.whsFull || whStock(id).length);
  AFTER.push(() => { const i = $('#whsq'); if (i) i.oninput = () => { S.whsQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => { const pos = i.selectionStart; render(true); const x = $('#whsq'); x.focus(); x.setSelectionRange(pos, pos); }, 250); };
    const c = $('#whsfull'); if (c) c.onchange = () => { S.whsFull = c.checked; render(true); }; });
  return `<div class="wrap">${pageHead('Αποθήκες & χώροι', 'Αποθήκες', can('setup') ? `<button class="btn" data-act="setupTab" data-t="wh">+ Νέα αποθήκη</button>` : '')}
  <h2>Κεντρικές αποθήκες</h2><div class="list">${n.map(item).join('') || '<div class="panel empty">Δεν υπάρχουν αποθήκες.</div>'}</div>
  ${gAll.length ? `<h2 style="margin-top:8px">Αποθήκες γυμναστηρίων <span class="muted small">(${gAll.length})</span></h2>
    <div class="row" style="gap:10px">${gAll.length > 5 ? `<input type="search" id="whsq" value="${esc(S.whsQ || '')}" placeholder="Αναζήτηση γυμναστηρίου" style="flex:1;min-width:180px" aria-label="Αναζήτηση">` : ''}<label class="check"><input type="checkbox" id="whsfull" ${S.whsFull ? 'checked' : ''}> Μόνο όσες έχουν απόθεμα</label></div>
    <div class="list">${g.map(item).join('') || '<div class="panel empty">Καμία αποθήκη γυμναστηρίου για αυτό το φίλτρο.</div>'}</div>` : ''}</div>`;
};
VIEWS.wh = id => {
  const w = S.wh[id]; if (!w) return `<div class="wrap"><div class="panel empty">Η αποθήκη δεν βρέθηκε.</div></div>`;
  const F = (S.whF && S.whF.wh === id) ? S.whF : (S.whF = { wh: id, sec: '', cat: '' });
  const all = whStock(id);
  const inSec = F.sec ? all.filter(r => r.sec === F.sec) : all;
  const byCat = {}; inSec.forEach(r => { const c = (S.prod[r.p] && S.prod[r.p].cat) || ''; (byCat[c] = byCat[c] || []).push(r); });
  const rows = F.cat ? (byCat[F.cat] || []) : inSec;
  const tot = rs => sumByUnit(rs.map(r => ({ p: r.p, q: r.N + r.U + r.D + r.C })));
  const secs = allSections(id); const showSec = hasSections(id);
  return `<div class="wrap">${pageHead(`<span class="mono">${esc(w.code)}</span>${w.gym ? ' · ' + esc(gymName(w.gym)) : ''}`, esc(w.name),
    `${can('move', id) ? `<button class="btn pri" data-go="imp" data-a="${id}">Εισαγωγή</button><button class="btn" data-go="load" data-a="${id}">Παραλαβή</button>` : ''}${can('transfer', id) ? `<button class="btn" data-go="xfer" data-a="${id}">Μεταφορά</button>` : ''}${can('inv_edit') ? `<button class="btn" data-act="newInvWh" data-w="${id}">Απογραφή</button>` : ''}`, `<a data-go="whs">Αποθήκες</a>`)}
    ${w.address ? `<div class="muted">${esc(w.address)}</div>` : ''}
    ${showSec ? `<div class="chips"><span class="lbl" style="align-self:center">Χώρος</span><button class="chip ${!F.sec ? 'on' : ''}" data-act="whF" data-k="sec" data-v="">Όλοι οι χώροι<span class="n">${tot(all)}</span></button>
      ${secs.map(s => `<button class="chip ${F.sec === s.id ? 'on' : ''}" data-act="whF" data-k="sec" data-v="${s.id}">${esc(s.name)}<span class="n">${tot(all.filter(r => r.sec === s.id))}</span></button>`).join('')}</div>` : ''}
    <div class="chips"><span class="lbl" style="align-self:center">Είδος</span><button class="chip ${!F.cat ? 'on' : ''}" data-act="whF" data-k="cat" data-v="">Όλα τα είδη</button>
      ${Object.keys(byCat).sort((a, b) => catName(a).localeCompare(catName(b), 'el')).map(c => `<button class="chip ${F.cat === c ? 'on' : ''}" data-act="whF" data-k="cat" data-v="${c}">${esc(catName(c) || 'Χωρίς είδος')}<span class="n">${tot(byCat[c])}</span></button>`).join('')}</div>
    <div class="tw"><table><thead><tr><th></th><th>Προϊόν</th>${showSec ? '<th>Χώρος</th>' : ''}<th>Είδος / Κατηγορία</th><th class="r">Κανονικά</th><th class="r">Μεταχειρ.</th><th class="r">Κατεστρ.</th><th class="r">Προς έλεγχο</th><th class="r">Σύνολο</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="click" data-go="prod" data-a="${r.p}"><td style="width:56px">${thumb(r.p)}</td><td><b>${esc(prodName(r.p))}</b><div class="mono small muted">${esc(prodCode(r.p))}</div></td>${showSec ? `<td>${esc(secName(id, r.sec))}</td>` : ''}<td class="small">${esc(catLabel(r.p))}</td>
      <td class="r"><b>${fmtN(r.N)}</b></td><td class="r">${r.U ? `<span class="tag U">${fmtN(r.U)}</span>` : '0'}</td><td class="r">${r.D ? `<span class="tag D">${fmtN(r.D)}</span>` : '0'}</td><td class="r">${r.C ? `<span class="tag C">${fmtN(r.C)}</span>` : '0'}</td><td class="r">${qtyU(r.N + r.U + r.D + r.C, r.p)}</td></tr>`).join('') || `<tr><td colspan="9" class="empty">Κανένα απόθεμα.</td></tr>`}
    </tbody></table></div>
    ${(() => { const rs = remsWhere(F.sec ? { wh: id, sec: F.sec } : { wh: id }); return rs.length ? `<div class="panel"><h2>Ρετάλια (${rs.length})</h2>${remRows(rs)}</div>` : ''; })()}</div>`;
};
ACT.whF = el => { S.whF[el.dataset.k] = el.dataset.v; render(true); };

/* ---------------- ΓΥΜΝΑΣΤΗΡΙΑ ---------------- */
VIEWS.gyms = () => `<div class="wrap">${pageHead('Χώροι εγκατάστασης', 'Γυμναστήρια', can('setup') ? `<button class="btn" data-act="setupTab" data-t="gym">+ Νέο γυμναστήριο</button>` : '')}
  <div class="list">${activeList(S.gym).map(([id, g]) => {
    const inst = gymInstalled(id); const gw = gymWarehouses(id); const stored = gw.flatMap(w => whStock(w));
    return `<div class="li" data-go="gym" data-a="${id}"><span class="tag k">${esc(g.code || '')}</span><div class="main"><b>${esc(g.name)}</b><span class="muted small">${esc(g.address || '')}</span></div>
      <div class="side"><span><b>${sumByUnit(Object.entries(inst).map(([p, q]) => ({ p, q })))}</b> εγκατεστ.</span>${gw.length ? `<span class="small muted">${sumByUnit(stored.map(r => ({ p: r.p, q: r.N + r.D + r.C })))} αποθηκευμένα</span>` : '<span class="small muted">Χωρίς αποθήκη</span>'}</div></div>`;
  }).join('') || '<div class="panel empty">Δεν υπάρχουν γυμναστήρια.</div>'}</div></div>`;
VIEWS.gym = id => {
  const g = S.gym[id]; if (!g) return `<div class="wrap"><div class="panel empty">Το γυμναστήριο δεν βρέθηκε.</div></div>`;
  const inst = gymInstalled(id); const gw = gymWarehouses(id);
  const pls = Object.entries(S.pl).filter(([, p]) => p.gym === id).sort((a, b) => b[1].no - a[1].no);
  const stored = gw.flatMap(w => whStock(w).map(r => Object.assign({ wh: w }, r)));
  return `<div class="wrap">${pageHead(`<span class="mono">${esc(g.code || '')}</span> · ${esc(g.address || '')}`, esc(g.name),
    `${gw.length && can('move') ? `<button class="btn pri" data-go="install" data-a="${id}">Εγκατάσταση από αποθήκη</button>` : ''}${can('retire') && Object.keys(inst).length ? `<button class="btn danger" data-go="retireg" data-a="${id}">Απόσυρση</button>` : ''}${!gw.length && can('setup') ? `<button class="btn" data-act="mkGymWh" data-g="${id}">Δημιουργία αποθήκης γυμναστηρίου</button>` : ''}`, `<a data-go="gyms">Γυμναστήρια</a>`)}
    <div class="grid2">
      <div class="panel"><h2>Εγκατεστημένα</h2>${Object.keys(inst).length ? `<div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th class="r">Ποσότητα</th></tr></thead><tbody>${sortProds(Object.keys(inst)).map(p => `<tr class="click" data-go="prod" data-a="${p}"><td style="width:56px">${thumb(p)}</td><td><b>${esc(prodName(p))}</b><div class="mono small muted">${esc(prodCode(p))}</div></td><td class="r"><b>${qtyU(inst[p], p)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Τίποτα εγκατεστημένο.</div>'}</div>
      <div class="panel"><h2>Αποθηκευμένα (δεν έχουν εγκατασταθεί)</h2>${gw.length ? (stored.length ? `<div class="tw"><table><thead><tr><th>Προϊόν</th><th>Αποθήκη</th><th class="r">Καν.</th><th class="r">Μεταχ.</th><th class="r">Κατ.</th><th class="r">Έλεγχ.</th></tr></thead><tbody>${stored.map(r => `<tr><td><b>${esc(prodName(r.p))}</b></td><td class="small">${esc(whName(r.wh))}${secLabel(r.wh, r.sec) ? ' / ' + esc(secLabel(r.wh, r.sec)) : ''}</td><td class="r">${fmtN(r.N)}</td><td class="r">${fmtN(r.U)}</td><td class="r">${fmtN(r.D)}</td><td class="r">${fmtN(r.C)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Η αποθήκη του γυμναστηρίου είναι άδεια.</div>') : '<div class="empty">Το γυμναστήριο δεν έχει αποθήκη.</div>'}</div>
    </div>
    ${(() => { const since = Date.now() - 365 * 864e5; const rr = replacementRows({ gym: id, from: since }); const by = {}; rr.forEach(r => by[r.p] = (by[r.p] || 0) + r.qty);
      const ps = Object.keys(by).sort((a, b) => by[b] - by[a]);
      return `<div class="panel"><div class="row" style="margin-bottom:10px"><h2 style="flex:1">Αντικαταστάσεις τελευταίων 12 μηνών</h2><button class="btn sm pri" data-act="replOpen" data-g="${id}">Στατιστική & γραφήματα</button></div>${ps.length ? `<div class="tw"><table><thead><tr><th></th><th>Προϊόν</th><th class="r">Αντικαταστάθηκαν</th></tr></thead><tbody>${ps.map(p => `<tr class="click" data-go="prod" data-a="${p}"><td style="width:56px">${thumb(p)}</td><td><b>${esc(prodName(p))}</b><div class="small muted">${esc(catLabel(p))}</div></td><td class="r"><b>${qtyU(by[p], p)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Καμία αντικατάσταση τους τελευταίους 12 μήνες.</div>'}</div>`; })()}
    <div class="panel"><h2>Τοποθετήσεις</h2>${pls.length ? `<div class="list">${pls.slice(0, 30).map(([pid, p]) => plItem(pid, p)).join('')}</div>` : '<div class="empty">Καμία τοποθέτηση.</div>'}</div></div>`;
};
ACT.mkAllGymWh = async () => {
  const gs = Object.entries(S.gym).filter(([gid, g]) => g.active !== false && !Object.values(S.wh).some(w => w.gym === gid));
  if (!gs.length || !confirm(`Δημιουργία αποθήκης για ${gs.length} γυμναστήρια;`)) return;
  setBusy('Δημιουργία…'); let n = 0;
  try { for (const [gid, g] of gs) { await saveDoc('wh/w' + uid(), { code: 'ΑΠ-' + (g.code || '').replace(/\W/g, ''), name: 'Αποθήκη ' + g.name, address: g.address || '', active: true, gym: gid, sections: [] }); n++; } toast(`Δημιουργήθηκαν ${n} αποθήκες γυμναστηρίων.`); }
  catch (e) { toast(e.message, true); } finally { setBusy(null); }
};
ACT.mkGymWh = async el => {
  const g = S.gym[el.dataset.g]; const id = 'w' + uid();
  try { await saveDoc('wh/' + id, { code: 'ΑΠ-' + (g.code || '').replace(/\W/g, ''), name: 'Αποθήκη ' + g.name, address: g.address || '', active: true, gym: el.dataset.g, sections: [] }); toast('Δημιουργήθηκε η αποθήκη του γυμναστηρίου.'); }
  catch (e) { toast(e.message, true); }
};

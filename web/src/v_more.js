/* ================================================================
   ΑΠΟΓΡΑΦΕΣ, ΙΣΤΟΡΙΚΟ, ΣΗΜΕΙΩΜΑΤΑΡΙΟ, ΑΝΑΦΟΡΕΣ, ΡΥΘΜΙΣΕΙΣ, ΧΡΗΣΤΕΣ
   ================================================================ */

/* ---------------- ΑΠΟΓΡΑΦΕΣ ---------------- */
const invScopeLabel = s => s.t === 'V' ? vehName(s.id) : whName(s.id) + (s.sec ? ' / ' + secName(s.id, s.sec) : '');
VIEWS.invs = () => {
  const list = Object.entries(S.inv).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
  return `<div class="wrap">${pageHead('Καταμέτρηση & διορθώσεις', 'Απογραφές', can('inv_edit') ? `<button class="btn pri" data-act="newInv">+ Νέα απογραφή</button>` : '')}
    <div class="list">${list.map(([id, v]) => `<div class="li" data-go="inv" data-a="${id}"><span class="tag ${v.status === 'done' ? 'g' : 'y'}">${v.status === 'done' ? 'Ολοκληρωμένη' : 'Σε εξέλιξη'}</span>
      <div class="main"><b>${esc(invScopeLabel(v.scope))}</b><span class="muted small">${esc(fmtDT(v.created))} · ${esc(uname(v.by))} · ${v.rows.length} γραμμές${v.scope.cat ? ' · ' + esc(catName(v.scope.cat)) : ''}</span></div>
      <div class="side">${v.status === 'done' && v.mov && S.movById[v.mov] ? `<span class="docno">${esc(S.movById[v.mov].docNo)}</span>` : (v.saved ? `<span class="small muted">Αποθ. ${esc(fmtDT(v.saved))}</span>` : '')}</div></div>`).join('') || '<div class="panel empty">Δεν υπάρχουν απογραφές.</div>'}</div></div>`;
};
ACT.newInv = () => openNewInv({});
ACT.newInvWh = el => openNewInv({ t: 'W', id: el.dataset.w });
ACT.newInvVeh = el => openNewInv({ t: 'V', id: el.dataset.v });
function openNewInv(pre) {
  const st = { t: pre.t || 'W', wh: pre.t === 'W' ? pre.id : defaultWh(), veh: pre.t === 'V' ? pre.id : defaultVeh(), sec: '', cat: '', sub: '', mode: 'stock' };
  const draw = () => {
    openModal(`${mhead('Νέα απογραφή')}
      <div class="chips"><button class="chip ${st.t === 'W' ? 'on' : ''}" data-x="tW">Αποθήκη</button><button class="chip ${st.t === 'V' ? 'on' : ''}" data-x="tV">Φορτίο οχήματος</button></div>
      <div class="fields">${st.t === 'W' ? whSelect('niwh', st.wh) + secSelect('nisec', st.wh, st.sec, { all: true, label: 'Χώρος ή ολόκληρη αποθήκη' }) : vehSelect('niveh', st.veh)}
        <div class="f"><label for="nicat">Είδος</label><select id="nicat">${opt('', 'Όλα', !st.cat)}${activeList(S.cat).map(([k, c]) => opt(k, c.name, k === st.cat)).join('')}</select></div>
        <div class="f"><label for="nisub">Κατηγορία</label><select id="nisub">${opt('', 'Όλες', !st.sub)}${(st.cat ? (S.cat[st.cat].subs || []) : []).map(s => opt(s.id, s.name, s.id === st.sub)).join('')}</select></div>
        ${st.sub && ((subOf(st.cat, st.sub) || {}).types || []).length ? `<div class="f"><label for="nitype">Τύπος</label><select id="nitype">${opt('', 'Όλοι', !st.ptype)}${subOf(st.cat, st.sub).types.map(t => opt(t.id, t.name, t.id === st.ptype)).join('')}</select></div>` : ''}
        ${st.t === 'W' ? `<div class="f"><label for="nimode">Προϊόντα</label><select id="nimode">${opt('stock', 'Όσα έχουν απόθεμα', st.mode === 'stock')}${opt('all', 'Όλα τα προϊόντα του φίλτρου', st.mode === 'all')}</select></div>` : ''}</div>
      <div class="hint">Μπορείτε να προσθέσετε ή να αφαιρέσετε προϊόντα μέσα στην απογραφή.</div>
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="nigo">Δημιουργία</button></div>`);
    $$('[data-x]').forEach(b => b.onclick = () => { st.t = b.dataset.x.slice(1); draw(); });
    const on = (id, k, redraw) => { const e = $('#' + id); if (e) e.onchange = () => { st[k] = e.value; if (k === 'wh') st.sec = ''; if (k === 'cat') st.sub = ''; if (k === 'cat' || k === 'sub') st.ptype = ''; if (redraw) draw(); }; };
    on('niwh', 'wh', 1); on('nisec', 'sec'); on('niveh', 'veh'); on('nicat', 'cat', 1); on('nisub', 'sub', 1); on('nitype', 'ptype'); on('nimode', 'mode');
    $('#nigo').onclick = async () => {
      const f = { cat: st.cat, sub: st.sub, ptype: st.ptype, q: '' };
      const rows = [];
      if (st.t === 'V') {
        const by = {}; vehLots(st.veh).forEach(l => by[l.p] = (by[l.p] || 0) + l.qty);
        sortProds(Object.keys(by).filter(p => prodMatches(p, f))).forEach(p => rows.push({ p, sec: null, sys: { N: by[p] }, cnt: { N: '' } }));
      } else {
        const secs = st.sec ? [st.sec] : allSections(st.wh).map(s => s.id);
        const seen = new Set();
        for (const sc of secs) for (const p of sortProds(Object.keys(S.prod).filter(p => prodMatches(p, f)))) {
          const sys = { N: whAvail(p, st.wh, sc, 'N'), U: whAvail(p, st.wh, sc, 'U'), D: whAvail(p, st.wh, sc, 'D'), C: whAvail(p, st.wh, sc, 'C') };
          if (sys.N + sys.U + sys.D + sys.C > 0) { rows.push({ p, sec: sc, sys, cnt: { N: '', U: '', D: '', C: '' } }); seen.add(p); }
        }
        if (st.mode === 'all') {
          const sc = st.sec || sections(st.wh)[0].id;
          sortProds(Object.keys(S.prod).filter(p => prodMatches(p, f) && !seen.has(p))).forEach(p => rows.push({ p, sec: sc, sys: { N: 0, U: 0, D: 0, C: 0 }, cnt: { N: '', U: '', D: '', C: '' } }));
        }
      }
      const id = 'i' + uid();
      const doc = { created: Date.now(), by: S.me.id, status: 'draft', scope: { t: st.t, id: st.t === 'V' ? st.veh : st.wh, sec: st.t === 'V' ? null : (st.sec || null), cat: st.cat || null, sub: st.sub || null }, rows, saved: Date.now() };
      try { await saveDoc('inv/' + id, doc); S.inv[id] = doc; closeModal(); go('inv', id); } catch (e) { toast(e.message, true); }
    };
  };
  draw();
}
function invCurSys(inv, r) {
  if (inv.scope.t === 'V') return { N: vehLots(inv.scope.id).filter(l => l.p === r.p).reduce((s, l) => s + l.qty, 0) };
  return { N: whAvail(r.p, inv.scope.id, r.sec, 'N'), U: whAvail(r.p, inv.scope.id, r.sec, 'U'), D: whAvail(r.p, inv.scope.id, r.sec, 'D'), C: whAvail(r.p, inv.scope.id, r.sec, 'C') };
}
const STS = inv => inv.scope.t === 'V' ? ['N'] : ENG.STS;
VIEWS.inv = id => {
  const src = S.inv[id]; if (!src) return `<div class="wrap"><div class="panel empty">Η απογραφή δεν βρέθηκε.</div></div>`;
  if (!S.invDraft || S.invDraft.id !== id || src.status === 'done') S.invDraft = { id, doc: JSON.parse(JSON.stringify(src)), dirty: false };
  const inv = S.invDraft.doc; const sts = STS(inv); const done = inv.status === 'done'; const editable = !done && can('inv_edit');
  let stale = 0;
  const rowsHtml = inv.rows.map((r, i) => {
    const cur = invCurSys(inv, r); const changed = !done && sts.some(s => Math.abs((cur[s] || 0) - (r.sys[s] || 0)) > 1e-9); if (changed) stale++;
    return `<tr ${changed ? 'style="background:var(--warn-soft)"' : ''}><td style="width:56px">${thumb(r.p)}</td><td style="min-width:160px"><b>${esc(prodName(r.p))}</b><div class="mono small muted">${esc(prodCode(r.p))} · ${esc(catLabel(r.p))}${inv.scope.t === 'W' && secLabel(inv.scope.id, r.sec) ? ' · ' + esc(secLabel(inv.scope.id, r.sec)) : ''}</div>${changed ? '<div class="small" style="color:var(--warn)">Το υπόλοιπο άλλαξε μετά τη δημιουργία</div>' : ''}</td>
      ${sts.map(s => { const c = r.cnt[s]; const d = c === '' || c == null ? null : Number(c) - (r.sys[s] || 0);
        return `<td class="r">${fmtN(r.sys[s])}</td><td class="r">${editable ? `<input type="number" min="0" step="any" style="width:76px" data-ir="${i}" data-is="${s}" value="${c ?? ''}" aria-label="${ENG.ST[s]} πραγματική">` : (c === '' || c == null ? '—' : fmtN(c))}</td>
        <td class="r" id="d${i}${s}">${d == null ? '' : `<b style="color:${d ? (d < 0 ? 'var(--danger)' : 'var(--ok)') : 'inherit'}">${d > 0 ? '+' : ''}${fmtN(d)}</b>`}</td>`; }).join('')}
      ${editable ? `<td><button class="iconbtn" data-act="invDelRow" data-i="${i}" aria-label="Αφαίρεση">✕</button></td>` : ''}</tr>`;
  }).join('');
  AFTER.push(() => $$('[data-ir]').forEach(inp => inp.oninput = () => {
    const i = inp.dataset.ir, s = inp.dataset.is, r = inv.rows[i]; r.cnt[s] = inp.value === '' ? '' : Number(inp.value);
    const d = inp.value === '' ? null : Number(inp.value) - (r.sys[s] || 0);
    $(`#d${i}${s}`).innerHTML = d == null ? '' : `<b style="color:${d ? (d < 0 ? 'var(--danger)' : 'var(--ok)') : 'inherit'}">${d > 0 ? '+' : ''}${fmtN(d)}</b>`;
    S.invDraft.dirty = true; clearTimeout(S.invDraft.t); S.invDraft.t = setTimeout(() => invSave(true), 4000);
  }));
  const head = sts.map(s => `<th class="r">${s === 'N' ? 'Σύστημα' : ''} ${ENG.ST[s]}</th><th class="r">Πραγματική</th><th class="r">Διαφορά</th>`).join('');
  const m = done && inv.mov ? S.movById[inv.mov] : null;
  return `<div class="wrap">${pageHead(done ? 'Ολοκληρωμένη απογραφή' : 'Απογραφή σε εξέλιξη', esc(invScopeLabel(inv.scope)), editable ? `<button class="btn" data-act="invAdd">+ Προϊόν</button><button class="btn" data-act="invSave">Προσωρινή αποθήκευση</button><button class="btn" data-act="invRefresh">Ανανέωση ποσοτήτων συστήματος</button>` : '', `<a data-go="invs">Απογραφές</a>`)}
    <div class="muted small">Δημιουργήθηκε ${esc(fmtDT(inv.created))} από ${esc(uname(inv.by))}${inv.saved && !done ? ' · Τελευταία αποθήκευση ' + esc(fmtDT(inv.saved)) : ''}${done ? ' · Ολοκληρώθηκε ' + esc(fmtDT(inv.doneTs)) + ' από ' + esc(uname(inv.doneBy)) : ''}${m ? ' · <span class="docno">' + esc(m.docNo) + '</span>' : ''}</div>
    ${stale ? `<div class="warnbox">${stale} γραμμές έχουν διαφορετικό υπόλοιπο από τη στιγμή που ξεκίνησε η απογραφή, λόγω ενδιάμεσων κινήσεων. Πατήστε «Ανανέωση ποσοτήτων συστήματος» πριν από την ολοκλήρωση.</div>` : ''}
    ${!done && !can('inv_apply') ? `<div class="hint">Μπορείτε να καταμετρήσετε και να αποθηκεύσετε. Την ολοκλήρωση κάνει χρήστης με ρόλο Warehouse Manager ή Administrator.</div>` : ''}
    <div class="tw"><table><thead><tr><th></th><th>Προϊόν</th>${head}${editable ? '<th></th>' : ''}</tr></thead><tbody>${rowsHtml || `<tr><td colspan="11" class="empty">Καμία γραμμή.</td></tr>`}</tbody></table></div>
    ${!done ? `<div class="cartbar"><div class="sum">Συμπληρώστε μόνο όσα μετρήσατε. Τα κενά πεδία δεν αλλάζουν.</div>${can('inv_edit') ? `<button class="btn sm" data-act="invDiscard">Απόρριψη</button>` : ''}${can('inv_apply') ? `<button class="btn pri" data-act="invFinish">Έλεγχος διαφορών</button>` : ''}</div>` : ''}</div>`;
};
async function invSave(silent) {
  const d = S.invDraft; if (!d || d.doc.status === 'done') return;
  clearTimeout(d.t); d.doc.saved = Date.now();
  try { await saveDoc('inv/' + d.id, d.doc); d.dirty = false; if (!silent) toast('Η απογραφή αποθηκεύτηκε.'); } catch (e) { toast(e.message, true); }
}
ACT.invSave = () => invSave(false);
ACT.invRefresh = async () => { const inv = S.invDraft.doc; inv.rows.forEach(r => r.sys = invCurSys(inv, r)); await invSave(true); toast('Οι ποσότητες συστήματος ενημερώθηκαν. Οι καταμετρήσεις διατηρήθηκαν.'); render(true); };
ACT.invDelRow = async el => { S.invDraft.doc.rows.splice(Number(el.dataset.i), 1); await invSave(true); render(true); };
ACT.invDiscard = () => {
  openModal(`${mhead('Απόρριψη απογραφής;')}<p>Η απογραφή διαγράφεται χωρίς να αλλάξει κανένα υπόλοιπο.</p><div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Άκυρο</button><button class="btn danger" id="invdel">Απόρριψη</button></div>`);
  $('#invdel').onclick = async () => { try { await db.doc('inv/' + S.invDraft.id).delete(); closeModal(); go('invs'); } catch (e) { toast('Η διαγραφή απέτυχε.', true); } };
};
ACT.invAdd = () => {
  const inv = S.invDraft.doc;
  openModal(`${mhead('Προσθήκη προϊόντος στην απογραφή')}
    <div class="fields"><div class="f"><label for="iaq">Αναζήτηση</label><input type="search" id="iaq" autofocus placeholder="Κωδικός ή όνομα"></div>
    ${inv.scope.t === 'W' ? secSelect('iasec', inv.scope.id, inv.scope.sec || sections(inv.scope.id)[0].id) : ''}</div><div id="iares" class="list"></div>`);
  const draw = () => {
    const q = $('#iaq').value; const ids = sortProds(Object.keys(S.prod).filter(p => prodMatches(p, { q }))).slice(0, 20);
    $('#iares').innerHTML = ids.map(p => `<div class="li" data-p="${p}">${thumb(p)}<div class="main"><b>${esc(prodName(p))}</b><span class="mono small muted">${esc(prodCode(p))}</span></div><div class="side"><span class="btn sm">Προσθήκη</span></div></div>`).join(''); fillPhotos($('#iares'));
    $$('#iares [data-p]').forEach(r => r.onclick = async () => {
      const sec = inv.scope.t === 'W' ? (($('#iasec') || {}).value || inv.scope.sec || sections(inv.scope.id)[0].id) : null;
      if (inv.rows.some(x => x.p === r.dataset.p && x.sec === sec)) return toast('Υπάρχει ήδη στην απογραφή.', true);
      const row = { p: r.dataset.p, sec, cnt: inv.scope.t === 'W' ? { N: '', U: '', D: '', C: '' } : { N: '' } }; row.sys = invCurSys(inv, row);
      inv.rows.push(row); closeModal(); await invSave(true); render(true);
    });
  };
  $('#iaq').oninput = draw; draw();
};
ACT.invFinish = async () => {
  await invSave(true);
  const d = S.invDraft;
  confirmOp({ type: 'INV', id: d.opId || (d.opId = uid()), invId: d.id, inv: d.doc }, { title: 'Ολοκλήρωση απογραφής', intro: `<div class="small">Αναλυτική κατάσταση διαφορών. Με την επιβεβαίωση δημιουργούνται διορθωτικές κινήσεις και τα υπόλοιπα ενημερώνονται. Οι προηγούμενες και οι νέες ποσότητες διατηρούνται στο ιστορικό.</div>`, onDone: () => { S.invDraft = null; } });
  const b = $('#okbtn'); if (b) b.textContent = 'Ολοκλήρωση απογραφής';
};

/* ---------------- ΙΣΤΟΡΙΚΟ ---------------- */
VIEWS.hist = () => {
  const f = S.histF = S.histF || { type: '', from: '', to: '', q: '', loc: '', user: '', veh: '', prod: '' };
  let list = S.mov.filter(m => m.state !== 'pending');
  if (f.type) list = list.filter(m => m.type === f.type);
  if (f.from) { const t = new Date(f.from + 'T00:00').getTime(); list = list.filter(m => m.ts >= t); }
  if (f.to) { const t = new Date(f.to + 'T23:59:59').getTime(); list = list.filter(m => m.ts <= t); }
  if (f.veh) list = list.filter(m => (m.from && m.from.t === 'V' && m.from.id === f.veh) || (m.to && m.to.t === 'V' && m.to.id === f.veh));
  if (f.prod) list = list.filter(m => m.lines.some(l => l.p === f.prod));
  if (f.loc) { const [t, id] = f.loc.split(':'); list = list.filter(m => (m.from && m.from.t === t && m.from.id === id) || (m.to && m.to.t === t && m.to.id === id) || (t === 'W' && m.lines.some(l => l.wh === id))); }
  if (f.user) list = list.filter(m => m.by === f.user);
  if (f.q) { const q = norm(f.q); list = list.filter(m => norm(m.docNo).includes(q) || norm(m.note).includes(q) || m.lines.some(l => norm(prodName(l.p) + ' ' + prodCode(l.p)).includes(q))); }
  const users = [...new Set(S.mov.map(m => m.by).filter(Boolean))];
  AFTER.push(() => {
    [['hft', 'type'], ['hff', 'from'], ['hfto', 'to'], ['hfl', 'loc'], ['hfu', 'user']].forEach(([id, k]) => $('#' + id).onchange = e => { f[k] = e.target.value; f.veh = ''; render(true); });
    $('#hfq').onchange = e => { f.q = e.target.value; f.prod = ''; render(true); };
  });
  const locs = [...activeList(S.wh).map(([k, w]) => ['W:' + k, 'Αποθήκη: ' + w.name]), ...activeList(S.veh).map(([k, v]) => ['V:' + k, 'Όχημα: ' + v.name]), ...activeList(S.gym).map(([k, g]) => ['G:' + k, 'Γυμναστήριο: ' + g.name])];
  return `<div class="wrap">${pageHead(`${S.mov.length} πιο πρόσφατες κινήσεις φορτωμένες`, 'Ιστορικό κινήσεων', `<button class="btn" data-act="histExport">Εξαγωγή Excel</button>`)}
    ${f.veh || f.prod ? `<div class="row"><span class="tag k">Φίλτρο: ${f.veh ? esc(vehName(f.veh)) : ''} ${f.prod ? esc(prodName(f.prod)) : ''}</span><button class="btn sm ghost" data-act="histClear">Καθαρισμός</button></div>` : ''}
    <div class="panel"><div class="fields">
      <div class="f"><label for="hfq">Αναζήτηση</label><input type="search" id="hfq" value="${esc(f.q)}" placeholder="Αριθμός, προϊόν, σημείωση"></div>
      <div class="f"><label for="hft">Τύπος κίνησης</label><select id="hft">${opt('', 'Όλοι', !f.type)}${Object.entries(ENG.TYPES).map(([k, t]) => opt(k, t.label, k === f.type)).join('')}</select></div>
      <div class="f"><label for="hfl">Τοποθεσία</label><select id="hfl">${opt('', 'Όλες', !f.loc)}${locs.map(([k, l]) => opt(k, l, k === f.loc)).join('')}</select></div>
      <div class="f"><label for="hfu">Χρήστης</label><select id="hfu">${opt('', 'Όλοι', !f.user)}${users.map(u => opt(u, uname(u), u === f.user)).join('')}</select></div>
      <div class="f"><label for="hff">Από</label><input type="date" id="hff" value="${esc(f.from)}"></div>
      <div class="f"><label for="hfto">Έως</label><input type="date" id="hfto" value="${esc(f.to)}"></div>
    </div></div>
    ${movRows(list.slice(0, 500), { showProd: f.prod || null })}
    ${S.mov.length >= S.movLimit ? `<div class="row" style="justify-content:center"><button class="btn" data-act="histMore">Φόρτωση παλαιότερων κινήσεων</button></div>` : ''}</div>`;
};
ACT.histClear = () => { S.histF.veh = ''; S.histF.prod = ''; render(true); };
ACT.histMore = () => { S.movLimit += 500; subscribeMov(); toast('Φόρτωση παλαιότερων κινήσεων…'); };
ACT.histExport = () => { const r = REPORTS.movs.build({ from: S.histF.from, to: S.histF.to, type: S.histF.type }); exportXlsx(r); };

/* ---------------- ΣΗΜΕΙΩΜΑΤΑΡΙΟ ---------------- */
VIEWS.notes = () => {
  const f = S.noteF = S.noteF || { q: '', sort: 'new' };
  let list = Object.entries(S.notes);
  if (f.q) { const q = norm(f.q); list = list.filter(([, n]) => q.split(/\s+/).every(t => norm(n.subj + ' ' + n.text).includes(t))); }
  list.sort((a, b) => f.sort === 'old' ? a[1].ts - b[1].ts : f.sort === 'subj' ? a[1].subj.localeCompare(b[1].subj, 'el') : b[1].ts - a[1].ts);
  AFTER.push(() => {
    $('#nq').oninput = e => { f.q = e.target.value; clearTimeout(f.t); f.t = setTimeout(() => { const pos = e.target.selectionStart; render(true); const q = $('#nq'); q.focus(); q.setSelectionRange(pos, pos); }, 250); };
    $('#nsort').onchange = e => { f.sort = e.target.value; render(true); };
  });
  return `<div class="wrap">${pageHead(`Προσωπικό · ${Object.keys(S.notes).length} σημειώσεις`, 'Το σημειωματάριό μου', can('notes') ? `<button class="btn pri" data-act="noteEdit">+ Νέα σημείωση</button>` : '')}
    <p class="hint">Οι σημειώσεις σας είναι προσωπικές: τις βλέπετε μόνο εσείς (και ο βοηθός AI όταν τον ρωτάτε εσείς). Κάθε χρήστης έχει το δικό του σημειωματάριο.</p>
    <div class="panel"><div class="fields"><div class="f" style="grid-column:span 2"><label for="nq">Αναζήτηση σε θέμα και κείμενο</label><input type="search" id="nq" value="${esc(f.q)}"></div>
      <div class="f"><label for="nsort">Ταξινόμηση</label><select id="nsort">${opt('new', 'Νεότερες πρώτα', f.sort === 'new')}${opt('old', 'Παλαιότερες πρώτα', f.sort === 'old')}${opt('subj', 'Θέμα (Α–Ω)', f.sort === 'subj')}</select></div></div></div>
    <div class="grid2">${list.map(([id, n]) => `<div class="note" data-act="noteOpen" data-id="${id}"><div class="row"><span class="mono small">${esc(fmtD(n.ts))} · ${esc(fmtT(n.ts))}</span>${(n.edits || []).length ? `<span class="tag g">${n.edits.length} επεξ.</span>` : ''}</div>
      <h3>${esc(n.subj)}</h3><div class="nt">${esc(n.text)}</div></div>`).join('') || '<div class="panel empty">Δεν βρέθηκαν σημειώσεις.</div>'}</div></div>`;
};
const toLocalInput = ts => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
ACT.noteOpen = el => {
  const n = S.notes[el.dataset.id]; const id = el.dataset.id;
  const mine = n.by === S.me.id;
  openModal(`${mhead(esc(n.subj), `${esc(fmtD(n.ts))} · ${esc(fmtT(n.ts))}`)}<div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(n.text)}</div>
    ${(n.edits || []).length ? `<details><summary class="small">Ιστορικό επεξεργασιών (${n.edits.length})</summary><div class="list" style="margin-top:8px">${n.edits.slice().reverse().map(e => `<div class="panel small"><div class="muted">Πριν από την επεξεργασία της ${esc(fmtDT(e.at))} · ${esc(uname(e.by))}</div><b>${esc(e.subj)}</b><div style="white-space:pre-wrap">${esc(e.text)}</div></div>`).join('')}</div></details>` : ''}
    <div class="btns" style="justify-content:flex-end">${can('notes') && mine ? `<button class="btn danger" data-act="noteDel" data-id="${id}">Διαγραφή</button>` : ''}${can('notes') ? `<button class="btn" data-act="noteEdit" data-id="${id}">Επεξεργασία</button>` : ''}<button class="btn pri" data-act="closeModal">Κλείσιμο</button></div>`);
};
ACT.noteEdit = el => openNoteEditor(el.dataset.id || null);
function openNoteEditor(id, pre = {}) {
  const n = id ? S.notes[id] : Object.assign({ ts: Date.now(), subj: '', text: '' }, pre);
  openModal(`${mhead(id ? 'Επεξεργασία σημείωσης' : 'Νέα σημείωση')}
    <div class="fields"><div class="f"><label for="nts">Ημερομηνία & ώρα</label><input type="datetime-local" id="nts" value="${toLocalInput(n.ts)}"></div>
    <div class="f" style="grid-column:span 2"><label for="nsubj">Θέμα</label><input type="text" id="nsubj" value="${esc(n.subj)}" autofocus></div></div>
    <div class="f"><label for="ntext">Κείμενο</label><textarea id="ntext" style="min-height:180px">${esc(n.text)}</textarea></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="nsave">Αποθήκευση</button></div>`);
  $('#nsave').onclick = async () => {
    const subj = $('#nsubj').value.trim(), text = $('#ntext').value.trim(); const ts = new Date($('#nts').value).getTime() || Date.now();
    if (!subj) return toast('Συμπληρώστε θέμα.', true);
    const { _p, ...base } = n || {};
    const data = id ? Object.assign({}, base, { subj, text, ts, edits: [...(n.edits || []), { at: Date.now(), by: S.me.id, subj: n.subj, text: n.text, ts: n.ts }] })
      : { subj, text, ts, by: S.me.id, created: Date.now(), edits: [] };
    try { await saveDoc(id ? notePath(id) : `data/users/${S.me.id}/note_${uid()}`, data); closeModal(); toast('Η σημείωση αποθηκεύτηκε.'); } catch (e) { toast(e.message, true); }
  };
}
ACT.noteDel = el => {
  const id = el.dataset.id;
  openModal(`${mhead('Διαγραφή σημείωσης;')}<p>«${esc(S.notes[id].subj)}» θα διαγραφεί οριστικά.</p><div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Άκυρο</button><button class="btn danger" id="ndel">Διαγραφή</button></div>`);
  $('#ndel').onclick = async () => { try { await db.doc(notePath(id)).delete(); closeModal(); toast('Η σημείωση διαγράφηκε.'); } catch (e) { toast('Η διαγραφή απέτυχε.', true); } };
};

/* ---------------- ΑΝΑΦΟΡΕΣ ---------------- */
const REPORTS = {
  byProd: { label: 'Υπόλοιπα ανά προϊόν', filters: ['cat', 'sub', 'ptype'], build(f) {
    const ids = sortProds(Object.keys(S.prod).filter(p => prodMatches(p, { cat: f.cat, sub: f.sub, ptype: f.ptype, q: '' })));
    return { title: 'Υπόλοιπα ανά προϊόν', cols: ['Κωδικός', 'Προϊόν', 'Είδος', 'Κατηγορία', 'Τύπος', 'Μονάδα', 'Κανονικά', 'Μεταχειρισμένα', 'Κατεστραμμένα', 'Προς έλεγχο', 'Στα οχήματα', 'Εγκατεστημένα', 'Σύνολο'], num: [6, 7, 8, 9, 10, 11, 12],
      rows: ids.map(p => { const t = prodTotals(p); const x = S.prod[p]; return [x.code, x.name, catName(x.cat), subName(x.cat, x.sub), typeName(x.cat, x.sub, x.ptype), x.unit, t.WN, t.WU, t.WD, t.WC, t.V, t.G, t.all]; }), unitCol: 5 };
  } },
  byCat: { label: 'Ανά είδος, κατηγορία & τύπο', filters: [], build() {
    const g = {};
    Object.keys(S.prod).filter(p => !S.prod[p].deleted).forEach(p => { const x = S.prod[p]; const t = prodTotals(p); const k = `${x.cat}|${x.sub || ''}|${x.ptype || ''}|${x.unit}`;
      const r = g[k] = g[k] || [catName(x.cat), subName(x.cat, x.sub) || '—', typeName(x.cat, x.sub, x.ptype) || '—', x.unit, 0, 0, 0, 0, 0, 0]; r[4]++; r[5] += t.WN; r[6] += t.WU + t.WD + t.WC; r[7] += t.V; r[8] += t.G; r[9] += t.all; });
    return { title: 'Ανά είδος, κατηγορία & τύπο', cols: ['Είδος', 'Κατηγορία', 'Τύπος', 'Μονάδα', 'Κωδικοί', 'Κανονικά', 'Μεταχ., κατεστρ. & προς έλεγχο', 'Οχήματα', 'Εγκατεστημένα', 'Σύνολο'], num: [4, 5, 6, 7, 8, 9],
      rows: Object.values(g).sort((a, b) => a[0].localeCompare(b[0], 'el') || a[1].localeCompare(b[1], 'el')), note: 'Κάθε γραμμή αφορά μία μονάδα μέτρησης· διαφορετικές μονάδες δεν αθροίζονται.' };
  } },
  byWh: { label: 'Ανά αποθήκη & χώρο', filters: ['wh', 'cat'], build(f) {
    const whs = f.wh ? [f.wh] : Object.keys(S.wh); const rows = [];
    whs.forEach(w => whStock(w).filter(r => !f.cat || (S.prod[r.p] && S.prod[r.p].cat === f.cat)).forEach(r => rows.push([whName(w), secLabel(w, r.sec) || '—', catLabel(r.p), prodCode(r.p), prodName(r.p), unitOf(r.p), r.N, r.U, r.D, r.C, r.N + r.U + r.D + r.C])));
    return { title: 'Απόθεμα ανά αποθήκη & χώρο' + (f.wh ? ' · ' + whName(f.wh) : ''), cols: ['Αποθήκη', 'Χώρος', 'Είδος / Κατηγορία', 'Κωδικός', 'Προϊόν', 'Μονάδα', 'Κανονικά', 'Μεταχειρισμένα', 'Κατεστραμμένα', 'Προς έλεγχο', 'Σύνολο'], num: [6, 7, 8, 9, 10], rows, unitCol: 5 };
  } },
  byVeh: { label: 'Φορτίο ανά όχημα', filters: ['veh'], build(f) {
    const vs = f.veh ? [f.veh] : Object.keys(S.veh); const rows = [];
    vs.forEach(v => vehLots(v).forEach(l => rows.push([vehName(v), pkLabel(l.pk), l.wh ? whName(l.wh) : '—', prodCode(l.p), prodName(l.p), unitOf(l.p), l.qty])));
    return { title: 'Φορτίο οχημάτων', cols: ['Όχημα', 'Λίστα παραλαβής', 'Αρχική αποθήκη', 'Κωδικός', 'Προϊόν', 'Μονάδα', 'Ποσότητα'], num: [6], rows, unitCol: 5 };
  } },
  repl: { label: 'Αντικαταστάσεις', filters: ['gym', 'from', 'to', 'cat', 'group'], build(f) {
    const rr = replacementRows({ gym: f.gym || '', from: f.from ? new Date(f.from + 'T00:00').getTime() : null, to: f.to ? new Date(f.to + 'T23:59:59').getTime() : null })
      .filter(r => !f.cat || (S.prod[r.p] && S.prod[r.p].cat === f.cat));
    const per = f.from || f.to ? ` ${f.from ? fmtD(new Date(f.from)) : '…'} έως ${f.to ? fmtD(new Date(f.to)) : '…'}` : '';
    const g = {};
    const mk = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
    if (f.group === 'month') {
      rr.forEach(r => { const k = `${r.gym}|${mk(r.ts)}|${r.p}`; const row = g[k] = g[k] || [gymName(r.gym), mk(r.ts), prodCode(r.p), prodName(r.p), catLabel(r.p), unitOf(r.p), 0, 0, 0, 0, 0, 0, 0]; row[6] += r.qty; row[7]++; row[8] += r.x; row[9] += r.u; row[10] += r.d; row[11] += r.c; });
      const rows = Object.values(g).sort((a, b) => a[0].localeCompare(b[0], 'el') || b[1].localeCompare(a[1]) || b[6] - a[6]);
      return { title: 'Αντικαταστάσεις ανά γυμναστήριο & μήνα' + per, cols: ['Γυμναστήριο', 'Μήνας', 'Κωδικός', 'Προϊόν', 'Είδος / Κατηγορία', 'Μονάδα', 'Ποσότητα', 'Φορές', 'Παλιά πέταμα', 'Παλιά μεταχειρ.', 'Παλιά κατεστρ.', 'Παλιά προς έλεγχο'], num: [6, 7, 8, 9, 10, 11], rows, unitCol: 5 };
    }
    rr.forEach(r => { const k = `${r.gym}|${r.p}`; const row = g[k] = g[k] || [gymName(r.gym), prodCode(r.p), prodName(r.p), catLabel(r.p), unitOf(r.p), 0, 0, 0, 0, 0, 0, 0, new Set()]; row[5] += r.qty; row[6]++; row[7] += r.x; row[8] += r.u; row[9] += r.d; row[10] += r.c; row[11] = Math.max(row[11], r.ts); if (r.reason) row[12].add(r.reason); });
    const rows = Object.values(g).sort((a, b) => a[0].localeCompare(b[0], 'el') || b[5] - a[5]).map(r => { r[11] = fmtD(r[11]); r[12] = [...r[12]].join('; '); return r; });
    return { title: 'Αντικαταστάσεις ανά γυμναστήριο' + per, cols: ['Γυμναστήριο', 'Κωδικός', 'Προϊόν', 'Είδος / Κατηγορία', 'Μονάδα', 'Ποσότητα', 'Φορές', 'Παλιά πέταμα', 'Παλιά μεταχειρ.', 'Παλιά κατεστρ.', 'Παλιά προς έλεγχο', 'Τελευταία', 'Προβλήματα'], num: [5, 6, 7, 8, 9, 10], rows, unitCol: 4 };
  } },
  rems: { label: 'Ρετάλια σε απόθεμα', filters: ['wh'], build(f) {
    const rows = remsWhere(f.wh ? { wh: f.wh } : {}).map(([, r]) => [prodCode(r.p), prodName(r.p), r.dims, remLoc(r), fmtD(r.ts), (S.movById[r.mov] || {}).docNo || '', r.note || '']);
    return { title: 'Ρετάλια σε απόθεμα' + (f.wh ? ' · ' + whName(f.wh) : ''), cols: ['Κωδικός', 'Υλικό', 'Διάσταση', 'Θέση', 'Ημερομηνία', 'Από', 'Σημείωση'], num: [], rows };
  } },
  proc: { label: 'Επεξεργασίες υλικών', filters: ['from', 'to'], build(f) {
    const a = f.from ? new Date(f.from + 'T00:00').getTime() : 0, b = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
    const rows = S.mov.filter(m => m.type === 'PROCESS' && m.state !== 'pending' && m.ts >= a && m.ts <= b).map(m => { const l = m.lines[0];
      return [fmtD(m.ts), m.docNo, prodCode(l.p), prodName(l.p), l.src === 'rem' ? 'Ρετάλι ' + l.dims : 'Ολόκληρα', l.src === 'rem' ? 1 : l.qty, unitOf(l.p), m.purpose || '', (l.out || []).map(o => o.dims + ' → ' + remLocText(o.loc)).join('; '), uname(m.by)]; });
    return { title: 'Επεξεργασίες υλικών', cols: ['Ημερομηνία', 'Παραστατικό', 'Κωδικός', 'Υλικό', 'Τι', 'Ποσότητα', 'Μονάδα', 'Για τι', 'Ρετάλια που έμειναν', 'Χρήστης'], num: [5], rows, unitCol: 6 };
  } },
  byGym: { label: 'Ανά γυμναστήριο (εγκατεστημένα & αποθηκευμένα)', filters: ['gym', 'cat'], build(f) {
    const gs = f.gym ? [f.gym] : Object.keys(S.gym); const rows = [];
    gs.forEach(g => { const ps = new Set([...Object.keys(gymInstalled(g)), ...Object.keys(S.bal).filter(p => gymWarehouses(g).some(w => whQty(p, w)))]);
      sortProds([...ps]).filter(p => !f.cat || (S.prod[p] && S.prod[p].cat === f.cat)).forEach(p => { const v = gymProd(g, p); rows.push([gymName(g), prodCode(p), prodName(p), catLabel(p), unitOf(p), v.inst, v.stored, v.inst + v.stored]); }); });
    return { title: 'Ανά γυμναστήριο', cols: ['Γυμναστήριο', 'Κωδικός', 'Προϊόν', 'Είδος / Κατηγορία', 'Μονάδα', 'Εγκατεστημένα', 'Αποθηκευμένα', 'Σύνολο'], num: [5, 6, 7], rows, unitCol: 4 };
  } },
  movs: { label: 'Κινήσεις ανά διάστημα & τύπο', filters: ['from', 'to', 'type'], build(f) {
    let list = S.mov.filter(m => m.state !== 'pending');
    if (f.type) list = list.filter(m => m.type === f.type);
    if (f.from) list = list.filter(m => m.ts >= new Date(f.from + 'T00:00').getTime());
    if (f.to) list = list.filter(m => m.ts <= new Date(f.to + 'T23:59:59').getTime());
    const rows = []; list.forEach(m => m.lines.forEach(l => rows.push([m.docNo, ENG.TYPES[m.type].label, fmtDT(m.ts), uname(m.by), locName(m.from), locName(m.to), prodCode(l.p), prodName(l.p), unitOf(l.p), m.type === 'INV' && l.diff != null ? l.diff : l.qty, lineDesc(Object.assign({}, m, { wh: m.from && m.from.id, toWh: m.to && m.to.id }), l)])));
    return { title: 'Κινήσεις' + (f.from || f.to ? ` ${f.from || '…'} έως ${f.to || '…'}` : ''), cols: ['Αριθμός', 'Τύπος', 'Ημερομηνία', 'Χρήστης', 'Από', 'Προς', 'Κωδικός', 'Προϊόν', 'Μονάδα', 'Ποσότητα', 'Λεπτομέρειες'], num: [9], rows, unitCol: 8 };
  } },
};
VIEWS.reports = () => {
  const f = S.repF = S.repF || { k: 'byProd', cat: '', sub: '', wh: '', veh: '', gym: '', from: '', to: '', type: '' };
  const R = REPORTS[f.k]; const r = R.build(f);
  const fl = { cat: `<div class="f"><label for="rcat">Είδος</label><select id="rcat">${opt('', 'Όλα', !f.cat)}${activeList(S.cat).map(([k, c]) => opt(k, c.name, k === f.cat)).join('')}</select></div>`,
    sub: f.cat ? `<div class="f"><label for="rsub">Κατηγορία</label><select id="rsub">${opt('', 'Όλες', !f.sub)}${(S.cat[f.cat].subs || []).map(s => opt(s.id, s.name, s.id === f.sub)).join('')}</select></div>` : '',
    ptype: f.sub ? `<div class="f"><label for="rptype">Τύπος</label><select id="rptype">${opt('', 'Όλοι', !f.ptype)}${((subOf(f.cat, f.sub) || {}).types || []).map(t => opt(t.id, t.name, t.id === f.ptype)).join('')}</select></div>` : '',
    wh: `<div class="f"><label for="rwh">Αποθήκη</label><select id="rwh">${opt('', 'Όλες', !f.wh)}${whOpts(f.wh)}</select></div>`,
    veh: `<div class="f"><label for="rveh">Όχημα</label><select id="rveh">${opt('', 'Όλα', !f.veh)}${activeList(S.veh).map(([k, v]) => opt(k, v.name, k === f.veh)).join('')}</select></div>`,
    gym: `<div class="f"><label for="rgym">Γυμναστήριο</label><select id="rgym">${opt('', 'Όλα', !f.gym)}${activeList(S.gym).map(([k, g]) => opt(k, g.name, k === f.gym)).join('')}</select></div>`,
    from: `<div class="f"><label for="rfrom">Από</label><input type="date" id="rfrom" value="${esc(f.from)}"></div>`,
    to: `<div class="f"><label for="rto">Έως</label><input type="date" id="rto" value="${esc(f.to)}"></div>`,
    group: `<div class="f"><label for="rgroup">Ομαδοποίηση</label><select id="rgroup">${opt('prod', 'Ανά γυμναστήριο & προϊόν', f.group !== 'month')}${opt('month', 'Ανά γυμναστήριο, μήνα & προϊόν', f.group === 'month')}</select></div>`,
    type: `<div class="f"><label for="rtype">Τύπος κίνησης</label><select id="rtype">${opt('', 'Όλοι', !f.type)}${Object.entries(ENG.TYPES).map(([k, t]) => opt(k, t.label, k === f.type)).join('')}</select></div>` };
  AFTER.push(() => ['cat', 'sub', 'ptype', 'wh', 'veh', 'gym', 'from', 'to', 'type', 'group'].forEach(k => { const e = $('#r' + k); if (e) e.onchange = () => { f[k] = e.value; if (k === 'cat') f.sub = ''; if (k === 'cat' || k === 'sub') f.ptype = ''; render(true); }; }));
  return `<div class="wrap">${pageHead('Αναφορές & υπόλοιπα', 'Αναφορές', `<button class="btn" data-act="repXlsx">Excel</button><button class="btn" data-act="repPdf">PDF</button>`)}
    <div class="chips">${Object.entries(REPORTS).map(([k, x]) => `<button class="chip ${f.k === k ? 'on' : ''}" data-act="repK" data-k="${k}">${esc(x.label)}</button>`).join('')}</div>
    ${R.filters.length ? `<div class="panel"><div class="fields">${R.filters.map(k => fl[k]).join('')}</div></div>` : ''}
    ${reportTable(r)}</div>`;
};
ACT.repK = el => { S.repF.k = el.dataset.k; render(true); };
function reportTotals(r) { // σύνολα ανά μονάδα
  if (r.unitCol == null) return [];
  const by = {}; r.rows.forEach(row => { const u = row[r.unitCol]; const t = by[u] = by[u] || r.cols.map(() => ''); t[r.unitCol] = u; r.num.forEach(i => t[i] = (Number(t[i]) || 0) + (Number(row[i]) || 0)); });
  return Object.values(by).map(t => { t[0] = 'Σύνολο'; return t; });
}
function reportTable(r, forPdf) {
  const tot = reportTotals(r);
  return `${forPdf ? '' : `<div class="muted small">${r.rows.length} γραμμές${r.note ? ' · ' + esc(r.note) : ''}</div>`}<div class="tw"><table><thead><tr>${r.cols.map((c, i) => `<th class="${r.num.includes(i) ? 'r' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>
    ${r.rows.slice(0, forPdf ? 5000 : 800).map(row => `<tr>${row.map((v, i) => `<td class="${r.num.includes(i) ? 'r' : ''}">${r.num.includes(i) ? fmtN(v) : esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${r.cols.length}" class="empty">Κανένα αποτέλεσμα.</td></tr>`}</tbody>
    ${tot.length ? `<tfoot>${tot.map(t => `<tr>${t.map((v, i) => `<td class="${r.num.includes(i) ? 'r' : ''}">${r.num.includes(i) ? fmtN(v) : esc(v)}</td>`).join('')}</tr>`).join('')}</tfoot>` : ''}</table></div>`;
}
function loadScript(src) { return new Promise((res, rej) => { if ($(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Η βιβλιοθήκη εξαγωγής δεν φορτώθηκε.')); document.head.appendChild(s); }); }
async function saveFile(filename, data) {
  if (!dlCap) return toast('Η αποθήκευση αρχείων δεν είναι διαθέσιμη σε αυτή την προβολή.', true);
  try { const r = await dlCap.save({ filename, data }); if (r.status === 'saved') toast('Το αρχείο αποθηκεύτηκε.'); }
  catch (e) { if (e.code !== 'declined') toast('Η αποθήκευση απέτυχε: ' + (e.message || e.code), true); }
}
const fileStamp = () => new Date().toISOString().slice(0, 10);
async function exportXlsx(r) {
  try {
    setBusy('Δημιουργία Excel…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const tot = reportTotals(r);
    const ws = XLSX.utils.aoa_to_sheet([[r.title], [`${S.company.name || 'MEGA GYM'} · ${fmtDT(Date.now())}`], [], r.cols, ...r.rows, ...tot]);
    ws['!cols'] = r.cols.map((c, i) => ({ wch: Math.min(40, Math.max(c.length, ...r.rows.slice(0, 200).map(x => String(x[i] ?? '').length)) + 2) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Αναφορά');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    setBusy(null);
    await saveFile(`MEGA-GYM-${r.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-${fileStamp()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (e) { setBusy(null); toast(e.message, true); }
}
async function exportPdf(r) {
  try {
    setBusy('Δημιουργία PDF…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-10000px;top:0';
    holder.innerHTML = `<div class="pdfsheet"><div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #FFD200;padding-bottom:8px;margin-bottom:12px"><div><div style="font:800 18px var(--f-display)">${esc(r.title)}</div><div style="color:#555">${esc(S.company.name || 'MEGA GYM')} · ${esc(fmtDT(Date.now()))}</div></div><div style="background:#111;color:#FFD200;font:800 14px var(--f-display);padding:6px 8px">MEGA GYM</div></div>${reportTable(r, true)}</div>`;
    document.body.appendChild(holder);
    const blob = await html2pdf().set({ margin: 8, filename: 'r.pdf', html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: r.cols.length > 7 ? 'landscape' : 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } }).from(holder.firstChild).outputPdf('blob');
    holder.remove(); setBusy(null);
    await saveFile(`MEGA-GYM-${r.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-${fileStamp()}.pdf`, blob);
  } catch (e) { setBusy(null); toast(e.message || 'Η δημιουργία PDF απέτυχε.', true); }
}
ACT.repXlsx = () => exportXlsx(REPORTS[S.repF.k].build(S.repF));
ACT.repPdf = () => exportPdf(REPORTS[S.repF.k].build(S.repF));

/* ---------------- ΡΥΘΜΙΣΕΙΣ ---------------- */
VIEWS.setup = () => {
  const t = S.setupTab || 'company'; const ro = !can('setup');
  const tabs = [['company', 'Εταιρεία'], ['wh', 'Αποθήκες & χώροι'], ['gym', 'Γυμναστήρια'], ['gwh', 'Αποθήκες γυμναστηρίων'], ['veh', 'Οχήματα'], ['cat', 'Είδη & κατηγορίες'], ['units', 'Μονάδες μέτρησης']];
  let body = '';
  if (t === 'company') {
    const c = S.company;
    body = `<div class="panel"><div class="fields">${[['cname', 'Ονομασία', c.name], ['ccode', 'Κωδικός εταιρείας', c.code], ['caddr', 'Διεύθυνση', c.address], ['cphone', 'Τηλέφωνο', c.phone], ['cmail', 'Email', c.email]].map(([id, l, v]) => `<div class="f"><label for="${id}">${l}</label><input type="text" id="${id}" value="${esc(v)}" ${ro ? 'disabled' : ''}></div>`).join('')}</div>
      ${ro ? '' : `<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="saveCompany">Αποθήκευση</button></div>`}
      <p class="hint" style="margin-top:12px">Η δομή δεδομένων είναι έτοιμη για περισσότερες εταιρείες με πλήρη διαχωρισμό· στην έκδοση για δικό σας server κάθε εγγραφή θα φέρει τον κωδικό εταιρείας.</p></div>
      ${S.me.isOwner ? `<div class="panel" style="border-color:var(--danger)"><h3>Καθαρισμός δοκιμαστικών κινήσεων</h3>
        <p class="hint" style="margin:8px 0">Σβήνει όλα τα υπόλοιπα (αποθήκες, χώροι, οχήματα, εγκατεστημένα), όλες τις κινήσεις και τα παραστατικά, τις λίστες παραλαβών και τοποθετήσεων και τις απογραφές. Η αρίθμηση ξεκινά ξανά από την αρχή.<br><b>Μένουν:</b> προϊόντα με φωτογραφίες, είδη/κατηγορίες/τύποι, αποθήκες και χώροι, γυμναστήρια, οχήματα, χρήστες και ρόλοι.</p>
        <button class="btn danger" data-act="resetTests">Καθαρισμός δοκιμών…</button></div>` : ''}`;
  }
  const tbl = (cols, rows) => `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${cols.length}" class="empty">Καμία εγγραφή.</td></tr>`}</tbody></table></div>`;
  const status = a => a === false ? '<span class="tag g">Ανενεργό</span>' : '<span class="tag N">Ενεργό</span>';
  if (t === 'gwh') {
    const q = norm(S.gwhQ || ''); const gyms = Object.entries(S.gym).filter(([, g]) => g.active !== false).sort((a, b) => a[1].name.localeCompare(b[1].name, 'el'))
      .filter(([, g]) => !q || norm(g.name + ' ' + (g.code || '') + ' ' + (g.address || '')).includes(q));
    const missing = Object.entries(S.gym).filter(([gid, g]) => g.active !== false && !Object.values(S.wh).some(w => w.gym === gid)).length;
    body = `<p class="hint">Κάθε γυμναστήριο μπορεί να έχει μία αποθήκη για προϊόντα που φυλάσσονται εκεί χωρίς να έχουν εγκατασταθεί. Εμφανίζονται χωριστά από τις κεντρικές αποθήκες.</p>
      <div class="row" style="gap:10px"><input type="search" id="gwhq" value="${esc(S.gwhQ || '')}" placeholder="Αναζήτηση γυμναστηρίου" style="flex:1;min-width:180px" aria-label="Αναζήτηση">
      ${!ro && missing ? `<button class="btn" data-act="mkAllGymWh">Δημιουργία για όσα δεν έχουν (${missing})</button>` : ''}</div>` +
      tbl(['Γυμναστήριο', 'Αποθήκη', 'Χώροι', 'Απόθεμα', ''], gyms.map(([gid, g]) => { const ws = Object.entries(S.wh).filter(([, w]) => w.gym === gid);
        if (!ws.length) return `<tr><td><b>${esc(g.name)}</b><div class="small muted">${esc(g.code || '')}</div></td><td class="muted">— δεν έχει —</td><td></td><td></td><td>${ro ? '' : `<button class="btn sm" data-act="mkGymWh" data-g="${gid}">Δημιουργία</button>`}</td></tr>`;
        return ws.map(([id, w]) => { const st = whStock(id); return `<tr class="${ro ? '' : 'click'}" ${ro ? '' : `data-act="editWh" data-id="${id}"`}><td><b>${esc(g.name)}</b><div class="small muted">${esc(g.code || '')}</div></td><td>${esc(w.name)}<div class="mono small muted">${esc(w.code)}</div></td>
          <td class="small">${(w.sections || []).map(s => esc(s.name)).join(', ') || 'Γενικός χώρος'}</td><td class="small">${st.length ? sumByUnit(st.map(r => ({ p: r.p, q: r.N + r.U + r.D + r.C }))) : '<span class="muted">άδεια</span>'}</td><td>${status(w.active)}</td></tr>`; }).join(''); }).join(''));
    AFTER.push(() => { const i = $('#gwhq'); if (i) i.oninput = () => { S.gwhQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => { const pos = i.selectionStart; render(true); const x = $('#gwhq'); x.focus(); x.setSelectionRange(pos, pos); }, 250); }; });
  }
  if (t === 'wh') body = `${ro ? '' : `<div class="btns"><button class="btn pri" data-act="editWh">+ Νέα αποθήκη</button></div>`}<p class="hint">Κεντρικές αποθήκες. Οι αποθήκες γυμναστηρίων είναι στη δική τους καρτέλα.</p>` + tbl(['Κωδικός', 'Ονομασία', 'Χώροι', 'Κατάσταση'],
    Object.entries(S.wh).filter(([, w]) => !w.gym).map(([id, w]) => `<tr class="${ro ? '' : 'click'}" ${ro ? '' : `data-act="editWh" data-id="${id}"`}><td class="mono">${esc(w.code)}</td><td><b>${esc(w.name)}</b><div class="small muted">${esc(w.address || '')}</div></td><td class="small">${(w.sections || []).map(s => esc(s.name) + (s.active === false ? ' (ανεν.)' : '')).join(', ') || 'Γενικός χώρος'}</td><td>${status(w.active)}</td></tr>`).join(''));
  if (t === 'gym') body = `${ro ? '' : `<div class="btns"><button class="btn pri" data-act="editGym">+ Νέο γυμναστήριο</button></div>`}` + tbl(['Κωδικός', 'Ονομασία', 'Διεύθυνση', 'Αποθήκη', 'Κατάσταση'],
    Object.entries(S.gym).map(([id, g]) => `<tr class="${ro ? '' : 'click'}" ${ro ? '' : `data-act="editGym" data-id="${id}"`}><td class="mono">${esc(g.code)}</td><td><b>${esc(g.name)}</b></td><td>${esc(g.address || '')}</td><td>${gymWarehouses(id).map(whName).map(esc).join(', ') || '—'}</td><td>${status(g.active)}</td></tr>`).join(''));
  if (t === 'veh') body = `${ro ? '' : `<div class="btns"><button class="btn pri" data-act="editVeh">+ Νέο όχημα</button></div>`}` + tbl(['Κωδικός', 'Ονομασία', 'Αριθμός κυκλοφορίας', 'Φορτίο', 'Κατάσταση'],
    Object.entries(S.veh).map(([id, v]) => `<tr class="${ro ? '' : 'click'}" ${ro ? '' : `data-act="editVeh" data-id="${id}"`}><td class="mono">${esc(v.code)}</td><td><b>${esc(v.name)}</b></td><td>${esc(v.plate || '—')}</td><td>${sumByUnit(vehLots(id).map(l => ({ p: l.p, q: l.qty })))}</td><td>${status(v.active)}</td></tr>`).join(''));
  if (t === 'cat') body = `${can('catalog') ? `<div class="btns"><button class="btn pri" data-act="editCat">+ Νέο είδος</button></div>` : ''}` + tbl(['Είδος', 'Κατηγορίες → Τύποι', 'Προϊόντα', 'Κατάσταση'],
    Object.entries(S.cat).sort((a, b) => a[1].name.localeCompare(b[1].name, 'el')).map(([id, c]) => `<tr class="${can('catalog') ? 'click' : ''}" ${can('catalog') ? `data-act="editCat" data-id="${id}"` : ''}><td><b>${esc(c.name)}</b></td><td class="small">${(c.subs || []).map(s => `<div><b>${esc(s.name)}</b>${s.active === false ? ' (ανεν.)' : ''}${(s.types || []).length ? ' → ' + s.types.map(t => esc(t.name) + (t.active === false ? ' (ανεν.)' : '')).join(', ') : ''}</div>`).join('') || '—'}</td><td>${Object.values(S.prod).filter(p => p.cat === id && !p.deleted).length}</td><td>${status(c.active)}</td></tr>`).join(''));
  if (t === 'units') body = `<div class="panel"><div class="list">${S.units.map(u => `<div class="row"><span class="tag k">${esc(u.k)}</span><span>${esc(u.n)}</span></div>`).join('')}</div>
    ${can('catalog') ? `<div class="fields" style="margin-top:14px"><div class="f"><label for="uk">Συντομογραφία</label><input type="text" id="uk" placeholder="π.χ. κιβ"></div><div class="f"><label for="un">Ονομασία</label><input type="text" id="un" placeholder="π.χ. Κιβώτια"></div><div class="f" style="justify-content:flex-end"><button class="btn pri" data-act="addUnit">Προσθήκη μονάδας</button></div></div>` : ''}</div>`;
  return `<div class="wrap">${pageHead(esc(S.company.name || 'MEGA GYM'), 'Εταιρεία & δομή')}
    ${ro ? `<div class="warnbox">Προβολή μόνο. Οι αλλαγές δομής γίνονται από Administrator ή Warehouse Manager.</div>` : ''}
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="setupTab" data-t="${k}">${l}</button>`).join('')}</div>${body}</div>`;
};
ACT.setupTab = el => { S.setupTab = el.dataset.t; if (S.route.v !== 'setup') go('setup'); else render(true); };
ACT.resetTests = () => {
  if (!S.me.isOwner) return toast('Μόνο ο κάτοχος της εφαρμογής μπορεί να κάνει καθαρισμό.', true);
  const cnt = { mov: S.mov.length, pk: Object.keys(S.pk).length, pl: Object.keys(S.pl).length, inv: Object.keys(S.inv).length, bal: Object.keys(S.bal).length };
  openModal(`${mhead('Καθαρισμός δοκιμαστικών κινήσεων', 'Η ενέργεια δεν αναιρείται')}
    <div class="warnbox">Θα διαγραφούν ${cnt.mov}${S.mov.length >= S.movLimit ? '+' : ''} κινήσεις, ${cnt.pk} λίστες παραλαβής, ${cnt.pl} λίστες τοποθέτησης, ${cnt.inv} απογραφές και τα υπόλοιπα ${cnt.bal} προϊόντων. Όλα τα αποθέματα γίνονται μηδέν.</div>
    <label class="check"><input type="checkbox" id="rnotes"> Διαγραφή και των παλιών κοινών σημειώσεων (${Object.keys(S.sharedNotes).length}) — τα προσωπικά σημειωματάρια δεν επηρεάζονται</label>
    <div class="f"><label for="rconf">Για επιβεβαίωση πληκτρολογήστε ΜΗΔΕΝΙΣΜΟΣ</label><input type="text" id="rconf" autocomplete="off"></div>
    <div id="rerr"></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn danger" id="rgo" disabled>Καθαρισμός</button></div>`);
  const conf = $('#rconf'); conf.oninput = () => { $('#rgo').disabled = norm(conf.value.trim()) !== norm('ΜΗΔΕΝΙΣΜΟΣ'); };
  $('#rgo').onclick = async () => {
    const withNotes = $('#rnotes').checked; closeModal();
    let n = 0;
    try {
      setBusy('Καθαρισμός…');
      const r = await SB.fn('execute', { action: 'reset', withNotes }); n = r.deleted || 0;
      await SB.resync();
      S.invDraft = null; S.form = null;
      setBusy(null); toast(`Ο καθαρισμός ολοκληρώθηκε (${n} εγγραφές). Όλα τα αποθέματα είναι μηδέν.`);
      go('dash');
    } catch (e) { setBusy(null); toast('Ο καθαρισμός διακόπηκε: ' + (e.message || e.code || 'σφάλμα') + '. Πατήστε ξανά για να συνεχίσει.', true); }
  };
};
ACT.saveCompany = async () => {
  const d = { name: $('#cname').value.trim() || 'MEGA GYM', code: $('#ccode').value.trim(), address: $('#caddr').value.trim(), phone: $('#cphone').value.trim(), email: $('#cmail').value.trim() };
  try { await saveDoc('cfg/company', d); toast('Τα στοιχεία της εταιρείας αποθηκεύτηκαν.'); } catch (e) { toast(e.message, true); }
};
ACT.addUnit = async () => {
  const k = $('#uk').value.trim(), n = $('#un').value.trim(); if (!k || !n) return toast('Συμπληρώστε συντομογραφία και ονομασία.', true);
  if (S.units.some(u => u.k === k)) return toast('Η μονάδα υπάρχει ήδη.', true);
  try { await saveDoc('cfg/units', { list: [...S.units, { k, n }] }); toast('Η μονάδα προστέθηκε.'); } catch (e) { toast(e.message, true); }
};
function hasStockAt(pred) { for (const b of Object.values(S.bal)) for (const [k, v] of Object.entries(b.q || {})) if (v && pred(k)) return true;
  for (const r of Object.values(S.rem)) if (r.status === 'stock') { const k = r.loc.t === 'W' ? `W|${r.loc.wh}|${r.loc.sec || '_'}|R` : `V|${r.loc.veh}|R|0`; if (pred(k)) return true; } return false; }
function subEditor(list, label) {
  return `<div class="f"><span class="lbl">${label}</span><div id="subs" class="list">${list.map((s, i) => `<div class="row"><input type="text" data-sn="${i}" value="${esc(s.name)}" style="flex:1;min-width:140px" aria-label="Ονομασία"><label class="check"><input type="checkbox" data-sa="${i}" ${s.active !== false ? 'checked' : ''}> Ενεργό</label></div>`).join('')}</div>
    <button class="btn sm" id="subadd" style="align-self:flex-start;margin-top:6px">+ Προσθήκη</button></div>`;
}
function bindSubEditor(list, redraw) {
  $$('[data-sn]').forEach(i => i.oninput = () => list[i.dataset.sn].name = i.value);
  $$('[data-sa]').forEach(i => i.onchange = () => list[i.dataset.sa].active = i.checked);
  $('#subadd').onclick = () => { list.push({ id: 's' + uid(), name: '', active: true }); redraw(); };
}
ACT.editWh = el => {
  const id = el.dataset.id; const w = id ? JSON.parse(JSON.stringify(S.wh[id])) : { code: '', name: '', address: '', active: true, gym: '', sections: [] };
  const draw = () => {
    openModal(`${mhead(id ? 'Επεξεργασία αποθήκης' : 'Νέα αποθήκη')}<div class="fields">
      <div class="f"><label for="wcode">Κωδικός</label><input type="text" id="wcode" value="${esc(w.code)}"></div><div class="f"><label for="wname">Ονομασία</label><input type="text" id="wname" value="${esc(w.name)}"></div>
      <div class="f"><label for="waddr">Διεύθυνση</label><input type="text" id="waddr" value="${esc(w.address)}"></div>
      ${gymSelect('wgym', w.gym, { blank: true, label: 'Συνδεδεμένο γυμναστήριο (προαιρετικά)' }).replace('— Επιλέξτε —', '— Κανένα —')}</div>
      <label class="check"><input type="checkbox" id="wact" ${w.active !== false ? 'checked' : ''}> Ενεργή αποθήκη</label>
      ${subEditor(w.sections, 'Χώροι / τμήματα αποθήκης (προαιρετικά, π.χ. Ισόγειο, Υπόγειο, Ράφι Α). Χωρίς χώρους χρησιμοποιείται ο Γενικός χώρος.')}
      <p class="hint">Τα είδη, οι κατηγορίες και οι τύποι προϊόντων είναι κοινά για όλες τις αποθήκες· οι χώροι δείχνουν πού βρίσκεται φυσικά το απόθεμα.</p>
      <div id="werr"></div><div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="wsave">Αποθήκευση</button></div>`);
    const keep = () => { w.code = $('#wcode').value; w.name = $('#wname').value; w.address = $('#waddr').value; w.gym = $('#wgym').value; w.active = $('#wact').checked; };
    w.sections = w.sections || [];
    bindSubEditor(w.sections, () => { keep(); draw(); });
    $('#wsave').onclick = async () => {
      keep(); const err = m => $('#werr').innerHTML = `<div class="errbox">${esc(m)}</div>`;
      w.code = w.code.trim(); w.name = w.name.trim(); w.sections = w.sections.filter(s => s.name.trim()).map(s => Object.assign(s, { name: s.name.trim() }));
      if (!w.code || !w.name) return err('Συμπληρώστε κωδικό και ονομασία.');
      if (Object.entries(S.wh).some(([k, x]) => k !== id && norm(x.code) === norm(w.code))) return err('Ο κωδικός χρησιμοποιείται ήδη.');
      if (id) {
        for (const s of w.sections) if (s.active === false && hasStockAt(k => k.startsWith(`W|${id}|${s.id}|`))) return err(`Ο χώρος «${s.name}» έχει απόθεμα. Μεταφέρετε πρώτα το απόθεμα και μετά απενεργοποιήστε τον.`);
        const removed = (S.wh[id].sections || []).filter(s => !w.sections.some(x => x.id === s.id));
        for (const s of removed) if (hasStockAt(k => k.startsWith(`W|${id}|${s.id}|`))) return err(`Ο χώρος «${s.name}» έχει απόθεμα και δεν μπορεί να αφαιρεθεί.`);
        if (!w.active && hasStockAt(k => k.startsWith(`W|${id}|`))) return err('Η αποθήκη έχει απόθεμα. Δεν μπορεί να απενεργοποιηθεί.');
      }
      try { await saveDoc('wh/' + (id || 'w' + uid()), w); closeModal(); toast('Η αποθήκη αποθηκεύτηκε.'); } catch (e) { err(e.message); }
    };
  };
  draw();
};
function simpleEditor({ title, path, id, data, fields, validate }) {
  openModal(`${mhead(title)}<div class="fields">${fields.map(([k, l]) => `<div class="f"><label for="se_${k}">${l}</label><input type="text" id="se_${k}" value="${esc(data[k] || '')}"></div>`).join('')}</div>
    <label class="check"><input type="checkbox" id="se_act" ${data.active !== false ? 'checked' : ''}> Ενεργό</label><div id="seerr"></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="sesave">Αποθήκευση</button></div>`);
  $('#sesave').onclick = async () => {
    fields.forEach(([k]) => data[k] = $('#se_' + k).value.trim()); data.active = $('#se_act').checked;
    const e = validate(data); if (e) return $('#seerr').innerHTML = `<div class="errbox">${esc(e)}</div>`;
    try { await saveDoc(path + '/' + id, data); closeModal(); toast('Αποθηκεύτηκε.'); } catch (x) { $('#seerr').innerHTML = `<div class="errbox">${esc(x.message)}</div>`; }
  };
}
ACT.editGym = el => {
  const id = el.dataset.id || 'g' + uid(); const data = Object.assign({ code: '', name: '', address: '', active: true }, S.gym[id] || {});
  simpleEditor({ title: S.gym[id] ? 'Επεξεργασία γυμναστηρίου' : 'Νέο γυμναστήριο', path: 'gyms', id, data, fields: [['code', 'Κωδικός'], ['name', 'Ονομασία'], ['address', 'Διεύθυνση']],
    validate: d => !d.code || !d.name ? 'Συμπληρώστε κωδικό και ονομασία.' : Object.entries(S.gym).some(([k, x]) => k !== id && norm(x.code) === norm(d.code)) ? 'Ο κωδικός χρησιμοποιείται ήδη.' : (!d.active && hasStockAt(k => k.startsWith(`G|${id}|`)) ? 'Υπάρχουν εγκατεστημένα προϊόντα· δεν μπορεί να απενεργοποιηθεί.' : null) });
};
ACT.editVeh = el => {
  const id = el.dataset.id || 'v' + uid(); const n = Object.keys(S.veh).length + 1;
  const data = Object.assign({ code: 'ΑΜ' + n, name: 'ΑΜΑΞΙ ' + n, plate: '', active: true }, S.veh[id] || {});
  simpleEditor({ title: S.veh[id] ? 'Επεξεργασία οχήματος' : 'Νέο όχημα', path: 'veh', id, data, fields: [['code', 'Κωδικός'], ['name', 'Ονομασία'], ['plate', 'Αριθμός κυκλοφορίας (προαιρετικά)']],
    validate: d => !d.code || !d.name ? 'Συμπληρώστε κωδικό και ονομασία.' : Object.entries(S.veh).some(([k, x]) => k !== id && norm(x.code) === norm(d.code)) ? 'Ο κωδικός χρησιμοποιείται ήδη.' : (!d.active && (vehLots(id).length || remsWhere({ veh: id }).length) ? 'Το όχημα έχει φορτίο ή ρετάλια· δεν μπορεί να απενεργοποιηθεί.' : null) });
};
ACT.editCat = el => {
  const id = el.dataset.id; const c = id ? JSON.parse(JSON.stringify(S.cat[id])) : { name: '', active: true, subs: [] };
  c.subs.forEach(s => s.types = s.types || []);
  const keep = () => {
    c.name = $('#cn').value; c.active = $('#cact').checked; c.mat = $('#cmat').checked;
    $$('[data-sn]').forEach(i => c.subs[i.dataset.sn].name = i.value);
    $$('[data-sa]').forEach(i => c.subs[i.dataset.sa].active = i.checked);
    $$('[data-tn]').forEach(i => { const [a, b] = i.dataset.tn.split(':'); c.subs[a].types[b].name = i.value; });
    $$('[data-ta]').forEach(i => { const [a, b] = i.dataset.ta.split(':'); c.subs[a].types[b].active = i.checked; });
  };
  const draw = () => {
    openModal(`${mhead(id ? 'Επεξεργασία είδους' : 'Νέο είδος', 'Είδος → Κατηγορία → Τύπος. Ισχύει για όλες τις αποθήκες, τα οχήματα και τα γυμναστήρια. Η μετονομασία και η απενεργοποίηση δεν επηρεάζουν το ιστορικό.')}
      <div class="f"><label for="cn">Είδος</label><input type="text" id="cn" value="${esc(c.name)}" placeholder="π.χ. Ηλεκτρολογικός εξοπλισμός"></div>
      <label class="check"><input type="checkbox" id="cact" ${c.active !== false ? 'checked' : ''}> Ενεργό</label>
      <label class="check"><input type="checkbox" id="cmat" ${c.mat ? 'checked' : ''}> Είδος υλικών κατασκευών — όλα τα προϊόντα του είναι υλικά (επεξεργασία & ρετάλια)</label>
      <span class="lbl">Κατηγορίες και τύποι (προαιρετικά)</span>
      <div class="list">${c.subs.map((s, i) => `<div class="panel" style="padding:12px;display:flex;flex-direction:column;gap:8px">
        <div class="row"><input type="text" data-sn="${i}" value="${esc(s.name)}" style="flex:1;min-width:140px;font-weight:600" placeholder="π.χ. Φώτα" aria-label="Κατηγορία"><label class="check"><input type="checkbox" data-sa="${i}" ${s.active !== false ? 'checked' : ''}> Ενεργή</label><button class="iconbtn" data-dels="${i}" aria-label="Διαγραφή κατηγορίας" title="Διαγραφή κατηγορίας">✕</button></div>
        <div style="display:flex;flex-direction:column;gap:6px;padding-left:16px;border-left:3px solid var(--accent)">
          ${s.types.map((t, j) => `<div class="row"><input type="text" data-tn="${i}:${j}" value="${esc(t.name)}" style="flex:1;min-width:120px" placeholder="π.χ. LED tubes" aria-label="Τύπος"><label class="check"><input type="checkbox" data-ta="${i}:${j}" ${t.active !== false ? 'checked' : ''}> Ενεργός</label><button class="iconbtn" data-delt="${i}:${j}" aria-label="Διαγραφή τύπου" title="Διαγραφή τύπου">✕</button></div>`).join('')}
          <button class="btn sm ghost" data-addt="${i}" style="align-self:flex-start">+ Τύπος</button></div></div>`).join('')}</div>
      <button class="btn sm" id="subadd" style="align-self:flex-start">+ Κατηγορία</button>
      <div id="cerr"></div><div class="btns" style="justify-content:space-between">${id ? '<button class="btn danger" id="cdel">Διαγραφή είδους</button>' : '<span></span>'}<span class="btns"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="csave">Αποθήκευση</button></span></div>`);
    const live = Object.values(S.prod).filter(p => !p.deleted && p.cat === id);
    const err = m => { $('#cerr').innerHTML = `<div class="errbox">${esc(m)}</div>`; };
    $$('[data-dels]').forEach(b => b.onclick = () => {
      keep(); const sub = c.subs[b.dataset.dels]; const n = live.filter(p => p.sub === sub.id).length;
      if (n) return err(`Η κατηγορία «${sub.name}» έχει ${n} προϊόντα. Μεταφέρετέ τα σε άλλη κατηγορία ή διαγράψτε τα πρώτα, ή απενεργοποιήστε την.`);
      c.subs.splice(Number(b.dataset.dels), 1); draw(); toast('Η κατηγορία αφαιρέθηκε. Πατήστε Αποθήκευση.');
    });
    $$('[data-delt]').forEach(b => b.onclick = () => {
      keep(); const [a, j] = b.dataset.delt.split(':').map(Number); const sub = c.subs[a]; const ty = sub.types[j];
      const n = live.filter(p => p.sub === sub.id && p.ptype === ty.id).length;
      if (n) return err(`Ο τύπος «${ty.name}» έχει ${n} προϊόντα. Μεταφέρετέ τα σε άλλο τύπο ή διαγράψτε τα πρώτα, ή απενεργοποιήστε τον.`);
      sub.types.splice(j, 1); draw(); toast('Ο τύπος αφαιρέθηκε. Πατήστε Αποθήκευση.');
    });
    const cd = $('#cdel'); if (cd) cd.onclick = () => {
      if (live.length) return err(`Το είδος έχει ${live.length} προϊόντα. Μεταφέρετέ τα σε άλλο είδος ή διαγράψτε τα πρώτα, ή απενεργοποιήστε το.`);
      openModal(`${mhead('Διαγραφή είδους;', esc(S.cat[id].name))}<p>Θα διαγραφεί οριστικά μαζί με όλες τις κατηγορίες και τους τύπους του.</p>
        <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn danger" id="cdelgo">Διαγραφή</button></div>`);
      $('#cdelgo').onclick = async () => { try { await db.doc('cats/' + id).delete(); closeModal(); toast('Το είδος διαγράφηκε.'); } catch (e) { toast('Η διαγραφή απέτυχε.', true); } };
    };
    $('#subadd').onclick = () => { keep(); c.subs.push({ id: 's' + uid(), name: '', active: true, types: [] }); draw(); };
    $$('[data-addt]').forEach(b => b.onclick = () => { keep(); c.subs[b.dataset.addt].types.push({ id: 't' + uid(), name: '', active: true }); draw(); });
    $('#csave').onclick = async () => {
      keep(); c.name = c.name.trim();
      c.subs = c.subs.filter(s => s.name.trim()).map(s => Object.assign(s, { name: s.name.trim(), types: s.types.filter(t => t.name.trim()).map(t => Object.assign(t, { name: t.name.trim() })) }));
      if (!c.name) return $('#cerr').innerHTML = `<div class="errbox">Συμπληρώστε ονομασία είδους.</div>`;
      try { await saveDoc('cats/' + (id || 'c' + uid()), c); closeModal(); toast('Το είδος αποθηκεύτηκε.'); } catch (e) { $('#cerr').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
    };
  };
  draw();
};

/* ---------------- ΧΡΗΣΤΕΣ ---------------- */
VIEWS.users = () => {
  const admin = S.me.role === 'admin';
  const ids = [...new Set([...Object.keys(S.members), ...Object.keys(S.roles)])];
  if (admin && !S.authUsers && !S.authUsersLoading) loadAuthUsers();
  return `<div class="wrap">${pageHead('Ρόλοι & πρόσβαση', 'Χρήστες & δικαιώματα', admin ? `<button class="btn pri" data-act="newUser">+ Νέος χρήστης</button>` : '')}
    <div class="panel"><h3>Ο λογαριασμός σας</h3><p style="margin:8px 0 0">${esc(S.me.name || 'Εσείς')} · <b>${esc(ROLE_LABEL[S.me.role])}</b>${S.me.whs.length ? ' · Αποθήκες: ' + S.me.whs.map(whName).map(esc).join(', ') : ''}${S.me.isOwner ? ' · Κάτοχος της εφαρμογής' : ''}</p></div>
    <div class="panel"><h3>Ρόλοι</h3><div class="tw" style="margin-top:10px"><table><thead><tr><th>Ρόλος</th><th>Τι επιτρέπει</th></tr></thead><tbody>
      <tr><td><b>Administrator</b></td><td>Πλήρης διαχείριση, ρόλοι χρηστών, διαγραφή προϊόντων και ειδών/κατηγοριών/τύπων.</td></tr>
      <tr><td><b>Warehouse Manager</b></td><td>Όλες οι κινήσεις, μεταφορές, καταστάσεις, απόσυρση, ολοκλήρωση απογραφών, επιστροφή σε άλλη αποθήκη, δομή & κατάλογος, διαγραφή προϊόντων και ειδών/κατηγοριών/τύπων.</td></tr>
      <tr><td><b>Warehouse Employee</b></td><td>Εισαγωγή, παραλαβή, τοποθέτηση, επιστροφή στην αρχική αποθήκη, καταμέτρηση απογραφής, νέα προϊόντα, σημειώσεις.</td></tr>
      <tr><td><b>Viewer</b></td><td>Μόνο προβολή και αναφορές.</td></tr></tbody></table></div>
      <p class="hint" style="margin-top:10px">Ο AI Assistant ακολουθεί ακριβώς τα ίδια δικαιώματα. Νέους χρήστες προσθέτει ο Administrator με το κουμπί «+ Νέος χρήστης» (email και προσωρινός κωδικός). Ο χρήστης μπορεί μετά να αλλάξει τον κωδικό του από το μενού του λογαριασμού.</p></div>
    <div class="tw"><table><thead><tr><th>Χρήστης</th><th>Ρόλος</th><th>Περιορισμός αποθηκών</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
    ${ids.map(u => { const r = S.roles[u] || {}; const isMe = u === S.me.id; const role = isMe ? S.me.role : (r.role || 'viewer');
      return `<tr><td><b>${esc(uname(u))}</b>${isMe ? ' <span class="tag y">Εσείς</span>' : ''}<div class="small muted">${esc((S.members[u] && S.members[u].email) || '')}${au(u).banned ? ' · <b class="neg">Απενεργοποιημένος</b>' : ''}</div><div class="small muted">Πρώτη είσοδος ${esc(fmtD(S.members[u] && S.members[u].first))}${au(u).last ? ' · Τελευταία ' + esc(fmtD(Date.parse(au(u).last))) : ''}</div></td>
      <td>${admin && !isMe ? `<select data-ur="${u}">${Object.entries(ROLE_LABEL).map(([k, l]) => opt(k, l, k === role)).join('')}</select>` : esc(ROLE_LABEL[role])}</td>
      <td class="small">${admin && !isMe ? (() => { const cb = ([k, w]) => `<label class="check"><input type="checkbox" data-uw="${u}" value="${k}" ${(r.whs || []).includes(k) ? 'checked' : ''}> ${esc(w.name)}</label>`; const all = activeList(S.wh); const gw = all.filter(([, w]) => w.gym); const sel = gw.filter(([k]) => (r.whs || []).includes(k)).length;
        return all.filter(([, w]) => !w.gym).map(cb).join('') + (gw.length ? `<details style="margin-top:4px"><summary class="small">Αποθήκες γυμναστηρίων (${gw.length}${sel ? ', επιλεγμένες ' + sel : ''})</summary>${gw.map(cb).join('')}</details>` : ''); })() + '<div class="muted">Κανένα επιλεγμένο = όλες</div>' : ((r.whs || []).map(whName).map(esc).join(', ') || 'Όλες')}</td>
      ${admin ? `<td><div class="btns">${isMe ? '' : `<button class="btn sm pri" data-act="saveRole" data-u="${u}">Αποθήκευση</button>`}<button class="btn sm ghost" data-act="userPass" data-u="${u}">Κωδικός</button>${isMe || u === S.ownerUid ? '' : `<button class="btn sm ghost" data-act="userBan" data-u="${u}" data-on="${au(u).banned ? 0 : 1}">${au(u).banned ? 'Ενεργοποίηση' : 'Απενεργοποίηση'}</button>`}</div></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="4" class="empty">Κανένας χρήστης ακόμη.</td></tr>`}
    </tbody></table></div></div>`;
};
ACT.saveRole = async el => {
  const u = el.dataset.u; const role = $(`[data-ur="${u}"]`).value; const whs = $$(`[data-uw="${u}"]`).filter(c => c.checked).map(c => c.value);
  try { await saveDoc('roles/' + u, { role, whs, by: S.me.id, at: Date.now() }); toast('Ο ρόλος αποθηκεύτηκε.'); }
  catch (e) { toast('Μόνο ο κάτοχος ή Editor της εφαρμογής μπορεί να αλλάξει ρόλους.', true); }
};

/* ---- λογαριασμοί σύνδεσης (email & κωδικός) — μόνο Administrator, μέσω της function «admin» ---- */
const au = u => (S.authUsers && S.authUsers[u]) || {};
async function loadAuthUsers() {
  S.authUsersLoading = true;
  try { const r = await SB.fn('admin', { action: 'list' }); S.authUsers = {}; r.users.forEach(x => S.authUsers[x.id] = x); scheduleRender(); }
  catch (e) { S.authUsers = {}; } finally { S.authUsersLoading = false; }
}
ACT.newUser = () => {
  const cb = ([k, w]) => `<label class="check"><input type="checkbox" class="nuw" value="${k}"> ${esc(w.name)}</label>`;
  openModal(`${mhead('Νέος χρήστης', 'Σύνδεση με email & κωδικό')}
    <div class="f"><label for="nun">Ονοματεπώνυμο</label><input type="text" id="nun" autocomplete="off"></div>
    <div class="f"><label for="nue">Email</label><input type="email" id="nue" autocomplete="off" inputmode="email"></div>
    <div class="f"><label for="nup">Προσωρινός κωδικός (τουλάχιστον 8 χαρακτήρες)</label><input type="text" id="nup" autocomplete="off" value="${genPass()}"></div>
    <div class="f"><label for="nur">Ρόλος</label><select id="nur">${Object.entries(ROLE_LABEL).map(([k, l]) => opt(k, l, k === 'employee')).join('')}</select></div>
    <div class="f"><label>Περιορισμός αποθηκών (κανένα = όλες)</label>${activeList(S.wh).filter(([, w]) => !w.gym).map(cb).join('')}</div>
    <p class="hint">Δώστε στον χρήστη το email και τον προσωρινό κωδικό. Μπορεί να τον αλλάξει από το μενού «Λογαριασμός».</p>
    <div id="nuerr"></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="nugo">Δημιουργία</button></div>`);
  $('#nugo').onclick = async () => {
    const body = { action: 'create', name: $('#nun').value.trim(), email: $('#nue').value.trim(), password: $('#nup').value, role: $('#nur').value, whs: $$('.nuw').filter(c => c.checked).map(c => c.value) };
    $('#nugo').disabled = true;
    try { await SB.fn('admin', body); closeModal(); toast('Ο χρήστης δημιουργήθηκε.'); S.authUsers = null; scheduleRender(); }
    catch (e) { $('#nuerr').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; $('#nugo').disabled = false; }
  };
};
function genPass() { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; const a = new Uint32Array(10); crypto.getRandomValues(a); return Array.from(a, x => c[x % c.length]).join(''); }
ACT.userPass = el => {
  const u = el.dataset.u;
  openModal(`${mhead('Νέος κωδικός', uname(u))}
    <div class="f"><label for="upw">Νέος κωδικός (τουλάχιστον 8 χαρακτήρες)</label><input type="text" id="upw" autocomplete="off" value="${genPass()}"></div>
    <div id="uperr"></div><div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="upgo">Αποθήκευση</button></div>`);
  $('#upgo').onclick = async () => {
    try { await SB.fn('admin', { action: 'password', uid: u, password: $('#upw').value }); closeModal(); toast('Ο κωδικός άλλαξε.'); }
    catch (e) { $('#uperr').innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
  };
};
ACT.userBan = async el => {
  const u = el.dataset.u, off = el.dataset.on === '1';
  try { await SB.fn('admin', { action: off ? 'disable' : 'enable', uid: u }); toast(off ? 'Ο χρήστης απενεργοποιήθηκε — δεν μπορεί να συνδεθεί.' : 'Ο χρήστης ενεργοποιήθηκε.'); S.authUsers = null; scheduleRender(); }
  catch (e) { toast(e.message, true); }
};

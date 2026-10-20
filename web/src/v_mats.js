/* ================================================================
   ΥΛΙΚΑ ΚΑΤΑΣΚΕΥΩΝ: επεξεργασία (κατανάλωση), ρετάλια κομμάτι-κομμάτι
   ================================================================ */
const matIds = (withStockOnly) => sortProds(Object.keys(S.prod).filter(p => isMat(p) && !S.prod[p].deleted && (!withStockOnly || prodTotals(p).all > 0 || remsWhere({ p }).length || S.prod[p].active !== false)));
// επιλογές προορισμού: όλες οι αποθήκες/χώροι (ομαδοποιημένες) και, προαιρετικά, οχήματα
function locOptions(cur, { veh = null, vehicles = false } = {}) {
  const all = activeList(S.wh); const n = all.filter(([, w]) => !w.gym), g = all.filter(([, w]) => w.gym);
  const o = ([w, x]) => sections(w).map(sc => opt(`W|${w}|${sc.id}`, (x.gym ? gymName(x.gym) + ' · ' : '') + x.name + (hasSections(w) ? ' / ' + sc.name : ''), cur === `W|${w}|${sc.id}`)).join('');
  return (veh ? opt('V|' + veh, `Στο ${vehName(veh)}`, cur === 'V|' + veh) : '') +
    `<optgroup label="Αποθήκες">${n.map(o).join('')}</optgroup>` + (g.length ? `<optgroup label="Αποθήκες γυμναστηρίων">${g.map(o).join('')}</optgroup>` : '') +
    (vehicles ? `<optgroup label="Οχήματα">${activeList(S.veh).filter(([k]) => k !== veh).map(([k, v]) => opt('V|' + k, v.name, cur === 'V|' + k)).join('')}</optgroup>` : '');
}
const parseLoc = k => { const s = k.split('|'); return s[0] === 'V' ? { t: 'V', veh: s[1] } : { t: 'W', wh: s[1], sec: s[2] }; };

/* ---------------- Επεξεργασία υλικού ---------------- */
VIEWS.proc = a => {
  const f = S.procF = S.procF || { p: '', src: 'W', wh: '', sec: '', veh: '', lot: '', rem: '', qty: 1, purpose: '', out: [] };
  if (a && f._a !== a) { f._a = a; const [t, id] = a.split(':');
    if (t === 'R' && S.rem[id]) { f.p = S.rem[id].p; f.src = 'R'; f.rem = id; f.out = []; }
    if (t === 'P' && S.prod[id]) { f.p = id; f.src = 'W'; f.out = []; } }
  const mats = matIds(true);
  if (!mats.length) return `<div class="wrap">${pageHead('Υλικά κατασκευών', 'Επεξεργασία υλικού')}<div class="panel empty">Δεν υπάρχουν υλικά. Καταχωρίστε ένα προϊόν ως «Υλικό κατασκευής» στον Γενικό πίνακα ή στα <a data-go="mats">Υλικά & ρετάλια</a>.</div></div>`;
  if (!S.prod[f.p] || !isMat(f.p)) f.p = mats.find(p => prodTotals(p).all || remsWhere({ p }).length) || mats[0];
  const p = f.p; const U = unitOf(p);
  // πηγές
  const whs = activeList(S.wh).filter(([w]) => allSections(w).some(s => whAvail(p, w, s.id, 'N') > 0));
  if (f.src === 'W') { if (!whs.some(([w]) => w === f.wh)) f.wh = (whs[0] || [''])[0]; const secs = f.wh ? allSections(f.wh).filter(s => whAvail(p, f.wh, s.id, 'N') > 0) : []; if (!secs.some(s => s.id === f.sec)) f.sec = (secs[0] || {}).id || ''; }
  const vlots = activeList(S.veh).flatMap(([v]) => vehLots(v).filter(l => l.p === p && !l.old).map(l => Object.assign({ veh: v }, l)));
  if (f.src === 'V' && !vlots.some(l => `${l.veh}|${l.pk}|${l.li}` === f.lot)) f.lot = vlots[0] ? `${vlots[0].veh}|${vlots[0].pk}|${vlots[0].li}` : '';
  const rems = remsWhere({ p });
  if (f.src === 'R' && !rems.some(([id]) => id === f.rem)) f.rem = (rems[0] || [''])[0];
  const avail = f.src === 'W' ? (f.wh && f.sec ? whAvail(p, f.wh, f.sec, 'N') : 0) : f.src === 'V' ? ((vlots.find(l => `${l.veh}|${l.pk}|${l.li}` === f.lot) || {}).qty || 0) : (f.rem ? 1 : 0);
  const srcVeh = f.src === 'V' ? f.lot.split('|')[0] : f.src === 'R' && S.rem[f.rem] && S.rem[f.rem].loc.t === 'V' ? S.rem[f.rem].loc.veh : null;
  const defDest = f.src === 'W' ? `W|${f.wh}|${f.sec}` : srcVeh ? 'V|' + srcVeh : (S.rem[f.rem] ? `W|${S.rem[f.rem].loc.wh}|${S.rem[f.rem].loc.sec}` : '');
  f.out.forEach(o => { if (!o.dest) o.dest = defDest; });
  AFTER.push(() => {
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onchange = () => { fn(e.value); render(true); }; };
    on('prp', v => { f.p = v; f.out = []; f.rem = ''; f.lot = ''; });
    on('prwh', v => { f.wh = v; f.sec = ''; }); on('prsec', v => { f.sec = v; }); on('prlot', v => { f.lot = v; });
    const q = $('#prq'); if (q) q.oninput = () => { f.qty = Number(q.value) || 0; };
    const pu = $('#prpur'); if (pu) pu.oninput = () => { f.purpose = pu.value; };
    $$('[data-od]').forEach(i => i.oninput = () => { f.out[i.dataset.od].dims = i.value; });
    $$('[data-ol]').forEach(i => i.onchange = () => { f.out[i.dataset.ol].dest = i.value; });
    $$('[data-on]').forEach(i => i.oninput = () => { f.out[i.dataset.on].note = i.value; });
    fillPhotos($('#main'));
  });
  const x = S.prod[p];
  return `<div class="wrap">${pageHead('Υλικά κατασκευών · κατανάλωση', 'Επεξεργασία υλικού', `<button class="btn" data-go="mats">Υλικά & ρετάλια</button>`)}
    <div class="hint">Το υλικό που επεξεργάζεστε φεύγει από το απόθεμα και καταγράφεται στα «Επεξεργασμένα». Ό,τι περισσέψει καταχωρίζεται ως ρετάλι με τη διάστασή του και μπορεί να ξαναχρησιμοποιηθεί.</div>
    <div class="panel"><div class="row" style="gap:14px;align-items:center">${thumb(p)}<div class="f" style="flex:1;min-width:220px"><label for="prp">Υλικό</label><select id="prp">${(() => { const g = {}; mats.forEach(k => (g[catLabel(k) || 'Χωρίς κατηγορία'] = g[catLabel(k) || 'Χωρίς κατηγορία'] || []).push(k)); return Object.keys(g).sort((a, b) => a.localeCompare(b, 'el')).map(c => `<optgroup label="${esc(c)}">${g[c].map(k => opt(k, `${prodName(k)}${S.prod[k].dims ? ' · ' + S.prod[k].dims : ''}${prodTotals(k).W + prodTotals(k).V ? '' : ' (χωρίς απόθεμα)'}`, k === p)).join('')}</optgroup>`).join(''); })()}</select></div></div>
      <div class="small muted" style="margin-top:6px">${x.dims ? 'Ολόκληρο: ' + esc(x.dims) + ' · ' : ''}Σε αποθήκες: <b>${fmtN(prodTotals(p).W)}</b> ${esc(U)} · σε οχήματα: <b>${fmtN(prodTotals(p).V)}</b> · ρετάλια: <b>${rems.length}</b></div></div>
    <div class="panel"><span class="lbl">Τι επεξεργάζεστε</span>
      <div class="chips" style="margin:6px 0 12px"><button class="chip ${f.src === 'W' ? 'on' : ''}" data-act="procSrc" data-v="W">Ολόκληρο από αποθήκη</button><button class="chip ${f.src === 'V' ? 'on' : ''}" data-act="procSrc" data-v="V">Ολόκληρο από αμάξι</button><button class="chip ${f.src === 'R' ? 'on' : ''}" data-act="procSrc" data-v="R">Ρετάλι (${rems.length})</button></div>
      ${f.src === 'W' ? (whs.length ? `<div class="fields"><div class="f"><label for="prwh">Αποθήκη</label><select id="prwh">${whOpts(f.wh, { filter: w => whs.some(([k]) => k === w) })}</select></div>
          ${hasSections(f.wh) ? `<div class="f"><label for="prsec">Χώρος</label><select id="prsec">${allSections(f.wh).filter(s => whAvail(p, f.wh, s.id, 'N') > 0).map(s => opt(s.id, `${s.name} (${fmtN(whAvail(p, f.wh, s.id, 'N'))})`, s.id === f.sec)).join('')}</select></div>` : ''}
          <div class="f"><label for="prq">Ποσότητα (${esc(U)}) · διαθέσιμα ${fmtN(avail)}</label><input type="number" id="prq" min="0" step="any" value="${f.qty || ''}"></div></div>` : `<div class="empty">Δεν υπάρχει ολόκληρο υλικό σε αποθήκη.</div>`) : ''}
      ${f.src === 'V' ? (vlots.length ? `<div class="fields"><div class="f" style="grid-column:span 2"><label for="prlot">Από αμάξι / λίστα παραλαβής</label><select id="prlot">${vlots.map(l => opt(`${l.veh}|${l.pk}|${l.li}`, `${vehName(l.veh)} · ${pkLabel(l.pk)} · ${fmtN(l.qty)} ${U}`, `${l.veh}|${l.pk}|${l.li}` === f.lot)).join('')}</select></div>
          <div class="f"><label for="prq">Ποσότητα (${esc(U)}) · διαθέσιμα ${fmtN(avail)}</label><input type="number" id="prq" min="0" step="any" value="${f.qty || ''}"></div></div>` : `<div class="empty">Δεν υπάρχει αυτό το υλικό σε κανένα αμάξι.</div>`) : ''}
      ${f.src === 'R' ? (rems.length ? `<div class="remlist">${rems.map(([id, r]) => `<label class="remopt ${f.rem === id ? 'on' : ''}"><input type="radio" name="prrem" data-act="procRem" data-v="${id}" ${f.rem === id ? 'checked' : ''}><b class="mono">${esc(r.dims)}</b><span class="small muted">${esc(remLoc(r))} · ${esc(fmtD(r.ts))}</span></label>`).join('')}</div>` : `<div class="empty">Δεν υπάρχουν ρετάλια από αυτό το υλικό.</div>`) : ''}
    </div>
    <div class="panel"><div class="f"><label for="prpur">Για τι χρησιμοποιήθηκε</label><input type="text" id="prpur" value="${esc(f.purpose)}" placeholder="π.χ. βάσεις για ράφια, καπάκια για Γλυφάδα"></div></div>
    <div class="panel"><div class="row" style="margin-bottom:8px"><h2 style="flex:1">Ρετάλια που έμειναν</h2><button class="btn sm" data-act="procAddOut">+ Ρετάλι</button></div>
      ${f.out.length ? f.out.map((o, i) => `<div class="outrow"><div class="f"><label for="pod${i}">Διάσταση ρεταλιού ${i + 1}</label><input type="text" id="pod${i}" data-od="${i}" value="${esc(o.dims || '')}" placeholder="π.χ. 1000×650"></div>
        <div class="f"><label for="pol${i}">Πού μπαίνει</label><select id="pol${i}" data-ol="${i}">${locOptions(o.dest, { veh: srcVeh })}</select></div>
        <div class="f"><label for="pon${i}">Σημείωση (προαιρετικά)</label><input type="text" id="pon${i}" data-on="${i}" value="${esc(o.note || '')}"></div>
        <button class="btn sm ghost" data-act="procDelOut" data-i="${i}" aria-label="Αφαίρεση">✕</button></div>`).join('') : '<div class="muted small">Δεν έμεινε ρετάλι. Αν περίσσεψε κομμάτι που κρατάτε, πατήστε «+ Ρετάλι» και γράψτε τη διάστασή του.</div>'}
    </div>
    <div class="cartbar wrapbar"><div class="sum">${f.src === 'R' ? (f.rem ? `Ρετάλι <b>${esc(S.rem[f.rem].dims)}</b>` : 'Επιλέξτε ρετάλι') : `<b>${fmtN(f.qty || 0)}</b> ${esc(U)}`} · ${f.out.length ? f.out.length + ' ρετάλι(α) μένουν' : 'χωρίς ρετάλι'}</div>
      ${can('move') ? `<button class="btn pri" data-act="procGo" ${avail ? '' : 'disabled'}>Καταχώριση επεξεργασίας</button>` : ''}</div>
  </div>`;
};
ACT.procSrc = el => { S.procF.src = el.dataset.v; S.procF.out.forEach(o => o.dest = ''); render(true); };
ACT.procRem = el => { S.procF.rem = el.dataset.v; S.procF.out.forEach(o => o.dest = ''); render(true); };
ACT.procAddOut = () => { S.procF.out.push({ dims: '', dest: '' }); render(true); setTimeout(() => { const i = $('#pod' + (S.procF.out.length - 1)); if (i) i.focus(); }, 30); };
ACT.procDelOut = el => { S.procF.out.splice(Number(el.dataset.i), 1); render(true); };
ACT.procGo = () => {
  const f = S.procF;
  let src; if (f.src === 'W') src = { t: 'W', wh: f.wh, sec: f.sec }; else if (f.src === 'V') { const [veh, pk, li] = f.lot.split('|'); src = { t: 'V', veh, pk, li: pk === 'ADJ' ? li : Number(li) }; } else src = { t: 'R', rem: f.rem };
  if (f.out.some(o => !String(o.dims || '').trim())) return toast('Συμπληρώστε τη διάσταση κάθε ρεταλιού ή αφαιρέστε τη γραμμή.', true);
  const op = { type: 'PROCESS', id: uid(), src, p: f.p, qty: f.src === 'R' ? 1 : f.qty, purpose: f.purpose, out: f.out.map(o => ({ dims: o.dims, note: o.note || '', loc: parseLoc(o.dest) })) };
  confirmOp(op, { title: 'Επεξεργασία υλικού', intro: `<div class="small">${f.purpose ? 'Για: <b>' + esc(f.purpose) + '</b> · ' : ''}Το υλικό φεύγει από το απόθεμα.${f.out.length ? ' Δημιουργούνται ' + f.out.length + ' ρετάλι(α).' : ''}</div>`,
    onDone: () => { S.procF = Object.assign(S.procF, { out: [], purpose: '', qty: 1, rem: '', _a: S.procF._a }); render(true); } });
};

/* ---------------- Ενέργειες ρεταλιών ---------------- */
function remMoveModal(ids) {
  const rs = ids.map(id => S.rem[id]).filter(Boolean); if (!rs.length) return;
  const r0 = rs[0]; let dest = r0.loc.t === 'V' ? `W|${(S.pk[r0.loc.pk] && S.pk[r0.loc.pk].wh) || defaultWh()}|${sections((S.pk[r0.loc.pk] && S.pk[r0.loc.pk].wh) || defaultWh())[0].id}` : '';
  openModal(`${mhead('Μεταφορά ρεταλιών', rs.map(r => r.dims).join(', '))}
    <div class="f"><label for="rmd">Προς</label><select id="rmd">${locOptions(dest, { vehicles: true })}</select></div>
    <div class="hint">Μπορείτε να τα πάτε σε άλλη αποθήκη ή χώρο, να τα φορτώσετε σε αμάξι ή να τα επιστρέψετε από αμάξι σε αποθήκη.</div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn pri" id="rmgo">Συνέχεια</button></div>`);
  $('#rmgo').onclick = () => { const to = parseLoc($('#rmd').value); closeModal(); confirmOp({ type: 'REM_MOVE', id: uid(), rems: ids, to }, { title: 'Μεταφορά ρεταλιών' }); };
}
ACT.remMove = el => remMoveModal(el.dataset.ids ? el.dataset.ids.split(',') : [el.dataset.id]);
ACT.remRetire = el => { const ids = el.dataset.ids ? el.dataset.ids.split(',') : [el.dataset.id];
  openModal(`${mhead('Απόσυρση ρεταλιών', ids.map(i => S.rem[i] && S.rem[i].dims).join(', '))}<div class="f"><label for="rrn">Αιτία</label><input type="text" id="rrn" placeholder="π.χ. πολύ μικρό, σκουριά"></div>
    <div class="btns" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Ακύρωση</button><button class="btn danger" id="rrgo">Συνέχεια</button></div>`);
  $('#rrgo').onclick = () => { const note = $('#rrn').value; closeModal(); confirmOp({ type: 'REM_RETIRE', id: uid(), rems: ids, note }, { title: 'Απόσυρση ρεταλιών' }); }; };
ACT.remUse = el => { S.procF = null; go('proc', 'R:' + el.dataset.id); };
function remRows(list, { showMat = true, actions = true, checks = false } = {}) {
  if (!list.length) return '<div class="empty">Κανένα ρετάλι.</div>';
  return `<div class="tw"><table><thead><tr>${checks ? '<th></th>' : ''}${showMat ? '<th>Υλικό</th>' : ''}<th>Διάσταση</th><th>Πού βρίσκεται</th><th>Από</th><th>Ημερομηνία</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(([id, r]) => { const m = S.movById[r.mov]; return `<tr>${checks ? `<td><input type="checkbox" data-remck="${id}" aria-label="Επιλογή"></td>` : ''}${showMat ? `<td><b>${esc(prodName(r.p))}</b><div class="mono small muted">${esc(prodCode(r.p))}</div></td>` : ''}
      <td><b class="mono">${esc(r.dims)}</b>${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td><td class="small">${esc(remLoc(r))}</td><td class="small">${m ? `<span class="docno">${esc(m.docNo)}</span>` : ''}${r.parent && S.rem[r.parent] ? `<div class="muted">από ρετάλι ${esc(S.rem[r.parent].dims)}</div>` : ''}</td><td class="small" style="white-space:nowrap">${esc(fmtD(r.ts))}</td>
      ${actions ? `<td><div class="btns" style="flex-wrap:nowrap">${can('move') ? `<button class="btn sm pri" data-act="remUse" data-id="${id}">Χρήση</button><button class="btn sm" data-act="remMove" data-id="${id}">Μεταφορά</button>` : ''}${can('retire') ? `<button class="btn sm ghost" data-act="remRetire" data-id="${id}">Απόσυρση</button>` : ''}</div></td>` : ''}</tr>`; }).join('')}
  </tbody></table></div>`;
}

/* ---------------- Υλικά & ρετάλια ---------------- */
VIEWS.mats = () => {
  const f = S.matsF = S.matsF || { tab: 'mat', q: '', wh: '', per: '3m' };
  const allM = matIds(false);
  const ids = allM.filter(p => { const x = S.prod[p]; if (f.cat && x.cat !== f.cat) return false; if (f.sub && x.sub !== f.sub) return false; if (f.ptype && x.ptype !== f.ptype) return false;
    if (!f.q) return true; return norm([x.code, x.name, x.dims, x.desc].join(' ')).includes(norm(f.q)); })
    .sort((a, b) => catLabel(a).localeCompare(catLabel(b), 'el') || prodName(a).localeCompare(prodName(b), 'el', { numeric: true }));
  const filtered = !!(f.q || f.cat || f.sub || f.ptype);
  // φίλτρα Είδος → Κατηγορία → Τύπος, μόνο όσα έχουν υλικά
  const cnt = (k, v) => allM.filter(p => S.prod[p][k] === v).length;
  const cats = [...new Set(allM.map(p => S.prod[p].cat))].filter(c => S.cat[c]).sort((a, b) => catName(a).localeCompare(catName(b), 'el'));
  if (f.cat && !cats.includes(f.cat)) { f.cat = ''; f.sub = ''; f.ptype = ''; }
  const subs = f.cat ? [...new Set(allM.filter(p => S.prod[p].cat === f.cat).map(p => S.prod[p].sub).filter(Boolean))] : [];
  const types = f.sub ? [...new Set(allM.filter(p => S.prod[p].cat === f.cat && S.prod[p].sub === f.sub).map(p => S.prod[p].ptype).filter(Boolean))] : [];
  const chips = (cats.length ? `<div class="chips"><button class="chip ${!f.cat ? 'on' : ''}" data-act="mtCat" data-v="">Όλα τα είδη</button>${cats.map(c => `<button class="chip ${f.cat === c ? 'on' : ''}" data-act="mtCat" data-v="${c}">${esc(catName(c))} <span class="n">${cnt('cat', c)}</span></button>`).join('')}</div>` : '')
    + (subs.length ? `<div class="chips"><button class="chip ${!f.sub ? 'on' : ''}" data-act="mtSub" data-v="">Όλες οι κατηγορίες</button>${subs.map(s => `<button class="chip ${f.sub === s ? 'on' : ''}" data-act="mtSub" data-v="${s}">${esc(subName(f.cat, s))} <span class="n">${allM.filter(p => S.prod[p].cat === f.cat && S.prod[p].sub === s).length}</span></button>`).join('')}</div>` : '')
    + (types.length ? `<div class="chips"><button class="chip ${!f.ptype ? 'on' : ''}" data-act="mtType" data-v="">Όλοι οι τύποι</button>${types.map(t => `<button class="chip ${f.ptype === t ? 'on' : ''}" data-act="mtType" data-v="${t}">${esc(typeName(f.cat, f.sub, t))}</button>`).join('')}</div>` : '');
  let lastCat = null;
  const catHead = p => { const l = catLabel(p) || 'Χωρίς κατηγορία'; if (l === lastCat) return ''; lastCat = l; return `<h3 class="mn-g" style="margin:14px 2px 6px">${esc(l)}</h3>`; };
  AFTER.push(() => {
    const q = $('#mtq'); if (q) q.oninput = () => { f.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const pos = q.selectionStart; render(true); const z = $('#mtq'); z.focus(); z.setSelectionRange(pos, pos); }, 250); };
    const w = $('#mtwh'); if (w) w.onchange = () => { f.wh = w.value; render(true); };
    const upd = () => { const sel = $$('[data-remck]:checked').map(c => c.dataset.remck); const b = $('#rembulk'); if (b) { b.hidden = !sel.length; b.querySelectorAll('button').forEach(x => x.dataset.ids = sel.join(',')); const n = $('#rembn'); if (n) n.textContent = sel.length; } };
    $$('[data-remck]').forEach(c => c.onchange = upd);
    fillPhotos($('#main'));
  });
  let body = '';
  if (f.tab === 'mat') body = ids.length ? ids.map(p => { const gh = catHead(p); const x = S.prod[p]; const t = prodTotals(p); const rs = remsWhere({ p });
      const byWh = activeList(S.wh).map(([w, wx]) => [wx.name, whQty(p, w)]).filter(([, n]) => n);
      return gh + `<div class="panel matcard"><div class="row" style="gap:12px;align-items:flex-start">${thumb(p)}<div style="flex:1;min-width:0"><a data-go="prod" data-a="${p}"><b>${esc(x.name)}</b></a> <span class="mono small muted">${esc(x.code)}</span>${x.active === false ? ' <span class="tag g">Ανενεργό</span>' : ''}
          ${x.dims ? `<div class="small muted">Ολόκληρο: ${esc(x.dims)}</div>` : ''}
          <div class="small" style="margin-top:4px">Ολόκληρα: <b>${fmtN(t.W + t.V)}</b> ${esc(x.unit)}${byWh.length ? ' <span class="muted">(' + byWh.map(([n, q]) => esc(n) + ' ' + fmtN(q)).join(' · ') + (t.V ? ' · οχήματα ' + fmtN(t.V) : '') + ')</span>' : ''} · Ρετάλια: <b>${rs.length}</b></div></div>
        <div class="btns">${can('move') ? `<button class="btn sm pri" data-act="matProc" data-p="${p}">Επεξεργασία</button>` : ''}${can('move') ? `<button class="btn sm" data-act="distrib" data-p="${p}">+ Ποσότητες</button>` : ''}</div></div>
        ${rs.length ? `<details style="margin-top:8px" ${rs.length <= 6 ? 'open' : ''}><summary class="small">Ρετάλια (${rs.length})</summary>${remRows(rs, { showMat: false })}</details>` : ''}</div>`; }).join('')
    : `<div class="panel empty">Δεν υπάρχουν υλικά. ${can('product_create') ? 'Πατήστε «+ Νέο υλικό».' : ''}</div>`;
  if (f.tab === 'rem') { const rs = remsWhere(f.wh ? (f.wh.startsWith('V|') ? { veh: f.wh.slice(2) } : { wh: f.wh }) : {}).filter(([, r]) => ids.includes(r.p)).sort((a, b) => ids.indexOf(a[1].p) - ids.indexOf(b[1].p));
    body = `<div class="panel"><div class="row" style="gap:10px;margin-bottom:10px"><div class="f" style="min-width:220px"><label for="mtwh">Θέση</label><select id="mtwh">${opt('', 'Όλες', !f.wh)}${whOpts(f.wh)}<optgroup label="Οχήματα">${activeList(S.veh).map(([k, v]) => opt('V|' + k, v.name, f.wh === 'V|' + k)).join('')}</optgroup></select></div>
      <div id="rembulk" hidden class="btns" style="align-self:flex-end"><span class="small">Επιλεγμένα: <b id="rembn">0</b></span>${can('move') ? '<button class="btn sm" data-act="remMove">Μεταφορά</button>' : ''}${can('retire') ? '<button class="btn sm ghost" data-act="remRetire">Απόσυρση</button>' : ''}</div></div>
      ${remRows(rs, { checks: true })}</div>`; }
  if (f.tab === 'done') { const from = { '1m': 30, '3m': 92, '12m': 366, all: 1e5 }[f.per] || 92; const since = Date.now() - from * 864e5;
    const ms = S.mov.filter(m => m.type === 'PROCESS' && m.state !== 'pending' && m.ts >= since && (!filtered || ids.includes(m.lines[0].p)));
    const sum = {}; ms.forEach(m => { const l = m.lines[0]; const k = l.p; const o = sum[k] = sum[k] || { full: 0, rem: 0, out: 0, n: 0 }; o.n++; if (l.src === 'rem') o.rem++; else o.full += l.qty; o.out += (l.out || []).length; });
    body = `<div class="chips" style="margin-bottom:10px">${[['1m', 'Μήνας'], ['3m', '3 μήνες'], ['12m', '12 μήνες'], ['all', 'Όλα']].map(([k, l]) => `<button class="chip ${f.per === k ? 'on' : ''}" data-act="matsPer" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="panel"><h2>Κατανάλωση ανά υλικό</h2>${Object.keys(sum).length ? `<div class="tw"><table><thead><tr><th>Υλικό</th><th class="r">Ολόκληρα</th><th class="r">Ρετάλια που χρησιμοποιήθηκαν</th><th class="r">Νέα ρετάλια</th><th class="r">Επεξεργασίες</th></tr></thead><tbody>
        ${Object.entries(sum).sort((a, b) => b[1].full - a[1].full).map(([p, o]) => `<tr class="click" data-go="prod" data-a="${p}"><td><b>${esc(prodName(p))}</b></td><td class="r"><b>${qtyU(o.full, p)}</b></td><td class="r">${fmtN(o.rem)}</td><td class="r">${fmtN(o.out)}</td><td class="r">${fmtN(o.n)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Καμία επεξεργασία στο διάστημα.</div>'}</div>
      <div class="panel"><h2>Επεξεργασμένα (αναλυτικά)</h2>${ms.length ? `<div class="tw"><table><thead><tr><th>Ημερομηνία</th><th>Παραστατικό</th><th>Υλικό</th><th>Τι επεξεργάστηκε</th><th>Για τι</th><th>Ρετάλια που έμειναν</th><th>Χρήστης</th></tr></thead><tbody>
        ${ms.map(m => { const l = m.lines[0]; return `<tr class="click" data-go="mov" data-a="${m.id}"><td style="white-space:nowrap">${esc(fmtD(m.ts))}</td><td><span class="docno">${esc(m.docNo)}</span></td><td><b>${esc(prodName(l.p))}</b></td>
          <td class="small">${l.src === 'rem' ? 'Ρετάλι ' + esc(l.dims) : qtyU(l.qty, l.p) + ' ολόκληρα'}<div class="muted">${esc(locName(m.from))}</div></td><td class="small">${esc(m.purpose || '')}</td>
          <td class="small">${(l.out || []).map(o => `<span class="mono">${esc(o.dims)}</span> → ${esc(remLocText(o.loc))}`).join('<br>') || '—'}</td><td class="small">${esc(uname(m.by))}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Καμία επεξεργασία στο διάστημα.</div>'}</div>`; }
  const nRem = remsWhere().length;
  return `<div class="wrap">${pageHead('Λαμαρίνες, προφίλ, σωλήνες…', 'Υλικά & ρετάλια', `${can('move') ? '<button class="btn pri" data-act="matProc">Επεξεργασία</button>' : ''}${can('product_create') ? '<button class="btn" data-act="newMat">+ Νέο υλικό</button>' : ''}`)}
    <div class="tabs"><button class="${f.tab === 'mat' ? 'on' : ''}" data-act="matsTab" data-v="mat">Υλικά (${matIds(false).length})</button><button class="${f.tab === 'rem' ? 'on' : ''}" data-act="matsTab" data-v="rem">Ρετάλια (${nRem})</button><button class="${f.tab === 'done' ? 'on' : ''}" data-act="matsTab" data-v="done">Επεξεργασμένα</button></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:10px">${chips}<input type="search" id="mtq" value="${esc(f.q)}" placeholder="Αναζήτηση υλικού (όνομα, κωδικός, διάσταση)" aria-label="Αναζήτηση"></div>
    ${body}</div>`;
};
ACT.matsTab = el => { S.matsF.tab = el.dataset.v; render(true); };
ACT.mtCat = el => { Object.assign(S.matsF, { cat: el.dataset.v, sub: '', ptype: '' }); render(true); };
ACT.mtSub = el => { Object.assign(S.matsF, { sub: el.dataset.v, ptype: '' }); render(true); };
ACT.mtType = el => { S.matsF.ptype = el.dataset.v; render(true); };
ACT.matsPer = el => { S.matsF.per = el.dataset.v; render(true); };
ACT.matProc = el => { S.procF = null; go('proc', el.dataset.p ? 'P:' + el.dataset.p : null); };
ACT.newMat = () => openProdEditor(null, () => render(true));

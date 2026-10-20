/* ================================================================
   ΑΝΤΙΚΑΤΑΣΤΑΣΕΙΣ — σύνοψη, γραφήματα και αναλυτική λίστα
   (καθαρά HTML/SVG, χωρίς εξωτερικές βιβλιοθήκες)
   ================================================================ */
// τι έγιναν τα παλιά: σταθερή σειρά & χρώματα (ελεγμένα για αχρωματοψία, light/dark)
const FATE = [['u', 'Μεταχειρισμένα', 'f-u'], ['c', 'Προς έλεγχο', 'f-c'], ['x', 'Πετάχτηκαν', 'f-x'], ['d', 'Κατεστραμμένα', 'f-d']];
const MONTHS_EL = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const ymKey = ts => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); };
const ymLabel = k => `${MONTHS_EL[k % 12]} ${String(Math.floor(k / 12)).slice(2)}`;

function replRange(f) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  if (f.per === 'month') return [new Date(y, m, 1).getTime(), null];
  if (f.per === '3m') return [new Date(y, m - 2, 1).getTime(), null];
  if (f.per === '12m') return [new Date(y, m - 11, 1).getTime(), null];
  if (f.per === 'year') return [new Date(y, 0, 1).getTime(), null];
  if (f.per === 'custom') return [f.from ? new Date(f.from + 'T00:00').getTime() : null, f.to ? new Date(f.to + 'T23:59:59').getTime() : null];
  return [null, null];
}

// οριζόντιες μπάρες (μία σειρά): [{label, v, sub?, act?}]
function hbars(items, unit, { max = 10, act } = {}) {
  if (!items.length) return '<div class="empty">Καμία αντικατάσταση.</div>';
  const top = items.slice(0, max); const mx = Math.max(...top.map(i => i.v)) || 1;
  return `<div class="hb">${top.map(i => `<div class="hb-r ${act ? 'click' : ''}" ${act ? `data-act="${act}" data-v="${esc(i.key)}"` : ''} data-tip="${esc(i.label)}: ${fmtN(i.v)} ${esc(unit)}${i.sub ? ' · ' + esc(i.sub) : ''}">
      <div class="hb-l">${esc(i.label)}${i.sub ? `<span class="muted small"> · ${esc(i.sub)}</span>` : ''}</div>
      <div class="hb-t"><div class="hb-b" style="width:${Math.max(2, i.v / mx * 100)}%"></div></div><div class="hb-v num">${fmtN(i.v)}</div></div>`).join('')}
    ${items.length > max ? `<div class="muted small">+ ${items.length - max} ακόμη</div>` : ''}</div>`;
}
// κάθετες μπάρες ανά μήνα (μία σειρά), SVG
function monthBars(series, unit) {
  if (!series.length) return '<div class="empty">Καμία αντικατάσταση.</div>';
  const narrow = innerWidth < 600; const W = narrow ? 330 : 640, H = narrow ? 190 : 200, padL = 30, padB = 26, padT = 10; const n = series.length;
  const mx = Math.max(...series.map(s => s.v)) || 1; const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(mx))); return Math.ceil(mx / p) * p; })();
  const bw = Math.min(36, (W - padL) / n - 4); const step = (W - padL) / n; const y = v => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const every = Math.max(1, Math.ceil(n / (narrow ? 4 : 8)));
  return `<svg class="mb" viewBox="0 0 ${W} ${H}" role="img" aria-label="Αντικαταστάσεις ανά μήνα">
    ${ticks.map(t => `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${fmtN(t)}</text>`).join('')}
    ${series.map((s, i) => { const x = padL + i * step + (step - bw) / 2; const top = y(s.v), h = Math.max(0, H - padB - top); const r = Math.min(4, h, bw / 2);
      return `<g data-tip="${esc(ymLabel(s.k))}: ${fmtN(s.v)} ${esc(unit)}${s.n ? ' · ' + s.n + (s.n === 1 ? ' φορά' : ' φορές') : ''}"><rect x="${padL + i * step}" y="${padT}" width="${step}" height="${H - padT - padB}" fill="transparent"/>
        ${s.v ? `<path class="bar" d="M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z"/>` : ''}
        ${(i % every === 0 && i < n - Math.ceil(every / 2)) || i === n - 1 ? `<text x="${i === n - 1 ? x + bw : x + bw / 2}" y="${H - 8}" class="ax" text-anchor="${i === n - 1 ? 'end' : 'middle'}">${esc(ymLabel(s.k))}</text>` : ''}</g>`; }).join('')}
    <line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" class="base"/></svg>`;
}
// τι έγιναν τα παλιά: μία οριζόντια στοίβα 100% + υπόμνημα με αριθμούς
function fateBar(tot, unit) {
  const all = FATE.reduce((s, [k]) => s + (tot[k] || 0), 0);
  if (!all) return '<div class="empty">Καμία αντικατάσταση.</div>';
  return `<div class="fb">${FATE.filter(([k]) => tot[k]).map(([k, l, c]) => `<div class="fb-s ${c}" style="flex:${tot[k]}" data-tip="${esc(l)}: ${fmtN(tot[k])} ${esc(unit)} (${Math.round(tot[k] / all * 100)}%)"></div>`).join('')}</div>
    <div class="fl">${FATE.map(([k, l, c]) => `<div class="fl-i"><span class="sw ${c}"></span><span>${esc(l)}</span><b class="num">${fmtN(tot[k] || 0)}</b><span class="muted small">${all ? Math.round((tot[k] || 0) / all * 100) : 0}%</span></div>`).join('')}</div>`;
}

VIEWS.repls = a => {
  const f = S.replF = S.replF || { per: '12m', gym: '', cat: '', unit: '', from: '', to: '' };
  if (a && f._a !== a) { f._a = a; f.gym = S.gym[a] ? a : ''; } // παράμετρος διαδρομής: εφαρμόζεται μία φορά
  const [from, to] = replRange(f);
  const all = replacementRows({ gym: f.gym, from, to }).filter(r => S.prod[r.p] && (!f.cat || S.prod[r.p].cat === f.cat));
  // μονάδες: τα γραφήματα αθροίζουν μόνο μία μονάδα κάθε φορά
  const units = {}; all.forEach(r => units[unitOf(r.p)] = (units[unitOf(r.p)] || 0) + r.qty);
  const ulist = Object.keys(units).sort((a, b) => units[b] - units[a]);
  if (!ulist.includes(f.unit)) f.unit = ulist[0] || '';
  const rows = all.filter(r => unitOf(r.p) === f.unit); const U = f.unit || 'τεμ';
  const sum = rows.reduce((s, r) => s + r.qty, 0);
  const events = new Set(all.map(r => r.pl)).size;
  const byGym = {}, byProd = {}, byMonth = {}, byReason = {}, fate = { x: 0, u: 0, c: 0, d: 0 };
  rows.forEach(r => {
    byGym[r.gym] = (byGym[r.gym] || 0) + r.qty; byProd[r.p] = (byProd[r.p] || 0) + r.qty;
    const k = ymKey(r.ts); const m = byMonth[k] = byMonth[k] || { v: 0, pls: new Set() }; m.v += r.qty; m.pls.add(r.pl);
    FATE.forEach(([q]) => fate[q] += r[q] || 0);
    const reason = (r.reason || '').trim(); if (reason) { const rk = norm(reason); const o = byReason[rk] = byReason[rk] || { label: reason, v: 0 }; o.v += r.qty; }
  });
  // συνεχής σειρά μηνών (και οι μήνες χωρίς αντικαταστάσεις)
  const ks = Object.keys(byMonth).map(Number); let series = [];
  if (ks.length || from) {
    const k0 = from ? ymKey(from) : Math.min(...ks); const k1 = to ? ymKey(to) : ymKey(Date.now());
    for (let k = Math.max(k0, k1 - 35); k <= k1; k++) series.push({ k, v: byMonth[k] ? byMonth[k].v : 0, n: byMonth[k] ? byMonth[k].pls.size : 0 });
  }
  const gymItems = Object.entries(byGym).sort((a, b) => b[1] - a[1]).map(([g, v]) => ({ key: g, label: gymName(g), v }));
  const prodItems = Object.entries(byProd).sort((a, b) => b[1] - a[1]).map(([p, v]) => ({ key: p, label: prodName(p), sub: prodCode(p), v }));
  const reasonItems = Object.values(byReason).sort((a, b) => b.v - a.v).map(o => ({ key: o.label, label: o.label, v: o.v }));
  const perLabel = { month: 'Αυτός ο μήνας', '3m': '3 μήνες', '12m': '12 μήνες', year: 'Φέτος', all: 'Όλα', custom: 'Από–έως' };
  const list = all.slice().sort((a, b) => b.ts - a.ts);
  AFTER.push(() => {
    const on = (id, k) => { const e = $('#' + id); if (e) e.onchange = () => { f[k] = e.value; render(true); }; };
    on('rpgym', 'gym'); on('rpcat', 'cat'); on('rpunit', 'unit'); on('rpfrom', 'from'); on('rpto', 'to');
    bindTips($('#main'));
  });
  return `<div class="wrap">${pageHead(f.gym ? esc(gymName(f.gym)) : 'Όλα τα γυμναστήρια', 'Αντικαταστάσεις', `<button class="btn" data-act="replExport">Αναφορά Excel / PDF</button>`)}
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      <div class="chips">${Object.entries(perLabel).map(([k, l]) => `<button class="chip ${f.per === k ? 'on' : ''}" data-act="replPer" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="fields">
        ${f.per === 'custom' ? `<div class="f"><label for="rpfrom">Από</label><input type="date" id="rpfrom" value="${esc(f.from)}"></div><div class="f"><label for="rpto">Έως</label><input type="date" id="rpto" value="${esc(f.to)}"></div>` : ''}
        <div class="f"><label for="rpgym">Γυμναστήριο</label><select id="rpgym">${opt('', 'Όλα τα γυμναστήρια', !f.gym)}${activeList(S.gym).map(([k, g]) => opt(k, g.name, k === f.gym)).join('')}</select></div>
        <div class="f"><label for="rpcat">Είδος</label><select id="rpcat">${opt('', 'Όλα τα είδη', !f.cat)}${activeList(S.cat).map(([k, c]) => opt(k, c.name, k === f.cat)).join('')}</select></div>
        ${ulist.length > 1 ? `<div class="f"><label for="rpunit">Μονάδα γραφημάτων</label><select id="rpunit">${ulist.map(u => opt(u, u, u === f.unit)).join('')}</select></div>` : ''}
      </div></div>
    <div class="kpis">
      <div class="kpi"><span class="l">Αντικαταστάθηκαν</span><span class="v">${fmtN(sum)}</span><span class="u">${esc(U)}${ulist.length > 1 ? ' · υπάρχουν και άλλες μονάδες' : ''}</span></div>
      <div class="kpi"><span class="l">Φορές</span><span class="v">${fmtN(events)}</span><span class="u">λίστες τοποθέτησης με αντικατάσταση</span></div>
      <div class="kpi"><span class="l">Γυμναστήρια</span><span class="v">${fmtN(gymItems.length)}</span><span class="u">με αντικαταστάσεις</span></div>
      <div class="kpi"><span class="l">Συχνότερο</span><span class="v" style="font-size:1rem;line-height:1.25">${prodItems[0] ? esc(prodItems[0].label) : '—'}</span><span class="u">${prodItems[0] ? fmtN(prodItems[0].v) + ' ' + esc(U) : ''}</span></div>
    </div>
    ${!all.length ? `<div class="panel empty">Καμία αντικατάσταση για αυτά τα φίλτρα.</div>` : `
    <div class="panel"><h2>Ανά μήνα <span class="muted small">(${esc(U)})</span></h2>${monthBars(series, U)}</div>
    <div class="grid2">
      <div class="panel"><h2>Ανά γυμναστήριο <span class="muted small">(${esc(U)})</span></h2>${hbars(gymItems, U, { act: f.gym ? '' : 'replGym' })}${f.gym ? '' : '<div class="muted small" style="margin-top:6px">Πατήστε ένα γυμναστήριο για να δείτε μόνο αυτό.</div>'}</div>
      <div class="panel"><h2>Ποια προϊόντα <span class="muted small">(${esc(U)})</span></h2>${hbars(prodItems, U, { act: 'replProd' })}</div>
    </div>
    <div class="grid2">
      <div class="panel"><h2>Τι έγιναν τα παλιά</h2>${fateBar(fate, U)}</div>
      <div class="panel"><h2>Προβλήματα παλιών</h2>${reasonItems.length ? hbars(reasonItems, U, { max: 8 }) : '<div class="empty">Δεν έχουν καταγραφεί προβλήματα.</div>'}</div>
    </div>
    <div class="panel"><h2>Αναλυτικά <span class="muted small">(${list.length})</span></h2><div class="tw"><table><thead><tr><th>Ημερομηνία</th><th>Λίστα</th><th>Γυμναστήριο</th><th></th><th>Προϊόν</th><th class="r">Ποσότητα</th><th>Τι έγιναν τα παλιά</th><th>Πρόβλημα</th></tr></thead><tbody>
      ${list.slice(0, 300).map(r => { const pl = S.pl[r.pl]; const pll = pl && pl.lines.find(l => l.p === r.p && (l.purpose || pl.purpose) === 'repl'); const od = pll && (pll.oldDest || pl.oldDest);
        return `<tr class="click" data-go="pl" data-a="${r.pl}"><td style="white-space:nowrap">${esc(fmtD(r.ts))}</td><td><span class="docno">${esc(pl ? pl.docNo : '')}</span></td><td>${esc(gymName(r.gym))}</td><td style="width:48px">${thumb(r.p)}</td>
          <td><b>${esc(prodName(r.p))}</b><div class="mono small muted">${esc(prodCode(r.p))}</div></td><td class="r"><b>${qtyU(r.qty, r.p)}</b></td>
          <td class="small">${esc(oldText(r)) || '—'}${(r.u || r.c || r.d) && od ? `<div class="muted">→ ${esc(destText(od, pl.veh))}</div>` : ''}</td><td class="small">${esc(r.reason || '')}</td></tr>`; }).join('')}
      </tbody></table></div></div>`}
  </div>`;
};
ACT.replPer = el => { S.replF.per = el.dataset.v; render(true); };
ACT.replGym = el => { S.replF.gym = el.dataset.v; render(true); window.scrollTo(0, 0); };
ACT.replProd = el => go('prod', el.dataset.v);
ACT.replExport = () => {
  const f = S.replF; const [from, to] = replRange(f); const d = t => { if (!t) return ''; const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  S.repF = { k: 'repl', cat: f.cat, sub: '', wh: '', veh: '', gym: f.gym, from: d(from), to: d(to), type: '', group: 'month' }; go('reports');
};

/* ---------- tooltip για γραφήματα (ποντίκι & άγγιγμα) ---------- */
function bindTips(root) {
  if (!root) return; let tip = $('#ctip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'ctip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  const show = (el, x, y) => { tip.textContent = el.getAttribute('data-tip'); tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px'; tip.style.top = Math.max(8, y - h - 12) + 'px'; };
  const hide = () => { tip.style.display = 'none'; };
  root.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('pointermove', e => show(el, e.clientX, e.clientY));
    el.addEventListener('pointerleave', hide);
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') show(el, e.clientX, e.clientY); });
  });
  window.addEventListener('scroll', hide, { passive: true, once: true });
}

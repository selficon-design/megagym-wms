/* ================================================================
   MEGA GYM AI — βοηθός με ελεγχόμενη πρόσβαση στα πραγματικά δεδομένα.
   Διαβάζει μέσω εργαλείων· οι ενέργειες γίνονται μόνο ως προσχέδια που
   ο χρήστης επιβεβαιώνει, με τα ίδια δικαιώματα και κανόνες αποθέματος.
   ================================================================ */
/* ---------- Φωνή (ανάγνωση απαντήσεων) με τις φωνές της συσκευής ---------- */
const TTS = { ok: typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined', on: false, voice: null };
try { TTS.on = TTS.ok && localStorage.getItem('mg-tts') === '1'; } catch (e) {}
function ttsPickVoice() {
  if (!TTS.ok) return null;
  const vs = speechSynthesis.getVoices() || [];
  TTS.voice = vs.find(v => /^el(-|_|$)/i.test(v.lang)) || null;
  return TTS.voice;
}
if (TTS.ok) { ttsPickVoice(); try { speechSynthesis.onvoiceschanged = ttsPickVoice; } catch (e) {} }
function ttsClean(t) { return String(t || '').replace(/\*\*/g, '').replace(/[#•*_`>]/g, ' ').replace(/ΠΑΡ-0*(\d+)/g, 'παραλαβή $1').replace(/ΤΟΠ-0*(\d+)/g, 'τοποθέτηση $1').replace(/(\d)\s*τεμ\b\.?/g, '$1 τεμάχια').replace(/(\d)\s*μ²/g, '$1 τετραγωνικά μέτρα').replace(/\s+/g, ' ').trim(); }
function ttsSpeak(text) {
  if (!TTS.ok) return;
  try {
    speechSynthesis.cancel();
    const chunks = ttsClean(text).match(/[^.!;\n]{1,220}[.!;]?/g) || [];
    chunks.forEach(c => { const u = new SpeechSynthesisUtterance(c); u.lang = 'el-GR'; if (TTS.voice || ttsPickVoice()) u.voice = TTS.voice; u.rate = 1.02; speechSynthesis.speak(u); });
  } catch (e) { toast('Η ανάγνωση δεν είναι διαθέσιμη σε αυτή τη συσκευή.', true); }
}
ACT.ttsToggle = () => {
  TTS.on = !TTS.on; try { localStorage.setItem('mg-tts', TTS.on ? '1' : '0'); } catch (e) {}
  if (TTS.on) ttsSpeak(TTS.voice || ttsPickVoice() ? 'Η φωνή ενεργοποιήθηκε.' : 'Η φωνή ενεργοποιήθηκε. Δεν βρέθηκε ελληνική φωνή στη συσκευή.');
  else try { speechSynthesis.cancel(); } catch (e) {}
  if (TTS.on && !(TTS.voice || ttsPickVoice())) toast('Δεν βρέθηκε ελληνική φωνή στη συσκευή· θα χρησιμοποιηθεί η προεπιλεγμένη.', true);
  renderAi();
};
ACT.ttsSay = el => { const it = AI.items[Number(el.dataset.i)]; if (it && it.text) ttsSpeak(it.text); };
ACT.closeAiTts = () => {};
const AI = { open: false, items: [], turns: [], busy: false, ctl: null, props: {} };

function renderAiFab() {
  $('#aifab').hidden = AI.open;
}
ACT.openAi = () => { AI.open = true; renderAi(); renderAiFab(); setTimeout(() => { const t = $('#aiin'); if (t) t.focus(); }, 50); };
ACT.closeAi = () => { try { if (TTS.ok) speechSynthesis.cancel(); } catch (e) {} AI.open = false; $('#ai').hidden = true; renderAiFab(); };
ACT.clearAi = () => { if (AI.ctl) AI.ctl.abort(); AI.items = []; AI.turns = []; AI.props = {}; renderAi(); };
const AI_SUGGEST = [
  'Πώς κάνω αντικατάσταση σε γυμναστήριο και πού πάνε τα παλιά;',
  'Δείξε μου τη στατιστική αντικαταστάσεων των τελευταίων 12 μηνών.',
  'Πόσα φωτιστικά έχουμε στην Κεντρική Αποθήκη, πόσα στο αμάξι και πόσα εγκατεστημένα στη Γλυφάδα;',
  'Δείξε μου την τελευταία λίστα παραλαβής.',
  'Ποια προϊόντα της τελευταίας παραλαβής βρίσκονται ακόμη στο αμάξι;',
  'Ετοίμασε επιστροφή όλων των προϊόντων της τελευταίας παραλαβής στην αρχική αποθήκη.',
  'Ποια προϊόντα έχουν μηδενικό απόθεμα;',
  'Βρες τη σημείωση για τα χαλασμένα φωτιστικά.',
];
function mdLite(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>'); }
function renderAi() {
  const box = $('#ai'); box.hidden = !AI.open; if (!AI.open) return;
  const unavailable = !sampleCap;
  box.innerHTML = `<div class="aipanel" role="dialog" aria-label="MEGA GYM AI"><div class="aihead"><span class="brand"><span class="mk">AI</span></span><b>MEGA GYM AI</b>
    ${TTS.ok ? `<button data-act="ttsToggle" aria-pressed="${TTS.on}" title="Ανάγνωση απαντήσεων" style="${TTS.on ? 'background:var(--accent);color:#111;border-color:var(--accent)' : ''}">${TTS.on ? 'Φωνή: ON' : 'Φωνή: OFF'}</button>` : ''}<button data-act="clearAi">Νέα συζήτηση</button><button data-act="closeAi" aria-label="Κλείσιμο">✕</button></div>
    <div class="aimsgs" id="aimsgs">${unavailable ? `<div class="warnbox">Ο AI Assistant δεν είναι διαθέσιμος αυτή τη στιγμή. Ελέγξτε τη σύνδεση και ανοίξτε ξανά την εφαρμογή.</div>` :
      (AI.items.length ? AI.items.map(aiItemHtml).join('') : `<div class="msg a">Γεια σας. Ρωτήστε με πώς γίνεται οποιαδήποτε εργασία στην εφαρμογή, ή για προϊόντα, αποθέματα, παραλαβές, τοποθετήσεις και σημειώσεις, ή δώστε μου εντολή να ετοιμάσω μια κίνηση. Κάθε ενέργεια εκτελείται μόνο αφού την επιβεβαιώσετε.</div>
        <div class="suggest">${AI_SUGGEST.map(s => `<button data-act="aiSuggest">${esc(s)}</button>`).join('')}</div>`)}</div>
    <form class="aiform" id="aiform"><textarea id="aiin" placeholder="Γράψτε ή μιλήστε…" aria-label="Μήνυμα" ${unavailable ? 'disabled' : ''}></textarea>${micBtnHtml(unavailable)}
      ${AI.busy ? `<button type="button" class="btn" data-act="aiStop">Διακοπή</button>` : `<button class="btn pri" ${unavailable ? 'disabled' : ''}>Αποστολή</button>`}</form></div>`;
  $('#aiform').onsubmit = e => { e.preventDefault(); aiSend($('#aiin').value); };
  $('#aiin').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend($('#aiin').value); } };
  fillPhotos(box);
  const m = $('#aimsgs'); m.scrollTop = m.scrollHeight;
}
function aiItemHtml(it) {
  if (it.k === 'u') return `<div class="msg u">${esc(it.text)}</div>`;
  if (it.k === 'a') return `<div class="msg a">${mdLite(it.text || 'Σκέφτομαι…')}${TTS.ok && it.text && !AI.busy ? `<div style="margin-top:6px"><button class="btn sm ghost" data-act="ttsSay" data-i="${AI.items.indexOf(it)}">Ακρόαση</button></div>` : ''}</div>`;
  if (it.k === 't') return `<div class="msg t">${esc(it.text)}</div>`;
  if (it.k === 'err') return `<div class="errbox">${esc(it.text)}</div>`;
  if (it.k === 'cards') return `<div class="pcards">${it.ids.filter(p => S.prod[p]).map(p => `<div class="pcard" data-act="aiGo" data-v="prod" data-a="${p}"><div class="ph2" ${S.prod[p].photo ? `data-ph="${p}"` : ''}>${S.prod[p].photo ? '' : '<span class="small">Χωρίς φωτο</span>'}</div><div class="t"><b>${esc(prodName(p))}</b><div class="mono muted">${esc(prodCode(p))}</div></div></div>`).join('')}</div>`;
  if (it.k === 'prop') {
    const P = AI.props[it.id]; if (!P) return '';
    let body;
    if (P.kind === 'note') body = `<div class="small"><b>${esc(P.note.subj)}</b> · ${esc(fmtDT(P.note.ts))}<div style="white-space:pre-wrap">${esc(P.note.text)}</div></div>`;
    else { let m; try { m = dryRun(P.op).mov; } catch (e) { m = null; P.err = P.err || e.message; }
      body = m ? `<div class="small">${esc(locName(m.from))} → ${esc(locName(m.to))}</div>${movTable(Object.assign({}, m, { wh: P.op.wh, toWh: P.op.toWh }))}` : ''; }
    const st = P.state;
    return `<div class="propose"><div class="row"><span class="pt">Προσχέδιο: ${esc(P.title)}</span></div>${body}
      ${P.err && st === 'open' ? `<div class="errbox">${esc(P.err)}</div>` : ''}
      ${st === 'open' ? `<div class="btns"><button class="btn pri" data-act="aiConfirm" data-id="${it.id}" ${P.err ? 'disabled' : ''}>Επιβεβαίωση</button><button class="btn ghost" data-act="aiCancel" data-id="${it.id}">Ακύρωση</button></div>`
        : st === 'done' ? `<div class="okbox">Καταχωρίστηκε ${P.docNo ? `<span class="docno">${esc(P.docNo)}</span>` : ''} ${P.link ? `<button class="btn sm" data-act="aiGo" data-v="${P.link[0]}" data-a="${P.link[1]}">Άνοιγμα</button>` : ''}</div>`
        : st === 'busy' ? `<div class="muted small">Καταχώριση…</div>` : `<div class="muted small">Ακυρώθηκε.</div>`}</div>`;
  }
  return '';
}
ACT.aiSuggest = el => aiSend(el.textContent);
ACT.aiStop = () => { if (AI.ctl) AI.ctl.abort(); };
ACT.aiGo = el => { if (innerWidth < 900) ACT.closeAi(); go(el.dataset.v, el.dataset.a); };
ACT.aiCancel = el => { AI.props[el.dataset.id].state = 'cancelled'; AI.turns.push({ role: 'user', content: '[Εφαρμογή] Ο χρήστης ακύρωσε το προσχέδιο.' }); renderAi(); };
ACT.aiConfirm = async el => {
  const P = AI.props[el.dataset.id]; if (!P || P.state !== 'open') return;
  P.state = 'busy'; renderAi();
  try {
    if (P.kind === 'note') {
      if (!can('notes')) throw new Error('Δεν έχετε δικαίωμα δημιουργίας σημειώσεων.');
      const id = 'note_' + uid(); await saveDoc(`data/users/${S.me.id}/${id}`, { subj: P.note.subj, text: P.note.text, ts: P.note.ts, by: S.me.id, created: Date.now(), edits: [] });
      P.state = 'done'; P.docNo = ''; P.link = ['notes', ''];
      AI.turns.push({ role: 'user', content: `[Εφαρμογή] Ο χρήστης επιβεβαίωσε· η σημείωση «${P.note.subj}» δημιουργήθηκε.` });
    } else {
      const res = await execute(P.op);
      P.state = 'done'; P.docNo = res.docNo;
      P.link = res.type === 'LOAD' ? ['pk', res.refs.pk] : (res.refs && res.refs.pl && (res.type === 'PLACE' || res.type === 'INSTALL')) ? ['pl', res.refs.pl] : null;
      AI.turns.push({ role: 'user', content: `[Εφαρμογή] Ο χρήστης επιβεβαίωσε· δημιουργήθηκε το παραστατικό ${res.docNo}.` });
    }
  } catch (e) { P.state = 'open'; P.err = e.message; }
  renderAi();
};

/* ---------------- βοηθητικά αναζήτησης ---------------- */
function dayStart(s) { return s ? new Date(s + 'T00:00').getTime() : null; }
function dayEnd(s) { return s ? new Date(s + 'T23:59:59').getTime() : null; }
function findPk(ref) {
  if (!ref) return null; ref = String(ref);
  if (S.pk[ref]) return ref;
  const n = Number((ref.match(/\d+/) || [])[0]);
  return Object.keys(S.pk).find(id => S.pk[id].no === n) || null;
}
function findPl(ref) {
  if (!ref) return null; ref = String(ref);
  if (S.pl[ref]) return ref;
  const n = Number((ref.match(/\d+/) || [])[0]);
  return Object.keys(S.pl).find(id => S.pl[id].no === n) || null;
}
const latestPk = () => (Object.entries(S.pk).sort((a, b) => b[1].no - a[1].no)[0] || [null])[0];
function searchProducts(query, cat) {
  const toks = norm(query).split(/\s+/).filter(Boolean).map(t => t.length > 4 ? t.slice(0, t.length - 2) : t); // απλή αποκοπή καταλήξεων
  const scored = [];
  for (const [p, x] of Object.entries(S.prod)) {
    if (x.deleted) continue;
    if (cat && x.cat !== cat) continue;
    const hay = norm([x.code, x.name, x.desc, catLabel(p), x.unit].join(' '));
    const hits = toks.filter(t => hay.includes(t)).length;
    if (!toks.length || hits) scored.push([p, hits + (norm(x.code) === norm(query) ? 10 : 0) + (norm(x.name).includes(norm(query)) ? 3 : 0)]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
function prodBrief(p) {
  const x = S.prod[p]; const t = prodTotals(p);
  return { id: p, code: x.code, name: x.name, item_type: x.kind === 'mat' ? 'υλικό κατασκευής' : 'έτοιμο προϊόν', full_dimensions: x.dims || undefined, remnants_in_stock: x.kind === 'mat' ? remsWhere({ p }).length : undefined, description: (x.desc || '').slice(0, 160), kind: catName(x.cat), category: subName(x.cat, x.sub) || null, type: typeName(x.cat, x.sub, x.ptype) || null, unit: x.unit, active: x.active !== false, has_photo: !!x.photo,
    totals: { AVAILABLE_FOR_USE: t.avail, available_in_warehouses: t.WN, available_in_vehicles: t.VN, not_for_use_old_items: { used: t.WU, damaged: t.WD, to_check: t.WC, old_in_vehicles: t.VO, total: t.old }, not_for_use_installed_in_gyms: t.G } };
}
function locLabel(k) {
  const s = k.split('|');
  if (s[0] === 'W') return { type: 'warehouse', warehouse: whName(s[1]), warehouse_id: s[1], space: secLabel(s[1], s[2]) || undefined, status: ENG.ST[s[3]] };
  if (s[0] === 'V') return { type: 'vehicle', vehicle: vehName(s[1]), vehicle_id: s[1], from_pickup: pkLabel(s[2]), old_item_status: s[2].startsWith('OLD') ? ENG.ST[s[2][3]] : undefined, origin_warehouse: S.pk[s[2]] ? whName(S.pk[s[2]].wh) : null };
  return { type: 'installed', gym: gymName(s[1]), gym_id: s[1], placement: S.pl[s[2]] ? S.pl[s[2]].docNo : null };
}
function pickupInfo(id, detail) {
  const p = S.pk[id]; const rem = pkRemaining(id); const st = pkStatus(id);
  const o = { id, number: p.docNo, date: fmtDT(p.ts), user: uname(p.by), warehouse: whName(p.wh), vehicle: vehName(p.veh), products: p.lines.length, status: st.label };
  if (detail) {
    o.lines = p.lines.map((l, i) => ({ product: prodName(l.p), product_id: l.p, code: prodCode(l.p), unit: unitOf(l.p), category: catLabel(l.p), loaded: l.qty, still_in_vehicle: rem[i] || 0, installed_now: l.placed - l.back, placed_total: l.placed, returned_from_gym_to_vehicle: l.back, returned_to_warehouse: l.returned, moved_to_gym_warehouse: l.toWh, retired_from_vehicle: l.retired || 0 }));
    o.movements = movsFor(m => m.refs && (m.refs.pk === id || (m.refs.pks || []).includes(id))).slice(0, 20).map(m => ({ number: m.docNo, type: ENG.TYPES[m.type].label, date: fmtDT(m.ts), from: locName(m.from), to: locName(m.to) }));
  } else o.still_in_vehicle = Object.entries(rem).filter(([, v]) => v > 0).map(([i, v]) => `${prodName(p.lines[i].p)}: ${v} ${unitOf(p.lines[i].p)}`);
  return o;
}
function placementInfo(id, detail) {
  const p = S.pl[id]; const inst = plInstalled(id);
  const o = { id, number: p.docNo, date: fmtDT(p.ts), user: uname(p.by), gym: gymName(p.gym), purpose: PURPOSE[p.purpose || 'new'], reason: p.reason || undefined, source: p.src === 'veh' ? 'Όχημα ' + vehName(p.veh) : 'Αποθήκη ' + whName(p.wh),
    origin_pickups: [...new Set(p.lines.map(l => l.pk).filter(Boolean))].map(pkLabel) };
  o.lines = p.lines.map((l, i) => ({ product: prodName(l.p), product_id: l.p, unit: unitOf(l.p), purpose: PURPOSE[l.purpose || p.purpose || 'new'], placed: l.qty, returned: l.back, retired_or_replaced_later: (l.retired || 0) + (l.replaced || 0), still_installed: inst[i], from_pickup: l.pk ? pkLabel(l.pk) : null,
    old_items: (l.purpose || p.purpose) === 'repl' && l.old ? oldText(l.old) : undefined, old_items_went_to: (l.purpose || p.purpose) === 'repl' && l.old && (l.old.u || l.old.c || l.old.d) && (l.oldDest || p.oldDest) ? destText(l.oldDest || p.oldDest, p.veh) : undefined, problem: l.problem || undefined }));
  if (!detail) o.lines = o.lines.slice(0, 15);
  return o;
}

/* ---------------- εργαλεία για το μοντέλο ---------------- */
const AI_TOOLS = [
  { name: 'get_manual', description: 'Οδηγός χρήσης της εφαρμογής. Κάλεσέ το για ΚΑΘΕ ερώτηση «πώς κάνω…», «πού βρίσκω…», «τι σημαίνει…» ή «τι δικαίωμα χρειάζομαι…». Επιστρέφει τις πιο σχετικές ενότητες με τα ακριβή βήματα και ονόματα κουμπιών/μενού. query: λέξεις-κλειδιά στα ελληνικά.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    execute: i => { const r = manualSearch(String(i.query || '')).slice(0, 3); return r.length ? r.map(s => ({ section_id: s.id, title: s.t, text: s.b })) : { note: 'Καμία ενότητα δεν ταιριάζει. Διαθέσιμες ενότητες:', sections: MANUAL.map(s => ({ section_id: s.id, title: s.t })) }; } },
  { name: 'open_manual', description: 'Ανοίγει στην εφαρμογή την οθόνη «Οδηγός χρήσης» στην ενότητα section_id (από get_manual).',
    inputSchema: { type: 'object', properties: { section_id: { type: 'string' } }, required: ['section_id'] },
    execute: i => { if (innerWidth < 900) ACT.closeAi(); S.helpF = { q: '' }; go('help', String(i.section_id)); return 'Ο οδηγός άνοιξε.'; } },
  { name: 'list_locations', description: 'Επιστρέφει αποθήκες (με τους φυσικούς χώρους τους και συνδεδεμένο γυμναστήριο), οχήματα, γυμναστήρια, είδη → κατηγορίες → τύπους με τα id τους. Χρησιμοποίησέ το για να αντιστοιχίσεις ονόματα σε id.',
    execute: () => ({ warehouses: Object.entries(S.wh).map(([id, w]) => ({ id, code: w.code, name: w.name, kind: w.gym ? 'αποθήκη γυμναστηρίου' : 'κεντρική αποθήκη', spaces: sections(id).map(s => ({ id: s.id, name: s.name })), active: w.active !== false, gym: w.gym ? gymName(w.gym) : null, gym_id: w.gym || null })),
      vehicles: Object.entries(S.veh).map(([id, v]) => ({ id, code: v.code, name: v.name, plate: v.plate || null })),
      gyms: Object.entries(S.gym).map(([id, g]) => ({ id, code: g.code, name: g.name, address: g.address, warehouses: gymWarehouses(id) })),
      kinds: Object.entries(S.cat).map(([id, c]) => ({ id, name: c.name, categories: (c.subs || []).map(s => ({ id: s.id, name: s.name, types: (s.types || []).map(t => ({ id: t.id, name: t.name })) })) })) }) },
  { name: 'find_products', description: 'Αναζήτηση προϊόντων με κωδικό, όνομα, περιγραφή, είδος, κατηγορία ή τύπο (λέξεις-κλειδιά, ελληνικά ή λατινικά). Επιστρέφει έως 25 με id και σύνολα αποθέματος ανά κατάσταση/θέση.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, category_id: { type: 'string' } }, required: ['query'] },
    execute: i => { const ids = searchProducts(String(i.query || ''), i.category_id).slice(0, 25); return ids.length ? ids.map(prodBrief) : 'Κανένα προϊόν δεν ταιριάζει.'; } },
  { name: 'get_stock', description: 'Αναλυτικά υπόλοιπα: ανά αποθήκη/τμήμα/κατάσταση, ανά όχημα (με λίστα παραλαβής προέλευσης) και εγκατεστημένα ανά γυμναστήριο. Φίλτρα: product_ids, location_type (warehouse|vehicle|installed), location_id (id αποθήκης, οχήματος ή γυμναστηρίου).',
    inputSchema: { type: 'object', properties: { product_ids: { type: 'array', items: { type: 'string' } }, location_type: { type: 'string', enum: ['warehouse', 'vehicle', 'installed'] }, location_id: { type: 'string' } } },
    execute: i => {
      const pids = i.product_ids && i.product_ids.length ? i.product_ids.map(String) : Object.keys(S.bal);
      const map = { warehouse: 'W', vehicle: 'V', installed: 'G' }; const out = [];
      for (const p of pids) for (const [k, v] of Object.entries(balQ(p))) {
        if (!v) continue; const s = k.split('|');
        if (i.location_type && s[0] !== map[i.location_type]) continue;
        if (i.location_id && s[1] !== i.location_id) continue;
        out.push(Object.assign({ product: prodName(p), product_id: p, code: prodCode(p), qty: v, unit: unitOf(p) }, locLabel(k)));
      }
      if (!out.length) return 'Δεν υπάρχει υπόλοιπο για αυτά τα φίλτρα (ποσότητα 0).';
      return out.length > 250 ? { note: `Εμφανίζονται 250 από ${out.length}. Περιόρισε τα φίλτρα.`, rows: out.slice(0, 250) } : out;
    } },
  { name: 'zero_stock', description: 'Προϊόντα με μηδενικό κανονικό διαθέσιμο απόθεμα σε όλες τις αποθήκες (προαιρετικά ανά είδος).',
    inputSchema: { type: 'object', properties: { category_id: { type: 'string' } } },
    execute: i => Object.keys(S.prod).filter(p => S.prod[p].active !== false && !S.prod[p].deleted && (!i.category_id || S.prod[p].cat === i.category_id) && prodTotals(p).avail <= 0).slice(0, 100).map(p => ({ id: p, code: prodCode(p), name: prodName(p), category: catName(S.prod[p].cat) })) },
  { name: 'list_pickups', description: 'Λίστες παραλαβής (φόρτωσης στο αμάξι), νεότερες πρώτα. Φίλτρα ημερομηνίας σε μορφή YYYY-MM-DD.',
    inputSchema: { type: 'object', properties: { vehicle_id: { type: 'string' }, warehouse_id: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' }, only_with_items_in_vehicle: { type: 'boolean' }, limit: { type: 'number' } } },
    execute: i => {
      let l = Object.keys(S.pk).sort((a, b) => S.pk[b].no - S.pk[a].no);
      if (i.vehicle_id) l = l.filter(id => S.pk[id].veh === i.vehicle_id);
      if (i.warehouse_id) l = l.filter(id => S.pk[id].wh === i.warehouse_id);
      if (i.date_from) l = l.filter(id => S.pk[id].ts >= dayStart(i.date_from));
      if (i.date_to) l = l.filter(id => S.pk[id].ts <= dayEnd(i.date_to));
      if (i.only_with_items_in_vehicle) l = l.filter(id => pkStatus(id).rem > 0);
      return l.slice(0, Math.min(30, i.limit || 10)).map(id => pickupInfo(id, false));
    } },
  { name: 'get_pickup', description: 'Πλήρης λίστα παραλαβής με γραμμές: φορτώθηκαν, παραμένουν στο αμάξι, εγκατεστημένα, επιστράφηκαν, και τις συνδεδεμένες κινήσεις. Δέχεται αριθμό (π.χ. 87, 00087, ΠΑΡ-00087), id, ή "latest".',
    inputSchema: { type: 'object', properties: { pickup: { type: 'string' } }, required: ['pickup'] },
    execute: i => { const id = String(i.pickup) === 'latest' ? latestPk() : findPk(i.pickup); if (!id) throw new Error('Δεν βρέθηκε λίστα παραλαβής με αυτόν τον αριθμό.'); return pickupInfo(id, true); } },
  { name: 'list_placements', description: 'Λίστες τοποθέτησης (εγκαταστάσεις σε γυμναστήρια), νεότερες πρώτα, με γραμμές και ποσότητες που παραμένουν εγκατεστημένες.',
    inputSchema: { type: 'object', properties: { gym_id: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' }, product_id: { type: 'string' }, limit: { type: 'number' } } },
    execute: i => {
      let l = Object.keys(S.pl).sort((a, b) => S.pl[b].no - S.pl[a].no);
      if (i.gym_id) l = l.filter(id => S.pl[id].gym === i.gym_id);
      if (i.date_from) l = l.filter(id => S.pl[id].ts >= dayStart(i.date_from));
      if (i.date_to) l = l.filter(id => S.pl[id].ts <= dayEnd(i.date_to));
      if (i.product_id) l = l.filter(id => S.pl[id].lines.some(x => x.p === i.product_id));
      return l.slice(0, Math.min(30, i.limit || 10)).map(id => placementInfo(id, false));
    } },
  { name: 'get_placement', description: 'Μία λίστα τοποθέτησης με όλες τις γραμμές. Δέχεται αριθμό (π.χ. 12, ΤΟΠ-00012) ή id.',
    inputSchema: { type: 'object', properties: { placement: { type: 'string' } }, required: ['placement'] },
    execute: i => { const id = findPl(i.placement); if (!id) throw new Error('Δεν βρέθηκε λίστα τοποθέτησης.'); return placementInfo(id, true); } },
  { name: 'replacements', description: 'Στατιστική αντικαταστάσεων σε διάστημα YYYY-MM-DD: σύνολα, ανά γυμναστήριο, ανά προϊόν, ανά μήνα, τι έγιναν τα παλιά (πετάχτηκαν/μεταχειρισμένα/κατεστραμμένα/προς έλεγχο), συχνότερα προβλήματα και πρόσφατες αντικαταστάσεις. Φίλτρα gym_id, product_id, category_id.',
    inputSchema: { type: 'object', properties: { gym_id: { type: 'string' }, product_id: { type: 'string' }, category_id: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' } } },
    execute: i => {
      const rr = replacementRows({ gym: i.gym_id || '', from: dayStart(i.date_from), to: dayEnd(i.date_to) }).filter(r => S.prod[r.p] && (!i.product_id || r.p === i.product_id) && (!i.category_id || S.prod[r.p].cat === i.category_id));
      if (!rr.length) return 'Καμία αντικατάσταση στο διάστημα.';
      const agg = (keyf, namef) => { const m = {}; rr.forEach(r => { const k = keyf(r); const o = m[k] = m[k] || { name: namef(r), unit: unitOf(r.p), qty: 0, times: new Set() }; o.qty += r.qty; o.times.add(r.pl); }); return Object.values(m).map(o => ({ name: o.name, unit: o.unit, qty: o.qty, times: o.times.size })).sort((a, b) => b.qty - a.qty); };
      const fate = { thrown: 0, used: 0, damaged: 0, to_check: 0 }; rr.forEach(r => { fate.thrown += r.x; fate.used += r.u; fate.damaged += r.d; fate.to_check += r.c; });
      const reasons = {}; rr.forEach(r => { const t = (r.reason || '').trim(); if (t) reasons[t] = (reasons[t] || 0) + r.qty; });
      return { total_by_unit: sumByUnit(rr.map(r => ({ p: r.p, q: r.qty }))), replacement_events: new Set(rr.map(r => r.pl)).size,
        by_gym: agg(r => r.gym + '|' + unitOf(r.p), r => gymName(r.gym)).slice(0, 30), by_product: agg(r => r.p, r => prodName(r.p)).slice(0, 30),
        by_month: agg(r => { const d = new Date(r.ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '|' + unitOf(r.p); }, r => { const d = new Date(r.ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }).sort((a, b) => a.name.localeCompare(b.name)),
        old_items_fate: fate, top_problems: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, q]) => ({ problem: t, qty: q })),
        recent: rr.sort((a, b) => b.ts - a.ts).slice(0, 15).map(r => ({ date: fmtD(r.ts), placement: S.pl[r.pl] ? S.pl[r.pl].docNo : '', gym: gymName(r.gym), product: prodName(r.p), qty: r.qty, unit: unitOf(r.p), old: oldText(r) || null, problem: r.reason || null })),
        tip: 'Για γραφήματα πρότεινε open_screen με screen=replacements.' };
    } },
  { name: 'list_movements', description: 'Ιστορικό κινήσεων (νεότερες πρώτα). type: IMP εισαγωγή, LOAD φόρτωση, PLACE τοποθέτηση, INSTALL εγκατάσταση από αποθήκη, UNPLACE επιστροφή από γυμναστήριο, RETURN επιστροφή σε αποθήκη, TOGWH σε αποθήκη γυμναστηρίου, TRANSFER μεταφορά, VMOVE μεταφορά σε άλλο όχημα, SUPPLY εισαγωγή σε γυμναστήριο από προμηθευτή, GYM_MOVE μεταφορά από γυμναστήριο, PROCESS επεξεργασία υλικού, REM_MOVE μεταφορά ρεταλιών, REM_RETIRE απόσυρση ρεταλιών, STATUS αλλαγή κατάστασης, RETIRE απόσυρση από αποθήκη, RETIRE_V απόσυρση από αμάξι, RETIRE_G απόσυρση από γυμναστήριο, INV απογραφή.',
    inputSchema: { type: 'object', properties: { type: { type: 'string' }, product_id: { type: 'string' }, location_id: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' }, limit: { type: 'number' } } },
    execute: i => {
      let l = S.mov.filter(m => m.state !== 'pending');
      if (i.type) l = l.filter(m => m.type === i.type);
      if (i.product_id) l = l.filter(m => m.lines.some(x => x.p === i.product_id));
      if (i.location_id) l = l.filter(m => (m.from && m.from.id === i.location_id) || (m.to && m.to.id === i.location_id) || m.lines.some(x => x.wh === i.location_id));
      if (i.date_from) l = l.filter(m => m.ts >= dayStart(i.date_from));
      if (i.date_to) l = l.filter(m => m.ts <= dayEnd(i.date_to));
      return l.slice(0, Math.min(40, i.limit || 15)).map(m => ({ number: m.docNo, type: ENG.TYPES[m.type].label, date: fmtDT(m.ts), user: uname(m.by), from: locName(m.from), to: locName(m.to), note: m.note || undefined,
        lines: m.lines.slice(0, 20).map(x => ({ product: prodName(x.p), qty: m.type === 'INV' && x.diff != null ? x.diff : x.qty, unit: unitOf(x.p), details: lineDesc(Object.assign({}, m, { wh: m.from && m.from.id, toWh: m.to && m.to.id }), x) })) }));
    } },
  { name: 'search_notes', description: 'Αναζήτηση στο ΠΡΟΣΩΠΙΚΟ σημειωματάριο του χρήστη (θέμα και κείμενο) και/ή ανά διάστημα ημερομηνιών YYYY-MM-DD.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' } } },
    execute: i => {
      const toks = norm(i.query || '').split(/\s+/).filter(Boolean).map(t => t.length > 4 ? t.slice(0, t.length - 2) : t);
      let l = Object.values(S.notes);
      if (i.date_from) l = l.filter(n => n.ts >= dayStart(i.date_from));
      if (i.date_to) l = l.filter(n => n.ts <= dayEnd(i.date_to));
      l = l.map(n => [n, toks.filter(t => norm(n.subj + ' ' + n.text).includes(t)).length]).filter(([, h]) => !toks.length || h).sort((a, b) => b[1] - a[1] || b[0].ts - a[0].ts).map(x => x[0]);
      return l.length ? l.slice(0, 15).map(n => ({ date: fmtD(n.ts), time: fmtT(n.ts), subject: n.subj, text: n.text.slice(0, 600), author: uname(n.by) })) : 'Δεν βρέθηκαν σημειώσεις.';
    } },
  { name: 'list_remnants', description: 'Ρετάλια υλικών κατασκευής σε απόθεμα (κομμάτι-κομμάτι): id, υλικό, διάσταση, θέση (αποθήκη/χώρος ή αμάξι), ημερομηνία. Φίλτρα: product_id, warehouse_id, vehicle_id.',
    inputSchema: { type: 'object', properties: { product_id: { type: 'string' }, warehouse_id: { type: 'string' }, vehicle_id: { type: 'string' } } },
    execute: i => { const rs = remsWhere({ p: i.product_id, wh: i.warehouse_id, veh: i.vehicle_id }); return rs.length ? rs.slice(0, 100).map(([id, r]) => ({ id, material: prodName(r.p), product_id: r.p, dims: r.dims, location: remLoc(r), date: fmtD(r.ts), from_doc: (S.movById[r.mov] || {}).docNo, note: r.note || undefined })) : 'Κανένα ρετάλι.'; } },
  { name: 'show_products', description: 'Εμφανίζει στον χρήστη κάρτες προϊόντων με φωτογραφία. Χρησιμοποίησέ το όταν ζητά να δει προϊόντα ή φωτογραφίες, ή για να του δείξεις επιλογές όταν ταιριάζουν πολλά.',
    inputSchema: { type: 'object', properties: { product_ids: { type: 'array', items: { type: 'string' } } }, required: ['product_ids'] },
    execute: i => { const ids = (i.product_ids || []).map(String).filter(p => S.prod[p]).slice(0, 12); AI.items.push({ k: 'cards', ids }); renderAi(); return `Εμφανίστηκαν ${ids.length} κάρτες (${ids.filter(p => S.prod[p].photo).length} με φωτογραφία).`; } },
  { name: 'open_screen', description: 'Ανοίγει στην εφαρμογή μια οθόνη: pickup (λίστα παραλαβής, δέχεται αριθμό), placement, product, vehicle, warehouse, gym, replacements (στατιστική & γραφήματα αντικαταστάσεων· id = gym id ή "all").',
    inputSchema: { type: 'object', properties: { screen: { type: 'string', enum: ['pickup', 'placement', 'product', 'vehicle', 'warehouse', 'gym', 'replacements', 'materials', 'processing'] }, id: { type: 'string' } }, required: ['screen', 'id'] },
    execute: i => {
      const m = { pickup: ['pk', findPk(i.id === 'latest' ? latestPk() : i.id)], placement: ['pl', findPl(i.id)], product: ['prod', S.prod[i.id] ? i.id : null], vehicle: ['veh', S.veh[i.id] ? i.id : null], warehouse: ['wh', S.wh[i.id] ? i.id : null], gym: ['gym', S.gym[i.id] ? i.id : null], replacements: ['repls', S.gym[i.id] ? i.id : '-'], materials: ['mats', null], processing: ['proc', S.prod[i.id] ? 'P:' + i.id : S.rem[i.id] ? 'R:' + i.id : null] }[i.screen];
      if (!m || (!m[1] && !['mats', 'proc'].includes(m[0]))) throw new Error('Δεν βρέθηκε.'); if (m[0] === 'proc') S.procF = null; go(m[0], m[1]); return 'Η οθόνη άνοιξε.';
    } },
  { name: 'propose_action', description: `Δημιουργεί ΠΡΟΣΧΕΔΙΟ ενέργειας με προεπισκόπηση και κουμπί «Επιβεβαίωση». ΔΕΝ εκτελεί τίποτα. Ελέγχει δικαιώματα και υπόλοιπα.
action:
• import — εισαγωγή σε αποθήκη (warehouse_id, section_id, lines)
• pickup — φόρτωση από αποθήκη σε αμάξι (warehouse_id, vehicle_id, lines)
• place — από αμάξι σε γυμναστήριο (vehicle_id ή pickup, gym_id, lines ή all_remaining, purpose new|repl ανά γραμμή ή για όλα)
• install — από αποθήκη γυμναστηρίου σε εγκατάσταση στο ίδιο γυμναστήριο (gym_id, lines, purpose)
• to_gym_warehouse — από αμάξι σε αποθήκη γυμναστηρίου (warehouse_id)
• return_to_warehouse — από αμάξι σε αποθήκη (καινούργια και παλιά· τα παλιά επιστρέφουν με την κατάστασή τους). Χωρίς warehouse_id = αρχική αποθήκη. lines[].status για τα καινούργια (N,U,D,C), lines[].from new|old
• return_from_gym — από γυμναστήριο πίσω (στο αμάξι ή στην αποθήκη γυμναστηρίου)
• move_to_vehicle — φορτίο σε άλλο αμάξι (vehicle_id → to_vehicle_id)
• transfer — αποθήκη→αποθήκη/χώρο (warehouse_id, to_warehouse_id, to_section_id, status)
• status_change — αλλαγή κατάστασης σε αποθήκη (warehouse_id, from_status, to_status)
• retire_from_warehouse — οριστική απόσυρση από αποθήκη (status, reason)
• retire_from_vehicle — οριστική απόσυρση από αμάξι (lines[].from new|old|U|D|C, reason)
• retire_from_gym — απόσυρση εγκατεστημένων χωρίς αντικατάσταση (gym_id, reason)
• supply_to_gym — εισαγωγή σε γυμναστήριο κατευθείαν από προμηθευτή (gym_id, supplier, lines, purpose new|repl όπως στο place· old_destination origin = αποθήκη του γυμναστηρίου)
• move_from_gym — μεταφορά εγκατεστημένων από gym_id σε to_gym_id ή σε to_warehouse_id/to_section_id, condition good|used (lines ή all_remaining, reason)
• process — επεξεργασία υλικού κατασκευής (κατανάλωση): product_id, source warehouse|vehicle|remnant (+ warehouse_id/section_id ή vehicle_id/pickup ή remnant_id), qty (ολόκληρα), reason = για τι χρησιμοποιήθηκε, remnants_left = [{dims, destination: same|warehouse|vehicle, warehouse_id, section_id}]
• move_remnant — μεταφορά ρεταλιών (remnant_ids) σε to_warehouse_id/to_section_id ή to_vehicle_id
• retire_remnant — απόσυρση ρεταλιών (remnant_ids, reason)
• pickup δέχεται και remnant_ids: ρετάλια της ίδιας αποθήκης στην ίδια λίστα παραλαβής
• create_note
ΑΝΤΙΚΑΤΑΣΤΑΣΗ (place/install με purpose repl): για κάθε γραμμή old_thrown + old_used + old_damaged + old_check = qty (ή old_all για όλα). old_destination: origin (αποθήκη προέλευσης, προεπιλογή) | vehicle | warehouse (+ old_warehouse_id, old_section_id). problem = πρόβλημα παλιών. Αν ο χρήστης δεν το είπε, ΡΩΤΑ τον πριν φτιάξεις προσχέδιο. Τα παλιά αφαιρούνται αυτόματα από τα ήδη εγκατεστημένα του ίδιου προϊόντος στο γυμναστήριο.
Καταστάσεις: N κανονικό, U μεταχειρισμένο, D κατεστραμμένο, C προς έλεγχο.`,
    inputSchema: { type: 'object', properties: {
      action: { type: 'string', enum: ['import', 'pickup', 'place', 'install', 'return_to_warehouse', 'return_from_gym', 'to_gym_warehouse', 'transfer', 'move_to_vehicle', 'status_change', 'retire_from_warehouse', 'retire_from_vehicle', 'retire_from_gym', 'supply_to_gym', 'move_from_gym', 'process', 'move_remnant', 'retire_remnant', 'create_note'] },
      warehouse_id: { type: 'string' }, section_id: { type: 'string' }, vehicle_id: { type: 'string' }, to_vehicle_id: { type: 'string' }, gym_id: { type: 'string' }, to_warehouse_id: { type: 'string' }, to_section_id: { type: 'string' },
      pickup: { type: 'string', description: 'αριθμός λίστας παραλαβής ή "latest"' }, placement: { type: 'string', description: 'αριθμός λίστας τοποθέτησης ή "latest"' },
      all_remaining: { type: 'boolean' }, purpose: { type: 'string', enum: ['new', 'repl'] }, reason: { type: 'string', description: 'αιτία (απόσυρση) ή πρόβλημα παλιών (αντικατάσταση)' },
      status: { type: 'string', enum: ['N', 'U', 'D', 'C'] }, from_status: { type: 'string', enum: ['N', 'U', 'D', 'C'] }, to_status: { type: 'string', enum: ['N', 'U', 'D', 'C'] },
      old_all: { type: 'string', enum: ['thrown', 'used', 'damaged', 'check'], description: 'αντικατάσταση: ίδια τύχη για όλα τα παλιά' },
      old_destination: { type: 'string', enum: ['origin', 'vehicle', 'warehouse'] }, old_warehouse_id: { type: 'string' }, old_section_id: { type: 'string' },
      supplier: { type: 'string' }, to_gym_id: { type: 'string' }, condition: { type: 'string', enum: ['good', 'used'] },
      product_id: { type: 'string', description: 'process: το υλικό' }, qty: { type: 'number', description: 'process: ολόκληρα τεμάχια/φύλλα' }, source: { type: 'string', enum: ['warehouse', 'vehicle', 'remnant'] }, remnant_id: { type: 'string' },
      remnant_ids: { type: 'array', items: { type: 'string' } },
      remnants_left: { type: 'array', items: { type: 'object', properties: { dims: { type: 'string' }, destination: { type: 'string', enum: ['same', 'warehouse', 'vehicle'] }, warehouse_id: { type: 'string' }, section_id: { type: 'string' }, note: { type: 'string' } }, required: ['dims'] } },
      lines: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'string' }, qty: { type: 'number' },
        status: { type: 'string', enum: ['N', 'U', 'D', 'C'] }, from: { type: 'string', enum: ['new', 'old', 'U', 'D', 'C'], description: 'αμάξι: ποια τεμάχια (καινούργια ή παλιά από αντικαταστάσεις)' },
        purpose: { type: 'string', enum: ['new', 'repl'] }, old_thrown: { type: 'number' }, old_used: { type: 'number' }, old_damaged: { type: 'number' }, old_check: { type: 'number' },
        old_destination: { type: 'string', enum: ['origin', 'vehicle', 'warehouse'] }, old_warehouse_id: { type: 'string' }, old_section_id: { type: 'string' }, problem: { type: 'string' } }, required: ['product_id', 'qty'] } },
      note_subject: { type: 'string' }, note_text: { type: 'string' }, note_datetime: { type: 'string', description: 'YYYY-MM-DDTHH:MM, προαιρετικά' } }, required: ['action'] },
    execute: i => aiPropose(i) },
];

function aiPropose(i) {
  const FK = { old_thrown: 'x', old_used: 'u', old_damaged: 'd', old_check: 'c' };
  const lines = (i.lines || []).map(l => {
    const o = {}; let has = false; for (const [k, v] of Object.entries(FK)) if (l[k] != null) { o[v] = Number(l[k]) || 0; has = true; }
    return { p: String(l.product_id), qty: Number(l.qty), st: l.status || 'N', purpose: l.purpose, from: l.from, fate: has ? o : null,
      dest: l.old_destination ? { kind: l.old_destination, wh: l.old_warehouse_id, sec: l.old_section_id } : null };
  });
  for (const l of lines) { if (!S.prod[l.p]) throw new Error(`Άγνωστο product_id ${l.p}. Βρες το με find_products.`); if (!(l.qty > 0)) throw new Error('Μη έγκυρη ποσότητα.'); }
  const needWh = id => { if (!id || !S.wh[id]) throw new Error('Χρειάζεται έγκυρο warehouse_id (δες list_locations).'); return id; };
  const secOf = (wh, sec) => sec && sections(wh).some(s => s.id === sec) ? sec : sections(wh)[0].id;
  const pid = 'pr' + uid(); let op = null, title = '', P = { kind: 'op', state: 'open' };
  const vehOf = (id = i.vehicle_id) => { const v = id && S.veh[id] ? id : defaultVeh(); if (!v) throw new Error('Δεν υπάρχει όχημα.'); return v; };
  const pkRef = () => { if (!i.pickup) return null; const id = String(i.pickup) === 'latest' ? latestPk() : findPk(i.pickup); if (!id) throw new Error('Δεν βρέθηκε η λίστα παραλαβής.'); return id; };
  // παρτίδες οχήματος: which = 'new' (μόνο καινούργια) | 'any' (και τα παλιά από αντικαταστάσεις)
  const allocLots = (veh, pk, which, oldFirst) => {
    let lots = vehLots(veh).filter(l => (!pk || l.pk === pk) && (which === 'any' || !l.old));
    if (oldFirst) lots = lots.slice().sort((a, b) => (b.old ? 1 : 0) - (a.old ? 1 : 0));
    const out = [];
    if (i.all_remaining || !lines.length) { if (!pk && !i.all_remaining) throw new Error('Δώσε lines ή all_remaining.'); lots.forEach(l => out.push(Object.assign({}, l, { take: l.qty, st: l.old || 'N', ln: null }))); }
    else for (const ln of lines) {
      const ls = lots.filter(l => l.p === ln.p && (!ln.from || (ln.from === 'old' ? !!l.old : ln.from === 'new' ? !l.old : l.old === ln.from)));
      const have = ls.reduce((s, l) => s + l.qty, 0); let left = ln.qty;
      if (have < ln.qty) throw new Error(`Στο ${vehName(veh)}${pk ? ' από ' + pkLabel(pk) : ''} υπάρχουν ${have} ${unitOf(ln.p)} «${prodName(ln.p)}»${ln.from ? ' (' + ln.from + ')' : ''}, ζητήθηκαν ${ln.qty}.`);
      for (const l of ls) { const t = Math.min(l.qty, left); if (t > 0) out.push(Object.assign({}, l, { take: t, st: ln.st, ln })); left -= t; if (!left) break; }
    }
    if (!out.length) throw new Error('Δεν υπάρχει τίποτα στο αμάξι για αυτή την ενέργεια.');
    return out;
  };
  // κατανομή αποθήκης ανά χώρο (μεγαλύτερο υπόλοιπο πρώτα)
  const allocWh = (wh, st = 'N') => lines.map(ln => {
    const s = ln.st && ln.st !== 'N' ? ln.st : st;
    if (i.section_id) return [{ p: ln.p, sec: i.section_id, qty: ln.qty, st: s, ln }];
    const secs = allSections(wh).map(x => ({ sec: x.id, have: whAvail(ln.p, wh, x.id, s) })).filter(x => x.have > 0).sort((a, b) => b.have - a.have);
    let left = ln.qty; const out = [];
    for (const x of secs) { const t = Math.min(x.have, left); out.push({ p: ln.p, sec: x.sec, qty: t, st: s, ln }); left -= t; if (!left) break; }
    if (left > 0) throw new Error(`Στην «${whName(wh)}» υπάρχουν ${ln.qty - left} ${unitOf(ln.p)} «${prodName(ln.p)}» (${ENG.ST[s].toLowerCase()}), ζητήθηκαν ${ln.qty}.`);
    return out;
  }).flat();
  // αντικατάσταση: τι έγιναν τα παλιά (σύνολο = ποσότητα) και πού πάνε — κατανομή ανά παρτίδα
  const ALL = { thrown: 'x', used: 'u', damaged: 'd', check: 'c' };
  const fatePools = {};
  const fateFor = (ln, p, qty) => {
    const key = ln ? lines.indexOf(ln) : 'all:' + p;
    if (!fatePools[key]) {
      if (ln && ln.fate) { const s = Object.values(ln.fate).reduce((a, b) => a + b, 0); if (Math.abs(s - ln.qty) > 1e-9) throw new Error(`«${prodName(p)}»: αντικαταστάθηκαν ${ln.qty}, αλλά τα παλιά (old_thrown+old_used+old_damaged+old_check) είναι ${s}. Πρέπει να είναι ίσα.`); fatePools[key] = Object.assign({ x: 0, u: 0, d: 0, c: 0 }, ln.fate); }
      else if (i.old_all && ALL[i.old_all]) fatePools[key] = { x: 0, u: 0, d: 0, c: 0, [ALL[i.old_all]]: Infinity };
      else throw new Error(`Για την αντικατάσταση του «${prodName(p)}» ρώτα πρώτα τον χρήστη τι έγιναν τα παλιά (πετάχτηκαν επιτόπου, μεταχειρισμένα, κατεστραμμένα ή προς έλεγχο) και πού πάνε όσα επιστρέφουν (αποθήκη προέλευσης, αμάξι ή άλλη αποθήκη). Μην υποθέτεις.`);
    }
    const pool = fatePools[key]; const out = { x: 0, u: 0, d: 0, c: 0 }; let left = qty;
    for (const k of ['u', 'd', 'c', 'x']) { const t = Math.min(pool[k], left); if (t > 0) { out[k] = t; if (pool[k] !== Infinity) pool[k] -= t; left -= t; } }
    if (left > 1e-9) throw new Error(`«${prodName(p)}»: λείπουν ${left} παλιά από την κατανομή.`);
    return out;
  };
  const destFor = (ln, origin) => {
    const d = (ln && ln.dest) || (i.old_destination ? { kind: i.old_destination, wh: i.old_warehouse_id, sec: i.old_section_id } : { kind: 'origin' });
    if (d.kind === 'vehicle') return { t: 'V' };
    if (d.kind === 'warehouse') { needWh(d.wh); return { t: 'W', wh: d.wh, sec: secOf(d.wh, d.sec) }; }
    if (origin) return origin;
    throw new Error('Δεν βρέθηκε αποθήκη προέλευσης· δώσε old_destination = vehicle ή warehouse.');
  };
  const addOldInst = (gym, ls) => { const used = {}; ls.forEach(l => { if (l.purpose !== 'repl') return; let want = l.qty; const fi = [];
    for (const x of gymInstLots(gym, l.p)) { const k = x.pl + '|' + x.li; const t = Math.min(x.q - (used[k] || 0), want); if (t > 0) { fi.push({ pl: x.pl, li: x.li, q: t }); used[k] = (used[k] || 0) + t; want -= t; } if (!want) break; }
    if (fi.length) l.fromInst = fi; }); };
  const purposeOf = ln => ((ln && ln.purpose) || i.purpose) === 'repl' ? 'repl' : 'new';
  const replLine = (base, ln, origin) => { const pu = purposeOf(ln); if (pu !== 'repl') return Object.assign(base, { purpose: 'new' });
    const old = fateFor(ln, base.p, base.qty); const back = old.u + old.d + old.c;
    return Object.assign(base, { purpose: 'repl', old, problem: String((ln && ln.problem) || i.reason || ''), oldDest: back ? destFor(ln, origin) : undefined }); };
  switch (i.action) {
    case 'create_note': {
      if (!i.note_subject) throw new Error('Χρειάζεται note_subject.');
      P = { kind: 'note', state: 'open', note: { subj: String(i.note_subject), text: String(i.note_text || ''), ts: i.note_datetime ? new Date(i.note_datetime).getTime() || Date.now() : Date.now() } };
      title = 'Νέα σημείωση'; if (!can('notes')) P.err = 'Δεν έχετε δικαίωμα δημιουργίας σημειώσεων.'; break;
    }
    case 'import': { const wh = needWh(i.warehouse_id); const sec = secOf(wh, i.section_id); if (!lines.length) throw new Error('Δώσε lines.');
      op = { type: 'IMP', id: uid(), wh, lines: lines.map(l => ({ p: l.p, sec, qty: l.qty })) }; title = 'Εισαγωγή σε αποθήκη'; break; }
    case 'pickup': { const wh = needWh(i.warehouse_id); const rr = (i.remnant_ids || []).map(String); if (!lines.length && !rr.length) throw new Error('Δώσε lines ή remnant_ids.');
      op = { type: 'LOAD', id: uid(), wh, veh: vehOf(), lines: allocWh(wh, 'N').map(l => ({ p: l.p, sec: l.sec, qty: l.qty })), rems: rr }; title = `Παραλαβή & φόρτωση στο ${vehName(op.veh)}`; break; }
    case 'place': { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf();
      if (!i.gym_id || !S.gym[i.gym_id]) throw new Error('Χρειάζεται gym_id (δες list_locations).');
      if (lines.some(l => l.purpose)) lines.forEach(l => { if (!l.purpose) l.purpose = i.purpose || 'new'; });
      const ls = allocLots(veh, pk, 'new').map(l => { const opk = S.pk[l.pk]; const origin = opk && S.wh[opk.wh] ? { t: 'W', wh: opk.wh, sec: secOf(opk.wh, opk.lines[l.li] && opk.lines[l.li].sec) } : null;
        return replLine({ p: l.p, pk: l.pk, li: l.li, qty: l.take }, l.ln, origin); });
      addOldInst(i.gym_id, ls);
      op = { type: 'PLACE', id: uid(), veh, gym: i.gym_id, lines: ls }; title = `${ls.every(l => l.purpose === 'repl') ? 'Αντικατάσταση' : ls.some(l => l.purpose === 'repl') ? 'Τοποθέτηση & αντικατάσταση' : 'Τοποθέτηση'} στο ${gymName(i.gym_id)}`; break; }
    case 'install': { if (!i.gym_id || !S.gym[i.gym_id]) throw new Error('Χρειάζεται gym_id.');
      const wh = i.warehouse_id && S.wh[i.warehouse_id] ? i.warehouse_id : gymWarehouses(i.gym_id)[0]; if (!wh) throw new Error('Το γυμναστήριο δεν έχει αποθήκη.');
      if (!lines.length) throw new Error('Δώσε lines.');
      const ls = allocWh(wh, 'N').map(l => replLine({ p: l.p, sec: l.sec, qty: l.qty }, l.ln, { t: 'W', wh, sec: l.sec }));
      addOldInst(i.gym_id, ls);
      op = { type: 'INSTALL', id: uid(), wh, gym: i.gym_id, lines: ls }; title = `Εγκατάσταση από αποθήκη γυμναστηρίου · ${gymName(i.gym_id)}`; break; }
    case 'to_gym_warehouse': { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf(); const wh = needWh(i.warehouse_id);
      op = { type: 'TOGWH', id: uid(), veh, wh, sec: secOf(wh, i.section_id), lines: allocLots(veh, pk, 'new').map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) }; title = 'Μεταφορά σε αποθήκη γυμναστηρίου'; break; }
    case 'return_to_warehouse': { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf();
      const dest = i.warehouse_id && S.wh[i.warehouse_id] ? i.warehouse_id : null;
      op = { type: 'RETURN', id: uid(), veh, lines: allocLots(veh, pk, 'any').map(l => {
        const wh = dest || l.wh || defaultWh(); const sec = dest ? secOf(dest, i.section_id) : (l.wh ? l.sec : sections(wh)[0].id);
        const st = l.old || (ENG.ST[l.st] ? l.st : 'N'); // τα παλιά επιστρέφουν πάντα με την κατάστασή τους
        return { p: l.p, pk: l.pk, li: l.li, wh, sec, N: st === 'N' ? l.take : 0, U: st === 'U' ? l.take : 0, D: st === 'D' ? l.take : 0, C: st === 'C' ? l.take : 0 }; }) };
      title = dest ? `Επιστροφή στην ${whName(dest)}` : 'Επιστροφή στην αρχική αποθήκη'; break; }
    case 'return_from_gym': {
      let plId = i.placement ? (String(i.placement) === 'latest' ? null : findPl(i.placement)) : null;
      const cands = Object.keys(S.pl).filter(id => (!i.gym_id || S.pl[id].gym === i.gym_id)).sort((a, b) => S.pl[b].no - S.pl[a].no);
      if (!plId) {
        plId = cands.find(id => { const inst = plInstalled(id); return S.pl[id].lines.some((l, k) => inst[k] > 0 && (!lines.length || lines.some(x => x.p === l.p))); });
        if (!plId) throw new Error('Δεν βρέθηκε τοποθέτηση με εγκατεστημένα προϊόντα που να ταιριάζει.');
      }
      const pl = S.pl[plId]; const inst = plInstalled(plId); const out = [];
      if (i.all_remaining || !lines.length) pl.lines.forEach((l, k) => { if (inst[k] > 0) out.push({ li: k, qty: inst[k] }); });
      else for (const ln of lines) {
        let left = ln.qty; const have = pl.lines.reduce((s, l, k) => s + (l.p === ln.p ? inst[k] : 0), 0);
        if (have < ln.qty) throw new Error(`Στην ${pl.docNo} παραμένουν εγκατεστημένα ${have} «${prodName(ln.p)}», ζητήθηκαν ${ln.qty}.`);
        pl.lines.forEach((l, k) => { if (l.p === ln.p && left > 0) { const t = Math.min(inst[k], left); if (t > 0) out.push({ li: k, qty: t }); left -= t; } });
      }
      if (!out.length) throw new Error('Τίποτα εγκατεστημένο για επιστροφή.');
      op = { type: 'UNPLACE', id: uid(), pl: plId, lines: out }; title = `Επιστροφή από ${gymName(pl.gym)} (${pl.docNo}) ${pl.src === 'veh' ? 'στο ' + vehName(pl.veh) : 'στην αποθήκη γυμναστηρίου'}`; break; }
    case 'transfer': { const wh = needWh(i.warehouse_id); const to = needWh(i.to_warehouse_id); if (!lines.length) throw new Error('Δώσε lines.');
      const toSec = secOf(to, i.to_section_id); const st = i.status && ENG.ST[i.status] ? i.status : (lines[0].st || 'N');
      op = { type: 'TRANSFER', id: uid(), wh, toWh: to, lines: allocWh(wh, st).map(l => ({ p: l.p, sec: l.sec, toSec, st: l.st, qty: l.qty })) }; title = `Μεταφορά ${whName(wh)} → ${whName(to)}`; break; }
    case 'move_to_vehicle': { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf();
      if (!i.to_vehicle_id || !S.veh[i.to_vehicle_id]) throw new Error('Χρειάζεται to_vehicle_id (δες list_locations).');
      op = { type: 'VMOVE', id: uid(), veh, toVeh: i.to_vehicle_id, lines: allocLots(veh, pk, 'any').map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) }; title = `Μεταφορά ${vehName(veh)} → ${vehName(i.to_vehicle_id)}`; break; }
    case 'status_change': { const wh = needWh(i.warehouse_id); if (!lines.length) throw new Error('Δώσε lines.');
      const from = i.from_status, to = i.to_status; if (!ENG.ST[from] || !ENG.ST[to] || from === to) throw new Error('Δώσε from_status και to_status (N, U, D, C) διαφορετικά μεταξύ τους.');
      lines.forEach(l => l.st = from);
      op = { type: 'STATUS', id: uid(), wh, lines: allocWh(wh, from).map(l => ({ p: l.p, sec: l.sec, from, to, qty: l.qty })) }; title = `Αλλαγή κατάστασης ${ENG.ST[from]} → ${ENG.ST[to]} · ${whName(wh)}`; break; }
    case 'retire_from_warehouse': { const wh = needWh(i.warehouse_id); if (!lines.length) throw new Error('Δώσε lines.');
      const st = i.status && ENG.ST[i.status] ? i.status : 'D'; lines.forEach(l => { if (!l.st || l.st === 'N') l.st = st; });
      op = { type: 'RETIRE', id: uid(), wh, note: String(i.reason || ''), lines: allocWh(wh, st).map(l => ({ p: l.p, sec: l.sec, st: l.st, qty: l.qty })) }; title = `Απόσυρση από ${whName(wh)}`; break; }
    case 'retire_from_vehicle': { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf();
      op = { type: 'RETIRE_V', id: uid(), veh, note: String(i.reason || ''), lines: allocLots(veh, pk, 'any', true).map(l => ({ p: l.p, pk: l.pk, li: l.li, qty: l.take })) }; title = `Απόσυρση από ${vehName(veh)}`; break; }
    case 'retire_from_gym': { if (!i.gym_id || !S.gym[i.gym_id]) throw new Error('Χρειάζεται gym_id.'); if (!lines.length && !i.all_remaining) throw new Error('Δώσε lines.');
      const out = [];
      const want = i.all_remaining ? Object.entries(gymInstalled(i.gym_id)).map(([p, q]) => ({ p, qty: q })) : lines;
      for (const ln of want) { let left = ln.qty; const ls = gymInstLots(i.gym_id, ln.p); const have = ls.reduce((s, x) => s + x.q, 0);
        if (have < ln.qty) throw new Error(`Στο ${gymName(i.gym_id)} είναι εγκατεστημένα ${have} «${prodName(ln.p)}», ζητήθηκαν ${ln.qty}.`);
        for (const x of ls.slice().reverse()) { const t = Math.min(x.q, left); if (t > 0) out.push({ p: ln.p, pl: x.pl, li: x.li, qty: t }); left -= t; if (!left) break; } }
      op = { type: 'RETIRE_G', id: uid(), gym: i.gym_id, note: String(i.reason || ''), lines: out }; title = `Απόσυρση από ${gymName(i.gym_id)}`; break; }
    case 'supply_to_gym': { if (!i.gym_id || !S.gym[i.gym_id]) throw new Error('Χρειάζεται gym_id.'); if (!lines.length) throw new Error('Δώσε lines.');
      const gw = gymWarehouses(i.gym_id)[0]; const origin = gw ? { t: 'W', wh: gw, sec: sections(gw)[0].id } : null;
      const ls = lines.map(ln => replLine({ p: ln.p, qty: ln.qty }, ln, origin)); addOldInst(i.gym_id, ls);
      op = { type: 'SUPPLY', id: uid(), gym: i.gym_id, supplier: String(i.supplier || ''), lines: ls }; title = `Εισαγωγή από προμηθευτή στο ${gymName(i.gym_id)}`; break; }
    case 'move_from_gym': { if (!i.gym_id || !S.gym[i.gym_id]) throw new Error('Χρειάζεται gym_id.');
      const to = i.to_gym_id ? { t: 'G', gym: i.to_gym_id } : (() => { needWh(i.to_warehouse_id); return { t: 'W', wh: i.to_warehouse_id, sec: secOf(i.to_warehouse_id, i.to_section_id) }; })();
      if (!i.condition) throw new Error('Ρώτα τον χρήστη αν τα προϊόντα είναι σε καλή κατάσταση ή μεταχειρισμένα (condition good|used).');
      const want = i.all_remaining ? Object.entries(gymInstalled(i.gym_id)).map(([p, q]) => ({ p, qty: q })) : lines; if (!want.length) throw new Error('Δώσε lines ή all_remaining.');
      const out = []; for (const ln of want) { let left = ln.qty; const ls = gymInstLots(i.gym_id, ln.p); const have = ls.reduce((s, x) => s + x.q, 0);
        if (have < ln.qty) throw new Error(`Στο ${gymName(i.gym_id)} είναι εγκατεστημένα ${have} «${prodName(ln.p)}», ζητήθηκαν ${ln.qty}.`);
        for (const x of ls) { const t = Math.min(x.q, left); if (t > 0) out.push({ p: ln.p, pl: x.pl, li: x.li, qty: t }); left -= t; if (!left) break; } }
      op = { type: 'GYM_MOVE', id: uid(), gym: i.gym_id, to, cond: i.condition === 'used' ? 'U' : 'N', note: String(i.reason || ''), lines: out }; title = `Μεταφορά από ${gymName(i.gym_id)} → ${to.t === 'G' ? gymName(to.gym) : whName(to.wh)} (${i.condition === 'used' ? 'μεταχειρισμένα' : 'καλή κατάσταση'})`; break; }
    case 'process': {
      let src, p = String(i.product_id || ''), srcVeh = null, defLoc = null;
      if (i.source === 'remnant') { const r = S.rem[i.remnant_id]; if (!r || r.status !== 'stock') throw new Error('Δεν βρέθηκε διαθέσιμο ρετάλι με αυτό το id (δες list_remnants).'); src = { t: 'R', rem: i.remnant_id }; p = r.p; if (r.loc.t === 'V') srcVeh = r.loc.veh; else defLoc = { t: 'W', wh: r.loc.wh, sec: r.loc.sec }; }
      else {
        if (!S.prod[p] || !isMat(p)) throw new Error('Δώσε product_id υλικού κατασκευής (find_products).');
        const qn = Number(i.qty) || 1;
        if (i.source === 'vehicle') { const pk = pkRef(); const veh = pk ? S.pk[pk].veh : vehOf(); const lot = vehLots(veh).find(l => l.p === p && !l.old && l.qty >= qn && (!pk || l.pk === pk)); if (!lot) throw new Error(`Δεν υπάρχουν ${qn} ${unitOf(p)} «${prodName(p)}» σε μία παρτίδα του ${vehName(veh)}.`); src = { t: 'V', veh, pk: lot.pk, li: lot.li }; srcVeh = veh; }
        else { const wh = needWh(i.warehouse_id); const sec = i.section_id || (allSections(wh).map(s => [s.id, whAvail(p, wh, s.id, 'N')]).sort((a, b) => b[1] - a[1])[0] || [])[0]; if (!sec || whAvail(p, wh, sec, 'N') < qn) throw new Error(`Στην «${whName(wh)}» δεν υπάρχουν ${qn} ${unitOf(p)} «${prodName(p)}» σε έναν χώρο.`); src = { t: 'W', wh, sec }; defLoc = { t: 'W', wh, sec }; }
      }
      const out = (i.remnants_left || []).map(o => { let loc;
        if (o.destination === 'warehouse') { needWh(o.warehouse_id); loc = { t: 'W', wh: o.warehouse_id, sec: secOf(o.warehouse_id, o.section_id) }; }
        else if (o.destination === 'vehicle') { if (!srcVeh) throw new Error('Ρετάλι στο αμάξι μόνο όταν η επεξεργασία γίνεται από αμάξι.'); loc = { t: 'V', veh: srcVeh }; }
        else loc = defLoc || (srcVeh ? { t: 'V', veh: srcVeh } : null);
        if (!String(o.dims || '').trim()) throw new Error('Κάθε ρετάλι χρειάζεται διάσταση.'); return { dims: String(o.dims), note: o.note || '', loc }; });
      op = { type: 'PROCESS', id: uid(), src, p, qty: src.t === 'R' ? 1 : (Number(i.qty) || 1), purpose: String(i.reason || ''), out }; title = `Επεξεργασία · ${prodName(p)}${out.length ? ' · ' + out.length + ' ρετάλι(α)' : ''}`; break; }
    case 'move_remnant': { const rr = (i.remnant_ids || []).map(String); if (!rr.length) throw new Error('Δώσε remnant_ids (list_remnants).');
      const to = i.to_vehicle_id ? { t: 'V', veh: i.to_vehicle_id } : (() => { needWh(i.to_warehouse_id); return { t: 'W', wh: i.to_warehouse_id, sec: secOf(i.to_warehouse_id, i.to_section_id) }; })();
      op = { type: 'REM_MOVE', id: uid(), rems: rr, to }; title = `Μεταφορά ${rr.length} ρεταλιών → ${to.t === 'V' ? vehName(to.veh) : whName(to.wh)}`; break; }
    case 'retire_remnant': { const rr = (i.remnant_ids || []).map(String); if (!rr.length) throw new Error('Δώσε remnant_ids.');
      op = { type: 'REM_RETIRE', id: uid(), rems: rr, note: String(i.reason || '') }; title = `Απόσυρση ${rr.length} ρεταλιών`; break; }
    default: throw new Error('Άγνωστη ενέργεια.');
  }
  if (op) {
    P.op = op;
    const perr = opPermError(op); if (perr) throw new Error(perr + ' Το προσχέδιο δεν δημιουργήθηκε.');
    try { dryRun(op); } catch (e) { throw new Error(e.message); }
  } else if (P.err) throw new Error(P.err);
  P.title = title; AI.props[pid] = P; AI.items.push({ k: 'prop', id: pid }); renderAi();
  return `Το προσχέδιο «${title}» εμφανίστηκε με προεπισκόπηση. Ζήτα από τον χρήστη να πατήσει «Επιβεβαίωση». Δεν έχει εκτελεστεί ακόμη.`;
}

function aiRules() {
  const now = new Date();
  return `Είσαι ο MEGA GYM AI, ο βοηθός της εφαρμογής διαχείρισης αποθηκών της ${S.company.name || 'MEGA GYM'}. Μιλάς σύντομα και πρακτικά.
ΚΑΝΟΝΕΣ:
1. Κάθε αριθμός, προϊόν ή κίνηση προέρχεται ΜΟΝΟ από τα εργαλεία. Ποτέ μην επινοείς ή εκτιμάς ποσότητες. Αν κάτι δεν βρεθεί, πες το.
2. Για ονόματα αποθηκών/οχημάτων/γυμναστηρίων κάλεσε list_locations. Για προϊόντα κάλεσε find_products (δοκίμασε και συνώνυμα: π.χ. φωτιστικά/φωτισμός/LED).
3. Αλλαγές αποθεμάτων ή σημειώσεις: ΜΟΝΟ με propose_action, που φτιάχνει προσχέδιο· ο χρήστης επιβεβαιώνει με κουμπί. Ποτέ μη λες ότι κάτι εκτελέστηκε πριν το επιβεβαιώσει.
4. Αν η εντολή είναι ασαφής (ποιο γυμναστήριο, ποια ποσότητα, ποιο αμάξι) ρώτα. Αν ταιριάζουν πολλά προϊόντα, δείξε τα με show_products και ζήτα επιλογή.
5. ΑΝΤΙΚΑΤΑΣΤΑΣΗ: πριν το προσχέδιο ρώτα τι έγιναν τα παλιά (πετάχτηκαν επιτόπου / μεταχειρισμένα / κατεστραμμένα / προς έλεγχο — σύνολο ίσο με τα καινούργια), πού πάνε όσα επιστρέφουν (αποθήκη προέλευσης, αμάξι ή άλλη αποθήκη) και ποιο ήταν το πρόβλημα. Μη υποθέτεις «πέταμα».
6. Καταστάσεις αποθέματος: Κανονικό, Μεταχειρισμένο, Κατεστραμμένο, Προς έλεγχο. «ΔΙΑΘΕΣΙΜΑ ΠΡΟΣ ΧΡΗΣΗ» = ΜΟΝΟ τα κανονικά (καλή κατάσταση) σε αποθήκες, αποθήκες γυμναστηρίων και τα καινούργια στα οχήματα — αυτό εννοεί ο χρήστης όταν ρωτά «πόσα έχουμε». Τα παλιά (μεταχειρισμένα, κατεστραμμένα, προς έλεγχο, παλιά στο αμάξι) και τα εγκατεστημένα σε γυμναστήρια ΔΕΝ είναι προς χρήση· ανέφερέ τα χωριστά μόνο αν ζητηθούν ή αν βοηθούν.
7. Μην αθροίζεις διαφορετικές μονάδες μέτρησης. Ανέφερε πάντα μονάδα.
8. Οι αριθμοί παραστατικών: ΜΓΥ μεταφορά από γυμναστήριο, ΕΠΞ επεξεργασία υλικού, ΜΡΤ μεταφορά ρεταλιών, ΕΙΣ εισαγωγή, ΠΑΡ παραλαβή, ΤΟΠ τοποθέτηση, ΕΠΓ επιστροφή από γυμναστήριο, ΕΠΑ επιστροφή σε αποθήκη, ΜΑΓ σε αποθήκη γυμναστηρίου, ΜΕΤ μεταφορά, ΜΟΧ μεταφορά σε άλλο όχημα, ΚΑΤ αλλαγή κατάστασης, ΑΠΣ απόσυρση, ΑΠΓ απογραφή. Ο χρήστης μπορεί να γράψει «00087» ή «87».
9. Μπορείς να ανοίξεις οθόνες με open_screen (και screen=replacements για στατιστική με γραφήματα).
10. Για ερωτήσεις χρήσης της εφαρμογής («πώς κάνω…», «πού είναι…») κάλεσε ΠΡΩΤΑ get_manual και απάντησε με αριθμημένα βήματα, χρησιμοποιώντας ακριβώς τα ονόματα μενού και κουμπιών του οδηγού. Μην επινοείς κουμπιά ή οθόνες.
11. ΕΙΣΑΓΩΓΗ ΣΕ ΓΥΜΝΑΣΤΗΡΙΟ γίνεται με τρεις τρόπους: από αμάξι (place), από αποθήκη γυμναστηρίου (install), κατευθείαν από προμηθευτή (supply_to_gym). Μεταφορά εγκατεστημένων σε άλλο γυμναστήριο ή αποθήκη: move_from_gym — ρώτα αν είναι σε καλή κατάσταση ή μεταχειρισμένα.
11β. Δύο ομάδες: «Έτοιμα προϊόντα» και «Υλικά κατασκευών» (δεν είναι είδος· κάτω τους υπάρχουν είδη υλικών, π.χ. ΜΕΤΑΛΛΑ – ΛΑΜΑΡΙΝΕΣ – INOX ΛΑΜΑΡΙΝΕΣ / DKP ΛΑΜΑΡΙΝΕΣ). Η ταξινόμηση πάει πάντα Είδος – Κατηγορία – Τύπος. ΥΛΙΚΑ ΚΑΤΑΣΚΕΥΩΝ (π.χ. λαμαρίνες): δεν τοποθετούνται, καταναλώνονται με «Επεξεργασία» (process). Ρώτα για τι χρησιμοποιήθηκε και αν έμεινε ρετάλι (διάσταση και πού μπαίνει). Τα ρετάλια είναι κομμάτι-κομμάτι με διάσταση (list_remnants) και μπαίνουν και σε λίστες παραλαβής (pickup με remnant_ids).
12. Απάντησε σε απλό κείμενο με κουκκίδες «•» όπου χρειάζεται, χωρίς πίνακες markdown. Απάντα στη γλώσσα που σου γράφει ο χρήστης (προεπιλογή ελληνικά)· τα ονόματα κουμπιών αναφέρονται όπως φαίνονται στην οθόνη.
Τρέχουσα ημερομηνία και ώρα: ${new Intl.DateTimeFormat('el-GR', { dateStyle: 'full', timeStyle: 'short' }).format(now)} (ISO ${now.toISOString().slice(0, 10)}, ώρα Ελλάδας).
Χρήστης: ${S.me.name || 'χρήστης'}, ρόλος ${ROLE_LABEL[S.me.role]}${S.me.whs.length ? ', περιορισμένος στις αποθήκες ' + S.me.whs.map(whName).join(', ') : ''}. ${S.me.role === 'viewer' ? 'Ο ρόλος Viewer δεν επιτρέπει ενέργειες· εξήγησέ το αν ζητηθεί.' : ''}`;
}

async function aiSend(text) {
  text = String(text || '').trim(); if (!text || AI.busy || !sampleCap) return;
  AI.items.push({ k: 'u', text }); AI.turns.push({ role: 'user', content: text });
  const ans = { k: 'a', text: '' }; AI.items.push(ans);
  AI.busy = true; AI.ctl = new AbortController(); renderAi();
  const tools = AI_TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: async (inp, ctx) => {
    const label = { find_products: 'Αναζήτηση προϊόντων', get_stock: 'Ανάγνωση υπολοίπων', list_pickups: 'Λίστες παραλαβών', get_pickup: 'Άνοιγμα λίστας παραλαβής', list_placements: 'Λίστες τοποθετήσεων', get_placement: 'Άνοιγμα τοποθέτησης', list_movements: 'Ιστορικό κινήσεων', search_notes: 'Αναζήτηση σημειώσεων', propose_action: 'Προετοιμασία προσχεδίου', list_locations: 'Ανάγνωση τοποθεσιών', zero_stock: 'Μηδενικά υπόλοιπα', show_products: 'Εμφάνιση προϊόντων', open_screen: 'Άνοιγμα οθόνης', get_manual: 'Ανάγνωση οδηγού χρήσης', open_manual: 'Άνοιγμα οδηγού' }[t.name] || t.name;
    const idx = AI.items.indexOf(ans); AI.items.splice(idx, 0, { k: 't', text: '• ' + label }); renderAi();
    return t.execute(inp || {}, ctx);
  } }));
  const turns = AI.turns.slice(-24);
  try {
    const r = await sampleCap(turns, { system: aiRules(), tools, signal: AI.ctl.signal, onText: ({ text: t }) => { ans.text = t; const els = $$('#aimsgs .msg.a'); if (els.length) els[els.length - 1].innerHTML = mdLite(t); } });
    ans.text = r.text; AI.turns.push({ role: 'assistant', content: r.text });
    if (TTS.on) ttsSpeak(r.text);
  } catch (e) {
    if (e.text) ans.text = e.text;
    const msg = { cancelled: '', not_granted: 'Δεν δόθηκε άδεια χρήσης του Claude για αυτή την εφαρμογή.', rate_limited: 'Πολλά αιτήματα ή όριο χρήσης. Δοκιμάστε ξανά σε λίγο.', tools_unavailable: 'Αυτή η προβολή δεν υποστηρίζει τα εργαλεία του βοηθού.', sampling_disabled: 'Το Claude δεν είναι διαθέσιμο για αυτόν τον λογαριασμό.', session_expired: 'Η σύνδεση έληξε. Συνδεθείτε ξανά.', server: e.message }[e.code];
    if (!ans.text) AI.items.splice(AI.items.indexOf(ans), 1);
    if (msg !== '') AI.items.push({ k: 'err', text: msg || 'Η απάντηση διακόπηκε. Δοκιμάστε ξανά.' });
    if (ans.text) AI.turns.push({ role: 'assistant', content: ans.text });
  } finally { AI.busy = false; AI.ctl = null; renderAi(); }
}

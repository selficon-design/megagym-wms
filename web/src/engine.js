/* ================================================================
   MEGA GYM — ΜΗΧΑΝΙΣΜΟΣ ΑΠΟΘΕΜΑΤΩΝ (καθαρές συναρτήσεις)
   Κάθε ποσότητα ζει σε έναν «κάδο» (bucket) ανά προϊόν:
     W|αποθήκη|τμήμα|κατάσταση   (κατάσταση: N κανονικό, D κατεστραμμένο, C προς έλεγχο)
     V|όχημα|λίστα παραλαβής|γραμμή   (το φορτίο κρατά τη σύνδεση με την αρχική παραλαβή)
     G|γυμναστήριο|λίστα τοποθέτησης|γραμμή   (εγκατεστημένα)
   Κάθε κίνηση = σύνολο μεταβολών κάδων που εφαρμόζονται μαζί ή καθόλου.
   ================================================================ */
const ENG = (() => {
  const ST = { N: 'Κανονικό', U: 'Μεταχειρισμένο', D: 'Κατεστραμμένο', C: 'Προς έλεγχο' };
  const STS = ['N', 'U', 'D', 'C'];
  const DEF_SEC = '_';
  const K = {
    W: (wh, sec, st) => `W|${wh}|${sec || DEF_SEC}|${st || 'N'}`,
    V: (veh, pk, li) => `V|${veh}|${pk}|${li}`,
    G: (gym, pl, li) => `G|${gym}|${pl}|${li}`,
    parse(k) { const [t, a, b, c] = k.split('|'); return { t, a, b, c }; },
  };
  const TYPES = {
    IMP: { label: 'Εισαγωγή σε αποθήκη', pre: 'ΕΙΣ' },
    LOAD: { label: 'Φόρτωση στο αμάξι', pre: 'ΠΑΡ' },
    PLACE: { label: 'Τοποθέτηση σε γυμναστήριο', pre: 'ΤΟΠ' },
    INSTALL: { label: 'Εγκατάσταση από αποθήκη γυμναστηρίου', pre: 'ΤΟΠ' },
    UNPLACE: { label: 'Επιστροφή από γυμναστήριο', pre: 'ΕΠΓ' },
    RETURN: { label: 'Επιστροφή από αμάξι σε αποθήκη', pre: 'ΕΠΑ' },
    TOGWH: { label: 'Μεταφορά σε αποθήκη γυμναστηρίου', pre: 'ΜΑΓ' },
    TRANSFER: { label: 'Μεταφορά μεταξύ αποθηκών', pre: 'ΜΕΤ' },
    STATUS: { label: 'Αλλαγή κατάστασης', pre: 'ΚΑΤ' },
    RETIRE: { label: 'Οριστική απόσυρση', pre: 'ΑΠΣ' },
    RETIRE_G: { label: 'Απόσυρση από γυμναστήριο', pre: 'ΑΠΣ' },
    RETIRE_V: { label: 'Απόσυρση από αμάξι', pre: 'ΑΠΣ' },
    INV: { label: 'Απογραφή', pre: 'ΑΠΓ' },
    VMOVE: { label: 'Μεταφορά σε άλλο όχημα', pre: 'ΜΟΧ' },
    PROCESS: { label: 'Επεξεργασία υλικού', pre: 'ΕΠΞ' },
    GYM_MOVE: { label: 'Μεταφορά από γυμναστήριο', pre: 'ΜΓΥ' },
    SUPPLY: { label: 'Εισαγωγή σε γυμναστήριο από προμηθευτή', pre: 'ΤΟΠ' },
    REM_MOVE: { label: 'Μεταφορά ρεταλιών', pre: 'ΜΡΤ' },
    REM_RETIRE: { label: 'Απόσυρση ρεταλιών', pre: 'ΑΠΣ' },
  };
  const pad = n => String(n).padStart(5, '0');
  // σκοπός ανά γραμμή + παλιά τεμάχια που αφαιρέθηκαν (x: πέταμα, c: επιστροφή προς έλεγχο, d: επιστροφή κατεστραμμένα)
  function lineOld(op, l) {
    const purpose = (l.purpose || op.purpose) === 'repl' ? 'repl' : 'new';
    const o = l.old || {}; const old = { x: Number(o.x) || 0, u: Number(o.u) || 0, c: Number(o.c) || 0, d: Number(o.d) || 0 };
    if (old.x < 0 || old.u < 0 || old.c < 0 || old.d < 0) throw new StockError('Οι ποσότητες των παλιών δεν μπορεί να είναι αρνητικές.');
    if (purpose === 'repl' && op.type !== 'INV') {
      const q = Math.round(Number(l.qty) * 1000) / 1000, s = Math.round((old.x + old.u + old.c + old.d) * 1000) / 1000;
      if (s !== q) throw new StockError(`Αντικατάσταση ${q}: τα παλιά (πετάχτηκαν + μεταχειρισμένα + κατεστραμμένα + προς έλεγχο) πρέπει να είναι συνολικά ${q}, δηλώθηκαν ${s}.`);
    }
    return { purpose, old: purpose === 'repl' ? old : { x: 0, u: 0, c: 0, d: 0 } };
  }

  // παλιά που επιστρέφουν (μεταχειρισμένα / κατεστραμμένα / προς έλεγχο) → προορισμός της γραμμής ή της κίνησης
  function sendOld(op, l, lo, i, plId, add, needWh, fallback) {
    const back = { U: lo.old.u, D: lo.old.d, C: lo.old.c };
    if (!(back.U || back.D || back.C)) return null;
    const dest = (l.oldDest && l.oldDest.t) ? l.oldDest : (op.oldDest && op.oldDest.t) ? op.oldDest : fallback;
    if (dest.t === 'X') throw new StockError('Ορίστε πού πάνε τα παλιά που επιστρέφουν.');
    if (dest.t === 'W') {
      needWh(dest.wh);
      for (const st of ['U', 'D', 'C']) if (back[st]) add(l.p, `W|${dest.wh}|${dest.sec || DEF_SEC}|${st}`, back[st]);
    } else if (dest.t === 'V' && op.veh) {
      for (const st of ['U', 'D', 'C']) if (back[st]) add(l.p, `V|${op.veh}|OLD${st}:${plId}|${i}`, back[st]);
    } else throw new StockError('Μη έγκυρος προορισμός για τα παλιά.');
    return dest;
  }
  class StockError extends Error {}
  // παλιά που ήταν καταχωρισμένα ως εγκατεστημένα στο ίδιο γυμναστήριο: αφαιρούνται από τα εγκατεστημένα
  function takeOldInstalled(op, l, lo, add, plDoc, fail) {
    const fi = Array.isArray(l.fromInst) ? l.fromInst : [];
    if (!fi.length) return 0;
    if (lo.purpose !== 'repl') fail('Αφαίρεση παλιών από εγκατεστημένα γίνεται μόνο σε αντικατάσταση.');
    let tot = 0;
    for (const x of fi) {
      const q = Number(x.q); if (!(q > 0)) continue;
      const src = plDoc(x.pl); const sl = src && src.lines[x.li];
      if (!sl || src.gym !== op.gym || sl.p !== l.p) fail('Μη έγκυρη αναφορά σε εγκατεστημένα παλιά.');
      add(l.p, `G|${op.gym}|${x.pl}|${x.li}`, -q);
      sl.replaced = (sl.replaced || 0) + q; tot += q;
    }
    if (tot > lo.old.x + lo.old.u + lo.old.c + lo.old.d + 1e-9) fail('Τα παλιά που αφαιρούνται από τα εγκατεστημένα είναι περισσότερα από τα παλιά που δηλώθηκαν.');
    return tot;
  }
  const fail = m => { throw new StockError(m); };
  const posInt = (x, what) => {
    const n = Number(x);
    if (!isFinite(n) || n <= 0) fail(`Μη έγκυρη ποσότητα${what ? ' για ' + what : ''}.`);
    return Math.round(n * 1000) / 1000;
  };
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ctx: { bal:{pid:{v,q}}, pk:{id:doc}, pl:{id:doc}, wh:{id}, gym:{id}, veh:{id},
            prod:{id}, counters:{}, user, now }  — το ctx μεταλλάσσεται μόνο σε αντίγραφα */
  function plan(op, ctx) {
    const deltas = [];
    const docs = {};           // path -> νέο πλήρες περιεχόμενο
    const counters = clone(ctx.counters || {});
    const next = kind => (counters[kind] = (counters[kind] || 0) + 1);
    const add = (p, k, d) => { if (d) deltas.push({ p, k, d }); };
    const pname = p => (ctx.prod[p] && ctx.prod[p].name) || p;
    const needWh = id => ctx.wh[id] || fail('Δεν βρέθηκε η αποθήκη.');
    const needVeh = id => ctx.veh[id] || fail('Δεν βρέθηκε το όχημα.');
    const needGym = id => ctx.gym[id] || fail('Δεν βρέθηκε το γυμναστήριο.');
    const needProd = p => ctx.prod[p] || fail('Άγνωστο προϊόν.');
    const pkDoc = id => docs['pk/' + id] || (ctx.pk[id] && (docs['pk/' + id] = clone(ctx.pk[id])));
    const plDoc = id => docs['pl/' + id] || (ctx.pl[id] && (docs['pl/' + id] = clone(ctx.pl[id])));
    // ρετάλια: ένα έγγραφο ανά κομμάτι (rem/<id>) με θέση, διάσταση και κατάσταση
    const remDoc = id => docs['rem/' + id] || ((ctx.rem || {})[id] && (docs['rem/' + id] = clone(ctx.rem[id])));
    const needRem = id => { const r = remDoc(id); if (!r) fail('Δεν βρέθηκε το ρετάλι.'); if (r.status !== 'stock') fail(`Το ρετάλι ${r.dims || ''} δεν είναι πλέον διαθέσιμο (${r.status === 'used' ? 'χρησιμοποιήθηκε' : 'αποσύρθηκε'}).`); return r; };
    const locOf = l => l.t === 'W' ? { t: 'W', id: l.wh } : l.t === 'V' ? { t: 'V', id: l.veh } : null;
    const noLines = ['PROCESS', 'REM_MOVE', 'REM_RETIRE', 'INV'];
    if ((!op.lines || !op.lines.length) && !noLines.includes(op.type) && !(op.rems && op.rems.length)) fail('Δεν έχει επιλεγεί κανένα προϊόν.');
    op.lines = op.lines || [];
    const T = TYPES[op.type] || fail('Άγνωστος τύπος κίνησης.');
    const movNo = next('MOV');
    const mov = { type: op.type, no: movNo, ts: ctx.now, by: ctx.user, lines: [], refs: {}, note: op.note || '' };
    let docNo;

    switch (op.type) {
      case 'IMP': {
        const w = needWh(op.wh); if (w.active === false) fail('Η αποθήκη είναι ανενεργή.');
        docNo = next('IMP');
        mov.from = { t: 'EXT', name: op.source || 'Εξωτερική προέλευση' };
        mov.to = { t: 'W', id: op.wh };
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.W(op.wh, l.sec, 'N'), q);
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, toSt: 'N' });
        }
        break;
      }
      case 'LOAD': {
        needWh(op.wh); needVeh(op.veh);
        const n = next('PK'); docNo = n;
        const pkId = op.id;
        const pk = { no: n, ts: ctx.now, by: ctx.user, wh: op.wh, veh: op.veh, mov: op.id, lines: [] };
        op.lines.forEach((l, i) => {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.W(op.wh, l.sec, 'N'), -q);
          add(l.p, K.V(op.veh, pkId, i), q);
          pk.lines.push({ p: l.p, sec: l.sec || DEF_SEC, qty: q, placed: 0, back: 0, returned: 0, toWh: 0 });
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, li: i });
        });
        (op.rems || []).forEach(rid => { const r = needRem(rid);
          if (r.loc.t !== 'W' || r.loc.wh !== op.wh) fail(`Το ρετάλι ${r.dims} δεν βρίσκεται στην αποθήκη φόρτωσης.`);
          const from = Object.assign({}, r.loc); r.loc = { t: 'V', veh: op.veh, pk: pkId }; r.moves = (r.moves || 0) + 1;
          (pk.rems = pk.rems || []).push({ rem: rid, p: r.p, dims: r.dims, sec: from.sec || DEF_SEC });
          mov.lines.push({ p: r.p, qty: 1, rem: rid, dims: r.dims, sec: from.sec || DEF_SEC }); });
        docs['pk/' + pkId] = pk;
        mov.from = { t: 'W', id: op.wh }; mov.to = { t: 'V', id: op.veh }; mov.refs.pk = pkId;
        break;
      }
      case 'PLACE': {
        needVeh(op.veh); needGym(op.gym);
        const n = next('PL'); docNo = n; const plId = op.id;
        const pl = { no: n, ts: ctx.now, by: ctx.user, gym: op.gym, veh: op.veh, src: 'veh', mov: op.id, purpose: 'new', reason: op.note || '', lines: [] };
        const pks = new Set();
        op.lines.forEach((l, i) => {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.V(op.veh, l.pk, l.li), -q);
          add(l.p, K.G(op.gym, plId, i), q);
          const pk = pkDoc(l.pk);
          if (pk && pk.lines[l.li]) { pk.lines[l.li].placed += q; pks.add(l.pk); }
          const lo = lineOld(op, l);
          // παλιά που επιστρέφουν: μπαίνουν στο αμάξι με την κατάστασή τους, συνδεδεμένα με αυτή την τοποθέτηση
          const oDest = sendOld(op, l, lo, i, plId, add, needWh, { t: 'V' });
          const problem = lo.purpose === 'repl' ? String(l.problem || '').slice(0, 300) : '';
          const oldInst = takeOldInstalled(op, l, lo, add, plDoc, fail);
          pl.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li, back: 0, purpose: lo.purpose, old: lo.old, problem, oldInst, oldDest: oDest || undefined });
          mov.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li, purpose: lo.purpose, old: lo.old, problem, oldInst, fromInst: l.fromInst || undefined, oldDest: oDest || undefined });
        });
        if (pl.lines.some(x => x.purpose === 'repl')) pl.purpose = pl.lines.every(x => x.purpose === 'repl') ? 'repl' : 'mixed';
        if (op.oldDest) pl.oldDest = op.oldDest;
        docs['pl/' + plId] = pl;
        mov.from = { t: 'V', id: op.veh }; mov.to = { t: 'G', id: op.gym };
        mov.refs.pl = plId; mov.refs.pks = [...pks]; mov.purpose = pl.purpose; if (op.oldDest) mov.oldDest = op.oldDest;
        break;
      }
      case 'INSTALL': {
        const w = needWh(op.wh); needGym(op.gym);
        if (w.gym !== op.gym) fail('Η εγκατάσταση από αποθήκη γίνεται μόνο στο γυμναστήριο της αποθήκης.');
        const n = next('PL'); docNo = n; const plId = op.id;
        const pl = { no: n, ts: ctx.now, by: ctx.user, gym: op.gym, veh: null, src: 'gwh', wh: op.wh, mov: op.id, purpose: 'new', reason: op.note || '', lines: [] };
        op.lines.forEach((l, i) => {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.W(op.wh, l.sec, 'N'), -q);
          add(l.p, K.G(op.gym, plId, i), q);
          const lo = lineOld(op, l);
          // παλιά που επιστρέφουν: απευθείας στην αποθήκη του γυμναστηρίου με την κατάστασή τους
          const oDest = sendOld(Object.assign({}, op, { veh: null }), l, lo, i, plId, add, needWh, { t: 'W', wh: op.wh, sec: l.sec });
          const problem = lo.purpose === 'repl' ? String(l.problem || '').slice(0, 300) : '';
          const oldInst = takeOldInstalled(op, l, lo, add, plDoc, fail);
          pl.lines.push({ p: l.p, qty: q, pk: null, li: null, sec: l.sec || DEF_SEC, back: 0, purpose: lo.purpose, old: lo.old, problem, oldInst, oldDest: oDest || undefined });
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, purpose: lo.purpose, old: lo.old, problem, oldInst, fromInst: l.fromInst || undefined, oldDest: oDest || undefined });
        });
        if (pl.lines.some(x => x.purpose === 'repl')) pl.purpose = pl.lines.every(x => x.purpose === 'repl') ? 'repl' : 'mixed';
        docs['pl/' + plId] = pl;
        mov.from = { t: 'W', id: op.wh }; mov.to = { t: 'G', id: op.gym }; mov.refs.pl = plId; mov.purpose = pl.purpose; mov.oldDest = op.oldDest || { t: 'W', wh: op.wh, sec: null }; pl.oldDest = mov.oldDest;
        break;
      }
      case 'UNPLACE': {
        const pl = plDoc(op.pl) || fail('Δεν βρέθηκε η λίστα τοποθέτησης.');
        if (pl.src === 'sup') fail('Τα προϊόντα αυτής της λίστας ήρθαν κατευθείαν από προμηθευτή. Χρησιμοποιήστε «Μεταφορά από γυμναστήριο» για να τα πάτε σε αποθήκη ή σε άλλο γυμναστήριο.');
        if (pl.src === 'gym') fail('Τα προϊόντα αυτής της λίστας ήρθαν από άλλο γυμναστήριο. Χρησιμοποιήστε «Μεταφορά από γυμναστήριο» για να τα πάτε σε αποθήκη ή σε άλλο γυμναστήριο.');
        docNo = next('UNPLACE');
        const toVeh = pl.src === 'veh';
        const veh = toVeh ? (op.veh || pl.veh) : null;
        if (toVeh) needVeh(veh);
        const pks = new Set();
        for (const l of op.lines) {
          const pll = pl.lines[l.li] || fail('Άγνωστη γραμμή τοποθέτησης.');
          const q = posInt(l.qty, pname(pll.p));
          add(pll.p, K.G(pl.gym, op.pl, l.li), -q);
          if (toVeh) {
            const pkId = pll.pk;
            add(pll.p, K.V(veh, pkId, pll.li), q);
            const pk = pkDoc(pkId);
            if (pk && pk.lines[pll.li]) { pk.lines[pll.li].back += q; pks.add(pkId); }
          } else {
            add(pll.p, K.W(pl.wh, pll.sec, 'N'), q);
          }
          pll.back += q;
          mov.lines.push({ p: pll.p, qty: q, pl: op.pl, pli: l.li, pk: pll.pk, li: pll.li });
        }
        mov.from = { t: 'G', id: pl.gym };
        mov.to = toVeh ? { t: 'V', id: veh } : { t: 'W', id: pl.wh };
        mov.refs.pl = op.pl; mov.refs.pks = [...pks];
        break;
      }
      case 'RETURN': {
        needVeh(op.veh); docNo = next('RETURN');
        const pks = new Set(); const whs = new Set();
        for (const l of op.lines) {
          needProd(l.p); needWh(l.wh);
          const parts = { N: Number(l.N) || 0, U: Number(l.U) || 0, D: Number(l.D) || 0, C: Number(l.C) || 0 };
          if (STS.some(s => parts[s] < 0)) fail('Οι ποσότητες δεν μπορεί να είναι αρνητικές.');
          const q = parts.N + parts.U + parts.D + parts.C;
          if (q <= 0) continue;
          add(l.p, K.V(op.veh, l.pk, l.li), -q);
          for (const st of STS) add(l.p, K.W(l.wh, l.sec, st), parts[st]);
          const pk = pkDoc(l.pk);
          if (pk && pk.lines[l.li]) { pk.lines[l.li].returned += q; pks.add(l.pk); }
          whs.add(l.wh);
          mov.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li, wh: l.wh, sec: l.sec || DEF_SEC, N: parts.N, U: parts.U, D: parts.D, C: parts.C });
        }
        if (!mov.lines.length) fail('Δεν δηλώθηκε ποσότητα επιστροφής.');
        mov.from = { t: 'V', id: op.veh };
        mov.to = whs.size === 1 ? { t: 'W', id: [...whs][0] } : { t: 'W', id: [...whs][0], multi: true };
        mov.refs.pks = [...pks];
        break;
      }
      case 'TOGWH': {
        needVeh(op.veh); const w = needWh(op.wh);
        if (!w.gym) fail('Η αποθήκη προορισμού δεν είναι συνδεδεμένη με γυμναστήριο.');
        docNo = next('TOGWH'); const pks = new Set();
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.V(op.veh, l.pk, l.li), -q);
          add(l.p, K.W(op.wh, op.sec, 'N'), q);
          const pk = pkDoc(l.pk);
          if (pk && pk.lines[l.li]) { pk.lines[l.li].toWh += q; pks.add(l.pk); }
          mov.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li, sec: op.sec || DEF_SEC });
        }
        mov.from = { t: 'V', id: op.veh }; mov.to = { t: 'W', id: op.wh, gym: w.gym };
        mov.refs.pks = [...pks];
        break;
      }
      case 'VMOVE': {
        needVeh(op.veh); const tv = needVeh(op.toVeh);
        if (tv.active === false) fail('Το όχημα προορισμού είναι ανενεργό.');
        if (op.veh === op.toVeh) fail('Ίδιο όχημα προέλευσης και προορισμού.');
        docNo = next('VMOVE'); const pks = new Set();
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.V(op.veh, l.pk, l.li), -q);
          add(l.p, K.V(op.toVeh, l.pk, l.li), q);
          if (ctx.pk[l.pk]) pks.add(l.pk);
          mov.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li });
        }
        mov.from = { t: 'V', id: op.veh }; mov.to = { t: 'V', id: op.toVeh }; mov.refs.pks = [...pks];
        break;
      }
      case 'SUPPLY': {
        needGym(op.gym); const n = next('PL'); docNo = n; const plId = op.id; const sup = String(op.supplier || '').trim() || 'Προμηθευτής';
        const pl = { no: n, ts: ctx.now, by: ctx.user, gym: op.gym, veh: null, src: 'sup', supplier: sup, mov: op.id, purpose: 'new', reason: op.note || '', lines: [] };
        op.lines.forEach((l, i) => {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.G(op.gym, plId, i), q);
          const lo = lineOld(op, l);
          const oDest = sendOld(Object.assign({}, op, { veh: null }), l, lo, i, plId, add, needWh, { t: 'X' });
          const problem = lo.purpose === 'repl' ? String(l.problem || '').slice(0, 300) : '';
          const oldInst = takeOldInstalled(op, l, lo, add, plDoc, fail);
          pl.lines.push({ p: l.p, qty: q, pk: null, li: null, back: 0, purpose: lo.purpose, old: lo.old, problem, oldInst, oldDest: oDest || undefined });
          mov.lines.push({ p: l.p, qty: q, purpose: lo.purpose, old: lo.old, problem, oldInst, fromInst: l.fromInst || undefined, oldDest: oDest || undefined });
        });
        if (pl.lines.some(x => x.purpose === 'repl')) pl.purpose = pl.lines.every(x => x.purpose === 'repl') ? 'repl' : 'mixed';
        docs['pl/' + plId] = pl;
        mov.from = { t: 'EXT', name: sup }; mov.to = { t: 'G', id: op.gym }; mov.refs.pl = plId; mov.purpose = pl.purpose; mov.supplier = sup;
        break;
      }
      case 'GYM_MOVE': {
        needGym(op.gym); const to = op.to || fail('Λείπει ο προορισμός.'); const cond = op.cond === 'U' ? 'U' : 'N';
        docNo = next('GYM_MOVE'); const pls = new Set(); let newPl = null;
        if (to.t === 'G') { const tg = needGym(to.gym); if (to.gym === op.gym) fail('Ίδιο γυμναστήριο προέλευσης και προορισμού.'); if (tg.active === false) fail('Το γυμναστήριο προορισμού είναι ανενεργό.');
          const n = next('PL'); newPl = { no: n, ts: ctx.now, by: ctx.user, gym: to.gym, veh: null, src: 'gym', fromGym: op.gym, cond, mov: op.id, purpose: 'moved', reason: op.note || '', lines: [], docNo: 'ΤΟΠ-' + pad(n) }; }
        else if (to.t === 'W') { const w = needWh(to.wh); if (w.active === false) fail('Η αποθήκη προορισμού είναι ανενεργή.'); }
        else fail('Μη έγκυρος προορισμός.');
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          const src = plDoc(l.pl); if (!src || src.gym !== op.gym || !src.lines[l.li] || src.lines[l.li].p !== l.p) fail('Μη έγκυρη γραμμή εγκατάστασης.');
          add(l.p, K.G(op.gym, l.pl, l.li), -q); src.lines[l.li].moved = (src.lines[l.li].moved || 0) + q; pls.add(l.pl);
          if (newPl) { const i = newPl.lines.length; add(l.p, K.G(to.gym, op.id, i), q); newPl.lines.push({ p: l.p, qty: q, pk: null, li: null, back: 0, purpose: 'moved', cond, fromPl: l.pl }); }
          else add(l.p, K.W(to.wh, to.sec, cond), q);
          mov.lines.push({ p: l.p, qty: q, pl: l.pl, li: l.li, cond, sec: to.sec || undefined });
        }
        if (newPl) { docs['pl/' + op.id] = newPl; mov.refs.pl = op.id; }
        mov.from = { t: 'G', id: op.gym }; mov.to = to.t === 'G' ? { t: 'G', id: to.gym } : { t: 'W', id: to.wh }; mov.refs.pls = [...pls]; mov.cond = cond; if (to.sec) mov.toSec = to.sec;
        break;
      }
      case 'PROCESS': {
        const s = op.src || fail('Λείπει η προέλευση.'); docNo = next('PROCESS'); let p, from, srcVeh = null, srcPk = null;
        if (s.t === 'R') { const r = needRem(s.rem); p = r.p; r.status = 'used'; r.usedMov = op.id; r.usedTs = ctx.now; r.usedFor = String(op.purpose || '').slice(0, 300);
          from = locOf(r.loc); if (r.loc.t === 'V') { srcVeh = r.loc.veh; srcPk = r.loc.pk || null; }
          mov.lines.push({ p, qty: 1, rem: s.rem, dims: r.dims, src: 'rem' }); }
        else {
          p = op.p; needProd(p); const q = posInt(op.qty, pname(p));
          if (s.t === 'W') { needWh(s.wh); add(p, K.W(s.wh, s.sec, 'N'), -q); from = { t: 'W', id: s.wh }; mov.lines.push({ p, qty: q, sec: s.sec || DEF_SEC, src: 'full' }); }
          else if (s.t === 'V') { needVeh(s.veh); add(p, K.V(s.veh, s.pk, s.li), -q); from = { t: 'V', id: s.veh }; srcVeh = s.veh; srcPk = s.pk;
            const pk = pkDoc(s.pk); if (pk && pk.lines[s.li]) pk.lines[s.li].processed = (pk.lines[s.li].processed || 0) + q;
            mov.lines.push({ p, qty: q, pk: s.pk, li: s.li, src: 'full' }); }
          else fail('Μη έγκυρη προέλευση.');
        }
        const out = [];
        (op.out || []).forEach((o, k) => { const dims = String(o.dims || '').trim(); if (!dims) fail('Συμπληρώστε τη διάσταση κάθε ρεταλιού.');
          let loc;
          if (o.loc && o.loc.t === 'W') { needWh(o.loc.wh); loc = { t: 'W', wh: o.loc.wh, sec: o.loc.sec || DEF_SEC }; }
          else if (o.loc && o.loc.t === 'V') { if (!srcVeh && !o.loc.veh) fail('Ρετάλι στο αμάξι γίνεται μόνο όταν η επεξεργασία γίνεται από αμάξι.'); loc = { t: 'V', veh: o.loc.veh || srcVeh, pk: srcPk }; needVeh(loc.veh); }
          else fail('Ορίστε πού μπαίνει κάθε ρετάλι.');
          const rid = op.id + '_' + k; docs['rem/' + rid] = { p, dims, loc, status: 'stock', ts: ctx.now, by: ctx.user, mov: op.id, parent: s.t === 'R' ? s.rem : null, note: String(o.note || '').slice(0, 200) };
          out.push({ rem: rid, dims, loc }); });
        mov.lines[0].out = out; mov.purpose = String(op.purpose || '').slice(0, 300); mov.note = mov.note || mov.purpose;
        mov.from = from; mov.to = { t: 'OUT', name: 'Επεξεργασμένα' }; mov.refs.rems = out.map(o => o.rem).concat(s.t === 'R' ? [s.rem] : []);
        break;
      }
      case 'REM_MOVE': {
        if (!op.rems || !op.rems.length) fail('Δεν επιλέχθηκε ρετάλι.'); const to = op.to || fail('Λείπει ο προορισμός.'); docNo = next('REM_MOVE');
        let loc; if (to.t === 'W') { const w = needWh(to.wh); if (w.active === false) fail('Η αποθήκη προορισμού είναι ανενεργή.'); loc = { t: 'W', wh: to.wh, sec: to.sec || DEF_SEC }; }
        else if (to.t === 'V') { const v = needVeh(to.veh); if (v.active === false) fail('Το όχημα προορισμού είναι ανενεργό.'); loc = { t: 'V', veh: to.veh, pk: null }; } else fail('Μη έγκυρος προορισμός.');
        let from = null;
        op.rems.forEach(rid => { const r = needRem(rid); from = from || locOf(r.loc); mov.lines.push({ p: r.p, qty: 1, rem: rid, dims: r.dims, fromLoc: Object.assign({}, r.loc) }); r.loc = Object.assign({}, loc, loc.t === 'V' && r.loc.t === 'V' ? { pk: r.loc.pk } : {}); r.moves = (r.moves || 0) + 1; });
        mov.from = from; mov.to = locOf(loc); mov.refs.rems = op.rems.slice();
        break;
      }
      case 'REM_RETIRE': {
        if (!op.rems || !op.rems.length) fail('Δεν επιλέχθηκε ρετάλι.'); docNo = next('RETIRE'); let from = null;
        op.rems.forEach(rid => { const r = needRem(rid); from = from || locOf(r.loc); r.status = 'retired'; r.retiredMov = op.id; r.retiredTs = ctx.now; mov.lines.push({ p: r.p, qty: 1, rem: rid, dims: r.dims, fromLoc: Object.assign({}, r.loc) }); });
        mov.from = from; mov.to = { t: 'OUT', name: 'Απόσυρση' }; mov.refs.rems = op.rems.slice();
        break;
      }
      case 'TRANSFER': {
        needWh(op.wh); const tw = needWh(op.toWh); if (tw.active === false) fail('Η αποθήκη προορισμού είναι ανενεργή.');
        docNo = next('TRANSFER');
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p)); const st = l.st || 'N';
          if (op.wh === op.toWh && (l.sec || DEF_SEC) === (l.toSec || DEF_SEC)) fail('Ίδια αποθήκη και τμήμα προέλευσης και προορισμού.');
          add(l.p, K.W(op.wh, l.sec, st), -q);
          add(l.p, K.W(op.toWh, l.toSec, st), q);
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, toSec: l.toSec || DEF_SEC, st });
        }
        mov.from = { t: 'W', id: op.wh }; mov.to = { t: 'W', id: op.toWh };
        break;
      }
      case 'STATUS': {
        needWh(op.wh); docNo = next('STATUS');
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          if (!ST[l.from] || !ST[l.to] || l.from === l.to) fail('Μη έγκυρη αλλαγή κατάστασης.');
          add(l.p, K.W(op.wh, l.sec, l.from), -q);
          add(l.p, K.W(op.wh, l.sec, l.to), q);
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, fromSt: l.from, toSt: l.to });
        }
        mov.from = { t: 'W', id: op.wh }; mov.to = { t: 'W', id: op.wh };
        break;
      }
      case 'RETIRE': {
        needWh(op.wh); docNo = next('RETIRE');
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.W(op.wh, l.sec, l.st || 'D'), -q);
          mov.lines.push({ p: l.p, qty: q, sec: l.sec || DEF_SEC, st: l.st || 'D' });
        }
        mov.from = { t: 'W', id: op.wh }; mov.to = { t: 'OUT', name: 'Απόσυρση' };
        break;
      }
      case 'RETIRE_V': {
        needVeh(op.veh); docNo = next('RETIRE'); const pks = new Set();
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.V(op.veh, l.pk, l.li), -q);
          const pk = pkDoc(l.pk);
          if (pk && pk.lines[l.li]) { pk.lines[l.li].retired = (pk.lines[l.li].retired || 0) + q; pks.add(l.pk); }
          mov.lines.push({ p: l.p, qty: q, pk: l.pk, li: l.li });
        }
        mov.from = { t: 'V', id: op.veh }; mov.to = { t: 'OUT', name: 'Απόσυρση' }; mov.refs.pks = [...pks];
        break;
      }
      case 'RETIRE_G': {
        needGym(op.gym); docNo = next('RETIRE'); const pls = new Set();
        for (const l of op.lines) {
          needProd(l.p); const q = posInt(l.qty, pname(l.p));
          add(l.p, K.G(op.gym, l.pl, l.li), -q);
          const pl = plDoc(l.pl);
          if (pl && pl.lines[l.li]) { pl.lines[l.li].retired = (pl.lines[l.li].retired || 0) + q; pls.add(l.pl); }
          mov.lines.push({ p: l.p, qty: q, pl: l.pl, li: l.li });
        }
        mov.from = { t: 'G', id: op.gym }; mov.to = { t: 'OUT', name: 'Απόσυρση' }; mov.refs.pls = [...pls];
        break;
      }
      case 'INV': {
        const inv = op.inv || fail('Λείπει η απογραφή.');
        docNo = next('INV');
        const isVeh = inv.scope.t === 'V';
        if (isVeh) needVeh(inv.scope.id); else needWh(inv.scope.id);
        for (const r of inv.rows) {
          const cur = ctx.bal[r.p] ? ctx.bal[r.p].q : {};
          if (isVeh) {
            const pref = `V|${inv.scope.id}|`;
            const lots = Object.entries(cur).filter(([k, v]) => k.startsWith(pref) && v > 0);
            const sys = lots.reduce((s, [, v]) => s + v, 0);
            if (Math.abs(sys - (r.sys.N || 0)) > 1e-9) fail(`Η απογραφή είναι παρωχημένη: το υπόλοιπο του «${pname(r.p)}» άλλαξε από άλλη κίνηση. Ανανεώστε τις ποσότητες συστήματος.`);
            const cnt = r.cnt && r.cnt.N != null && r.cnt.N !== '' ? Number(r.cnt.N) : null;
            if (cnt == null) continue;
            if (cnt < 0) fail('Αρνητική καταμέτρηση.');
            let diff = cnt - sys;
            if (!diff) continue;
            if (diff > 0) add(r.p, K.V(inv.scope.id, 'ADJ', r.p), diff);
            else {
              let left = -diff;
              lots.sort((a, b) => (a[0] < b[0] ? 1 : -1));
              for (const [k, v] of lots) { const t = Math.min(v, left); add(r.p, k, -t); left -= t; if (!left) break; }
            }
            mov.lines.push({ p: r.p, qty: Math.abs(diff), diff, sysN: sys, cntN: cnt });
          } else {
            const line = { p: r.p, sec: r.sec, diffs: {} };
            let any = false;
            for (const st of STS) {
              const k = K.W(inv.scope.id, r.sec, st);
              const now = cur[k] || 0;
              if (Math.abs(now - (r.sys[st] || 0)) > 1e-9) fail(`Η απογραφή είναι παρωχημένη: το υπόλοιπο του «${pname(r.p)}» άλλαξε από άλλη κίνηση. Ανανεώστε τις ποσότητες συστήματος.`);
              const c = r.cnt ? r.cnt[st] : null;
              if (c == null || c === '') continue;
              if (Number(c) < 0) fail('Αρνητική καταμέτρηση.');
              const d = Number(c) - now;
              if (d) { add(r.p, k, d); line.diffs[st] = { sys: now, cnt: Number(c), d }; any = true; }
            }
            if (any) { line.qty = Object.values(line.diffs).reduce((s, x) => s + Math.abs(x.d), 0); mov.lines.push(line); }
          }
        }
        docs['inv/' + op.invId] = Object.assign(clone(inv), { status: 'done', doneTs: ctx.now, doneBy: ctx.user, mov: op.id });
        mov.from = { t: isVeh ? 'V' : 'W', id: inv.scope.id }; mov.to = mov.from;
        mov.refs.inv = op.invId;
        break;
      }
    }

    // εφαρμογή & έλεγχος υπολοίπων
    const newBal = {};
    for (const { p, k, d } of deltas) {
      const b = newBal[p] || (newBal[p] = clone(ctx.bal[p] || { v: 0, q: {} }));
      b.q[k] = Math.round(((b.q[k] || 0) + d) * 1000) / 1000;
    }
    for (const [p, b] of Object.entries(newBal)) {
      for (const [k, v] of Object.entries(b.q)) {
        if (v < 0) {
          const before = ctx.bal[p] ? (ctx.bal[p].q[k] || 0) : 0;
          fail(`Ανεπαρκές υπόλοιπο για «${pname(p)}»: διαθέσιμα ${before}, ζητήθηκαν ${Math.round((before - v) * 1000) / 1000}.`);
        }
        if (v === 0) delete b.q[k];
      }
      b.v = (b.v || 0) + 1;
    }
    mov.docNo = `${T.pre}-${pad(docNo)}`;
    if (op.type === 'LOAD') docs['pk/' + op.id].docNo = mov.docNo;
    if (op.type === 'PLACE' || op.type === 'INSTALL' || op.type === 'SUPPLY') docs['pl/' + op.id].docNo = mov.docNo;
    docs['cfg/counters'] = counters;
    return { mov, newBal, docs, deltas };
  }

  /* -------- βοηθητικά ανάγνωσης -------- */
  function totals(q) { // ανά προϊόν
    const t = { W: 0, WN: 0, WU: 0, WD: 0, WC: 0, V: 0, G: 0 };
    for (const [k, v] of Object.entries(q || {})) {
      const { t: ty, c } = K.parse(k);
      if (ty === 'W') { t.W += v; t['W' + (k.split('|')[3])] += v; }
      else t[ty] += v;
    }
    return t;
  }
  function pkRemaining(pkId, allBal) { // ανά γραμμή → υπόλοιπο στο αμάξι (σε οποιοδήποτε όχημα)
    const out = {};
    for (const [p, b] of Object.entries(allBal)) {
      for (const [k, v] of Object.entries(b.q || {})) {
        if (k[0] !== 'V') continue; const x = K.parse(k);
        if (x.b === pkId) out[x.c] = (out[x.c] || 0) + v;
      }
    }
    return out;
  }
  function plInstalled(pl, plId, allBal) {
    const out = {};
    pl.lines.forEach((l, i) => { const b = allBal[l.p]; out[i] = b ? (b.q[K.G(pl.gym, plId, i)] || 0) : 0; });
    return out;
  }
  return { ST, STS, K, TYPES, DEF_SEC, plan, totals, pkRemaining, plInstalled, StockError, pad };
})();
if (typeof module !== 'undefined') module.exports = ENG;

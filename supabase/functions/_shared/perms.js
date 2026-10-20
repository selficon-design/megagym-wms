// ΠΑΡΑΓΕΤΑΙ ΑΥΤΟΜΑΤΑ από web/src/core.js (npm run build) — μην το αλλάζετε με το χέρι.
// Έλεγχος δικαιωμάτων κινήσεων στον server (ίδιοι κανόνες με την εφαρμογή).
export const PERMS = {
  admin: ['*'],
  manager: ['move', 'transfer', 'status', 'retire', 'inv_edit', 'inv_apply', 'return_other', 'product', 'catalog', 'setup', 'notes', 'notes_admin'],
  employee: ['move', 'inv_edit', 'product_create', 'notes'],
  viewer: [],
};
export function canFor(me, action, wh) {
  if (!me || !me.id) return false;
  const r = me.role; const ps = PERMS[r] || [];
  const ok = ps.includes('*') || ps.includes(action) || (action === 'product_create' && ps.includes('product'));
  if (!ok) return false;
  if (wh && r !== 'admin' && me.whs && me.whs.length && !me.whs.includes(wh)) return false;
  return true;
}
export function opPermError(op, me, ctx) {
  const S = { me, pk: ctx.pk || {} };
  const whName = id => (ctx.wh && ctx.wh[id] && ctx.wh[id].name) || id || '';
  const can = (action, wh) => canFor(me, action, wh);
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

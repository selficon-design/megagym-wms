// Εκτέλεση κινήσεων αποθέματος στον server: μία κίνηση = μία συναλλαγή PostgreSQL.
// • κλείδωμα (pg_advisory_xact_lock) ώστε δύο κινήσεις να μη «συγκρούονται»
// • έλεγχος δικαιωμάτων με τους ίδιους κανόνες με την εφαρμογή
// • ο μηχανισμός (engine.js) ελέγχει υπόλοιπα — ποτέ αρνητικό απόθεμα
// • κάθε κίνηση γράφεται μία φορά (το id της είναι μοναδικό)
import ENG from './engine.js';
import { opPermError } from './perms.js';

const LOCK_KEY = 74210931; // σταθερό κλειδί κλειδώματος για όλες τις κινήσεις αποθέματος

export class OpError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const splitPath = p => { const i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };

export async function getDoc(sql, path) {
  const r = await sql`select data from public.docs where path = ${path}`;
  return r.length ? r[0].data : null;
}
async function getColl(sql, coll) {
  const out = {}; for (const r of await sql`select id, data from public.docs where coll = ${coll}`) out[r.id] = r.data; return out;
}
async function getMany(sql, coll, ids) {
  const out = {}; const list = [...new Set(ids)].filter(Boolean); if (!list.length) return out;
  for (const r of await sql`select id, data from public.docs where coll = ${coll} and id = any(${list})`) out[r.id] = r.data;
  return out;
}
export async function putDoc(sql, path, data) {
  const [coll, id] = splitPath(path);
  await sql`insert into public.docs (path, coll, id, data) values (${path}, ${coll}, ${id}, ${sql.json(data)})
            on conflict (path) do update set data = excluded.data`;
}

// Ποιος είναι ο χρήστης: ρόλος, περιορισμός αποθηκών, κάτοχος
export async function loadMe(sql, uid) {
  const owner = await getDoc(sql, 'cfg/owner');
  const role = await getDoc(sql, 'roles/' + uid);
  const isOwner = !!(owner && owner.uid === uid);
  return { id: uid, isOwner, role: isOwner ? 'admin' : (role && role.role) || 'viewer', whs: isOwner ? [] : (role && role.whs) || [] };
}

export async function runOp(sql, uid, op) {
  if (!op || typeof op !== 'object' || !op.type || !op.id) throw new OpError('Μη έγκυρη κίνηση.');
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(String(op.id))) throw new OpError('Μη έγκυρο αναγνωριστικό κίνησης.');
  if (!ENG.TYPES[op.type]) throw new OpError('Άγνωστος τύπος κίνησης.');
  return await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
    if (await getDoc(tx, 'mov/' + op.id)) throw new OpError('Η κίνηση έχει ήδη καταχωριστεί. Δεν επιτρέπεται διπλή εκτέλεση.', 409);
    const me = await loadMe(tx, uid);
    // ό,τι χρειάζεται ο μηχανισμός — φρέσκια ανάγνωση μέσα στη συναλλαγή
    const lines = op.lines || [];
    const plIds = [op.pl, ...lines.map(l => l.pl), ...lines.flatMap(l => (l.fromInst || []).map(x => x.pl))];
    const pl = await getMany(tx, 'pl', plIds);
    const pkIds = [...lines.map(l => l.pk), op.src && op.src.pk, ...Object.values(pl).flatMap(p => p.lines.map(l => l.pk))]
      .filter(k => k && k !== 'ADJ' && !String(k).startsWith('OLD'));
    const pk = await getMany(tx, 'pk', pkIds);
    const rem = await getMany(tx, 'rem', [...(op.rems || []), op.src && op.src.rem]);
    const pids = new Set([...lines.map(l => l.p), op.p, ...Object.values(pl).flatMap(p => p.lines.map(l => l.p)), ...Object.values(rem).map(r => r.p),
      ...((op.inv && op.inv.rows) || []).map(r => r.p)].filter(Boolean));
    const bal = await getMany(tx, 'bal', [...pids]);
    const ctx = { wh: await getColl(tx, 'wh'), gym: await getColl(tx, 'gyms'), veh: await getColl(tx, 'veh'), prod: await getColl(tx, 'prods'),
      user: uid, now: Date.now(), bal, pk, pl, rem, counters: (await getDoc(tx, 'cfg/counters')) || {} };
    const perr = opPermError(op, me, ctx); if (perr) throw new OpError(perr, 403);
    let r;
    try { r = ENG.plan(op, ctx); } catch (e) { throw new OpError(e.message || String(e)); }
    for (const [p, b] of Object.entries(r.newBal)) await putDoc(tx, 'bal/' + p, b);
    for (const [path, data] of Object.entries(r.docs)) await putDoc(tx, path, data);
    const mov = Object.assign({}, r.mov, { state: 'ok' });
    await putDoc(tx, 'mov/' + op.id, mov);
    return Object.assign({ id: op.id }, mov);
  });
}

// Καθαρισμός δοκιμαστικών κινήσεων (μόνο ο κάτοχος): μένουν κατάλογος, δομή, χρήστες, προσωπικές σημειώσεις
export async function resetTests(sql, uid, withNotes) {
  const me = await loadMe(sql, uid); if (!me.isOwner) throw new OpError('Μόνο ο κάτοχος της εφαρμογής μπορεί να κάνει καθαρισμό.', 403);
  return await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
    const colls = ['mov', 'pk', 'pl', 'inv', 'bal', 'rem', ...(withNotes ? ['notes'] : [])];
    const r = await tx`delete from public.docs where coll = any(${colls}) or path = 'cfg/counters'`;
    return { deleted: r.count };
  });
}

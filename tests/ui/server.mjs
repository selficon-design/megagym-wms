// Τοπικός διακομιστής ελέγχου: σερβίρει το dist/ και προσομοιώνει το Supabase
// πάνω σε πραγματικό PostgreSQL — με τους πραγματικούς κανόνες ασφαλείας (RLS)
// και τον πραγματικό κώδικα της function «execute».
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../pgsql.mjs';
import { runOp, resetTests, loadMe } from '../../supabase/functions/_shared/ops.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const sql = connect();
const PORT = Number(process.env.PORT || 8787);
const clients = new Set();
const push = ev => { const s = `data: ${JSON.stringify(ev)}\n\n`; clients.forEach(r => r.write(s)); };
const uidOk = u => /^[0-9a-f-]{36}$/.test(u || '');
let aiScript = []; // σενάριο απαντήσεων AI για τον έλεγχο
const aiLog = [];

async function asUser(uid, fn) {
  return sql.begin(async tx => { await tx.unsafe('set local role authenticated'); await tx`select set_config('request.jwt.claim.sub', ${uid}, true)`; return fn(tx); });
}
async function changedSince(t0) { return sql`select path, data from public.docs where updated_at >= ${t0}::timestamptz`; }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const body = req => new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => r(b)); });
const J = (res, o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

let queue = Promise.resolve();
http.createServer((req, res) => {
  const u0 = new URL(req.url, 'http://x');
  if (u0.pathname === '/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); res.write(': ok\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; }
  queue = queue.then(() => handle(req, res)).catch(e => console.error(e)); // ένα αίτημα τη φορά (μία σύνδεση psql)
}).listen(PORT, '127.0.0.1', () => console.log('READY', PORT));

async function handle(req, res) {
  const u = new URL(req.url, 'http://x'); const uid = req.headers['x-uid'];
  try {
    if (u.pathname === '/mock_supabase.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(readFileSync(join(root, 'tests/ui/mock_supabase.js'))); }
    if (u.pathname === '/__ai_script' && req.method === 'POST') { aiScript = JSON.parse(await body(req)); aiLog.length = 0; return J(res, { ok: true }); }
    if (u.pathname === '/__ai_log') return J(res, aiLog);
    if (u.pathname.startsWith('/db/')) {
      if (!uidOk(uid)) return J(res, { error: 'no auth' }, 401);
      const b = JSON.parse(await body(req) || '{}');
      if (u.pathname === '/db/select') {
        const rows = await asUser(uid, tx => {
          const f = Object.fromEntries(b.filters);
          if (f.path) return tx`select path, id, data from public.docs where path = ${f.path}`;
          return tx`select path, id, data from public.docs where coll = ${f.coll}`;
        });
        return J(res, rows);
      }
      const t0 = (await sql`select clock_timestamp()::text as ts`)[0].ts;
      try {
        if (u.pathname === '/db/upsert') {
          const r = b.row;
          await asUser(uid, tx => tx`insert into public.docs (path, coll, id, data) values (${r.path}, ${r.coll}, ${r.id}, ${tx.json(r.data)}) on conflict (path) do update set data = excluded.data`);
          (await changedSince(t0)).forEach(x => push({ ev: 'UPSERT', row: x }));
        } else if (u.pathname === '/db/delete') {
          const f = Object.fromEntries(b.filters);
          const old = await sql`select path, data from public.docs where path = ${f.path}`;
          const n = await asUser(uid, tx => tx`delete from public.docs where path = ${f.path}`);
          if (n.count) old.forEach(x => push({ ev: 'DELETE', row: { path: x.path } }));
        }
        return J(res, { error: null });
      } catch (e) { return J(res, { error: String(e.message).includes('row-level security') ? 'new row violates row-level security policy' : e.message }); }
    }
    const fm = u.pathname.match(/^\/functions\/v1\/(\w+)$/);
    if (fm) {
      if (!uidOk(uid)) return J(res, { error: 'Συνδεθείτε ξανά.' }, 401);
      const name = fm[1];
      if (name === 'execute') {
        const b = JSON.parse(await body(req));
        const t0 = (await sql`select clock_timestamp()::text as ts`)[0].ts;
        try {
          if (b.action === 'reset') { const r = await resetTests(sql, uid, !!b.withNotes); push({ ev: 'RESYNC' }); return J(res, r); }
          const mov = await runOp(sql, uid, b.op);
          (await changedSince(t0)).forEach(x => push({ ev: 'UPSERT', row: x }));
          return J(res, { mov });
        } catch (e) { return J(res, { error: e.message }, e.status || 500); }
      }
      if (name === 'admin') {
        const b = JSON.parse(await body(req)); const me = await loadMe(sql, uid);
        if (me.role !== 'admin') return J(res, { error: 'Μόνο ο Administrator διαχειρίζεται χρήστες.' }, 403);
        if (b.action === 'list') return J(res, { users: (await sql`select id::text as id, email from auth.users`).map(x => Object.assign(x, { banned: false })) });
        if (b.action === 'create') {
          if (String(b.password || '').length < 8) return J(res, { error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' }, 400);
          const id = (await sql`select gen_random_uuid()::text as id`)[0].id;
          await sql`insert into auth.users (id, email, raw_user_meta_data) values (${id}::uuid, ${b.email}, ${sql.json({ name: b.name })})`;
          await sql`insert into public.docs (path, coll, id, data) values (${'roles/' + id}, 'roles', ${id}, ${sql.json({ role: b.role, whs: b.whs || [] })}) on conflict (path) do update set data = excluded.data`;
          await sql`update public.docs set data = data || ${sql.json({ name: b.name })} where path = ${'members/' + id}`;
          push({ ev: 'RESYNC' }); return J(res, { id });
        }
        return J(res, { ok: true });
      }
      if (name === 'ai') {
        const b = JSON.parse(await body(req)); aiLog.push(b);
        const next = aiScript.shift() || { content: [{ type: 'text', text: 'Τέλος σεναρίου.' }], stop_reason: 'end_turn' };
        return J(res, next);
      }
      if (name === 'tts') return J(res, { error: 'Δεν έχει ρυθμιστεί το ElevenLabs.' }, 503);
      if (name === 'stt') { await body(req); return J(res, { text: 'Πόσα προϊόντα έχουμε;' }); }
      return J(res, { error: 'unknown' }, 404);
    }
    // στατικά αρχεία
    let p = u.pathname === '/' ? '/index.html' : u.pathname;
    if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(`window.MG_CONFIG={url:'http://127.0.0.1:${PORT}',anonKey:'anon'};`); }
    const f = join(root, 'dist', p);
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  } catch (e) { console.error(e); J(res, { error: e.message }, 500); }
}

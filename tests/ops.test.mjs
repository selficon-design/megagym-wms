// Έλεγχος του μηχανισμού κινήσεων του server σε πραγματικό PostgreSQL (τοπικά).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from './pgsql.mjs';
import { runOp, resetTests, OpError } from '../supabase/functions/_shared/ops.js';

const OWNER = '11111111-1111-1111-1111-111111111111', EMP = '22222222-2222-2222-2222-222222222222', VIEW = '33333333-3333-3333-3333-333333333333';
const sql = connect();
const uid = () => 't' + Math.random().toString(36).slice(2, 12);
const bal = async p => { const r = await sql`select data from public.docs where path = ${'bal/' + p}`; return r.length ? r[0].data.q : {}; };

test('προετοιμασία', async () => {
  await sql`delete from public.docs where coll in ('mov','bal','pk','pl','rem','inv') or path = 'cfg/counters'`;
  await sql`insert into public.docs (path, coll, id, data) values ('prods/pTST', 'prods', 'pTST', ${sql.json({ code: 'T', name: 'Δοκιμή', unit: 'τεμ' })}) on conflict (path) do nothing`;
});

test('εισαγωγή, φόρτωση, τοποθέτηση, αντικατάσταση, επιστροφή', async () => {
  const imp = await runOp(sql, OWNER, { type: 'IMP', id: uid(), wh: 'whC', lines: [{ p: 'pTST', sec: 'sGEN', qty: 10 }] });
  assert.match(imp.docNo, /^ΕΙΣ-/);
  const L = await runOp(sql, EMP, { type: 'LOAD', id: uid(), wh: 'whC', veh: 'v1', lines: [{ p: 'pTST', sec: 'sGEN', qty: 6 }] });
  const pk = L.refs.pk;
  const P = await runOp(sql, EMP, { type: 'PLACE', id: uid(), veh: 'v1', gym: 'gGLY', lines: [{ p: 'pTST', pk, li: 0, qty: 2, purpose: 'repl', old: { x: 1, d: 1 }, oldDest: { t: 'W', wh: 'whC', sec: 'sGEN' } }] });
  assert.match(P.docNo, /^ΤΟΠ-/);
  await runOp(sql, EMP, { type: 'RETURN', id: uid(), veh: 'v1', lines: [{ p: 'pTST', pk, li: 0, wh: 'whC', sec: 'sGEN', N: 4 }] });
  const q = await bal('pTST');
  assert.equal(q['W|whC|sGEN|N'], 8); assert.equal(q['W|whC|sGEN|D'], 1); assert.equal(q['G|gGLY|' + P.refs.pl + '|0'], 2);
});

test('δεν επιτρέπεται αρνητικό απόθεμα', async () => {
  await assert.rejects(runOp(sql, OWNER, { type: 'LOAD', id: uid(), wh: 'whC', veh: 'v1', lines: [{ p: 'pTST', sec: 'sGEN', qty: 999 }] }), /Ανεπαρκές υπόλοιπο/);
});

test('δεν επιτρέπεται διπλή εκτέλεση', async () => {
  const op = { type: 'IMP', id: uid(), wh: 'whC', lines: [{ p: 'pTST', sec: 'sGEN', qty: 1 }] };
  await runOp(sql, OWNER, op);
  await assert.rejects(runOp(sql, OWNER, op), /ήδη καταχωριστεί/);
});

test('δικαιώματα: viewer δεν κινεί, employee δεν αποσύρει', async () => {
  await assert.rejects(runOp(sql, VIEW, { type: 'IMP', id: uid(), wh: 'whC', lines: [{ p: 'pTST', sec: 'sGEN', qty: 1 }] }), e => e instanceof OpError && e.status === 403);
  await assert.rejects(runOp(sql, EMP, { type: 'RETIRE', id: uid(), wh: 'whC', lines: [{ p: 'pTST', sec: 'sGEN', st: 'D', qty: 1 }] }), /δικαίωμα/);
});

test('ταυτόχρονες κινήσεις: η μία μπλοκάρεται', async () => {
  const sql2 = connect();
  const have = (await bal('pTST'))['W|whC|sGEN|N'];
  const a = runOp(sql, OWNER, { type: 'LOAD', id: uid(), wh: 'whC', veh: 'v1', lines: [{ p: 'pTST', sec: 'sGEN', qty: have }] });
  const b = runOp(sql2, OWNER, { type: 'LOAD', id: uid(), wh: 'whC', veh: 'v1', lines: [{ p: 'pTST', sec: 'sGEN', qty: have }] });
  const res = await Promise.allSettled([a, b]);
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(res.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await bal('pTST'))['W|whC|sGEN|N'] || 0, 0);
  await sql2.end();
});

test('επεξεργασία υλικού με ρετάλι και χρήση ρεταλιού', async () => {
  await runOp(sql, OWNER, { type: 'IMP', id: uid(), wh: 'whC', lines: [{ p: 'pTST', sec: 'sGEN', qty: 2 }] });
  const P = await runOp(sql, OWNER, { type: 'PROCESS', id: uid(), src: { t: 'W', wh: 'whC', sec: 'sGEN' }, p: 'pTST', qty: 1, purpose: 'βάσεις', out: [{ dims: '1000×650', loc: { t: 'W', wh: 'whC', sec: 'sGEN' } }] });
  const rid = P.lines[0].out[0].rem;
  await runOp(sql, OWNER, { type: 'PROCESS', id: uid(), src: { t: 'R', rem: rid }, purpose: 'καπάκι', out: [] });
  await assert.rejects(runOp(sql, OWNER, { type: 'PROCESS', id: uid(), src: { t: 'R', rem: rid }, purpose: 'ξανά', out: [] }), /δεν είναι πλέον διαθέσιμο/);
});

test('καθαρισμός δοκιμών μόνο από τον κάτοχο', async () => {
  await assert.rejects(resetTests(sql, EMP, false), /κάτοχος/);
  const r = await resetTests(sql, OWNER, false); assert.ok(r.deleted > 0);
  assert.deepEqual(await bal('pTST'), {});
  await sql.end();
});

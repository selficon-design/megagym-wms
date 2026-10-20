// Ελάχιστος προσαρμογέας «postgres.js-όμοιος» πάνω σε psql — ΜΟΝΟ για τοπικούς ελέγχους.
// Υποστηρίζει: sql`...` (με παραμέτρους), sql.json(obj), sql.begin(fn), αποτέλεσμα .count
import { spawn } from 'node:child_process';

const q = v => "'" + String(v).replace(/'/g, "''") + "'";
const JSONM = Symbol('json');

export function connect({ host = process.env.PGHOST || '/var/tmp/pgtest', port = Number(process.env.PGPORT || 5433), db = process.env.PGDATABASE || 'mg', user = 'postgres', psql = 'psql' } = {}) {
  const p = spawn(psql, ['-h', host, '-p', String(port), '-U', user, '-d', db, '-At', '-q', '-X', '-v', 'ON_ERROR_STOP=0'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = ''; let waiting = null;
  const check = () => { if (waiting && out.includes('__END__\n') && err.includes('__END__\n')) { const o = out.split('__END__\n')[0], e = err.split('__END__\n')[0]; out = out.slice(out.indexOf('__END__\n') + 8); err = err.slice(err.indexOf('__END__\n') + 8); const w = waiting; waiting = null; w(o, e); } };
  p.stdout.on('data', d => { out += d; check(); }); p.stderr.on('data', d => { err += d; check(); });
  let chain = Promise.resolve();
  const raw = text => (chain = chain.then(() => new Promise(res => { waiting = (o, e) => res({ o, e }); p.stdin.write(text + '\n\\echo __END__\n\\warn __END__\n'); })));
  const render = (strings, vals) => strings.reduce((s, str, i) => {
    if (i >= vals.length) return s + str; const v = vals[i];
    let lit; if (v && v[JSONM]) lit = q(JSON.stringify(v.v)) + '::jsonb';
    else if (Array.isArray(v)) lit = 'ARRAY[' + v.map(q).join(',') + ']::text[]';
    else if (typeof v === 'number') lit = String(v); else if (v == null) lit = 'NULL'; else lit = q(v);
    return s + str + lit; }, '');
  const run = async text => {
    const t = text.trim().replace(/;$/, ''); let wrapped;
    if (/^select\s+pg_advisory/i.test(t)) wrapped = t + ';';
    else if (/^select/i.test(t)) wrapped = `select coalesce(json_agg(t), '[]'::json) from (${t}) t;`;
    else if (/^(insert|update|delete)/i.test(t)) wrapped = `with r as (${t} returning 1) select count(*) from r;`;
    else wrapped = t + ';';
    const { o, e } = await raw(wrapped);
    if (/ERROR:/.test(e)) { const m = e.match(/ERROR:\s*(.*)/); throw new Error('SQL: ' + (m ? m[1] : e)); }
    if (/^select\s+pg_advisory/i.test(t) || !/^(select|insert|update|delete)/i.test(t)) return Object.assign([], { count: 0 });
    if (/^select/i.test(t)) { const rows = JSON.parse(o.trim() || '[]'); return Object.assign(rows, { count: rows.length }); }
    return Object.assign([], { count: Number(o.trim()) || 0 });
  };
  const sql = (strings, ...vals) => run(render(strings, vals));
  sql.json = v => ({ [JSONM]: true, v });
  sql.unsafe = text => run(text);
  sql.begin = async fn => {
    await raw('begin;');
    try { const r = await fn(sql); await raw('commit;'); return r; }
    catch (e) { await raw('rollback;'); throw e; }
  };
  sql.end = () => new Promise(r => { p.on('close', r); p.stdin.end('\\q\n'); });
  return sql;
}

// Κατασκευή: web/src → dist/ (η εφαρμογή) και κοινός κώδικας για τις Supabase functions.
// Χρήση: SUPABASE_URL=... SUPABASE_ANON_KEY=... node web/build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = f => readFileSync(join(root, 'web/src', f), 'utf8');
const shared = join(root, 'supabase/functions/_shared');

// 1) Μηχανισμός αποθέματος ως ES module για τον server (μία πηγή αλήθειας)
const engine = src('engine.js').replace(/if \(typeof module !== 'undefined'\)[^\n]*\n?/, '');
writeFileSync(join(shared, 'engine.js'), '// ΠΑΡΑΓΕΤΑΙ ΑΥΤΟΜΑΤΑ από web/src/engine.js (npm run build) — μην το αλλάζετε με το χέρι.\n' + engine + '\nexport default ENG;\n');

// 2) Κανόνες δικαιωμάτων για τον server, από το web/src/core.js
const core = src('core.js');
const perms = core.slice(core.indexOf('const PERMS = {'), core.indexOf('function can(action, wh) {')).trim();
let opErr = core.slice(core.indexOf('function opPermError(op) {'), core.indexOf('/* ---------------- ctx για τον μηχανισμό')).trim();
opErr = opErr.replace('function opPermError(op) {', "export function opPermError(op, me, ctx) {\n  const S = { me, pk: ctx.pk || {} };\n  const whName = id => (ctx.wh && ctx.wh[id] && ctx.wh[id].name) || id || '';\n  const can = (action, wh) => canFor(me, action, wh);");
writeFileSync(join(shared, 'perms.js'), `// ΠΑΡΑΓΕΤΑΙ ΑΥΤΟΜΑΤΑ από web/src/core.js (npm run build) — μην το αλλάζετε με το χέρι.
// Έλεγχος δικαιωμάτων κινήσεων στον server (ίδιοι κανόνες με την εφαρμογή).
export ${perms}
export function canFor(me, action, wh) {
  if (!me || !me.id) return false;
  const r = me.role; const ps = PERMS[r] || [];
  const ok = ps.includes('*') || ps.includes(action) || (action === 'product_create' && ps.includes('product'));
  if (!ok) return false;
  if (wh && r !== 'admin' && me.whs && me.whs.length && !me.whs.includes(wh)) return false;
  return true;
}
${opErr}
`);

// 3) Η εφαρμογή: ένα index.html (όπως η δοκιμαστική) + PWA αρχεία
const order = ['sb.js', 'engine.js', 'core.js', 'ui.js', 'v_forms.js', 'v_lists.js', 'v_more.js', 'v_mats.js', 'v_repl.js', 'manual.js', 'ai.js', 'voice.js', 'auth.js'];
const body = readFileSync(join(root, 'web/src/body.html'), 'utf8');
const js = order.map(src).join('\n');
const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111111"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="MEGA GYM">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="config.js"></script>
${src('head.html')}
</head><body>
${body}
<script>
${js}
</script>
<script>if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body></html>
`;
const dist = join(root, 'dist'); mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
cpSync(join(root, 'web/public'), dist, { recursive: true });
const url = (process.env.SUPABASE_URL || '').replace(/\s+/g, ''), key = (process.env.SUPABASE_ANON_KEY || '').replace(/\s+/g, '');
if (url && key) writeFileSync(join(dist, 'config.js'), `window.MG_CONFIG = ${JSON.stringify({ url, anonKey: key })};\n`);
else if (!existsSync(join(dist, 'config.js'))) writeFileSync(join(dist, 'config.js'), 'window.MG_CONFIG = window.MG_CONFIG || null;\n');
writeFileSync(join(dist, '.nojekyll'), '');
console.log('OK', (html.length / 1024).toFixed(0) + ' KB', url ? '(με ρυθμίσεις Supabase)' : '(χωρίς ρυθμίσεις — config.js κενό)');

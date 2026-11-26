// Διαχείριση χρηστών (μόνο Administrator): δημιουργία με email & κωδικό, αλλαγή κωδικού, απενεργοποίηση, λίστα.
import { handler, json, fail, db } from '../_shared/http.js';
import { loadMe, putDoc, getDoc } from '../_shared/ops.js';

const AUTH = () => Deno.env.get('SUPABASE_URL') + '/auth/v1/admin/users';
const KEY = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const adminFetch = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, headers: { apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.msg || j.message || j.error_description || 'Σφάλμα διαχείρισης χρηστών.'), { status: r.status });
  return j;
};
const ROLES = ['admin', 'manager', 'employee', 'viewer'];

Deno.serve(handler(async (req, user) => {
  const sql = db(); const me = await loadMe(sql, user.id);
  if (me.role !== 'admin') return fail('Μόνο ο Administrator διαχειρίζεται χρήστες.', 403);
  const b = await req.json(); const now = Date.now();
  switch (b.action) {
    case 'list': {
      const r = await adminFetch(AUTH() + '?per_page=200');
      return json({ users: (r.users || []).map(u => ({ id: u.id, email: u.email, banned: !!(u.banned_until && new Date(u.banned_until) > new Date()), last: u.last_sign_in_at })) });
    }
    case 'profile': { // όνομα / επώνυμο χρήστη — συμπληρώνει το προφίλ, δεν σβήνει τίποτα άλλο
      const uid = String(b.uid || ''); if (!/^[0-9a-f-]{36}$/.test(uid)) return fail('Άγνωστος χρήστης.');
      const fname = String(b.fname || '').trim().slice(0, 40), lname = String(b.lname || '').trim().slice(0, 60);
      if (!fname) return fail('Γράψτε το όνομα.');
      const cur = (await getDoc(sql, 'members/' + uid)) || {};
      await putDoc(sql, 'members/' + uid, Object.assign({}, cur, { fname, lname, name: [fname, lname].filter(Boolean).join(' '), by: user.id, at: now }));
      return json({ ok: true });
    }
    case 'create': {
      const email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Μη έγκυρο email.');
      if (password.length < 8) return fail('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      const role = ROLES.includes(b.role) ? b.role : 'viewer';
      const u = await adminFetch(AUTH(), 'POST', { email, password, email_confirm: true, user_metadata: { name: String(b.name || '').trim() } });
      const fname = String(b.fname || '').trim(), lname = String(b.lname || '').trim();
      await putDoc(sql, 'members/' + u.id, { name: [fname, lname].filter(Boolean).join(' ') || String(b.name || '').trim() || email.split('@')[0], fname, lname, email, first: now });
      await putDoc(sql, 'roles/' + u.id, { role, whs: Array.isArray(b.whs) ? b.whs : [], by: user.id, ts: now });
      return json({ id: u.id });
    }
    case 'password': {
      if (String(b.password || '').length < 8) return fail('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      await adminFetch(AUTH() + '/' + b.uid, 'PUT', { password: String(b.password) }); return json({ ok: true });
    }
    case 'disable': case 'enable': {
      const owner = await getDoc(sql, 'cfg/owner'); if (owner && owner.uid === b.uid) return fail('Ο κάτοχος δεν απενεργοποιείται.');
      await adminFetch(AUTH() + '/' + b.uid, 'PUT', { ban_duration: b.action === 'disable' ? '876000h' : 'none' }); return json({ ok: true });
    }
    default: return fail('Άγνωστη ενέργεια.');
  }
}));

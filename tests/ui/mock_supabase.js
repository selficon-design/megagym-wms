// Ψεύτικο supabase-js για έλεγχο: μιλά με τον τοπικό διακομιστή ελέγχου (tests/ui/server.mjs).
(function () {
  const USERS = window.__USERS || {}; // email -> {id, pass, name}
  const base = location.origin;
  let session = null; const authCbs = [];
  try { session = JSON.parse(sessionStorage.getItem('mock-session') || 'null'); } catch (e) {}
  const setS = (s, ev) => { session = s; try { sessionStorage.setItem('mock-session', JSON.stringify(s)); } catch (e) {} authCbs.forEach(f => f(ev, s)); };
  const hdr = () => ({ 'Content-Type': 'application/json', 'x-uid': session ? session.user.id : '' });
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: hdr(), body: JSON.stringify(b) }).then(r => r.json());
  function builder() {
    const st = { filters: [], order: null, lim: null, range: null, single: false, op: 'select' };
    const run = async () => {
      if (st.op === 'upsert') { const r = await post('/db/upsert', { row: st.row }); return { error: r.error ? { message: r.error } : null }; }
      if (st.op === 'delete') { const r = await post('/db/delete', { filters: st.filters }); return { error: r.error ? { message: r.error } : null }; }
      let rows = await post('/db/select', { filters: st.filters });
      if (!Array.isArray(rows)) return { data: null, error: { message: rows.error } };
      if (st.order) rows.sort((a, b) => ((b.data[st.order] || 0) - (a.data[st.order] || 0)) * (st.asc ? -1 : 1));
      if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
      if (st.lim) rows = rows.slice(0, st.lim);
      if (st.single) return { data: rows[0] || null, error: null };
      return { data: rows, error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { st.filters.push([c, v]); return b; },
      order(c, o) { st.order = c.replace('data->', ''); st.asc = o && o.ascending; return b; },
      limit(n) { st.lim = n; return b; }, range(a, z) { st.range = [a, z]; return b; },
      maybeSingle() { st.single = true; return b; },
      upsert(row) { st.op = 'upsert'; st.row = row; return b; }, delete() { st.op = 'delete'; return b; },
      then(res, rej) { return run().then(res, rej); },
    };
    return b;
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if (String(url).startsWith(base + '/functions/')) {
      const h = Object.assign({}, opts.headers || {}); const a = String(h.Authorization || '');
      h['x-uid'] = a.startsWith('Bearer tok-') ? a.slice(11) : '';
      return realFetch(url, Object.assign({}, opts, { headers: h }));
    }
    return realFetch(url, opts);
  };
  window.supabase = { createClient: () => ({
    from: () => builder(),
    channel: () => { let cb = null; const ch = { on(_t, _f, f) { cb = f; return ch; }, subscribe(st) {
      const es = new EventSource(base + '/events');
      es.onopen = () => st && st('SUBSCRIBED');
      es.onmessage = m => { const e = JSON.parse(m.data);
        if (e.ev === 'RESYNC') return typeof SB !== 'undefined' && SB.resync();
        if (e.ev === 'DELETE') cb({ eventType: 'DELETE', old: e.row, new: {} }); else cb({ eventType: 'UPDATE', new: e.row, old: {} }); };
      return ch; } }; return ch; },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: cb => { authCbs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email, password }) => {
        const u = USERS[email]; if (!u || u.pass !== password) return { error: { message: 'Invalid login credentials' } };
        setS({ access_token: 'tok-' + u.id, user: { id: u.id, email, user_metadata: { name: u.name } } }, 'SIGNED_IN'); return { error: null };
      },
      signOut: async () => { setS(null, 'SIGNED_OUT'); return { error: null }; },
      updateUser: async ({ password }) => { window.__pwchanged = password; return { error: null }; },
      resetPasswordForEmail: async email => { window.__resetFor = email; return { error: null }; },
    },
  }) };
})();

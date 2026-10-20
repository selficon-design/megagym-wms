/* ================================================================
   Σύνδεση με Supabase. Δίνει στις οθόνες τις ίδιες «υπηρεσίες» με τη
   δοκιμαστική εφαρμογή (βάση, χρήστης, AI, λήψη αρχείων), ώστε ο κώδικας
   των οθονών να μείνει ίδιος.
   • βάση: πίνακας docs (path / coll / id / data) με ζωντανή ενημέρωση
   • κινήσεις αποθέματος: function «execute» (μία συναλλαγή στον server)
   • AI: function «ai» (Claude API) — τα εργαλεία τρέχουν εδώ
   ================================================================ */
const SB = (() => {
  const cfg = window.MG_CONFIG;
  const client = cfg && cfg.url && cfg.anonKey && window.supabase ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  let session = null;
  const splitPath = p => { const i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
  const snap = (coll, map) => ({ docs: Object.entries(map).map(([id, data]) => ({ id, exists: true, data: () => data })), size: Object.keys(map).length, empty: !Object.keys(map).length });

  /* ---------- functions (με το token του χρήστη) ---------- */
  async function fn(name, body, { raw = false, signal } = {}) {
    const { data } = await client.auth.getSession(); const tok = data.session && data.session.access_token;
    const isForm = body instanceof FormData;
    const r = await fetch(`${cfg.url}/functions/v1/${name}`, { method: 'POST', signal,
      headers: Object.assign({ Authorization: 'Bearer ' + tok, apikey: cfg.anonKey }, isForm ? {} : { 'Content-Type': 'application/json' }),
      body: isForm ? body : JSON.stringify(body || {}) });
    if (raw && r.ok) return r;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || ('Σφάλμα διακομιστή (' + r.status + ').')); e.status = r.status; e.code = r.status === 429 ? 'rate_limited' : r.status === 401 ? 'session_expired' : 'server'; throw e; }
    return j;
  }

  /* ---------- βάση: έγγραφα & ζωντανές συλλογές ---------- */
  const colls = {};   // coll -> { map, cbs:Set, loaded }
  let movQ = null;    // { limit, map, cbs }
  async function fetchAll(coll) {
    const out = {}; let from = 0; const page = 1000;
    for (;;) {
      const { data, error } = await client.from('docs').select('id,data').eq('coll', coll).range(from, from + page - 1);
      if (error) throw error; data.forEach(r => out[r.id] = r.data);
      if (data.length < page) break; from += page;
    }
    return out;
  }
  async function fetchMov(limit) {
    const { data, error } = await client.from('docs').select('id,data').eq('coll', 'mov').order('data->no', { ascending: false }).limit(limit);
    if (error) throw error; const out = {}; data.forEach(r => out[r.id] = r.data); return out;
  }
  const emit = coll => { const c = colls[coll]; if (c) c.cbs.forEach(cb => { try { cb(snap(coll, c.map)); } catch (e) { console.error(e); } }); };
  const emitMov = () => { if (!movQ) return; const ids = Object.keys(movQ.map).sort((a, b) => (movQ.map[b].no || 0) - (movQ.map[a].no || 0));
    if (ids.length > movQ.limit) ids.slice(movQ.limit).forEach(id => delete movQ.map[id]);
    const docs = ids.slice(0, movQ.limit).map(id => ({ id, exists: true, data: () => movQ.map[id] }));
    movQ.cbs.forEach(cb => cb({ docs, size: docs.length, empty: !docs.length })); };
  async function resync() {
    for (const coll of Object.keys(colls)) { try { colls[coll].map = await fetchAll(coll); emit(coll); } catch (e) { console.warn('resync', coll, e); } }
    if (movQ) { try { movQ.map = await fetchMov(movQ.limit); emitMov(); } catch (e) { console.warn('resync mov', e); } }
  }
  let channel = null, wasDown = false;
  function startRealtime() {
    if (channel) return;
    channel = client.channel('docs-all').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
      const row = p.eventType === 'DELETE' ? p.old : p.new; if (!row || !row.path) return;
      const [coll, id] = splitPath(row.path);
      if (coll === 'mov' && movQ) { if (p.eventType === 'DELETE') delete movQ.map[id]; else movQ.map[id] = row.data; emitMov(); }
      const c = colls[coll]; if (!c) return;
      if (p.eventType === 'DELETE') delete c.map[id]; else c.map[id] = row.data;
      emit(coll);
    }).subscribe(status => {
      if (status === 'SUBSCRIBED') { if (wasDown) resync(); wasDown = false; }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') wasDown = true;
    });
  }
  // όταν το κινητό «ξυπνά», φέρνουμε ό,τι άλλαξε στο μεταξύ
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) resync(); });

  function query(coll, opts = {}) {
    const q = {
      orderBy: () => query(coll, opts), where: () => query(coll, opts),
      limit: n => query(coll, Object.assign({}, opts, { limit: n })),
      async get() { const map = coll === 'mov' ? await fetchMov(opts.limit || 300) : await fetchAll(coll); return snap(coll, map); },
      onSnapshot(next, onErr) {
        startRealtime();
        if (coll === 'mov') {
          movQ = movQ || { limit: opts.limit || 300, map: {}, cbs: new Set() }; movQ.limit = opts.limit || movQ.limit; movQ.cbs.add(next);
          fetchMov(movQ.limit).then(m => { movQ.map = m; emitMov(); }, e => onErr && onErr(e));
          return () => movQ && movQ.cbs.delete(next);
        }
        const c = colls[coll] = colls[coll] || { map: {}, cbs: new Set() }; c.cbs.add(next);
        fetchAll(coll).then(m => { c.map = m; emit(coll); }, e => onErr && onErr(e));
        return () => c.cbs.delete(next);
      },
      doc: id => doc(coll + '/' + id),
    };
    return q;
  }
  function doc(path) {
    const [coll, id] = splitPath(path);
    return { id, path,
      async get() { const { data, error } = await client.from('docs').select('data').eq('path', path).maybeSingle(); if (error) throw error; return { id, exists: !!data, data: () => data ? data.data : undefined }; },
      async set(d) { const { error } = await client.from('docs').upsert({ path, coll, id, data: d }); if (error) throw dbErr(error);
        const c = colls[coll]; if (c) { c.map[id] = d; emit(coll); } },
      async update(d) { const cur = await this.get(); return this.set(Object.assign({}, cur.data() || {}, d)); },
      async delete() { const { error } = await client.from('docs').delete().eq('path', path); if (error) throw dbErr(error);
        const c = colls[coll]; if (c) { delete c.map[id]; emit(coll); } },
    };
  }
  const dbErr = e => { const m = String(e.message || e); return new Error(/row-level security|permission/i.test(m) ? 'Δεν έχετε δικαίωμα για αυτή την αλλαγή.' : m); };
  const DB = { doc, collection: c => query(c) };

  /* ---------- χρήστης ---------- */
  const profileCache = {};
  const USER = {
    me: async () => { const u = session.user; const m = (colls.members && colls.members.map[u.id]) || {};
      const owner = await doc('cfg/owner').get(); const isOwner = !!(owner.exists && owner.data().uid === u.id);
      return { id: u.id, name: m.name || (u.user_metadata && u.user_metadata.name) || u.email, email: u.email, avatarUrl: '', isOwner, canEdit: isOwner }; },
    can: async () => true, isOwner: async () => (await USER.me()).isOwner,
    profiles: async ids => { const out = {}; let members = colls.members ? colls.members.map : null;
      if (!members) { try { members = await fetchAll('members'); } catch (e) { members = {}; } }
      [].concat(ids).forEach(i => out[i] = { id: i, name: (members[i] && members[i].name) || profileCache[i] || '' }); return out; },
  };

  /* ---------- AI: κύκλος με εργαλεία (τα εργαλεία εκτελούνται στην εφαρμογή) ---------- */
  async function SAMPLE(turns, opts = {}) {
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    const byName = Object.fromEntries((opts.tools || []).map(t => [t.name, t]));
    // διαδοχικά μηνύματα ίδιου ρόλου ενώνονται
    const messages = [];
    for (const t of turns) { const last = messages[messages.length - 1];
      if (last && last.role === t.role && typeof last.content === 'string') last.content += '\n\n' + t.content; else messages.push({ role: t.role, content: t.content }); }
    if (messages.length && messages[0].role !== 'user') messages.shift();
    let text = '';
    for (let step = 0; step < 12; step++) {
      if (opts.signal && opts.signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled', text });
      let r;
      try { r = await fn('ai', { system: opts.system || '', messages, tools, max_tokens: 2048 }, { signal: opts.signal }); }
      catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('cancelled'), { code: 'cancelled', text }); throw Object.assign(e, { text }); }
      const blocks = r.content || [];
      const t = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (t) { text = text ? text + '\n\n' + t : t; if (opts.onText) opts.onText({ text, delta: t }); }
      if (r.stop_reason !== 'tool_use') return { text, truncated: r.stop_reason === 'max_tokens' };
      messages.push({ role: 'assistant', content: blocks });
      const results = [];
      for (const b of blocks.filter(x => x.type === 'tool_use')) {
        const tool = byName[b.name];
        try { const out = tool ? await tool.execute(b.input || {}) : 'Άγνωστο εργαλείο.'; results.push({ type: 'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out) }); }
        catch (e) { results.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: String(e && e.message || e) }); }
      }
      messages.push({ role: 'user', content: results });
    }
    return { text: text || 'Δεν ολοκληρώθηκε η απάντηση.', truncated: true };
  }

  /* ---------- λήψη αρχείων ---------- */
  const DOWNLOADS = { save: async ({ filename, data, mimeType }) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return { status: 'saved' }; } };

  // ίδιος τρόπος πρόσβασης με τη δοκιμαστική (claude.use)
  window.claude = { use: async name => ({ db: session ? DB : null, user: session ? USER : null, sample: session ? SAMPLE : null, downloads: DOWNLOADS })[name] || null };

  return { client, cfg, fn, get session() { return session; }, set session(s) { session = s; }, resync, DB };
})();

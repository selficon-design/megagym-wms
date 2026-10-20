/* ================================================================
   Σύνδεση χρηστών: email & κωδικός (Supabase Auth).
   • οθόνη σύνδεσης · «Ξέχασα τον κωδικό» (email επαναφοράς)
   • ορισμός νέου κωδικού από τον σύνδεσμο του email
   • μενού λογαριασμού: αλλαγή κωδικού, αποσύνδεση
   Δεν υπάρχει δημόσια εγγραφή: χρήστες προσθέτει ο Administrator.
   ================================================================ */
const AUTHUI = { mode: 'login', msg: '', err: '', busy: false };
let booted = false;

function authBox(inner) {
  let el = $('#auth');
  if (!el) { el = document.createElement('div'); el.id = 'auth'; el.className = 'authwrap'; document.body.appendChild(el); }
  el.hidden = false;
  el.innerHTML = `<div class="authcard" role="dialog" aria-labelledby="authh"><div class="brand"><span class="mk">MG</span><span class="tx"><b>MEGA GYM</b><span>WAREHOUSE MANAGEMENT &amp; AI</span></span></div>${inner}</div>`;
}
const hideAuth = () => { const el = $('#auth'); if (el) { el.hidden = true; el.innerHTML = ''; } };
const amsg = () => (AUTHUI.err ? `<div class="errbox">${esc(AUTHUI.err)}</div>` : '') + (AUTHUI.msg ? `<div class="okbox">${esc(AUTHUI.msg)}</div>` : '');

function renderAuth() {
  const m = AUTHUI.mode;
  if (m === 'login') authBox(`<h1 id="authh">Σύνδεση</h1>
    <form id="authf"><div class="f"><label for="ae">Email</label><input type="email" id="ae" autocomplete="username" inputmode="email" required></div>
    <div class="f"><label for="ap">Κωδικός</label><input type="password" id="ap" autocomplete="current-password" required></div>
    ${amsg()}<button class="btn pri" style="width:100%" ${AUTHUI.busy ? 'disabled' : ''}>${AUTHUI.busy ? 'Σύνδεση…' : 'Σύνδεση'}</button></form>
    <button class="linkbtn" id="aforgot">Ξέχασα τον κωδικό</button>
    <p class="hint">Λογαριασμό δημιουργεί ο διαχειριστής της εφαρμογής.</p>`);
  if (m === 'forgot') authBox(`<h1 id="authh">Επαναφορά κωδικού</h1>
    <p class="hint">Θα σας στείλουμε email με σύνδεσμο για νέο κωδικό.</p>
    <form id="authf"><div class="f"><label for="ae">Email</label><input type="email" id="ae" autocomplete="username" inputmode="email" required></div>
    ${amsg()}<button class="btn pri" style="width:100%" ${AUTHUI.busy ? 'disabled' : ''}>Αποστολή</button></form>
    <button class="linkbtn" id="aback">← Πίσω στη σύνδεση</button>`);
  if (m === 'newpass') authBox(`<h1 id="authh">Νέος κωδικός</h1>
    <form id="authf"><div class="f"><label for="ap">Νέος κωδικός (τουλάχιστον 8 χαρακτήρες)</label><input type="password" id="ap" autocomplete="new-password" minlength="8" required></div>
    <div class="f"><label for="ap2">Επανάληψη</label><input type="password" id="ap2" autocomplete="new-password" minlength="8" required></div>
    ${amsg()}<button class="btn pri" style="width:100%" ${AUTHUI.busy ? 'disabled' : ''}>Αποθήκευση</button></form>`);
  if (m === 'noconfig') authBox(`<h1 id="authh">Δεν έχει ρυθμιστεί</h1><div class="errbox">Λείπουν οι ρυθμίσεις σύνδεσης με τη βάση (config.js). Δείτε τις οδηγίες εγκατάστασης στο README.</div>`);
  const f = $('#authf'); if (f) f.onsubmit = ev => { ev.preventDefault(); authSubmit(); };
  const fg = $('#aforgot'); if (fg) fg.onclick = () => { Object.assign(AUTHUI, { mode: 'forgot', err: '', msg: '' }); renderAuth(); };
  const bk = $('#aback'); if (bk) bk.onclick = () => { Object.assign(AUTHUI, { mode: 'login', err: '', msg: '' }); renderAuth(); };
  const first = $('#ae') || $('#ap'); if (first) setTimeout(() => first.focus(), 30);
}
const authErr = e => { const m = String((e && e.message) || e || '');
  if (/invalid login|invalid credentials/i.test(m)) return 'Λάθος email ή κωδικός.';
  if (/banned|disabled/i.test(m)) return 'Ο λογαριασμός είναι απενεργοποιημένος. Επικοινωνήστε με τον διαχειριστή.';
  if (/rate|too many/i.test(m)) return 'Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.';
  if (/fetch|network/i.test(m)) return 'Δεν υπάρχει σύνδεση στο διαδίκτυο.';
  if (/same.*password|different from the old/i.test(m)) return 'Ο νέος κωδικός πρέπει να διαφέρει από τον παλιό.';
  if (/weak|at least/i.test(m)) return 'Ο κωδικός είναι πολύ απλός. Χρησιμοποιήστε τουλάχιστον 8 χαρακτήρες.';
  return m || 'Κάτι πήγε στραβά.'; };

async function authSubmit() {
  const A = SB.client.auth; AUTHUI.err = ''; AUTHUI.msg = '';
  const email = $('#ae') ? $('#ae').value.trim() : '', pw = $('#ap') ? $('#ap').value : '';
  AUTHUI.busy = true; renderAuth(); if ($('#ae')) $('#ae').value = email;
  try {
    if (AUTHUI.mode === 'login') { const { error } = await A.signInWithPassword({ email, password: pw }); if (error) throw error; }
    else if (AUTHUI.mode === 'forgot') {
      const { error } = await A.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error;
      AUTHUI.msg = 'Αν το email είναι καταχωρισμένο, θα λάβετε σύνδεσμο σε λίγα λεπτά.';
    } else if (AUTHUI.mode === 'newpass') {
      if (pw.length < 8) throw new Error('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      if (pw !== $('#ap2').value) throw new Error('Οι δύο κωδικοί δεν ταιριάζουν.');
      const { error } = await A.updateUser({ password: pw }); if (error) throw error;
      AUTHUI.mode = 'login'; hideAuth(); toast('Ο νέος κωδικός αποθηκεύτηκε.'); startApp();
    }
  } catch (e) { AUTHUI.err = authErr(e); }
  AUTHUI.busy = false; if (!$('#auth') || !$('#auth').hidden) renderAuth();
}

function startApp() {
  if (booted) return; booted = true; hideAuth();
  boot().catch(e => { console.error(e); S.bootMsg = 'Σφάλμα εκκίνησης: ' + (e.message || e); render(); });
}

/* ---------- μενού λογαριασμού (πατώντας το όνομα επάνω δεξιά) ---------- */
ACT.account = () => {
  openModal(`${mhead('Λογαριασμός', esc((SB.session && SB.session.user.email) || ''))}
    <div class="f"><label for="mp1">Νέος κωδικός (τουλάχιστον 8 χαρακτήρες)</label><input type="password" id="mp1" autocomplete="new-password"></div>
    <div class="f"><label for="mp2">Επανάληψη</label><input type="password" id="mp2" autocomplete="new-password"></div>
    <div id="mperr"></div>
    <div class="btns" style="justify-content:space-between"><button class="btn danger" data-act="logout">Αποσύνδεση</button><span class="btns"><button class="btn ghost" data-act="closeModal">Κλείσιμο</button><button class="btn pri" id="mpgo">Αλλαγή κωδικού</button></span></div>`);
  $('#mpgo').onclick = async () => {
    const a = $('#mp1').value, b = $('#mp2').value;
    try {
      if (a.length < 8) throw new Error('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      if (a !== b) throw new Error('Οι δύο κωδικοί δεν ταιριάζουν.');
      const { error } = await SB.client.auth.updateUser({ password: a }); if (error) throw error;
      closeModal(); toast('Ο κωδικός άλλαξε.');
    } catch (e) { $('#mperr').innerHTML = `<div class="errbox">${esc(authErr(e))}</div>`; }
  };
};
ACT.logout = async () => { try { await SB.client.auth.signOut(); } catch (e) {} try { localStorage.removeItem('mg-route'); } catch (e) {} location.reload(); };

/* ---------- εκκίνηση ---------- */
(async function authInit() {
  const who = $('#who'); if (who) { who.setAttribute('role', 'button'); who.tabIndex = 0; who.title = 'Λογαριασμός'; who.dataset.act = 'account'; }
  if (!SB.client) { AUTHUI.mode = 'noconfig'; renderAuth(); return; }
  const recovering = /type=recovery/.test(location.hash);
  SB.client.auth.onAuthStateChange((ev, session) => {
    SB.session = session;
    if (ev === 'PASSWORD_RECOVERY') { Object.assign(AUTHUI, { mode: 'newpass', err: '', msg: '' }); renderAuth(); return; }
    if (ev === 'SIGNED_IN' && session && AUTHUI.mode !== 'newpass') startApp();
    if (ev === 'SIGNED_OUT' && booted) location.reload();
  });
  const { data } = await SB.client.auth.getSession(); SB.session = data.session;
  if (data.session && !recovering) startApp();
  else if (!data.session) renderAuth();
})();

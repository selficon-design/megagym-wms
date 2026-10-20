# Έλεγχος της εφαρμογής από άκρη σε άκρη: browser → τοπικός «Supabase» → PostgreSQL (RLS + execute).
# Χρήση: node tests/ui/server.mjs &  python3 tests/ui/ui_test.py
import json, sys, urllib.request, os
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8787'
OUT = os.environ.get('SHOTS', '/tmp')
USERS = {'owner@x.gr': {'id': '11111111-1111-1111-1111-111111111111', 'pass': 'owner-pass-1', 'name': 'Γιώργος'},
         'emp@x.gr': {'id': '22222222-2222-2222-2222-222222222222', 'pass': 'emp-pass-12', 'name': 'Μαρία'},
         'view@x.gr': {'id': '33333333-3333-3333-3333-333333333333', 'pass': 'view-pass-1', 'name': 'Νίκος'}}
MOCK = open(os.path.join(os.path.dirname(__file__), 'mock_supabase.js')).read()
errors, fails = [], []
def ok(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fails.append(msg)
def post(path, obj):
    urllib.request.urlopen(urllib.request.Request(BASE + path, data=json.dumps(obj).encode(), headers={'Content-Type': 'application/json'})).read()

def page(b, w=1280, h=900):
    ctx = b.new_context(viewport={'width': w, 'height': h}, permissions=['microphone'])
    ctx.add_init_script('window.__USERS = ' + json.dumps(USERS) + ';')
    ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='text/javascript', body=MOCK))
    p = ctx.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    p.goto(BASE + '/'); return p

def login(p, email, pw=None):
    p.wait_for_selector('#ae'); p.fill('#ae', email); p.fill('#ap', pw or USERS[email]['pass']); p.click('#authf button')

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    print('1. Σύνδεση')
    A = page(b, 390, 844)
    A.wait_for_selector('#authf'); A.screenshot(path=f'{OUT}/login360.png')
    login(A, 'owner@x.gr', 'λάθος'); A.wait_for_selector('#auth .errbox')
    ok('Λάθος email ή κωδικός' in A.inner_text('#auth .errbox'), 'λάθος κωδικός → μήνυμα')
    A.click('#aforgot'); A.fill('#ae', 'owner@x.gr'); A.click('#authf button'); A.wait_for_selector('#auth .okbox')
    ok(A.evaluate('window.__resetFor') == 'owner@x.gr', 'email επαναφοράς κωδικού')
    A.click('#aback'); login(A, 'owner@x.gr')
    A.wait_for_function('S.ready === true', timeout=15000)
    ok(A.evaluate('S.me.isOwner && S.me.role') == 'admin', 'κάτοχος = Administrator')
    ok(A.evaluate('Object.keys(S.prod).length') >= 60, 'κατάλογος φορτώθηκε (%d προϊόντα)' % A.evaluate('Object.keys(S.prod).length'))
    A.screenshot(path=f'{OUT}/dash360.png')

    print('2. Κινήσεις μέσω server + ζωντανή ενημέρωση')
    E = page(b); login(E, 'emp@x.gr'); E.wait_for_function('S.ready === true', timeout=15000)
    ok(E.evaluate('S.me.role') == 'employee', 'υπάλληλος = Warehouse Employee')
    p0 = A.evaluate("Object.keys(S.prod).find(p => !isMat(p))")
    before = E.evaluate(f"(S.bal['{p0}'] && S.bal['{p0}'].q['W|whC|sGEN|N']) || 0")
    r = A.evaluate(f"execute({{ type: 'IMP', id: 't' + uid(), wh: 'whC', lines: [{{ p: '{p0}', sec: 'sGEN', qty: 5 }}] }}).then(m => m.docNo, e => 'ERR ' + e.message)")
    ok(str(r).startswith('ΕΙΣ-'), 'εισαγωγή από τον κάτοχο: ' + str(r))
    E.wait_for_function(f"((S.bal['{p0}'] && S.bal['{p0}'].q['W|whC|sGEN|N']) || 0) === {before + 5}", timeout=8000)
    ok(True, 'ο υπάλληλος είδε αμέσως το νέο υπόλοιπο (+5)')
    ok(E.evaluate("S.mov[0] && S.mov[0].docNo") == r, 'η κίνηση εμφανίζεται στο ιστορικό του άλλου χρήστη')
    r2 = E.evaluate(f"execute({{ type: 'LOAD', id: 't' + uid(), wh: 'whC', veh: Object.keys(S.veh)[0], lines: [{{ p: '{p0}', sec: 'sGEN', qty: 99999 }}] }}).then(m => m.docNo, e => 'ERR ' + e.message)")
    ok('Ανεπαρκές' in r2, 'αρνητικό απόθεμα απορρίπτεται: ' + r2[:70])
    r3 = E.evaluate("saveDoc('cats/x' + uid(), { name: 'Χ' }).then(() => 'OK', e => 'ERR ' + e.message)")
    ok('δικαίωμα' in r3, 'υπάλληλος δεν αλλάζει κατηγορίες (RLS): ' + r3)
    r4 = E.evaluate("saveDoc('bal/hack', { q: { 'W|whC|sGEN|N': 1000 } }).then(() => 'OK', e => 'ERR ' + e.message)")
    ok(r4.startswith('ERR'), 'απευθείας εγγραφή αποθέματος απαγορεύεται (μόνο μέσω execute)')

    print('3. Viewer')
    V = page(b); login(V, 'view@x.gr'); V.wait_for_function('S.ready === true', timeout=15000)
    r5 = V.evaluate(f"SB.fn('execute', {{ op: {{ type: 'IMP', id: 't' + uid(), wh: 'whC', lines: [{{ p: '{p0}', sec: 'sGEN', qty: 1 }}] }} }}).then(() => 'OK', e => e.status + ' ' + e.message)")
    ok(r5.startswith('403'), 'viewer: ο server αρνείται κίνηση (' + r5[:40] + ')')
    V.close()

    print('4. Προσωπικό σημειωματάριο')
    A.evaluate("saveDoc(`data/users/${S.me.id}/note_a1`, { subj: 'Ιδιωτικό Γιώργου', text: 'x', ts: Date.now(), by: S.me.id, edits: [] })")
    A.wait_for_function("Object.values(S.notes).some(n => n.subj === 'Ιδιωτικό Γιώργου')", timeout=5000)
    E.wait_for_timeout(800)
    ok(not E.evaluate("Object.values(S.notes).some(n => n.subj === 'Ιδιωτικό Γιώργου')"), 'ο άλλος χρήστης δεν βλέπει τις προσωπικές σημειώσεις')
    leak = E.evaluate("SB.DB.collection('data/users/11111111-1111-1111-1111-111111111111').get().then(s => s.size)")
    ok(leak == 0, 'ούτε με απευθείας ανάγνωση (RLS)')

    print('5. AI βοηθός (κύκλος εργαλείων)')
    post('/__ai_script', [
        {'content': [{'type': 'text', 'text': 'Ψάχνω…'}, {'type': 'tool_use', 'id': 'tu1', 'name': 'find_products', 'input': {'query': ''}}], 'stop_reason': 'tool_use'},
        {'content': [{'type': 'text', 'text': 'Βρήκα **προϊόντα** στον κατάλογο.'}], 'stop_reason': 'end_turn'}])
    A.set_viewport_size({'width': 1280, 'height': 900})
    A.evaluate("ACT.openAi()"); A.fill('#aiin', 'Ποια προϊόντα έχουμε;'); A.press('#aiin', 'Enter')
    A.wait_for_function("!AI.busy && AI.items.some(i => i.k === 'a' && /Βρήκα/.test(i.text))", timeout=10000)
    log = json.loads(urllib.request.urlopen(BASE + '/__ai_log').read())
    ok(len(log) == 2, 'δύο κλήσεις στο Claude API')
    ok('MEGA GYM' in log[0]['system'] or 'αποθ' in log[0]['system'], 'οι κανόνες πάνε ως system prompt')
    ok(log[0]['messages'][0] == {'role': 'user', 'content': 'Ποια προϊόντα έχουμε;'}, 'πρώτο μήνυμα = ερώτηση χρήστη')
    tr = log[1]['messages'][-1]['content'][0]
    ok(tr['type'] == 'tool_result' and tr['tool_use_id'] == 'tu1' and len(tr['content']) > 20, 'το εργαλείο εκτελέστηκε στην εφαρμογή και επέστρεψε δεδομένα')
    ok(any(t['name'] == 'propose_action' for t in log[0]['tools']), 'στάλθηκαν τα εργαλεία (%d)' % len(log[0]['tools']))
    A.screenshot(path=f'{OUT}/ai1280.png')

    print('6. Φωνή')
    A.evaluate("ttsSpeak('Δοκιμή φωνής.')"); A.wait_for_timeout(500)
    ok(A.evaluate('VOICE.elOk') is False, 'ElevenLabs μη ρυθμισμένο → φωνή συσκευής (χωρίς σφάλμα)')
    post('/__ai_script', [{'content': [{'type': 'text', 'text': 'Έχουμε πολλά προϊόντα.'}], 'stop_reason': 'end_turn'}])
    A.click('[data-act=mic]'); A.wait_for_timeout(1500)
    ok(A.evaluate('VOICE.recording'), 'ηχογράφηση ξεκίνησε')
    A.click('[data-act=mic]')
    A.wait_for_function("AI.items.some(i => i.k === 'u' && i.text === 'Πόσα προϊόντα έχουμε;') && !AI.busy", timeout=10000)
    ok(True, 'ομιλία → κείμενο → στάλθηκε στον βοηθό')
    ok(A.evaluate('TTS.on'), 'απάντηση με φωνή ενεργή μετά από φωνητική ερώτηση')
    A.evaluate("ACT.closeAi()")

    print('7. Χρήστες')
    A.evaluate("go('users')"); A.wait_for_selector('[data-act=newUser]'); A.wait_for_timeout(500)
    A.click('[data-act=newUser]'); A.fill('#nun', 'Κώστας Δοκιμής'); A.fill('#nue', 'kostas%d@x.gr' % os.getpid()); A.select_option('#nur', 'employee'); A.click('#nugo')
    try: A.wait_for_function("Object.values(S.members).some(m => m.name === 'Κώστας Δοκιμής')", timeout=8000)
    except Exception: print('DEBUG', A.evaluate("(document.querySelector('#nuerr')||{}).innerText"), A.evaluate("JSON.stringify(Object.values(S.members).map(m=>m.name))")); A.screenshot(path=f'{OUT}/fail.png'); raise
    ok(True, 'νέος χρήστης δημιουργήθηκε και εμφανίζεται')
    nid = A.evaluate("Object.keys(S.members).find(k => S.members[k].name === 'Κώστας Δοκιμής')")
    ok(A.evaluate(f"S.roles['{nid}'] && S.roles['{nid}'].role") == 'employee', 'με ρόλο Warehouse Employee')
    A.screenshot(path=f'{OUT}/users1280.png', full_page=True)
    rr = E.evaluate("SB.fn('admin', { action: 'list' }).then(() => 'OK', e => e.status)")
    ok(rr == 403, 'υπάλληλος δεν διαχειρίζεται χρήστες')

    print('8. Λογαριασμός')
    A.click('#who'); A.fill('#mp1', 'new-pass-123'); A.fill('#mp2', 'new-pass-123'); A.click('#mpgo'); A.wait_for_timeout(300)
    ok(A.evaluate('window.__pwchanged') == 'new-pass-123', 'αλλαγή κωδικού')

    print('9. Καθαρισμός δοκιμών (κάτοχος)')
    rz = E.evaluate("SB.fn('execute', { action: 'reset' }).then(() => 'OK', e => e.status)")
    ok(rz == 403, 'μόνο ο κάτοχος καθαρίζει')
    A.evaluate("go('setup')"); A.wait_for_timeout(200)
    A.evaluate("ACT.resetTests()"); A.fill('#rconf', 'ΜΗΔΕΝΙΣΜΟΣ'); A.click('#rgo')
    A.wait_for_function("Object.keys(S.bal).length === 0 && S.mov.length === 0", timeout=10000)
    ok(True, 'όλα τα αποθέματα μηδέν, ο κατάλογος έμεινε (%d προϊόντα)' % A.evaluate('Object.keys(S.prod).length'))
    E.wait_for_function("Object.keys(S.bal).length === 0", timeout=8000); ok(True, 'και ο άλλος χρήστης το βλέπει')

    print('10. Αποσύνδεση')
    A.click('#who'); A.click('[data-act=logout]'); A.wait_for_selector('#authf', timeout=8000); ok(True, 'επιστροφή στη σύνδεση')
    b.close()

errs = [e for e in errors if 'favicon' not in e and 'ERR_' not in e and 'Failed to load resource' not in e]
print('\nΣφάλματα σελίδας:', '\n'.join(errs) if errs else 'κανένα')
print('ΑΠΟΤΕΛΕΣΜΑ:', 'ΟΛΑ ΟΚ' if not fails and not errs else '%d αποτυχίες' % len(fails))
sys.exit(1 if fails or errs else 0)

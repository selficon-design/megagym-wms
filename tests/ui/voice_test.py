# Μικρόφωνο: ζωντανή καταγραφή (ψεύτικο ElevenLabs WebSocket) → βελάκι → απάντηση που διαβάζεται αυτόματα.
import json, os, sys, urllib.request
src = open(os.path.join(os.path.dirname(__file__), 'ui_test.py')).read().replace('os.path.dirname(__file__)', repr(os.path.dirname(__file__)))
exec(src[:src.index('with sync_playwright() as pw:')])
fails = []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
def fake_ws(ws):
    st = {'n': 0, 'url': ws.url}
    print('   WS:', ws.url.split('?')[0], '|', 'language_code=el' in ws.url, 'commit_strategy=vad' in ws.url)
    ws.send(json.dumps({'message_type': 'session_started', 'session_id': 's1', 'config': {}}))
    def on(m):
        d = json.loads(m)
        st['n'] += 1
        if d.get('commit'): ws.send(json.dumps({'message_type': 'committed_transcript', 'text': 'Πόσα προϊόντα έχουμε στην αποθήκη;'})); return
        if st['n'] == 6: ws.send(json.dumps({'message_type': 'partial_transcript', 'text': 'Πόσα'}))
        if st['n'] == 12: ws.send(json.dumps({'message_type': 'partial_transcript', 'text': 'Πόσα προϊόντα έχουμε'}))
    ws.on_message(on)
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    A = page(b, 420, 860)
    login(A, 'owner@x.gr'); A.wait_for_function('S.ready === true', timeout=20000)
    urllib.request.urlopen(urllib.request.Request(BASE + '/__ai_script', data=json.dumps([{'content': [{'type': 'text', 'text': 'Έχουμε 68 προϊόντα.'}], 'stop_reason': 'end_turn'}, {'content': [{'type': 'text', 'text': 'Γραπτή απάντηση.'}], 'stop_reason': 'end_turn'}]).encode(), headers={'Content-Type': 'application/json'})).read()
    # ψεύτικο ElevenLabs Realtime (στη θέση του WebSocket μόνο για api.elevenlabs.io)
    A.evaluate("""(() => { const Real = window.WebSocket;
      window.WebSocket = function (url) { if (!/elevenlabs/.test(url)) return new Real(url);
        const ws = { readyState: 0, url, sent: 0 }; window.__wsurl = url;
        const emit = o => ws.onmessage && ws.onmessage({ data: JSON.stringify(o) });
        ws.send = m => { const d = JSON.parse(m); ws.sent++;
          if (d.commit) return setTimeout(() => emit({ message_type: 'committed_transcript', text: 'Πόσα προϊόντα έχουμε στην αποθήκη;' }), 50);
          if (ws.sent === 4) emit({ message_type: 'partial_transcript', text: 'Πόσα' });
          if (ws.sent === 9) emit({ message_type: 'partial_transcript', text: 'Πόσα προϊόντα έχουμε' }); };
        ws.close = () => { ws.readyState = 3; ws.onclose && ws.onclose({}); };
        setTimeout(() => { ws.readyState = 1; emit({ message_type: 'session_started', session_id: 's1', config: {} }); }, 100);
        return ws; }; })()""")
    A.evaluate("window.__spoken = []; const _s = ttsSpeak; ttsSpeak = t => { window.__spoken.push(t); return _s(t); }; 0")
    A.evaluate("ACT.openAi()"); A.wait_for_timeout(300)
    check(A.locator('button.send').count() == 1 and A.locator('[data-act=ttsToggle]').count() == 0, 'βελάκι αποστολής, χωρίς κουμπί «Φωνή ON/OFF»')
    A.click('[data-act=mic]')
    A.wait_for_function("document.querySelector('#aiin').value.includes('Πόσα προϊόντα')", timeout=10000)
    check(True, 'ζωντανή καταγραφή: εμφανίζεται «%s» ενώ μιλάτε' % A.input_value('#aiin'))
    u = A.evaluate('window.__wsurl'); check('language_code=el' in u and 'commit_strategy=vad' in u and 'token=tok-live' in u, 'σύνδεση ElevenLabs με κλειδί μιας χρήσης, ελληνικά, αυτόματες παύσεις')
    check(A.evaluate("VOICE.recording") and A.locator('form.listening').count() == 1, 'το πεδίο δείχνει ότι ακούει')
    A.screenshot(path=os.environ.get('SHOTS', '/tmp') + '/voice_live.png')
    A.click('button.send')
    A.wait_for_function("!AI.busy && AI.items.some(i => i.k === 'a' && /68/.test(i.text))", timeout=15000)
    check(A.evaluate("AI.items.find(i => i.k === 'u').text") == 'Πόσα προϊόντα έχουμε στην αποθήκη;', 'στάλθηκε το τελικό κείμενο')
    check(A.evaluate("__spoken.length") == 1 and '68' in A.evaluate("__spoken[0]"), 'η απάντηση διαβάστηκε αυτόματα (ακρόαση ανοιχτή από προεπιλογή)')
    A.click('[data-act=ttsListenOff]'); A.wait_for_timeout(200)
    check(A.locator('#aivoice [data-act=ttsListenOn]').count() == 1 and A.locator('#aivoice [data-act=ttsListenOff]').count() == 1 and A.locator('#aivoice [data-act=ttsReplay]').count() == 1, 'τρία κουμπιά: Ακρόαση · Κλείσιμο ακρόασης · Επανάληψη ακρόασης')
    check(not A.evaluate("VOICE.recording") and A.evaluate("!VOICE.live"), 'το μικρόφωνο έκλεισε')
    A.fill('#aiin', 'γραπτή ερώτηση'); A.click('button.send')
    A.wait_for_function("!AI.busy && AI.items.some(i => i.k === 'a' && /Γραπτή/.test(i.text))", timeout=15000)
    check(A.evaluate("__spoken.length") == 1, '«Κλείσιμο ακρόασης»: η απάντηση μόνο γράφεται')
    A.click('[data-act=ttsReplay]'); A.wait_for_timeout(300)
    check(A.evaluate("__spoken.length") == 2, '«Επανάληψη ακρόασης» διαβάζει την τελευταία απάντηση')
    A.click('[data-act=ttsListenOn]'); A.wait_for_timeout(300)
    check(A.evaluate("AI.listen") is True and A.evaluate("__spoken.length") == 3, '«Ακρόαση»: ανοίγει και διαβάζει την τρέχουσα απάντηση')
    post('/__ai_script', [{'content': [{'type': 'text', 'text': 'Τρίτη απάντηση.'}], 'stop_reason': 'end_turn'}])
    A.fill('#aiin', 'κι άλλη γραπτή'); A.click('button.send')
    A.wait_for_function("!AI.busy && AI.items.some(i => i.k === 'a' && /Τρίτη/.test(i.text))", timeout=15000)
    check(A.evaluate("__spoken.length") == 4, 'με ανοιχτή ακρόαση, και οι γραπτές απαντήσεις διαβάζονται (μένει ανοιχτή)')
    A.click('[data-act=ttsListenOff]'); A.wait_for_timeout(200)
    check(A.evaluate("AI.listen") is False, '«Κλείσιμο ακρόασης»: μόνο γραπτά')
    long = 'γραμμή κειμένου που είναι αρκετά μεγάλη για να αλλάξει σειρά ' * 6
    h0 = A.evaluate("document.querySelector('#aiin').offsetHeight"); A.fill('#aiin', long); A.wait_for_timeout(100)
    h1 = A.evaluate("document.querySelector('#aiin').offsetHeight")
    check(h1 > h0 + 30, f'το πεδίο μεγαλώνει με το κείμενο ({h0}px → {h1}px)')
    A.screenshot(path=os.environ.get('SHOTS', '/tmp') + '/voice_after.png')
    errs = [e for e in errors if 'ERR_' not in e and '503' not in e and 'Failed to load' not in e]
    print('Σφάλματα σελίδας:', errs or 'κανένα')
    print('ΑΠΟΤΕΛΕΣΜΑ:', 'ΟΛΑ ΟΚ' if not fails and not errs else f'{len(fails)} προβλήματα')
    sys.exit(1 if fails or errs else 0)

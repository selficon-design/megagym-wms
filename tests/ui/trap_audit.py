# Έλεγχος «εγκλωβισμού»: για ένα έτοιμο προϊόν και ένα υλικό, βάζουμε απόθεμα σε ΚΑΘΕ είδος θέσης
# και ελέγχουμε ότι εμφανίζεται στην οθόνη που μπορεί να το μετακινήσει/αποσύρει, με τα νέα φίλτρα.
import json, os, sys
src = open(os.path.join(os.path.dirname(__file__), 'ui_test.py')).read().replace('os.path.dirname(__file__)', repr(os.path.dirname(__file__)))
exec(src[:src.index('with sync_playwright() as pw:')])
fails = []
def check(c, m):
    print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
with sync_playwright() as pw:
    b = pw.chromium.launch(); A = page(b, 1280, 900); login(A, 'owner@x.gr'); A.wait_for_function('S.ready === true', timeout=20000)
    A.evaluate("SB.fn('execute', { action: 'reset' })"); A.wait_for_timeout(1500)
    info = A.evaluate("""(() => {
      const mat = Object.keys(S.prod).find(p => isMat(p) && !S.prod[p].deleted);
      const prod = Object.keys(S.prod).find(p => !isMat(p) && !S.prod[p].deleted && S.prod[p].active !== false && S.cat[S.prod[p].cat]);
      const gw = Object.entries(S.wh).find(([, w]) => w.gym && w.active !== false);
      return { mat, prod, gwh: gw && gw[0], gwgym: gw && gw[1].gym, veh: Object.keys(S.veh)[0], gym: 'gGLY' }; })()""")
    print(info)
    for kind in ('prod', 'mat'):
        p = info[kind]; nm = A.evaluate(f"S.prod['{p}'].name")
        print(f'\n== {kind}: {nm}')
        r = A.evaluate(f"""(async () => {{ const U = () => 't' + uid(); const p = '{p}', veh = '{info['veh']}', gym = '{info['gym']}', gwh = {json.dumps(info['gwh'])};
          const o = []; const ex = async op => {{ try {{ const m = await execute(Object.assign({{ id: U() }}, op)); o.push(op.type + ' ok'); return m; }} catch (e) {{ o.push(op.type + ' ERR ' + e.message); }} }};
          await ex({{ type: 'IMP', wh: 'whC', lines: [{{ p, sec: 'sGEN', qty: 20 }}] }});
          for (const to of ['U', 'D', 'C']) await ex({{ type: 'STATUS', wh: 'whC', lines: [{{ p, sec: 'sGEN', from: 'N', to, qty: 1 }}] }});
          const L = await ex({{ type: 'LOAD', wh: 'whC', veh, lines: [{{ p, sec: 'sGEN', qty: 6 }}] }});
          if (L) await ex({{ type: 'PLACE', veh, gym, lines: [{{ p, pk: L.refs.pk, li: 0, qty: 2, purpose: 'repl', old: {{ x: 0, u: 1, d: 1 }}, oldDest: {{ t: 'V' }} }}] }});
          if (L && gwh) await ex({{ type: 'TOGWH', veh, wh: gwh, lines: [{{ p, pk: L.refs.pk, li: 0, qty: 1, sec: sections(gwh)[0].id }}] }});
          await ex({{ type: 'SUPPLY', gym, lines: [{{ p, qty: 2 }}] }});
          return o; }})()""")
        print('  ', r)
        A.wait_for_timeout(1200)
        t = A.evaluate(f"JSON.stringify(prodTotals('{p}'))"); print('   totals', t)
        T = json.loads(t)
        fam = 'mat' if kind == 'mat' else 'prod'
        def shows(view, setup, listsel):
            A.evaluate(f"S.form = null; go('{view}')"); A.wait_for_timeout(250)
            A.evaluate(setup); A.evaluate("render(true)"); A.wait_for_timeout(400)
            fb = A.locator(f'[data-act=fkind][data-v={fam}]')
            if fb.count(): fb.first.click(); A.wait_for_timeout(350)
            return nm in A.inner_text(listsel)
        check(shows('xfer', "S.form.wh='whC'; S.form.sec='sGEN'", 'main'), 'Αποθήκη (κανονικά) → «Μεταφορά μεταξύ αποθηκών»')
        for st in ('U', 'D', 'C'):
            check(shows('status', f"S.form.wh='whC'; S.form.sec='sGEN'; S.form.fromSt='{st}'; S.form.st='{st}'", 'main'), f'Αποθήκη ({st}) → «Καταστάσεις»')
            check(shows('retire', f"S.form.wh='whC'; S.form.sec='sGEN'; S.form.st='{st}'", 'main'), f'Αποθήκη ({st}) → «Απόσυρση»')
        if T['VN']: check(shows('ret', f"S.form.veh='{info['veh']}'", 'main'), 'Αμάξι (καινούργια) → «Επιστροφή»')
        if T['VO']: check(shows('ret', f"S.form.veh='{info['veh']}'", 'main') and A.evaluate(f"vehLots('{info['veh']}').some(l => l.p === '{p}' && l.old)"), 'Αμάξι (παλιά από αντικατάσταση) → «Επιστροφή»')
        if info['gwh'] and A.evaluate(f"whN('{p}', '{info['gwh']}')"):
            check(shows('xfer', f"S.form.wh='{info['gwh']}'; S.form.sec=sections('{info['gwh']}')[0].id", 'main'), 'Αποθήκη γυμναστηρίου → «Μεταφορά μεταξύ αποθηκών»')
        if T['G']:
            check(shows('retireg', f"S.form.gym='{info['gym']}'", 'main'), 'Εγκατεστημένα → «Απόσυρση από γυμναστήριο»')
            check(shows('gymout', f"S.form.gym='{info['gym']}'", 'main'), 'Εγκατεστημένα → «Μεταφορά από γυμναστήριο»')
        A.evaluate("S.listF = null; go('prods')"); A.wait_for_timeout(300)
        A.locator(f'[data-act=fkind][data-v={fam}]').first.click(); A.wait_for_timeout(300)
        check(nm in A.inner_text('.ptab'), 'Γενικός πίνακας προϊόντων (σωστή καρτέλα)')
        if kind == 'mat':
            A.evaluate("go('proc')"); A.wait_for_timeout(400); check(nm in A.inner_text('main'), 'Υλικό → «Επεξεργασία υλικού»')
    A.evaluate("SB.fn('execute', { action: 'reset' })"); A.wait_for_timeout(800)
    errs = [e for e in errors if 'ERR_' not in e and 'Failed to load' not in e]
    print('\nΣφάλματα σελίδας:', errs or 'κανένα')
    print('ΑΠΟΤΕΛΕΣΜΑ:', 'ΚΑΝΕΝΑΣ ΕΓΚΛΩΒΙΣΜΟΣ' if not fails and not errs else f'{len(fails)} προβλήματα')
    sys.exit(1 if fails or errs else 0)

# MEGA GYM — Warehouse Management & AI

Εφαρμογή διαχείρισης αποθηκών, οχημάτων και γυμναστηρίων, με AI βοηθό που μιλά.

- **Εφαρμογή:** GitHub Pages (ανοίγει σε υπολογιστή και κινητό, εγκαθίσταται στην αρχική οθόνη)
- **Βάση & σύνδεση χρηστών:** Supabase (email και κωδικός)
- **AI:** Claude API, μέσω του server (το κλειδί δεν φτάνει ποτέ στο κινητό)
- **Φωνή:** ElevenLabs (ομιλία και μικρόφωνο), επίσης μέσω του server

Οι κινήσεις αποθέματος γίνονται **μόνο στον server**, σε μία συναλλαγή με κλείδωμα. Ή καταχωρίζεται όλη η κίνηση ή τίποτα, και το απόθεμα δεν γίνεται ποτέ αρνητικό.

---

## Εγκατάσταση (μία φορά)

> Κανένα κλειδί δεν γράφεται σε αρχείο ή σε συζήτηση. Όλα μπαίνουν μόνο στα **GitHub Secrets**.

### 1. Supabase

1. Στο [supabase.com](https://supabase.com) πατήστε **New project**.
   - Όνομα: `mega-gym`
   - Region: **Central EU (Frankfurt)**
   - Κρατήστε το **Database password** σε ασφαλές σημείο.
2. **Authentication → Sign In / Providers → Email:** απενεργοποιήστε το **Allow new users to sign up**. Έτσι, χρήστες προσθέτει μόνο ο διαχειριστής από την εφαρμογή.
3. **Project Settings → General:** αντιγράψτε το **Project ID** (π.χ. `abcdxyz…`).
4. **Project Settings → API Keys:** αντιγράψτε το **anon / publishable** key. Αυτό είναι δημόσιο από τη φύση του· ΜΗΝ αντιγράψετε το service_role / secret.
5. [Account → Access Tokens](https://supabase.com/dashboard/account/tokens): πατήστε **Generate new token** και αντιγράψτε το.

### 2. GitHub

1. **Settings → Pages → Build and deployment → Source:** επιλέξτε **GitHub Actions**.
   - Σε δωρεάν λογαριασμό GitHub, το Pages λειτουργεί μόνο σε **δημόσιο** repository.
   - Αυτό δεν είναι πρόβλημα: στο repository δεν υπάρχουν κλειδιά ούτε δεδομένα της εταιρείας.
   - Για ιδιωτικό repository χρειάζεται GitHub Pro.
2. **Settings → Secrets and variables → Actions → New repository secret.** Προσθέστε:

| Secret | Από πού |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | βήμα 1.5 |
| `SUPABASE_PROJECT_REF` | βήμα 1.3 (Project ID) |
| `SUPABASE_DB_PASSWORD` | βήμα 1.1 |
| `SUPABASE_ANON_KEY` | βήμα 1.4 |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `ELEVENLABS_API_KEY` | ElevenLabs → Developers → API Keys |
| `ELEVENLABS_VOICE_ID` | ElevenLabs → Voices → φωνή που μιλά ελληνικά → Copy voice ID |

Προαιρετικά, στην καρτέλα **Variables**, `AI_MODEL` για άλλο μοντέλο Claude (προεπιλογή: `claude-sonnet-5-5`).

3. **Actions → Deploy → Run workflow**, ή απλώς ένα push στο `main`. Σε 2–3 λεπτά:
   - φτιάχνεται η βάση με τους κανόνες ασφαλείας,
   - ανεβαίνουν οι functions με τα κλειδιά,
   - βγαίνει η εφαρμογή στο `https://<όνομα-χρήστη>.github.io/<repo>/`.

### 3. Μετά το πρώτο deploy

1. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** η διεύθυνση της εφαρμογής.
   - **Redirect URLs:** προσθέστε την ίδια διεύθυνση. Χρειάζεται για το «Ξέχασα τον κωδικό».
2. **Πρώτος χρήστης / κάτοχος:**
   - Πηγαίνετε **Authentication → Users → Add user → Create new user**.
   - Βάλτε το email σας και κωδικό, και επιλέξτε ✔ Auto Confirm.
   - Ο πρώτος χρήστης γίνεται αυτόματα **κάτοχος (Administrator)**.
3. **Κατάλογος από τη δοκιμαστική εφαρμογή:**
   - Ανοίξτε **SQL Editor → New query**.
   - Επικολλήστε το περιεχόμενο του `import_catalog.sql` (σας δίνεται ξεχωριστά, δεν ανεβαίνει στο GitHub) και πατήστε **Run**.
   - Περιέχει προϊόντα, φωτογραφίες, είδη, αποθήκες, γυμναστήρια και οχήματα. Δεν περιέχει δοκιμαστικές κινήσεις.
   - Ό,τι υπάρχει ήδη δεν αλλάζει.
4. Ανοίξτε την εφαρμογή, συνδεθείτε και προσθέστε χρήστες από **Ρυθμίσεις → Χρήστες & δικαιώματα → + Νέος χρήστης**.

Στο κινητό, για εγκατάσταση στην αρχική οθόνη:
- **iPhone (Safari):** Κοινή χρήση → «Προσθήκη στην οθόνη Αφετηρίας».
- **Android (Chrome):** ⋮ → «Εγκατάσταση εφαρμογής».

---

## Δομή

```
web/src/            η εφαρμογή (οθόνες, μηχανισμός αποθέματος, AI, φωνή, σύνδεση)
  engine.js         μηχανισμός αποθέματος — ΙΔΙΟΣ κώδικας τρέχει και στον server
  sb.js             σύνδεση με Supabase (βάση, ζωντανή ενημέρωση, functions)
  auth.js           σύνδεση/αποσύνδεση, κωδικοί
  voice.js          ElevenLabs: ανάγνωση απαντήσεων και μικρόφωνο
web/public/         εικονίδια, manifest, service worker (PWA)
web/build.mjs       κατασκευή → dist/ και κοινός κώδικας για τις functions
supabase/migrations πίνακας, κανόνες ασφαλείας (RLS), πρώτος χρήστης = κάτοχος
supabase/functions  execute (κινήσεις), admin (χρήστες), ai, tts, stt
tests/              έλεγχοι σε πραγματικό PostgreSQL + έλεγχος εφαρμογής από άκρη σε άκρη
```

### Ασφάλεια με μια ματιά

- **Ανάγνωση:** μόνο συνδεδεμένοι χρήστες. Τα προσωπικά σημειωματάρια τα βλέπει μόνο ο κάτοχός τους.
- **Κατάλογος και δομή:** εγγραφή ανάλογα με τον ρόλο (Administrator / Manager / Employee / Viewer).
- **Απόθεμα, λίστες, κινήσεις:** ΜΟΝΟ μέσω της function `execute`.
  - Ελέγχει δικαιώματα, περιορισμό αποθηκών και υπόλοιπα.
  - Η ίδια κίνηση δεν περνά δύο φορές.
- **Χρήστες:** μόνο ο Administrator, μέσω της function `admin`. Ο κάτοχος δεν απενεργοποιείται.
- **Κλειδιά** Claude / ElevenLabs / service role: μόνο στον server (Supabase secrets).

## Τοπικοί έλεγχοι (για προγραμματιστή)

```bash
node web/build.mjs                 # κατασκευή
npm test                           # κινήσεις αποθέματος σε PostgreSQL (PGHOST/PGPORT/PGDATABASE)
node tests/ui/server.mjs &         # τοπικός «Supabase» πάνω σε PostgreSQL
python3 tests/ui/ui_test.py        # η εφαρμογή σε browser: σύνδεση, κινήσεις, RLS, AI, φωνή, χρήστες
python3 tests/ui/trap_audit.py     # κανένα προϊόν/υλικό «εγκλωβισμένο»: κάθε θέση έχει οθόνη που το μετακινεί
```

Σε κάθε pull request το GitHub τρέχει αυτόματα τους ελέγχους της βάσης (`.github/workflows/test.yml`).

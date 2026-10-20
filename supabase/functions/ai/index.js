// AI βοηθός: μεσολαβεί προς το Claude API. Το κλειδί μένει μόνο στον server.
// Τα εργαλεία (αναζήτηση αποθέματος, προσχέδια κινήσεων κ.λπ.) εκτελούνται στην εφαρμογή,
// με τα δικαιώματα του χρήστη· κάθε κίνηση περνά ξανά από τον έλεγχο της function «execute».
import { handler, json, fail } from '../_shared/http.js';

Deno.serve(handler(async req => {
  const key = Deno.env.get('ANTHROPIC_API_KEY'); if (!key) return fail('Δεν έχει οριστεί το κλειδί του Claude API (ANTHROPIC_API_KEY).', 503);
  const b = await req.json();
  if (!Array.isArray(b.messages) || !b.messages.length) return fail('Κενό μήνυμα.');
  // περικοπή μόνο σε «καθαρό» σημείο (μήνυμα χρήστη με κείμενο), ώστε να μη χωρίζονται εργαλείο/αποτέλεσμα
  let msgs = b.messages.slice(-60);
  while (msgs.length > 1 && !(msgs[0].role === 'user' && typeof msgs[0].content === 'string')) msgs = msgs.slice(1);
  const body = {
    model: Deno.env.get('AI_MODEL') || 'claude-sonnet-5-5',
    max_tokens: Math.min(Number(b.max_tokens) || 2048, 4096),
    system: String(b.system || '').slice(0, 20000),
    messages: msgs,
    tools: Array.isArray(b.tools) ? b.tools.slice(0, 40) : undefined,
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) return fail((j.error && j.error.message) || 'Σφάλμα του Claude API.', r.status === 429 ? 429 : 502);
  return json(j);
}));

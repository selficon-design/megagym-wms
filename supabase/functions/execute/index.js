// Κινήσεις αποθέματος: μοναδικός δρόμος εγγραφής για mov / bal / pk / pl / rem / μετρητές.
import { handler, json, db } from '../_shared/http.js';
import { runOp, resetTests } from '../_shared/ops.js';

Deno.serve(handler(async (req, user) => {
  const body = await req.json();
  if (body && body.action === 'reset') return json(await resetTests(db(), user.id, !!body.withNotes));
  return json({ mov: await runOp(db(), user.id, body && body.op) });
}));

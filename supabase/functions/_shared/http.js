// Κοινά για όλες τις functions: CORS, απαντήσεις JSON, ταυτοποίηση χρήστη, σύνδεση βάσης.
import postgres from 'npm:postgres@3.4.4';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
export const fail = (message, status = 400) => json({ error: message }, status);

let _sql = null;
export const db = () => (_sql ||= postgres(Deno.env.get('SUPABASE_DB_URL'), { max: 3, prepare: false }));

// Επιστρέφει τον συνδεδεμένο χρήστη από το token της εφαρμογής (ή null)
export async function getUser(req) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/user', { headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') } });
  if (!r.ok) return null;
  const u = await r.json(); return u && u.id ? u : null;
}

// Υποδοχή αιτήματος: CORS, μόνο POST, απαιτεί σύνδεση
export function handler(fn) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return fail('Μόνο POST.', 405);
    try {
      const user = await getUser(req); if (!user) return fail('Συνδεθείτε ξανά.', 401);
      return await fn(req, user);
    } catch (e) {
      console.error(e);
      return fail(e && e.message ? e.message : 'Σφάλμα διακομιστή.', e && e.status ? e.status : 500);
    }
  };
}

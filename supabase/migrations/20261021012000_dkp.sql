-- Τύπος «ΛΑΜΑΡΙΝΕΣ» (ΜΕΤΑΛΛΑ › ΛΑΜΑΡΙΝΕΣ) → «DKP ΛΑΜΑΡΙΝΕΣ», κατόπιν αιτήματος του χρήστη.
-- Αλλάζει ΜΟΝΟ το όνομα αυτού του τύπου και ΜΟΝΟ αν έχει ακόμα το παλιό όνομα. Προϊόντα δεν αγγίζονται.
update public.docs d
   set data = jsonb_set(d.data, '{subs}', (
     select jsonb_agg(
              case when s->>'id' = 'smvctcthsl3c7wj' then jsonb_set(s, '{types}', (
                select jsonb_agg(case when t->>'id' = 'tmvctdorc6e34dh' and t->>'name' = 'ΛΑΜΑΡΙΝΕΣ'
                                      then t || jsonb_build_object('name', 'DKP ΛΑΜΑΡΙΝΕΣ') else t end order by o2)
                  from jsonb_array_elements(s->'types') with ordinality as x(t, o2)))
              else s end order by o1)
       from jsonb_array_elements(d.data->'subs') with ordinality as y(s, o1)))
 where d.path = 'cats/cmvctcoggv80guc'
   and d.data->'subs' @> '[{"id":"smvctcthsl3c7wj","types":[{"id":"tmvctdorc6e34dh","name":"ΛΑΜΑΡΙΝΕΣ"}]}]';

-- Ελάχιστη δομή για τους ελέγχους (μία αποθήκη, ένα αμάξι, ένα γυμναστήριο, ένα προϊόν)
insert into public.docs (path, coll, id, data) values
 ('wh/whC', 'wh', 'whC', '{"code":"ΤΑΤ","name":"ΤΑΤΟΙΟΥ 45","active":true,"sections":[{"id":"sGEN","name":"ΓΕΝΙΚΟΣ ΧΩΡΟΣ","active":true}]}'),
 ('veh/v1', 'veh', 'v1', '{"code":"ΑΜ1","name":"ΑΜΑΞΙ 1","active":true}'),
 ('gyms/gGLY', 'gyms', 'gGLY', '{"code":"ΓΛΥΦ","name":"MEGA GYM Γλυφάδα","active":true}'),
 ('prods/pTST', 'prods', 'pTST', '{"code":"T","name":"Δοκιμή","unit":"τεμ"}')
on conflict (path) do nothing;

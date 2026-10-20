\set ON_ERROR_STOP 0
insert into auth.users values ('11111111-1111-1111-1111-111111111111','owner@x.gr','{"name":"Ιδιοκτήτης"}');
insert into auth.users values ('22222222-2222-2222-2222-222222222222','emp@x.gr','{"name":"Υπάλληλος"}');
insert into auth.users values ('33333333-3333-3333-3333-333333333333','view@x.gr','{}');
insert into docs (path,coll,id,data) values ('roles/22222222-2222-2222-2222-222222222222','roles','22222222-2222-2222-2222-222222222222','{"role":"employee"}');
select path, data->>'email' from docs where coll in ('members') or path='cfg/owner' order by 1;
set role authenticated;
-- owner
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'owner role', app_role();
insert into docs values ('wh/wT','wh','wT','{"name":"Τεστ"}') ; select 'owner wh insert ok';
insert into docs values ('bal/x','bal','x','{"q":{}}'); 
insert into docs values ('roles/33333333-3333-3333-3333-333333333333','roles','33333333-3333-3333-3333-333333333333','{"role":"viewer"}'); select 'owner sets role ok';
insert into docs values ('data/users/11111111-1111-1111-1111-111111111111/note_a','data/users/11111111-1111-1111-1111-111111111111','note_a','{"subj":"ιδιωτικό"}');
-- employee
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'emp role', app_role();
insert into docs values ('prods/pT','prods','pT','{"name":"x"}'); select 'emp prod ok';
insert into docs values ('wh/wE','wh','wE','{"name":"x"}');
insert into docs values ('cfg/counters2','cfg','counters2','{}');
update docs set data = '{"role":"admin"}' where path = 'roles/22222222-2222-2222-2222-222222222222';
select 'emp still', app_role();
select 'emp sees owner note:', count(*) from docs where coll like 'data/users/%';
insert into docs values ('inv/i1','inv','i1','{"status":"done"}');
insert into docs values ('inv/i2','inv','i2','{"status":"draft"}'); select 'emp inv draft ok';
-- viewer
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'viewer role', app_role();
insert into docs values ('prods/pV','prods','pV','{}');
insert into docs values ('data/users/33333333-3333-3333-3333-333333333333/note_v','data/users/33333333-3333-3333-3333-333333333333','note_v','{"subj":"v"}'); select 'viewer own note ok';
select 'viewer sees notes:', count(*) from docs where coll like 'data/users/%';
delete from docs where path='prods/pT';
reset role;
select path from docs where path in ('wh/wT','bal/x','prods/pT','wh/wE','inv/i1','inv/i2','prods/pV') order by 1;

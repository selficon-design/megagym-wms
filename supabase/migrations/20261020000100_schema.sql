-- =====================================================================
-- MEGA GYM — Warehouse Management & AI
-- Αποθήκευση: ένας πίνακας εγγράφων (docs) με τη δομή της δοκιμαστικής
-- εφαρμογής (path = συλλογή/id, data = JSON). Έτσι οι οθόνες και ο
-- μηχανισμός αποθέματος μεταφέρονται αυτούσια.
--
-- Ασφάλεια:
--  • ανάγνωση: κάθε συνδεδεμένος χρήστης, εκτός από τα προσωπικά
--    σημειωματάρια (data/users/<uid>) που τα βλέπει μόνο ο κάτοχός τους
--  • εγγραφή καταλόγου/δομής: ανά ρόλο (app_role)
--  • κινήσεις αποθέματος (mov, bal, pk, pl, rem, cfg/counters): ΜΟΝΟ από
--    τη function «execute», σε συναλλαγή, με έλεγχο δικαιωμάτων
-- =====================================================================

create table if not exists public.docs (
  path        text primary key,
  coll        text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint docs_path_ok check (path = coll || '/' || id)
);
create index if not exists docs_coll_idx on public.docs (coll);
create index if not exists docs_mov_no_idx on public.docs (((data->>'no')::bigint) desc) where coll = 'mov';

-- πλήρης παλιά εγγραφή στα realtime μηνύματα
alter table public.docs replica identity full;

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

-- ---------------------------------------------------------------------
-- Ρόλος του τρέχοντος χρήστη: ο κάτοχος (cfg/owner) είναι πάντα admin.
-- ---------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then null
    when exists (select 1 from public.docs where path = 'cfg/owner' and data->>'uid' = auth.uid()::text) then 'admin'
    else coalesce((select data->>'role' from public.docs where path = 'roles/' || auth.uid()::text), 'viewer')
  end
$$;

create or replace function public.can_write_doc(p_coll text, p_path text, p_data jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := public.app_role(); me text := auth.uid()::text;
begin
  if me is null then return false; end if;
  -- προσωπικό σημειωματάριο & προφίλ
  if p_coll = 'data/users/' || me then return true; end if;
  if p_path = 'members/' || me then return true; end if;
  -- παλιές κοινές σημειώσεις: μόνο ο συντάκτης τους
  if p_coll = 'notes' then return coalesce(p_data->>'by', '') = me; end if;
  if r = 'viewer' or r is null then return false; end if;
  -- κατάλογος
  if p_coll in ('prods', 'photos') then return r in ('admin', 'manager', 'employee'); end if;
  if p_coll = 'cats' then return r in ('admin', 'manager'); end if;
  -- δομή εταιρείας
  if p_coll in ('wh', 'gyms', 'veh') or p_path in ('cfg/company', 'cfg/units') then return r in ('admin', 'manager'); end if;
  -- πρόχειρα απογραφών (η ολοκλήρωση γίνεται από τη function execute)
  if p_coll = 'inv' then return r in ('admin', 'manager', 'employee') and coalesce(p_data->>'status', 'draft') = 'draft'; end if;
  -- ρόλοι χρηστών
  if p_coll = 'roles' then return r = 'admin'; end if;
  return false;
end $$;

alter table public.docs enable row level security;

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated
  using (coll not like 'data/users/%' or coll = 'data/users/' || auth.uid()::text);

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check (public.can_write_doc(coll, path, data));

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (public.can_write_doc(coll, path, data))
  with check (public.can_write_doc(coll, path, data));

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated
  using (public.can_write_doc(coll, path, data));

-- ---------------------------------------------------------------------
-- Ο πρώτος χρήστης που δημιουργείται γίνεται κάτοχος (Administrator).
-- ---------------------------------------------------------------------
create or replace function public.on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.docs where path = 'cfg/owner') then
    insert into public.docs (path, coll, id, data)
    values ('cfg/owner', 'cfg', 'owner', jsonb_build_object('uid', new.id::text, 'email', new.email, 'ts', (extract(epoch from now()) * 1000)::bigint));
  end if;
  insert into public.docs (path, coll, id, data)
  values ('members/' || new.id::text, 'members', new.id::text,
          jsonb_build_object('name', coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'email', new.email, 'first', (extract(epoch from now()) * 1000)::bigint))
  on conflict (path) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_new_user();

-- Ζωντανή ενημέρωση όλων των οθονών (Supabase Realtime)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

grant select, insert, update, delete on public.docs to authenticated;

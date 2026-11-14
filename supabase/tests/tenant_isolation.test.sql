-- Integration tests for an isolated local Supabase database only.
-- Run after migrations with: supabase test db
-- These tests have not been executed merely by committing this file.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- The application deliberately removes global PUBLIC EXECUTE for new
-- postgres-owned functions. Grant only this test extension's functions to the
-- simulated client roles so assertions can run. Everything rolls back below.
do $food_go_test_pgtap_grants$
declare
  test_function record;
begin
  for test_function in
    select n.nspname as function_schema, p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as function_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid
      and d.refclassid = 'pg_extension'::regclass and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid
    where e.extname = 'pgtap' and p.prokind = 'f'
  loop
    execute format('grant execute on function %I.%I(%s) to anon, authenticated',
      test_function.function_schema, test_function.function_name,
      test_function.function_arguments);
  end loop;
end;
$food_go_test_pgtap_grants$;

select plan(27);

-- Intentionally omit RLS and explicit grants: these probes test default object
-- privileges themselves. Each new application object needs an explicit grant.
create table public.food_go_future_privilege_probe (id integer primary key);
insert into public.food_go_future_privilege_probe(id) values (1);
create function public.food_go_future_function_probe()
returns integer language sql immutable set search_path = '' as $$ select 1; $$;

do $food_go_test_service_defaults$
begin
  if not has_table_privilege('service_role', 'public.food_go_future_privilege_probe', 'SELECT')
    or not has_function_privilege('service_role', 'public.food_go_future_function_probe()', 'EXECUTE') then
    raise exception 'The fixture requires preserved explicit service_role public defaults';
  end if;
end;
$food_go_test_service_defaults$;

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.invalid', '{"display_name":"Owner A"}'),
  ('10000000-0000-4000-8000-000000000002', 'owner-b@example.invalid', '{"display_name":"Owner B"}'),
  ('10000000-0000-4000-8000-000000000003', 'staff@example.invalid', '{"role":"admin","is_admin":true}');
-- The auth trigger normally creates these. Make both owner fixtures explicit
-- so the cross-user UPDATE denial cannot pass just because its target is absent.
insert into public.profiles(id, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'Owner A'),
  ('10000000-0000-4000-8000-000000000002', 'Owner B')
on conflict (id) do nothing;
insert into public.organizations(id, name) values
  ('20000000-0000-4000-8000-000000000001', 'Venue group A'),
  ('20000000-0000-4000-8000-000000000002', 'Venue group B');
insert into public.organization_members(organization_id, user_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'staff'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner');
insert into public.venues(id, organization_id, slug, name, venue_type, cuisine, address, suburb, state, postcode, status, ownership_verified_at) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'test-public', 'Public A', 'restaurant', 'Australian', '1 Example Street', 'Melbourne', 'VIC', '3000', 'published', now()),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'test-draft-a', 'Draft A', 'cafe', 'Australian', '2 Example Street', 'Melbourne', 'VIC', '3000', 'draft', null),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'test-draft-b', 'Draft B', 'market', 'Australian', '3 Example Street', 'Sydney', 'NSW', '2000', 'draft', null);
insert into public.venue_contacts(venue_id, email, phone)
values ('30000000-0000-4000-8000-000000000003', 'private@example.invalid', '+61 2 9000 0000');
insert into public.check_ins(id, user_id, venue_id, verification_method, idempotency_key)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', 'signed_qr', '50000000-0000-4000-8000-000000000001');

set local role anon;
select throws_ok('select * from public.food_go_future_privilege_probe', '42501', null,
  'anonymous users cannot read a future table without an explicit grant');
select throws_ok('select public.food_go_future_function_probe()', '42501', null,
  'anonymous users cannot call a future function without an explicit grant');
select is((select count(*) from public.venues), 1::bigint, 'anonymous users see only published verified venues');
select is((select count(*) from public.venues where slug = 'test-draft-b'), 0::bigint, 'anonymous users cannot see drafts');
select throws_ok('select * from public.venue_contacts', '42501', null, 'private contacts are not anonymous data');
select throws_ok($$insert into public.venues(name) values ('Forged')$$, '42501', null, 'anonymous users cannot create venues');
select throws_ok('select * from public.profiles', '42501', null, 'profiles are private by default');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok('select * from public.food_go_future_privilege_probe', '42501', null,
  'authenticated users cannot read a future table without an explicit grant');
select throws_ok('select public.food_go_future_function_probe()', '42501', null,
  'authenticated users cannot call a future function without an explicit grant');
select is((select count(*) from public.organizations), 1::bigint, 'owner sees only their organisation');
select is((select count(*) from public.venues where slug = 'test-draft-b'), 0::bigint, 'owner cannot read another draft');
select is((select count(*) from public.venue_contacts), 0::bigint, 'owner cannot read another venue contact');
select is((select count(*) from public.venues), 2::bigint, 'owner sees their published and draft venues');
select throws_ok($$insert into public.organization_members values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'owner', now())$$,
  '42501', null, 'client cannot join another organisation');
select throws_ok($$update public.venues set status = 'published' where slug = 'test-draft-a'$$,
  '42501', null, 'owner cannot publish their own venue');
select throws_ok($$update public.venues set ownership_verified_at = now() where slug = 'test-draft-a'$$,
  '42501', null, 'owner cannot self-verify');
select throws_ok($$update public.venues set organization_id = '20000000-0000-4000-8000-000000000002' where slug = 'test-draft-a'$$,
  '42501', null, 'owner cannot move a venue into another organisation');
select throws_ok($$insert into public.check_ins(user_id) values ('10000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'client cannot forge a check-in');
select throws_ok($$insert into public.reward_events(user_id, points) values ('10000000-0000-4000-8000-000000000001', 1000)$$,
  '42501', null, 'client cannot mint points');
select throws_ok($$insert into public.food_discoveries(user_id) values ('10000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'client cannot forge a dish discovery');
with changed as (update public.profiles set display_name = 'Changed by another user'
  where id = '10000000-0000-4000-8000-000000000002' returning id)
select is((select count(*) from changed),
  0::bigint, 'owner cannot edit another profile');
select lives_ok($$update public.venues set description = 'An allowed venue description.' where slug = 'test-draft-a'$$,
  'owner can update permitted venue fields');
with changed as (update public.venues set name = 'Changed business identity'
  where slug = 'test-public' returning status)
select is((select status from changed),
  'pending', 'changing business identity requires verification again');
select ok((select ownership_verified_at is null from public.venues where slug = 'test-public'),
  'identity change clears verification');
select is((select count(*) from public.check_ins), 1::bigint, 'user sees their own check-in history');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
with changed as (update public.venues set description = 'Staff attempted edit'
  where slug = 'test-draft-a' returning id)
select is((select count(*) from changed),
  0::bigint, 'staff cannot edit venues, even when their user metadata says admin');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.check_ins), 0::bigint, 'another owner cannot read private visit history');

reset role;
select * from finish();
rollback;

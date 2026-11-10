-- Integration tests for an isolated local Supabase database only.
-- Run after migrations with: supabase test db
-- These tests have not been executed merely by committing this file.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.invalid', '{"display_name":"Owner A"}'),
  ('10000000-0000-4000-8000-000000000002', 'owner-b@example.invalid', '{"display_name":"Owner B"}'),
  ('10000000-0000-4000-8000-000000000003', 'staff@example.invalid', '{"role":"admin","is_admin":true}');
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
select is((select count(*) from public.venues), 1::bigint, 'anonymous users see only published verified venues');
select is((select count(*) from public.venues where slug = 'test-draft-b'), 0::bigint, 'anonymous users cannot see drafts');
select throws_ok('select * from public.venue_contacts', '42501', null, 'private contacts are not anonymous data');
select throws_ok($$insert into public.venues(name) values ('Forged')$$, '42501', null, 'anonymous users cannot create venues');
select throws_ok('select * from public.profiles', '42501', null, 'profiles are private by default');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
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
select is((with changed as (update public.profiles set display_name = 'Changed by another user'
  where id = '10000000-0000-4000-8000-000000000002' returning id) select count(*) from changed),
  0::bigint, 'owner cannot edit another profile');
select lives_ok($$update public.venues set description = 'An allowed venue description.' where slug = 'test-draft-a'$$,
  'owner can update permitted venue fields');
select is((with changed as (update public.venues set name = 'Changed business identity'
  where slug = 'test-public' returning status) select status from changed),
  'pending', 'changing business identity requires verification again');
select ok((select ownership_verified_at is null from public.venues where slug = 'test-public'),
  'identity change clears verification');
select is((select count(*) from public.check_ins), 1::bigint, 'user sees their own check-in history');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((with changed as (update public.venues set description = 'Staff attempted edit'
  where slug = 'test-draft-a' returning id) select count(*) from changed),
  0::bigint, 'staff cannot edit venues, even when their user metadata says admin');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.check_ins), 0::bigint, 'another owner cannot read private visit history');

reset role;
select * from finish();
rollback;

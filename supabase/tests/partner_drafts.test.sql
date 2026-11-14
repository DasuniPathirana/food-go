-- Disposable local/staging target only. All fixtures and test grants roll back.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
do $test_grants$
declare f record;
begin
  for f in select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid
      and d.refclassid = 'pg_extension'::regclass and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid where e.extname = 'pgtap' and p.prokind = 'f'
  loop execute format('grant execute on function %I.%I(%s) to anon, authenticated', f.nspname, f.proname, f.args); end loop;
end;
$test_grants$;
select plan(29);
insert into auth.users(id, email, email_confirmed_at, phone, phone_confirmed_at) values
 ('61000000-0000-4000-8000-000000000001', 'partner-a@example.invalid', now(), null, null),
 ('61000000-0000-4000-8000-000000000002', 'partner-b@example.invalid', now(), null, null),
 ('61000000-0000-4000-8000-000000000003', 'unconfirmed@example.invalid', null, null, null),
 ('61000000-0000-4000-8000-000000000004', null, null, '61412345678', now()),
 ('61000000-0000-4000-8000-000000000005', null, null, '447123456789', now());
select set_config('food_go.test_draft', '{"name":"Example Partner","email":"hello@example.invalid","phone":"+61 3 9000 0000","address":"12 Example Street","suburb":"Melbourne","state":"VIC","postcode":"3000","cuisine":"Australian","venueType":"cafe","description":"A neighbourhood cafe for seasonal food and coffee.","gameEnabled":true,"acceptedTerms":true}', true);

set local role anon;
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 '42501', null, 'anonymous users cannot execute draft creation');
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 '42501', null, 'authenticated role without a user cannot create a draft');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 '42501', null, 'unconfirmed users cannot create drafts through direct RPC calls');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 'verified Australian phone accounts can create drafts without an email account');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 '42501', null, 'verified foreign phone accounts cannot bypass Australian identity scope');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 'confirmed accounts can create a venue draft');
select is((select count(*) from public.venues), 1::bigint, 'one venue was created');
select is((select count(*) from public.organizations), 1::bigint, 'one organisation was created');
select is((select role from public.organization_members where user_id = auth.uid()), 'owner', 'caller becomes owner of only the new organisation');
select is((select email from public.venue_contacts), 'hello@example.invalid', 'private business contact is created atomically');
select is((select status from public.venues), 'draft', 'new listings are drafts');
select ok((select ownership_verified_at is null from public.venues), 'draft creation never verifies ownership');
select is((public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')->>'id'),
 (select id::text from public.venues), 'same submission returns the original venue');
select is((select count(*) from public.organizations), 1::bigint, 'idempotent replay creates no extra organisation');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"name":"Changed Example"}', '71000000-0000-4000-8000-000000000001')$$,
 'FG003', null, 'reusing a key with changed details fails');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000002')$$,
 'FG001', null, 'duplicate venue creation with a new key fails');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"status":"published"}', '71000000-0000-4000-8000-000000000002')$$,
 '22023', null, 'direct RPC rejects client publishing authority');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"acceptedTerms":false}', '71000000-0000-4000-8000-000000000002')$$,
 '22023', null, 'direct RPC requires explicit authorisation');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || jsonb_build_object('name', repeat('x',121)), '71000000-0000-4000-8000-000000000002')$$,
 '22023', null, 'direct RPC validates bounded names');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"phone":"not a number"}', '71000000-0000-4000-8000-000000000002')$$,
 '22023', null, 'direct RPC validates business phone');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"email":"invalid"}', '71000000-0000-4000-8000-000000000002')$$,
 '22023', null, 'direct RPC validates contact email');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.venues), 0::bigint, 'other accounts cannot read the draft');
select throws_ok('select * from private.venue_draft_requests', '42501', null, 'clients cannot read idempotency records');
select is((select count(*) from public.venue_contacts), 0::bigint, 'other accounts cannot read draft contacts');
select is((select count(*) from public.organization_members), 0::bigint, 'other accounts gain no organisation membership');
reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($create_more$
 do $extra$ declare i integer; begin
   for i in 2..5 loop
     perform public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb ||
       jsonb_build_object('name', 'Partner Venue ' || i, 'address', i || ' Example Road'),
       ('71000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid);
   end loop;
 end; $extra$;
 $create_more$, 'accounts can create up to five unique venue listings');
select throws_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb || '{"name":"One Too Many","address":"6 Example Road"}', '71000000-0000-4000-8000-000000000006')$$,
 'FG002', null, 'direct RPC enforces the account creation limit');
select lives_ok($$select public.food_go_create_venue_draft(current_setting('food_go.test_draft')::jsonb, '71000000-0000-4000-8000-000000000001')$$,
 'idempotent retry still succeeds at the creation limit');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*) from public.venues), 0::bigint, 'new drafts never appear in public discovery');
reset role;
select * from finish();
rollback;

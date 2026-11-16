begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $test_grants$
declare item record;
begin
  for item in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',item.nspname,item.proname,item.args); end loop;
end;
$test_grants$;
select plan(20);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('81000000-0000-4000-8000-000000000001','owner@journey.example.invalid',now(),'{"account_type":"partner"}'),
('81000000-0000-4000-8000-000000000002','customer@journey.example.invalid',now(),'{}'),
('81000000-0000-4000-8000-000000000003','stranger@journey.example.invalid',now(),'{}');
insert into auth.sessions(id,user_id) select id,id from auth.users where id in
('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003');
insert into public.organizations(id,name) values('81000000-0000-4000-8000-000000000010','Journey test group');
insert into public.organization_members(organization_id,user_id,role)
values('81000000-0000-4000-8000-000000000010','81000000-0000-4000-8000-000000000001','owner');
insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at,game_enabled)
values('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000010','journey-fixture','Fixture restaurant','restaurant','Italian','123 Test Street','Melbourne','VIC','3000','published',now(),true);
insert into public.venue_dishes(id,venue_id,name) values('81000000-0000-4000-8000-000000000012','81000000-0000-4000-8000-000000000011','Fixture pasta');
insert into private.exploration_codes(id,venue_id,issuer,token_hash,expires_at)
values('81000000-0000-4000-8000-000000000013','81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000001',md5(md5('visit')),now()+interval '10 minutes');
insert into private.exploration_codes(venue_id,dish_id,issuer,token_hash,expires_at)
values('81000000-0000-4000-8000-000000000011','81000000-0000-4000-8000-000000000012','81000000-0000-4000-8000-000000000001',md5(md5('dish')),now()+interval '10 minutes');
set local role anon;
select throws_ok($$select public.food_go_customer_journey()$$,'42501',null,'anonymous collection reads denied');
select throws_ok($$select * from private.exploration_codes$$,'42501',null,'verification codes cannot be read directly');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","session_id":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_customer_journey()->>'accountType','explorer','customer interface selected');
select throws_ok($$select public.food_go_partner_workspace('{"action":"read","venueId":"81000000-0000-4000-8000-000000000011"}')$$,'42501',null,'customer cannot read restaurant workspace');
select lives_ok($$select public.food_go_customer_journey('{"action":"save","kind":"venue","id":"81000000-0000-4000-8000-000000000011","saved":true}')$$,'save published venue');
select is(jsonb_array_length(public.food_go_customer_journey()->'savedVenues'),1,'saved venue persists in account');
select throws_ok($$select public.food_go_customer_journey('{"action":"redeem","code":"invalid"}')$$,'22023',null,'malformed evidence rejected');
select is((public.food_go_customer_journey(jsonb_build_object('action','redeem','code',md5('visit')))->>'points')::integer,50,'visit code awards fixed XP');
select is((public.food_go_customer_journey(jsonb_build_object('action','redeem','code',md5('visit')))->>'points')::integer,0,'visit retry cannot duplicate XP');
select is((public.food_go_customer_journey(jsonb_build_object('action','redeem','code',md5('dish')))->>'points')::integer,100,'dish has independent evidence and XP');
select is((public.food_go_game_profile()->>'xp')::integer,150,'Passport total includes verified visits and dishes');
select is(jsonb_array_length(public.food_go_customer_journey()->'discoveries'),1,'verified dish persists in FoodDex');
select throws_ok($$insert into public.reward_events(user_id,points,source_type,source_id) values(auth.uid(),9999,'venue_visit',gen_random_uuid())$$,'42501',null,'customer cannot forge points');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","session_id":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_customer_journey()->>'accountType','partner','owner interface selected');
select is(jsonb_array_length(public.food_go_customer_journey()->'savedVenues'),0,'saved data isolated across accounts');
select is((public.food_go_partner_workspace('{"action":"read","venueId":"81000000-0000-4000-8000-000000000011"}')->>'visits')::integer,1,'owner sees visit totals');
select throws_ok($$select public.food_go_customer_journey(jsonb_build_object('action','redeem','code',md5('visit')))$$,'42501',null,'owner cannot earn visits at own restaurant');
reset role;
update private.exploration_codes set expires_at=now()-interval '1 minute';
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","session_id":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_customer_journey(jsonb_build_object('action','redeem','code',md5('visit')))$$,'FG404',null,'expired code cannot award');
select throws_ok($$select public.food_go_partner_workspace('{"action":"issue","venueId":"81000000-0000-4000-8000-000000000011"}')$$,'42501',null,'another account cannot issue codes');
reset role;
delete from auth.sessions where id='81000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.food_go_customer_journey()$$,'42501',null,'revoked session loses collection access');
reset role;
select * from finish();
rollback;

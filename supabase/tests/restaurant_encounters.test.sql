-- Explicitly approved development/test database only. All fixture identities,
-- campaigns, codes, inventory, pgTAP helpers and temporary grants roll back.
-- This sequential suite does not claim to demonstrate competing transactions.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $test_grants$ declare f record; begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',f.nspname,f.proname,f.args); end loop;
end; $test_grants$;

create function pg_temp.ec_user(actor uuid, assurance text default 'aal1', session_ref uuid default null) returns void
language plpgsql set search_path='' as $$ begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',coalesce(session_ref,actor),'role','authenticated','aal',assurance)::text,true);
end; $$;
create function pg_temp.ec_keep(key text,value text) returns void
language plpgsql set search_path='' as $$ begin perform set_config('food_go.ec.'||key,coalesce(value,''),true); end; $$;
create function pg_temp.ec_action(command jsonb) returns jsonb language sql set search_path='' as $$
  select public.food_go_encounter_journey(command || jsonb_build_object('requestId',coalesce(command->>'requestId',gen_random_uuid()::text)));
$$;
create function pg_temp.ec_rejected(command jsonb) returns boolean language plpgsql set search_path='' as $$
declare response jsonb;
begin
  response:=pg_temp.ec_action(command);
  return response->'result'->'error' is not null and response->'result'->'error'<>'null'::jsonb;
exception when sqlstate '42501' or sqlstate 'FG404' or sqlstate 'FG409' or sqlstate 'FG429' then return true;
end; $$;
create function pg_temp.ec_version(encounter_ref uuid) returns text language sql set search_path='' as $$
  select campaign->>'version' from jsonb_array_elements(public.food_go_encounter_journey()->'campaigns') campaign where campaign->>'id'=encounter_ref::text;
$$;
create function pg_temp.ec_create(encounter_ref uuid, pool_kind text default 'collectible') returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('action','create','requestId',gen_random_uuid(),'encounterId',encounter_ref,
    'venueId','f2000000-0000-4000-8000-000000000002','title','Fixture kitchen encounter','description','A disposable approved encounter fixture.',
    'theme','restaurant','radiusMetres',60,'cooldownHours',24,'startsAt',clock_timestamp()-interval '1 hour','endsAt',clock_timestamp()+interval '1 day',
    'maxClaims',10,'offerValidityHours',1,'pool',jsonb_build_array(case pool_kind when 'offer' then
      jsonb_build_object('id',gen_random_uuid(),'kind','offer','promotionId','f6000000-0000-4000-8000-000000000001','rarity','rare','weight',1)
      else jsonb_build_object('id',gen_random_uuid(),'kind','collectible','name','Fixture kitchen token','description','A non-transferable fixture collectible.','rarity','common','weight',1) end));
$$;
grant execute on function pg_temp.ec_user(uuid,text,uuid),pg_temp.ec_keep(text,text),pg_temp.ec_action(jsonb),pg_temp.ec_rejected(jsonb),pg_temp.ec_version(uuid),pg_temp.ec_create(uuid,text) to anon,authenticated;
select plan(165);

insert into auth.users(id,email,email_confirmed_at) values
 ('f1000000-0000-4000-8000-000000000001','owner@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000002','player@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000003','operator@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000004','other@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000005','manager@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000006','other-owner@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000007','unverified@encounter.example.invalid',null),
 ('f1000000-0000-4000-8000-000000000008','stock-first@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000009','stock-other@encounter.example.invalid',now()),
 ('f1000000-0000-4000-8000-000000000010','sessions@encounter.example.invalid',now());
insert into auth.sessions(id,user_id) select id,id from auth.users where id::text like 'f1000000-%';
insert into private.food_go_operators(user_id) values('f1000000-0000-4000-8000-000000000003');
insert into public.organizations(id,name) values
 ('f2000000-0000-4000-8000-000000000001','Encounter fixture kitchen'),
 ('f2000000-0000-4000-8000-000000000003','Other encounter fixture kitchen');
insert into public.organization_members(organization_id,user_id,role) values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','owner'),
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','manager'),
 ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000006','owner');
insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at,game_enabled,longitude,latitude) values
 ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','encounter-fixture-kitchen','Encounter fixture kitchen','restaurant','Australian','1 Fixture Street','Melbourne','VIC','3000','published',now(),true,144.967146,-37.816813),
 ('f2000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000003','other-encounter-fixture','Other encounter fixture','cafe','Australian','2 Fixture Street','Melbourne','VIC','3000','published',now(),true,144.967146,-37.816813);
insert into public.promotions(id,venue_id,title,description,starts_at,ends_at,status) values
 ('f6000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','Fixture approved offer','Only the approved fixture terms apply.',now()-interval '1 day',now()+interval '7 days','published'),
 ('f6000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000004','Other kitchen offer','This offer belongs to the other fixture kitchen.',now()-interval '1 day',now()+interval '7 days','published'),
 ('f6000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','Unpublished fixture offer','This fixture offer must never be granted.',now()-interval '1 day',now()+interval '7 days','draft');
select pg_temp.ec_keep('rewards_before',(select count(*)::text from public.reward_events where user_id::text like 'f1000000-%'));
select pg_temp.ec_keep('visits_before',(select count(*)::text from public.check_ins where user_id::text like 'f1000000-%'));
select pg_temp.ec_keep('quests_before',(select count(*)::text from private.adventure_rewards where user_id::text like 'f1000000-%'));

select ok((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
  and c.relname in ('encounter_campaigns','encounter_pool_items','encounter_sessions','encounter_codes','encounter_inventory','encounter_accounts','encounter_requests','encounter_review_audit')),'all encounter state tables use RLS');
select ok((select not prosecdef from pg_proc where oid='public.food_go_encounter_journey(jsonb)'::regprocedure),'account RPC is an invoker wrapper');
select ok((select not prosecdef from pg_proc where oid='public.food_go_venue_encounters(uuid)'::regprocedure),'public venue RPC is an invoker wrapper');
select ok(not exists(select 1 from information_schema.columns where table_schema='private' and table_name like 'encounter_%'
  and column_name in ('token','code','raw_code','longitude','latitude','accuracy')),'encounter tables have no raw challenge or GPS fields');
set local role anon;
select throws_ok('select public.food_go_encounter_journey()','42501',null,'anonymous inventory access denied');
select throws_ok('select * from private.encounter_inventory','42501',null,'anonymous inventory table access denied');
select is(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters','[]'::jsonb,'published restaurants do not silently acquire invented encounters');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000007');
set local role authenticated;
select throws_ok('select public.food_go_encounter_journey()','42501',null,'unverified accounts cannot read or mutate encounter state');
reset role;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_encounter_journey()','42501',null,'a confirmed account still needs an active session');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(public.food_go_encounter_journey()->'inventory','[]'::jsonb,'new customers have no fabricated inventory');
select is(public.food_go_encounter_journey()->'managedVenues','[]'::jsonb,'customers have no manager authority');
select is(public.food_go_encounter_journey()->'operator','false'::jsonb,'ordinary customers cannot self-assign operator access');
select throws_ok('select * from private.encounter_codes','42501',null,'authenticated clients cannot read challenge hashes');
select throws_ok('select * from private.encounter_requests','42501',null,'authenticated clients cannot read request receipts');
select throws_ok($$select public.food_go_encounter_journey('{"action":"read","userId":"f1000000-0000-4000-8000-000000000001"}')$$,'22023',null,'clients cannot choose another inventory account');
select throws_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001'))$$,'42501',null,'customers cannot create restaurant reward pools');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001'))$$,'42501',null,'another restaurant owner cannot create pools for this venue');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001') || '{"xp":99999}'::jsonb)$$,'22023',null,'owners cannot supply XP authority');
select throws_ok($$select pg_temp.ec_action(jsonb_set(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001','offer'),'{pool,0,name}','"Invented discount"'))$$,'22023',null,'offer names and terms cannot be invented in the client pool');
select throws_ok($$select pg_temp.ec_action(jsonb_set(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001','offer'),'{pool,0,promotionId}','"f6000000-0000-4000-8000-000000000002"'))$$,'FG404',null,'offer entries cannot reference another restaurant promotion');
select throws_ok($$select pg_temp.ec_action(jsonb_set(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001','offer'),'{pool,0,promotionId}','"f6000000-0000-4000-8000-000000000003"'))$$,'FG404',null,'unpublished offers cannot enter reward pools');
select throws_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001') || '{"radiusMetres":151}'::jsonb)$$,'22023',null,'owners cannot expand the discovery radius past its bound');
select throws_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001') || '{"cooldownHours":0}'::jsonb)$$,'22023',null,'owners cannot disable per-venue cooldown');
select throws_ok($$select pg_temp.ec_action(jsonb_set(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001'),'{pool,0,weight}','0'))$$,'22023',null,'pool weights must be positive bounded integers');
select pg_temp.ec_keep('create',(pg_temp.ec_create('f4000000-0000-4000-8000-000000000001') || '{"cooldownHours":168}'::jsonb)::text);
select lives_ok($$select pg_temp.ec_action(current_setting('food_go.ec.create')::jsonb)$$,'owner creates a private immutable collectible pool');
select lives_ok($$select pg_temp.ec_action(current_setting('food_go.ec.create')::jsonb)$$,'identical create request is safely replayed');
select throws_ok($$select pg_temp.ec_action(current_setting('food_go.ec.create')::jsonb || '{"title":"Changed fixture title"}'::jsonb)$$,'FG409',null,'changed payload cannot reuse a successful request ID');
select is((select c->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'campaigns') c where c->>'id'='f4000000-0000-4000-8000-000000000001'),'draft','new reward pools remain private drafts');
select is(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters','[]'::jsonb,'draft rewards are absent from public venue reads');
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','submit','encounterId','f4000000-0000-4000-8000-000000000001','version','2000-01-01T00:00:00Z'))$$,'FG409',null,'stale draft versions cannot be submitted');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','submit','encounterId','f4000000-0000-4000-8000-000000000001','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000001')))$$,'owner submits the current pool version for independent review');
select pg_temp.ec_keep('pending_version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000001'));
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000001','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000001'),'decision','approve','reason','Owner self approval'))$$,'42501',null,'owners cannot approve their own pools');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000001','version',current_setting('food_go.ec.pending_version'),'decision','approve','reason','Independent fixture approval'))$$,'42501',null,'operator approval requires current MFA assurance');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003','aal2');
insert into public.organization_members(organization_id,user_id,role) values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000003','manager');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000001','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000001'),'decision','approve','reason','Operator with own organisation'))$$,'42501',null,'even MFA operators cannot approve a pool belonging to their own organisation');
reset role;
delete from public.organization_members where organization_id='f2000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000003';
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000001','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000001'),'decision','approve','reason','Independent fixture approval'))$$,'independent MFA operator approves the exact current version');
select is((select c->>'state' from jsonb_array_elements(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters') c where c->>'id'='f4000000-0000-4000-8000-000000000001'),'published','only approved current campaigns are public');
select ok(not (public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')::text ~ '(beneficiary|issuer|token_hash|organisation|organization_id|request_hash)'),'public campaign DTO does not leak private authority or challenge data');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')$$,'42501',null,'organisation members cannot claim their own restaurant pools');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001","longitude":144.967146,"latitude":-37.816813,"eligible":true}')$$,'22023',null,'raw proximity and claimed eligibility cannot authorise an encounter');
select pg_temp.ec_keep('start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select pg_temp.ec_keep('session',(current_setting('food_go.ec.start')::jsonb)->'result'->>'sessionId');
select ok(current_setting('food_go.ec.session') ~ '^[0-9a-f-]{36}$','starting creates a server-owned customer session');
select is((current_setting('food_go.ec.start')::jsonb)->'result'->'itemId','null'::jsonb,'starting does not reveal or grant a random reward');
select is(public.food_go_encounter_journey()->'inventory','[]'::jsonb,'starting alone cannot mint inventory');
select is(pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')->'result'->>'sessionId',current_setting('food_go.ec.session'),'another start reuses the customer active session');
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.session')))$$,'42501',null,'customers cannot issue their own staff confirmations');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000004');
set local role authenticated;
select is(public.food_go_encounter_journey()->'sessions','[]'::jsonb,'another account cannot read the active customer session');
select ok(pg_temp.ec_rejected(jsonb_build_object('action','cancel','sessionId',current_setting('food_go.ec.session'))),'another account cannot cancel the customer session');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.session')))$$,'42501',null,'staff from a neighbouring venue cannot issue this challenge');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.ec_keep('issue_command',jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.session'),'requestId',gen_random_uuid())::text);
select pg_temp.ec_keep('issue',pg_temp.ec_action(current_setting('food_go.ec.issue_command')::jsonb)::text);
select pg_temp.ec_keep('old_code',(current_setting('food_go.ec.issue')::jsonb)->'result'->>'code');
select ok(current_setting('food_go.ec.old_code') ~ '^[a-f0-9]{32}$','current staff issues a high-entropy short-lived confirmation code');
select is(pg_temp.ec_action(current_setting('food_go.ec.issue_command')::jsonb)->'result'->'code','null'::jsonb,'issuance replay never returns a stored plaintext token');
select is(pg_temp.ec_action(current_setting('food_go.ec.issue_command')::jsonb)->'result'->'replayed','true'::jsonb,'issuance replay is explicitly labelled');
select pg_temp.ec_keep('issue2',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.session')))::text);
select pg_temp.ec_keep('code',(current_setting('food_go.ec.issue2')::jsonb)->'result'->>'code');
select ok(current_setting('food_go.ec.code')<>current_setting('food_go.ec.old_code'),'deliberate replacement rotates the confirmation token');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.session'),'code',current_setting('food_go.ec.old_code')))->'result'->'error'<>'null'::jsonb,'replacement invalidates the old token without rewarding a guess');
select is(public.food_go_encounter_journey()->'inventory','[]'::jsonb,'invalid confirmation cannot reveal or grant an item');
select pg_temp.ec_keep('claim_command',jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.session'),'code',current_setting('food_go.ec.code'),'requestId',gen_random_uuid())::text);
select pg_temp.ec_keep('claim',pg_temp.ec_action(current_setting('food_go.ec.claim_command')::jsonb)::text);
select pg_temp.ec_keep('item',(current_setting('food_go.ec.claim')::jsonb)->'result'->>'itemId');
select is((current_setting('food_go.ec.claim')::jsonb)->'result'->'error','null'::jsonb,'fresh staff confirmation atomically grants the approved item');
select is(jsonb_array_length(public.food_go_encounter_journey()->'inventory'),1,'one confirmation produces exactly one inventory item');
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.item')),'collected','non-monetary collectible remains collected');
select is((select i->'expiresAt' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.item')),'null'::jsonb,'collectibles have no fabricated offer expiry');
select is(pg_temp.ec_action(current_setting('food_go.ec.claim_command')::jsonb)->'result'->>'itemId',current_setting('food_go.ec.item'),'a repeated claim request returns the same item');
select is(jsonb_array_length(public.food_go_encounter_journey()->'inventory'),1,'replaying a claim never grants a second item');
select throws_ok($$select pg_temp.ec_action(current_setting('food_go.ec.claim_command')::jsonb || '{"code":"00000000000000000000000000000000"}'::jsonb)$$,'FG409',null,'a changed claim cannot reuse a successful request key');
select ok(pg_temp.ec_rejected(jsonb_build_object('action','prepareRedemption','itemId',current_setting('food_go.ec.item'))),'collectibles are not redeemable monetary benefits');

-- An offer pool references existing approved promotion identity and terms.
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000002','offer'))$$,'owner may create a pool referencing the actual published offer');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','submit','encounterId','f4000000-0000-4000-8000-000000000002','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000002')))$$,'owner submits the offer pool');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000002','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000002'),'decision','approve','reason','Checked published fixture offer'))$$,'independent operator approves the linked offer version');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.ec_keep('offer_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')::text);
select pg_temp.ec_keep('offer_session',(current_setting('food_go.ec.offer_start')::jsonb)->'result'->>'sessionId');
select is((current_setting('food_go.ec.offer_start')::jsonb)->'result'->'itemId','null'::jsonb,'the offer outcome is never granted by simply starting');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.ec_keep('offer_issue',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.offer_session')))::text);
select pg_temp.ec_keep('offer_code',(current_setting('food_go.ec.offer_issue')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(pg_temp.ec_rejected(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.offer_session'),'code',current_setting('food_go.ec.offer_code'))),'a valid code cannot be used by the wrong beneficiary');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.ec_keep('offer_claim',pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.offer_session'),'code',current_setting('food_go.ec.offer_code')))::text);
select pg_temp.ec_keep('offer_item',(current_setting('food_go.ec.offer_claim')::jsonb)->'result'->>'itemId');
select is((current_setting('food_go.ec.offer_claim')::jsonb)->'result'->'error','null'::jsonb,'the intended beneficiary can claim the confirmed offer');
select is((select i->>'name' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'Fixture approved offer','granted offer name comes from its real promotion');
select is((select i->>'description' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'Only the approved fixture terms apply.','granted offer terms come from its real promotion');
select is((select i->>'rarity' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'rare','server grant preserves the independently approved rarity');
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'available','fresh confirmed offer is available for staff redemption');
select ok((select (i->>'expiresAt')::timestamptz>clock_timestamp() and (i->>'expiresAt')::timestamptz<=clock_timestamp()+interval '61 minutes'
  from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'offer expiry is bounded by server claim time and approved validity');
select pg_temp.ec_keep('prepare_command',jsonb_build_object('action','prepareRedemption','itemId',current_setting('food_go.ec.offer_item'),'requestId',gen_random_uuid())::text);
select pg_temp.ec_keep('prepare',pg_temp.ec_action(current_setting('food_go.ec.prepare_command')::jsonb)::text);
select pg_temp.ec_keep('redemption_code',(current_setting('food_go.ec.prepare')::jsonb)->'result'->>'code');
select ok(current_setting('food_go.ec.redemption_code') ~ '^[a-f0-9]{32}$','the customer prepares a short-lived redemption challenge');
select is(pg_temp.ec_action(current_setting('food_go.ec.prepare_command')::jsonb)->'result'->'code','null'::jsonb,'preparation replay does not recover a stored plaintext redemption code');
select ok(pg_temp.ec_rejected(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.redemption_code'))),'the customer cannot redeem their own benefit');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select ok(pg_temp.ec_rejected(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.redemption_code'))),'staff of another venue cannot redeem a neighbouring offer');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select ok(pg_temp.ec_rejected(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.offer_code'))),'claim-purpose confirmation cannot be used as a redemption code');
select pg_temp.ec_keep('redeem_command',jsonb_build_object('action','redeem','code',current_setting('food_go.ec.redemption_code'),'requestId',gen_random_uuid())::text);
select pg_temp.ec_keep('redeem',pg_temp.ec_action(current_setting('food_go.ec.redeem_command')::jsonb)::text);
select is((current_setting('food_go.ec.redeem')::jsonb)->'result'->'error','null'::jsonb,'current staff of the exact venue can consume the offer once');
select is((current_setting('food_go.ec.redeem')::jsonb)->'result'->>'itemId',current_setting('food_go.ec.offer_item'),'staff redeems precisely the bound inventory item');
select is(pg_temp.ec_action(current_setting('food_go.ec.redeem_command')::jsonb)->'result'->>'itemId',current_setting('food_go.ec.offer_item'),'lost redemption response can replay the same item outcome');
select ok(pg_temp.ec_rejected(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.redemption_code'))),'a new request cannot consume the same redemption challenge twice');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000004');
set local role authenticated;
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'redeemed','the customer inventory acknowledges completed staff redemption');
select ok((select (i->>'redeemedAt')::timestamptz is not null from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.offer_item')),'redemption time comes from the server ledger');

-- A code belongs to one session, not merely to a known account or venue.
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select pg_temp.ec_keep('binding_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select pg_temp.ec_keep('binding_session',(current_setting('food_go.ec.binding_start')::jsonb)->'result'->>'sessionId');
select pg_temp.ec_keep('other_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')::text);
select pg_temp.ec_keep('other_session',(current_setting('food_go.ec.other_start')::jsonb)->'result'->>'sessionId');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.ec_keep('binding_issue',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.binding_session')))::text);
select pg_temp.ec_keep('binding_code',(current_setting('food_go.ec.binding_issue')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.other_session'),'code',current_setting('food_go.ec.binding_code')))->'result'->'error'<>'null'::jsonb,'a valid challenge cannot be moved to another session of the same customer');
select is(public.food_go_encounter_journey()->'inventory','[]'::jsonb,'a wrong-session claim never partially grants an item');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',current_setting('food_go.ec.binding_session')))$$,'customers can cancel their own active encounter');
select ok(pg_temp.ec_rejected(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.binding_session'),'code',current_setting('food_go.ec.binding_code'))),'cancelling an encounter invalidates its outstanding staff confirmation');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',current_setting('food_go.ec.other_session')))$$,'the second test session can also be cancelled');

-- Offer expiry/version/withdrawal use another real venue rather than bypassing
-- the first venue's cooldown. Both venues share the same coordinates, so every
-- check also exercises identity separation in a co-located building.
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select pg_temp.ec_keep('other_create',jsonb_set(pg_temp.ec_create('f4000000-0000-4000-8000-000000000003','offer') ||
  '{"venueId":"f2000000-0000-4000-8000-000000000004","theme":"cafe"}'::jsonb,'{pool,0,promotionId}','"f6000000-0000-4000-8000-000000000002"')::text);
select lives_ok($$select pg_temp.ec_action(current_setting('food_go.ec.other_create')::jsonb)$$,'the neighbouring owner creates an independent pool for their exact venue');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','submit','encounterId','f4000000-0000-4000-8000-000000000003','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000003')))$$,'the neighbouring owner submits their own current pool');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000003','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000003'),'decision','approve','reason','Checked neighbouring venue identity'))$$,'independent operator approves the distinct venue and offer identity');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.ec_keep('version_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000003"}')::text);
select pg_temp.ec_keep('version_session',(current_setting('food_go.ec.version_start')::jsonb)->'result'->>'sessionId');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select pg_temp.ec_keep('version_issue',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.version_session')))::text);
select pg_temp.ec_keep('version_code',(current_setting('food_go.ec.version_issue')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.ec_keep('version_claim',pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.version_session'),'code',current_setting('food_go.ec.version_code')))::text);
select pg_temp.ec_keep('version_item',(current_setting('food_go.ec.version_claim')::jsonb)->'result'->>'itemId');
select is((current_setting('food_go.ec.version_claim')::jsonb)->'result'->'error','null'::jsonb,'a customer can collect from a different venue while the first venue cooldown runs');
select is((select i->'venue'->>'id' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.version_item')),'f2000000-0000-4000-8000-000000000004','inventory is bound to the actual shop rather than a shared building coordinate');

-- One finite-stock pool gives two customers legitimate sessions before its last
-- item is consumed. The assertions are sequential, not a concurrency claim.
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(pg_temp.ec_create('f4000000-0000-4000-8000-000000000004') || '{"maxClaims":1}'::jsonb)$$,'owner creates a finite one-claim campaign');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','submit','encounterId','f4000000-0000-4000-8000-000000000004','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000004')))$$,'finite stock campaign follows normal submission');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000004','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000004'),'decision','approve','reason','Verified finite claim capacity'))$$,'finite stock also needs independent publication');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select pg_temp.ec_keep('active1',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select pg_temp.ec_keep('active2',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')::text);
select pg_temp.ec_keep('active3',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000003"}')::text);
select is(jsonb_array_length(public.food_go_encounter_journey()->'sessions'),3,'the account may hold at most three active sessions');
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000004"}')$$,'FG429',null,'a fourth campaign cannot exceed the per-account active session bound');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',(current_setting('food_go.ec.active1')::jsonb)->'result'->>'sessionId'))$$,'cancel releases the first active slot');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',(current_setting('food_go.ec.active2')::jsonb)->'result'->>'sessionId'))$$,'cancel releases the second active slot');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',(current_setting('food_go.ec.active3')::jsonb)->'result'->>'sessionId'))$$,'cancel releases the third active slot');
select pg_temp.ec_keep('expired_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select pg_temp.ec_keep('expired_session',(current_setting('food_go.ec.expired_start')::jsonb)->'result'->>'sessionId');
reset role;
update private.encounter_sessions set created_at=statement_timestamp()-interval '16 minutes',expires_at=statement_timestamp()-interval '1 second'
 where id=current_setting('food_go.ec.expired_session')::uuid;
set local role authenticated;
select is(jsonb_array_length(public.food_go_encounter_journey()->'sessions'),0,'expired sessions disappear from the bounded active account view');
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.expired_session'),'code','00000000000000000000000000000000'))->'result'->'error'<>'null'::jsonb,'expired sessions cannot be claimed even with a shaped confirmation code');
select pg_temp.ec_keep('replacement_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select ok((current_setting('food_go.ec.replacement_start')::jsonb)->'result'->>'sessionId'<>current_setting('food_go.ec.expired_session'),'a fresh start replaces an expired session rather than reviving it');
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',(current_setting('food_go.ec.replacement_start')::jsonb)->'result'->>'sessionId'))$$,'the expiry test leaves no active session behind');

-- Captured promotion version is revalidated at preparation and redemption.
reset role;
select pg_temp.ec_keep('version_item_times',(select jsonb_build_object('claimedAt',claimed_at,'expiresAt',expires_at)::text from private.encounter_inventory where id=current_setting('food_go.ec.version_item')::uuid));
update private.encounter_inventory set claimed_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 second'
 where id=current_setting('food_go.ec.version_item')::uuid;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.version_item')),'expired','offer expiration is computed from server time');
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','prepareRedemption','itemId',current_setting('food_go.ec.version_item')))$$,'FG409',null,'expired inventory cannot prepare a redemption');
reset role;
update private.encounter_inventory set claimed_at=((current_setting('food_go.ec.version_item_times')::jsonb)->>'claimedAt')::timestamptz,
 expires_at=((current_setting('food_go.ec.version_item_times')::jsonb)->>'expiresAt')::timestamptz where id=current_setting('food_go.ec.version_item')::uuid;
set local role authenticated;
select pg_temp.ec_keep('version_prepare',pg_temp.ec_action(jsonb_build_object('action','prepareRedemption','itemId',current_setting('food_go.ec.version_item')))::text);
select pg_temp.ec_keep('version_redemption_code',(current_setting('food_go.ec.version_prepare')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_keep('promotion_before',(select to_jsonb(p)::text from public.promotions p where id='f6000000-0000-4000-8000-000000000002'));
update public.promotions set description='Changed fixture terms must not replace a granted snapshot.',updated_at=clock_timestamp()
 where id='f6000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.version_item')),'unavailable','a changed promotion version makes an existing offer unavailable');
select is((select i->>'description' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.version_item')),'This offer belongs to the other fixture kitchen.','granted terms remain immutable after promotion edits');
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','prepareRedemption','itemId',current_setting('food_go.ec.version_item')))$$,'FG409',null,'changed promotion versions cannot create new redemption challenges');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.version_redemption_code')))->'result'->'error'<>'null'::jsonb,'an already prepared code cannot bypass a changed promotion version');
set local role anon;
select is(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000004')->'encounters','[]'::jsonb,'public discovery hides campaigns whose approved offer version changed');
reset role;
update public.promotions set description=(current_setting('food_go.ec.promotion_before')::jsonb)->>'description',
 updated_at=((current_setting('food_go.ec.promotion_before')::jsonb)->>'updated_at')::timestamptz
 where id='f6000000-0000-4000-8000-000000000002';
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','review','encounterId','f4000000-0000-4000-8000-000000000003','version',pg_temp.ec_version('f4000000-0000-4000-8000-000000000003'),'decision','withdraw','reason','Withdrawal fixture blocks issued benefits'))$$,'operator can withdraw a published encounter');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000006');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','redeem','code',current_setting('food_go.ec.version_redemption_code')))->'result'->'error'<>'null'::jsonb,'withdrawal blocks previously prepared offer redemption');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select i->>'state' from jsonb_array_elements(public.food_go_encounter_journey()->'inventory') i where i->>'id'=current_setting('food_go.ec.version_item')),'unavailable','withdrawn campaign offers stay visible with an honest unavailable state');
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')$$,'FG429',null,'a second campaign at the same venue cannot evade its claimed-item cooldown');

-- Advance only the fixture history; a new campaign alone cannot reset cooldown.
reset role;
select ok((select cooldown_until=claimed_at+interval '168 hours' from private.encounter_inventory where id=current_setting('food_go.ec.item')::uuid),'grant snapshots the original seven-day venue cooldown');
update private.encounter_inventory set claimed_at=statement_timestamp()-interval '2 days' where id=current_setting('food_go.ec.item')::uuid;
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')$$,'FG429',null,'a shorter replacement pool cannot shorten the previously granted seven-day cooldown');
reset role;
update private.encounter_inventory set cooldown_until=statement_timestamp()-interval '1 day' where id=current_setting('food_go.ec.item')::uuid;
set local role authenticated;
select pg_temp.ec_keep('authority_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000002"}')::text);
select pg_temp.ec_keep('authority_session',(current_setting('food_go.ec.authority_start')::jsonb)->'result'->>'sessionId');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.ec_keep('authority_issue',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.authority_session')))::text);
select pg_temp.ec_keep('authority_code',(current_setting('food_go.ec.authority_issue')::jsonb)->'result'->>'code');
reset role;
delete from public.organization_members where organization_id='f2000000-0000-4000-8000-000000000001' and user_id='f1000000-0000-4000-8000-000000000005';
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.authority_session'),'code',current_setting('food_go.ec.authority_code')))->'result'->'error'<>'null'::jsonb,'staff losing current manager authority invalidates an issued confirmation');
reset role;
insert into public.organization_members(organization_id,user_id,role) values('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','manager');
update private.encounter_codes set expires_at=statement_timestamp()-interval '1 second'
 where session_id=current_setting('food_go.ec.authority_session')::uuid and purpose='claim';
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.authority_session'),'code',current_setting('food_go.ec.authority_code')))->'result'->'error'<>'null'::jsonb,'expired confirmation cannot claim an otherwise eligible session');
reset role;
update private.encounter_codes set expires_at=clock_timestamp()+interval '2 minutes'
 where session_id=current_setting('food_go.ec.authority_session')::uuid and purpose='claim';
delete from auth.sessions where id='f1000000-0000-4000-8000-000000000005';
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.authority_session'),'code',current_setting('food_go.ec.authority_code')))->'result'->'error'<>'null'::jsonb,'revoking the issuer session also invalidates outstanding confirmation');
reset role;
insert into auth.sessions(id,user_id) values('f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.authority_session'),'code',current_setting('food_go.ec.authority_code')))->'result'->'error'<>'null'::jsonb,'a replacement login cannot revive the invalidated issuer-session binding');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.ec_keep('authority_reissue',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.authority_session')))::text);
select pg_temp.ec_keep('authority_new_code',(current_setting('food_go.ec.authority_reissue')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.authority_session'),'code',current_setting('food_go.ec.authority_new_code')))->'result'->'error','null'::jsonb,'newly issued confirmation works only after current staff authority is restored');
reset role;
select ok(not exists(select 1 from private.encounter_requests where result->'code'<>'null'::jsonb),'idempotency receipts retain no plaintext confirmation or redemption codes');
select ok(not exists(select 1 from private.encounter_requests where result::text like '%'||current_setting('food_go.ec.code')||'%'
  or result::text like '%'||current_setting('food_go.ec.redemption_code')||'%'),'complete receipts do not contain issued token values under another key');
select ok((select bool_and(octet_length(token_hash)=32) from private.encounter_codes where beneficiary::text like 'f1000000-%'),'challenge storage contains fixed-size SHA-256 digests');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
  and p.proname like 'encounter_%' and p.proname<>'encounter_journey'
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'clients cannot call arbitrary-account or authority-free private encounter helpers');

select pg_temp.ec_user('f1000000-0000-4000-8000-000000000008');
set local role authenticated;
select pg_temp.ec_keep('stock_start_a',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000004"}')::text);
select pg_temp.ec_keep('stock_session_a',(current_setting('food_go.ec.stock_start_a')::jsonb)->'result'->>'sessionId');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000009');
set local role authenticated;
select pg_temp.ec_keep('stock_start_b',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000004"}')::text);
select pg_temp.ec_keep('stock_session_b',(current_setting('food_go.ec.stock_start_b')::jsonb)->'result'->>'sessionId');
reset role;
select is((select claimed_count from private.encounter_campaigns where id='f4000000-0000-4000-8000-000000000004'),0,'starting two sessions reserves no finite reward stock');
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.ec_keep('stock_issue_a',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.stock_session_a')))::text);
select pg_temp.ec_keep('stock_code_a',(current_setting('food_go.ec.stock_issue_a')::jsonb)->'result'->>'code');
select pg_temp.ec_keep('stock_issue_b',pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.stock_session_b')))::text);
select pg_temp.ec_keep('stock_code_b',(current_setting('food_go.ec.stock_issue_b')::jsonb)->'result'->>'code');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000008');
set local role authenticated;
select is(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.stock_session_a'),'code',current_setting('food_go.ec.stock_code_a')))->'result'->'error','null'::jsonb,'the first confirmed customer claims the last available item');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000009');
set local role authenticated;
select ok(pg_temp.ec_action(jsonb_build_object('action','claim','sessionId',current_setting('food_go.ec.stock_session_b'),'code',current_setting('food_go.ec.stock_code_b')))->'result'->'error'<>'null'::jsonb,'the second customer cannot exceed globally consumed stock');
select is(public.food_go_encounter_journey()->'inventory','[]'::jsonb,'stock exhaustion cannot partially grant an item');
reset role;
select is((select claimed_count from private.encounter_campaigns where id='f4000000-0000-4000-8000-000000000004'),1,'finite campaign count remains exactly one');
select is((select count(*) from private.encounter_inventory where encounter_id='f4000000-0000-4000-8000-000000000004'),1::bigint,'only one ledger grant exists for finite stock');
set local role anon;
select ok(not exists(select 1 from jsonb_array_elements(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters') c
  where c->>'id'='f4000000-0000-4000-8000-000000000004'),'public discovery removes an exhausted campaign');

-- Failed guesses must commit their throttle state, rather than raising an
-- exception that rolls the increment back. The batch still rolls back overall.
reset role;
update private.encounter_accounts set guesses=0,guess_window=statement_timestamp()-interval '16 minutes'
 where user_id='f1000000-0000-4000-8000-000000000010';
select pg_temp.ec_keep('guess_receipts_before',(select count(*)::text from private.encounter_requests where user_id='f1000000-0000-4000-8000-000000000010'));
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select pg_temp.ec_keep('guess_command',jsonb_build_object('action','claim','sessionId','f3000000-0000-4000-8000-000000000099','code','00000000000000000000000000000000','requestId',gen_random_uuid())::text);
select pg_temp.ec_keep('first_guess',pg_temp.ec_action(current_setting('food_go.ec.guess_command')::jsonb)::text);
select is((current_setting('food_go.ec.first_guess')::jsonb)->'result'->'error'->>'code','missing','well-shaped unknown confirmations return a safe persisted failure');
select ok(not ((current_setting('food_go.ec.first_guess')::jsonb)->'result')::text like '%00000000000000000000000000000000%','failed guesses never echo the submitted token');
do $guess_attempts$ begin
  for n in 2..20 loop
    perform pg_temp.ec_action(jsonb_build_object('action','claim','sessionId','f3000000-0000-4000-8000-000000000099','code','00000000000000000000000000000000'));
  end loop;
end; $guess_attempts$;
select is(pg_temp.ec_action('{"action":"claim","sessionId":"f3000000-0000-4000-8000-000000000099","code":"00000000000000000000000000000000"}')->'result'->'error'->>'code','limit','new request IDs cannot bypass the account guess cap');
select is(pg_temp.ec_action(current_setting('food_go.ec.guess_command')::jsonb)->'result'->'error'->>'code','missing','a failed request replay returns its original outcome without a new guess');
select throws_ok($$select pg_temp.ec_action(current_setting('food_go.ec.guess_command')::jsonb || '{"code":"ffffffffffffffffffffffffffffffff"}'::jsonb)$$,'FG409',null,'failed request IDs also reject changed payloads');
reset role;
select is((select guesses from private.encounter_accounts where user_id='f1000000-0000-4000-8000-000000000010'),20,'twenty failed guesses persist exactly once each');
select is((select count(*) from private.encounter_requests where user_id='f1000000-0000-4000-8000-000000000010')-(current_setting('food_go.ec.guess_receipts_before'))::bigint,20::bigint,'limited/replayed failures do not grow unbounded request receipts');
update private.encounter_accounts set guess_window=statement_timestamp()-interval '16 minutes' where user_id='f1000000-0000-4000-8000-000000000010';
set local role authenticated;
select is(pg_temp.ec_action('{"action":"claim","sessionId":"f3000000-0000-4000-8000-000000000099","code":"00000000000000000000000000000000"}')->'result'->'error'->>'code','missing','the server resets a completed guess window');
reset role;
select is((select guesses from private.encounter_accounts where user_id='f1000000-0000-4000-8000-000000000010'),1,'a new guess window begins with one persisted failure');
update private.encounter_accounts set mutation_day=(clock_timestamp() at time zone 'Australia/Sydney')::date,mutations_today=200
 where user_id='f1000000-0000-4000-8000-000000000010';
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')$$,'FG429',null,'successful daily mutation quotas cannot be reset by fresh request IDs');
select is(jsonb_array_length(public.food_go_encounter_journey()->'inventory'),0,'a limited account can still read its own inventory');
reset role;
update private.encounter_accounts set mutation_day=(clock_timestamp() at time zone 'Australia/Sydney')::date-1
 where user_id='f1000000-0000-4000-8000-000000000010';
set local role authenticated;
select pg_temp.ec_keep('day_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select is((current_setting('food_go.ec.day_start')::jsonb)->'result'->'error','null'::jsonb,'daily mutation quota resets on the next Sydney date');
reset role;
select is((select mutations_today from private.encounter_accounts where user_id='f1000000-0000-4000-8000-000000000010'),1,'a new Sydney day records exactly its first successful mutation');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',(current_setting('food_go.ec.day_start')::jsonb)->'result'->>'sessionId'))$$,'quota fixture leaves no active session behind');

-- Venue-wide confirmation quota spans every current owner and manager.
select pg_temp.ec_keep('quota_start',pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')::text);
select pg_temp.ec_keep('quota_session',(current_setting('food_go.ec.quota_start')::jsonb)->'result'->>'sessionId');
reset role;
create temporary table ec_quota_codes(id uuid primary key) on commit drop;
insert into ec_quota_codes select gen_random_uuid() from generate_series(1,60);
insert into private.encounter_codes(id,purpose,encounter_id,encounter_version,session_id,beneficiary,issuer,issuer_session_id,token_hash,expires_at)
 select c.id,'claim','f4000000-0000-4000-8000-000000000001',q.updated_at,current_setting('food_go.ec.quota_session')::uuid,
   'f1000000-0000-4000-8000-000000000010','f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
   extensions.digest(c.id::text,'sha256'),clock_timestamp()+interval '2 minutes'
 from ec_quota_codes c cross join private.encounter_campaigns q where q.id='f4000000-0000-4000-8000-000000000001';
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000005');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action(jsonb_build_object('action','issue','sessionId',current_setting('food_go.ec.quota_session')))$$,'FG429',null,'a second manager cannot evade the restaurant-wide hourly confirmation cap');
select is(pg_temp.ec_action(current_setting('food_go.ec.issue_command')::jsonb)->'result'->'code','null'::jsonb,'existing issuance replay remains safe even after the shared quota fills');
reset role;
delete from private.encounter_codes where id in (select id from ec_quota_codes);
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select lives_ok($$select pg_temp.ec_action(jsonb_build_object('action','cancel','sessionId',current_setting('food_go.ec.quota_session')))$$,'hourly quota fixture leaves no active session behind');

-- Isolate the ten-claim Sydney-day limit from the per-venue cooldown: current
-- history belongs to the first venue, while this new pool is at the other venue.
reset role;
insert into private.encounter_campaigns(id,venue_id,creator,venue_snapshot,title,description,theme,state,starts_at,ends_at,radius_metres,cooldown_hours,max_claims,offer_validity_hours)
 select 'f4000000-0000-4000-8000-000000000020','f2000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000006',
   private.encounter_venue_json('f2000000-0000-4000-8000-000000000004'),'Daily limit fixture','An isolated daily capacity fixture.','cafe','published',
   clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day',60,24,20,24;
insert into private.encounter_pool_items(id,encounter_id,kind,name,description,rarity,weight)
 values('f5000000-0000-4000-8000-000000000020','f4000000-0000-4000-8000-000000000020','collectible','Daily fixture token','A fixture without monetary value.','common',1);
create temporary table ec_daily(session_id uuid primary key,item_id uuid not null unique) on commit drop;
insert into ec_daily select gen_random_uuid(),gen_random_uuid() from generate_series(1,10);
insert into private.encounter_sessions(id,user_id,encounter_id,encounter_version,state,created_at,expires_at)
 select h.session_id,'f1000000-0000-4000-8000-000000000010',q.id,q.updated_at,'claimed',clock_timestamp(),clock_timestamp()+interval '15 minutes'
 from ec_daily h cross join private.encounter_campaigns q where q.id='f4000000-0000-4000-8000-000000000001';
insert into private.encounter_inventory(id,user_id,session_id,encounter_id,venue_id,pool_item_id,venue_snapshot,name,description,rarity,kind,claimed_at,cooldown_until)
 select h.item_id,'f1000000-0000-4000-8000-000000000010',h.session_id,i.encounter_id,i.venue_id,i.pool_item_id,i.venue_snapshot,i.name,i.description,i.rarity,i.kind,
   clock_timestamp(),clock_timestamp()+interval '168 hours' from ec_daily h cross join private.encounter_inventory i where i.id=current_setting('food_go.ec.item')::uuid;
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000020"}')$$,'FG429',null,'ten claims today block a different venue without relying on same-venue cooldown');
select is(jsonb_array_length(public.food_go_encounter_journey()->'inventory'),10,'a daily limit refusal leaves inventory unchanged');
reset role;
delete from private.encounter_inventory where id in (select item_id from ec_daily);
delete from private.encounter_sessions where id in (select session_id from ec_daily);
delete from private.encounter_pool_items where encounter_id='f4000000-0000-4000-8000-000000000020';
delete from private.encounter_campaigns where id='f4000000-0000-4000-8000-000000000020';

-- Bounded lifetime inventory is distinct from cooldown and daily limits. These
-- historical collectible rows are transaction-only fixtures copied from an
-- actual earlier approved grant; they are never committed or presented as art.
reset role;
create temporary table ec_history(session_id uuid primary key,item_id uuid not null unique) on commit drop;
insert into ec_history select gen_random_uuid(),gen_random_uuid() from generate_series(1,500);
insert into private.encounter_sessions(id,user_id,encounter_id,encounter_version,state,created_at,expires_at)
 select h.session_id,'f1000000-0000-4000-8000-000000000010',q.id,q.updated_at,'claimed',
   statement_timestamp()-interval '10 days',statement_timestamp()-interval '10 days'+interval '15 minutes'
 from ec_history h cross join private.encounter_campaigns q where q.id='f4000000-0000-4000-8000-000000000001';
insert into private.encounter_inventory(id,user_id,session_id,encounter_id,venue_id,pool_item_id,venue_snapshot,name,description,rarity,kind,claimed_at,cooldown_until)
 select h.item_id,'f1000000-0000-4000-8000-000000000010',h.session_id,i.encounter_id,i.venue_id,i.pool_item_id,
   i.venue_snapshot,i.name,i.description,i.rarity,i.kind,statement_timestamp()-interval '10 days',statement_timestamp()-interval '3 days'
 from ec_history h cross join private.encounter_inventory i where i.id=current_setting('food_go.ec.item')::uuid;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select is(jsonb_array_length(public.food_go_encounter_journey()->'inventory'),500,'a full owned inventory stays bounded and readable');
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')$$,'FG429',null,'500 historical grants block a new grant even after cooldown and a new day');
select throws_ok($$delete from private.encounter_inventory where user_id=auth.uid()$$,'42501',null,'clients cannot delete history to reset lifetime capacity');
reset role;
select is((select count(*) from private.encounter_inventory where user_id='f1000000-0000-4000-8000-000000000010'),500::bigint,'capacity refusal cannot insert a partial 501st item');
delete from private.encounter_inventory where id in (select item_id from ec_history);
delete from private.encounter_sessions where id in (select session_id from ec_history);

-- Current venue approval/participation are required at read and mutation time.
update public.venues set game_enabled=false where id='f2000000-0000-4000-8000-000000000002';
set local role anon;
select is(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters','[]'::jsonb,'turning off venue participation removes encounter discovery');
reset role;
select pg_temp.ec_user('f1000000-0000-4000-8000-000000000010');
set local role authenticated;
select throws_ok($$select pg_temp.ec_action('{"action":"start","encounterId":"f4000000-0000-4000-8000-000000000001"}')$$,'FG404',null,'published campaign cannot bypass current venue participation');
reset role;
update public.venues set game_enabled=true,status='suspended' where id='f2000000-0000-4000-8000-000000000002';
set local role anon;
select is(public.food_go_venue_encounters('f2000000-0000-4000-8000-000000000002')->'encounters','[]'::jsonb,'venue suspension hides otherwise published pools');
reset role;
update public.venues set status='published' where id='f2000000-0000-4000-8000-000000000002';
update auth.users set banned_until=clock_timestamp()+interval '1 day' where id='f1000000-0000-4000-8000-000000000010';
set local role authenticated;
select throws_ok('select public.food_go_encounter_journey()','42501',null,'banned accounts cannot read or mutate their encounter journey');
reset role;
update auth.users set banned_until=null where id='f1000000-0000-4000-8000-000000000010';
delete from auth.sessions where id='f1000000-0000-4000-8000-000000000010';
set local role authenticated;
select throws_ok('select public.food_go_encounter_journey()','42501',null,'revoked customer sessions immediately lose encounter access');

reset role;
select is((select count(*)::text from public.reward_events where user_id::text like 'f1000000-%'),current_setting('food_go.ec.rewards_before'),'encounter interactions never write the XP reward ledger');
select is((select count(*)::text from public.check_ins where user_id::text like 'f1000000-%'),current_setting('food_go.ec.visits_before'),'encounter interaction is not a verified venue check-in');
select is((select count(*)::text from private.adventure_rewards where user_id::text like 'f1000000-%'),current_setting('food_go.ec.quests_before'),'encounter interactions never mint quest rewards');
select * from finish();
rollback;

-- Explicitly authorised development database only. All fixtures, helper functions
-- and temporary grants roll back. No browser observation awards a real visit.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $test_grants$
declare f record;
begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',f.nspname,f.proname,f.args); end loop;
end;
$test_grants$;
create function pg_temp.geo_payload(p_request text,p_longitude numeric default 144.9671462327242,
  p_latitude numeric default -37.81681344435442,p_accuracy numeric default 8,p_time numeric default null)
returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('action','observe','requestId',p_request,'longitude',p_longitude,'latitude',p_latitude,
    'accuracy',p_accuracy,'timestamp',coalesce(p_time,floor(extract(epoch from clock_timestamp())*1000)),
    'recordingId',coalesce(public.food_go_geographic_exploration()->>'recordingId','d4000000-0000-4000-8000-000000000000'));
$$;
grant execute on function pg_temp.geo_payload(text,numeric,numeric,numeric,numeric) to authenticated;
select plan(90);
insert into auth.users(id,email,email_confirmed_at) values
 ('d1000000-0000-4000-8000-000000000001','first@geographic.example.invalid',now()),
 ('d1000000-0000-4000-8000-000000000002','second@geographic.example.invalid',now()),
 ('d1000000-0000-4000-8000-000000000003','unverified@geographic.example.invalid',null);
insert into auth.sessions(id,user_id) select id,id from auth.users where id::text like 'd1000000-%';
select set_config('food_go.geo_reward_before',(select count(*)::text from public.reward_events where user_id::text like 'd1000000-%'),true);
select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('private.geographic_accounts'::regclass,'private.geographic_cells'::regclass,'private.geographic_requests'::regclass)),'all geographic state tables have RLS');
select ok(not exists(select 1 from information_schema.columns where table_schema='private'
  and table_name in ('geographic_accounts','geographic_cells','geographic_requests')
  and column_name ~ '(longitude|latitude|accuracy|^payload$)'),'geographic storage has no precise coordinates, accuracy or raw request payload');
select ok((select not prosecdef from pg_proc where oid='public.food_go_geographic_exploration(jsonb)'::regprocedure),'public discovery RPC is an invoker wrapper');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('geographic_cell','geographic_distance','geographic_reveal','geographic_snapshot')
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),'clients cannot call authority-free geometry or arbitrary-account snapshot helpers');
select is((select row(x,y)::text from private.geographic_cell(180,0)),
  (select row(x,y)::text from private.geographic_cell(-180,0)),'server cell calculation canonicalises both sides of the dateline');
select is((select jsonb_agg('wm18:'||x||':'||y order by ('wm18:'||x||':'||y)) from private.geographic_reveal(180,0,0)),
  '["wm18:0:131071","wm18:0:131072","wm18:262143:131071","wm18:262143:131072"]'::jsonb,'server dateline reveal matches the shared algorithm');
select is((select jsonb_agg('wm18:'||x||':'||y order by ('wm18:'||x||':'||y)) from private.geographic_reveal(10,85.05112877980659,0)),
  '["wm18:138350:0","wm18:138350:1","wm18:138351:0","wm18:138351:1","wm18:138351:2","wm18:138352:0","wm18:138352:1","wm18:138352:2","wm18:138352:3","wm18:138353:0","wm18:138353:1","wm18:138353:2","wm18:138353:3","wm18:138354:0","wm18:138354:1","wm18:138354:2","wm18:138354:3","wm18:138355:0","wm18:138355:1","wm18:138355:2","wm18:138355:3","wm18:138356:0","wm18:138356:1","wm18:138356:2","wm18:138357:0"]'::jsonb,
  'server polar reveal matches the shared bounded 25-cell algorithm');
set local role anon;
select throws_ok('select public.food_go_geographic_exploration()','42501',null,'anonymous discovery access denied');
select throws_ok('select * from private.geographic_accounts','42501',null,'anonymous account state is private');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_geographic_exploration()','42501',null,'verified identity still requires a live session');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","session_id":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_geographic_exploration()','42501',null,'an unverified account cannot record discovery');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_geographic_exploration()->'enabled','false'::jsonb,'recording defaults off');
select is(public.food_go_geographic_exploration()->'consented','false'::jsonb,'no consent is silently inferred');
select is(public.food_go_geographic_exploration()->'cells','[]'::jsonb,'a new account has no saved cells');
select is(public.food_go_geographic_exploration()->'rewardEligible','false'::jsonb,'device discovery never claims reward eligibility');
select is(public.food_go_geographic_exploration()->'recordingId','null'::jsonb,'a new account has no authorised recording generation');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000001'))$$,'42501',null,'observing before explicit consent is denied');
select throws_ok($$select public.food_go_geographic_exploration('{"action":"read","userId":"d1000000-0000-4000-8000-000000000002"}')$$,'22023',null,'clients cannot choose a target account');
select throws_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":2,"enabled":true}')$$,'22023',null,'unsupported consent versions are rejected');
select throws_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":1,"enabled":true,"cells":["wm18:1:2"]}')$$,'22023',null,'manual or invented cells cannot be promoted through consent');
select lives_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":1,"enabled":true}')$$,'account explicitly consents to coarse discovery');
select is(public.food_go_geographic_exploration()->'enabled','true'::jsonb,'consent enables server recording');
select is(public.food_go_geographic_exploration()->'consented','true'::jsonb,'accepted consent is versioned');
select ok((public.food_go_geographic_exploration()->>'recordingId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$','explicit consent creates a server-issued recording UUID');
select set_config('food_go.geo_prior_recording',public.food_go_geographic_exploration()->>'recordingId',true);
select lives_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":1,"enabled":true}')$$,'a new explicit consent starts another recording generation');
select ok(public.food_go_geographic_exploration()->>'recordingId'<>current_setting('food_go.geo_prior_recording'),'recording generations are replaced on every consent activation');
select throws_ok('select * from private.geographic_cells','42501',null,'authenticated clients cannot read raw tables directly');
select throws_ok('select * from private.geographic_requests','42501',null,'idempotency receipts cannot be read directly');
select set_config('food_go.geo_first_fix',pg_temp.geo_payload('d3000000-0000-4000-8000-000000000001')::text,true);
select is(public.food_go_geographic_exploration(current_setting('food_go.geo_first_fix')::jsonb)->'observation'->'accepted','true'::jsonb,'a fresh accurate fix is accepted after consent');
select ok((public.food_go_geographic_exploration()->'cells') @> '["wm18:236633:160858","wm18:236634:160858"]'::jsonb
  and jsonb_array_length(public.food_go_geographic_exploration()->'cells')=2,'server derives exactly the same Melbourne cells as the shared geographic algorithm');
select ok(not (public.food_go_geographic_exploration() ?| array['longitude','latitude','accuracy','userId','requestId']),'public state contains no precise fix or identity fields');
select is(public.food_go_geographic_exploration(current_setting('food_go.geo_first_fix')::jsonb)->'observation'->'accepted','true'::jsonb,'same request and payload can be retried immediately');
select is(public.food_go_geographic_exploration(current_setting('food_go.geo_first_fix')::jsonb)->'observation'->'reason','null'::jsonb,'accepted replay remains free of a rejection reason');
select throws_ok($$select public.food_go_geographic_exploration(current_setting('food_go.geo_first_fix')::jsonb || '{"longitude":115.86}'::jsonb)$$,'FG409',null,'changed payload cannot reuse an accepted request key');
reset role;
select is((select count(*) from private.geographic_requests where user_id='d1000000-0000-4000-8000-000000000001'),1::bigint,'a retry creates only one receipt');
select is((select samples_today from private.geographic_accounts where user_id='d1000000-0000-4000-8000-000000000001'),1,'a retry does not consume the quota twice');
-- Null the previous fix so this is specifically a consent boundary check, not
-- merely an out-of-order check against an earlier accepted observation.
update private.geographic_accounts set consented_at=clock_timestamp(),last_attempt_at=clock_timestamp()-interval '6 seconds',
 last_fix_at=null,last_received_at=null where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000018',115.86,-31.95,8,
 floor(extract(epoch from clock_timestamp())*1000)-1000))->'observation'->>'reason','stale','a recent fix captured before the latest consent cannot be saved');
select is(jsonb_array_length(public.food_go_geographic_exploration()->'cells'),2,'pre-consent observations never reveal cells');
select throws_ok('select public.food_go_geographic_exploration(null)','22023',null,'raw SQL NULL action is rejected');
select throws_ok($$select public.food_go_geographic_exploration('null'::jsonb)$$,'22023',null,'JSON null action is rejected');
select throws_ok($$select public.food_go_geographic_exploration('{}'::jsonb)$$,'22023',null,'an action must be explicitly provided');
select throws_ok($$select public.food_go_geographic_exploration(jsonb_build_object('action','read','padding',repeat('x',4097)))$$,'22023',null,'oversized action payload is rejected before processing');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000020')-'longitude')$$,'22023',null,'missing observation coordinates are rejected');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000021') || '{"accuracy":null}'::jsonb)$$,'22023',null,'null observation accuracy is rejected');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000022',144.96,-37.81,100001))$$,'22023',null,'oversized accuracy cannot enter observation state');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000023',144.96,-37.81,8,-1))$$,'22023',null,'negative observation timestamps are rejected');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000002',181))$$,'22023',null,'longitude bounds are enforced by the server');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000003',144.96,90))$$,'22023',null,'unrenderable polar latitude is rejected instead of relocated');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000004',144.96,-37.81,-1))$$,'22023',null,'negative accuracy is rejected');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000005',144.96,-37.81,8,1000.5))$$,'22023',null,'observation timestamps must be integral epoch milliseconds');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000006') || '{"cells":["wm18:1:2"],"xp":999}'::jsonb)$$,'22023',null,'browser-supplied discovery cells and XP are rejected');
reset role;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000007',144.96,-37.81,36))->'observation'->>'reason','accuracy','uncertain observations reveal nothing');
reset role;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000008',144.96,-37.81,8,floor(extract(epoch from clock_timestamp())*1000)-16000))->'observation'->>'reason','stale','stale fixes cannot be saved');
reset role;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000009',144.96,-37.81,8,floor(extract(epoch from clock_timestamp())*1000)+4000))->'observation'->>'reason','stale','future fixes cannot move the server clock');
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000010'))->'observation'->>'reason','rapid','new keys cannot evade the account-wide observation interval');
reset role;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds',last_fix_at=clock_timestamp()+interval '1 second'
 where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000011'))->'observation'->>'reason','stale','out-of-order timestamps cannot replace a newer accepted fix');
reset role;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds',last_fix_at=clock_timestamp()-interval '7 seconds',
 last_received_at=clock_timestamp()-interval '6 seconds' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000012',115.86,-31.95))->'observation'->>'reason','travel','implausible travel within one observation interval is rejected');
select is(jsonb_array_length(public.food_go_geographic_exploration()->'cells'),2,'rejected fixes never reveal additional cells');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","session_id":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_geographic_exploration()->'cells','[]'::jsonb,'a second account cannot see the first account discovery');
select is(public.food_go_geographic_exploration()->'consented','false'::jsonb,'consent does not carry across accounts');
select lives_ok($$select public.food_go_geographic_exploration('{"action":"clear"}')$$,'clearing an empty second account is safe');
reset role;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.food_go_geographic_exploration()->'cells'),2,'clearing another account cannot erase this discovery');
-- Capture a legitimate old-session envelope before stopping and clearing it.
-- The future timestamp is within allowed clock skew, so a timestamp-only guard
-- cannot reliably isolate this request from an immediately renewed session.
select set_config('food_go.geo_delayed_fix',pg_temp.geo_payload('d3000000-0000-4000-8000-000000000019',115.86,-31.95,8,
 floor(extract(epoch from clock_timestamp())*1000)+2000)::text,true);
select lives_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":1,"enabled":false}')$$,'the account can stop recording');
select is(public.food_go_geographic_exploration()->'enabled','false'::jsonb,'recording is disabled after opt-out');
select is(public.food_go_geographic_exploration()->'recordingId','null'::jsonb,'stopping recording invalidates the server-issued generation');
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000013'))$$,'42501',null,'observations are denied after opt-out');
select is(jsonb_array_length(public.food_go_geographic_exploration()->'cells'),2,'stopping recording preserves the saved map until explicit clear');
reset role;
select ok((select last_fix_at is null and last_cell_x is null and last_cell_y is null and last_received_at is null
 from private.geographic_accounts where user_id='d1000000-0000-4000-8000-000000000001'),'opt-out removes the last coarse movement anchor');
update private.geographic_accounts set samples_today=777,sample_day=(clock_timestamp() at time zone 'Australia/Sydney')::date,
 last_attempt_at=clock_timestamp() where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.food_go_geographic_exploration('{"action":"clear"}')$$,'saved exploration can be explicitly cleared');
select is(public.food_go_geographic_exploration()->'cells','[]'::jsonb,'clear removes every saved cell');
select is(public.food_go_geographic_exploration()->'consented','false'::jsonb,'clear revokes the saved consent');
select is(public.food_go_geographic_exploration()->'enabled','false'::jsonb,'clear never silently starts another recording session');
select is(public.food_go_geographic_exploration()->'recordingId','null'::jsonb,'clearing invalidates the recording generation');
reset role;
select is((select count(*) from private.geographic_cells where user_id='d1000000-0000-4000-8000-000000000001'),0::bigint,'clear deletes cell rows');
select is((select count(*) from private.geographic_requests where user_id='d1000000-0000-4000-8000-000000000001'),0::bigint,'clear deletes location request receipts');
select ok((select samples_today=777 and last_attempt_at is not null from private.geographic_accounts
 where user_id='d1000000-0000-4000-8000-000000000001'),'clear retains minimal abuse counters so repeated clears cannot reset rate limits');
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds'
 where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.food_go_geographic_exploration('{"action":"consent","version":1,"enabled":true}')$$,'saving again requires fresh explicit consent');
select throws_ok($$select public.food_go_geographic_exploration(current_setting('food_go.geo_delayed_fix')::jsonb)$$,'42501',null,'a delayed request with a prior recording generation is denied after clear, even with tolerated future clock skew');
select is(public.food_go_geographic_exploration()->'cells','[]'::jsonb,'renewed consent cannot promote a fix captured before clearing');
reset role;
update private.geographic_accounts set samples_today=1000,last_attempt_at=clock_timestamp()-interval '6 seconds'
 where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000014'))$$,'FG429',null,'new consent cannot evade the daily observation quota');
reset role;
update private.geographic_accounts set sample_day=(clock_timestamp() at time zone 'Australia/Sydney')::date-1,
 last_attempt_at=clock_timestamp()-interval '6 seconds' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000015'))->'observation'->'accepted','true'::jsonb,'the server resets the quota on the next Sydney day');
reset role;
select is((select samples_today from private.geographic_accounts where user_id='d1000000-0000-4000-8000-000000000001'),1,'a new server day starts at one accepted attempt');
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds',last_fix_at=clock_timestamp()-interval '6 minutes',
 last_received_at=clock_timestamp()-interval '6 minutes' where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000016',115.86,-31.95))->'observation'->'accepted','true'::jsonb,'a long recording gap permits a new coarse anchor without claiming travel');
reset role;
delete from private.geographic_cells where user_id='d1000000-0000-4000-8000-000000000001';
insert into private.geographic_cells(user_id,x,y)
 select 'd1000000-0000-4000-8000-000000000001',0,n from generate_series(0,4095) n;
update private.geographic_accounts set last_attempt_at=clock_timestamp()-interval '6 seconds',last_fix_at=null,last_received_at=null,last_cell_x=null,last_cell_y=null
 where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.food_go_geographic_exploration(pg_temp.geo_payload('d3000000-0000-4000-8000-000000000017'))->'observation'->>'reason','capacity','an account cannot exceed the saved-cell capacity');
select is(jsonb_array_length(public.food_go_geographic_exploration()->'cells'),4096,'a capacity rejection preserves all prior cells');
reset role;
select is((select count(*) from private.geographic_cells where user_id='d1000000-0000-4000-8000-000000000001'),4096::bigint,'capacity rejection cannot insert a partial reveal');
select is((select count(*)::text from public.reward_events where user_id::text like 'd1000000-%'),current_setting('food_go.geo_reward_before'),'accepted, rejected and replayed observations create no reward events');
set local role authenticated;
select lives_ok($$select public.food_go_geographic_exploration('{"action":"clear"}')$$,'a full saved map remains clearable');
reset role;
update auth.users set banned_until=now()+interval '1 day' where id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok('select public.food_go_geographic_exploration()','42501',null,'banned accounts cannot read or record discovery');
reset role;
update auth.users set banned_until=null where id='d1000000-0000-4000-8000-000000000001';
delete from auth.sessions where id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok('select public.food_go_geographic_exploration()','42501',null,'a revoked session immediately loses discovery access');
reset role;
select * from finish();
rollback;

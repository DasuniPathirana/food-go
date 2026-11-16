-- Disposable database only. All dates, identities, sessions and grants roll back.
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
select plan(32);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000001','adult@age.example.invalid',now(),'{"date_of_birth":"1990-01-01"}'),
 ('c1000000-0000-4000-8000-000000000002','young@age.example.invalid',now(),jsonb_build_object('date_of_birth',(private.feed_calendar_today()-interval '15 years')::date::text)),
 ('c1000000-0000-4000-8000-000000000003','unknown@age.example.invalid',now(),'{}');
insert into auth.sessions(id,user_id) select id,id from auth.users where id::text like 'c1000000-%';
select set_config('food_go.age_adult_author',(select id::text from private.community_authors where user_id='c1000000-0000-4000-8000-000000000001'),true);
insert into private.community_policy_acceptances(user_id,policy_version) select id,private.community_policy_version() from auth.users where id::text like 'c1000000-%';
select ok((select relrowsecurity from pg_class where oid='private.player_birth_dates'::regclass),'birth dates have RLS');
select ok(not private.feed_birth_date_eligible('2010-11-17','2026-11-16'),'day before sixteenth birthday remains closed');
select ok(private.feed_birth_date_eligible('2010-11-17','2026-11-17'),'sixteenth birthday opens Feed');
select ok(not private.feed_birth_date_eligible('2012-02-29','2028-02-28'),'leap-day birthday remains closed one day before');
select ok(private.feed_birth_date_eligible('2012-02-29','2028-02-29'),'leap-day sixteenth birthday opens Feed');
select ok(not private.valid_player_birth_date('2027-01-01','2026-11-17'),'future date rejected');
select throws_ok($$insert into auth.users(id,raw_user_meta_data) values('c1000000-0000-4000-8000-000000000099','{"date_of_birth":"2011-02-29"}')$$,'22023',null,'impossible signup date rejected');
set local role anon;
select throws_ok('select public.food_go_age_status()','42501',null,'anonymous age lookup denied');
select throws_ok('select public.food_go_community_feed()','42501',null,'legacy anonymous feed denied');
select throws_ok('select public.food_go_community_feed_v2()','42501',null,'anonymous enriched feed denied');
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","session_id":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_age_status()->>'status','under16','young signup recorded privately');
select throws_ok('select * from private.player_birth_dates','42501',null,'private dates cannot be read directly');
select throws_ok('select public.food_go_community_feed()','FA016',null,'under16 legacy feed denied');
select throws_ok('select public.food_go_community_feed_v2()','FA016',null,'under16 enriched feed denied');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"This should not be posted","visibility":"public","requestId":"c2000000-0000-4000-8000-000000000001"}')$$,'FA016',null,'under16 posting denied');
select throws_ok($$select public.food_go_community_write('{"action":"like","postId":"c2000000-0000-4000-8000-000000000001","liked":true}')$$,'FA016',null,'under16 reactions denied before content lookup');
select throws_ok($$select public.food_go_record_post_view('c2000000-0000-4000-8000-000000000001')$$,'FA016',null,'under16 reach cannot be minted');
select throws_ok($$select public.food_go_record_birth_date('1990-01-01')$$,'FG409',null,'declared young date cannot be replaced');
reset role;
update auth.users set raw_user_meta_data='{"date_of_birth":"1990-01-01","feedEligible":true}' where id='c1000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.food_go_age_status()->>'status','under16','editable auth metadata cannot bypass age');
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000003","session_id":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_age_status()->>'status','unknown','older or phone accounts begin unknown');
select throws_ok('select public.food_go_community_feed_v2()','FA016',null,'unknown age cannot read Feed');
select lives_ok($$select public.food_go_record_birth_date('1990-01-01')$$,'one-time account declaration succeeds');
select lives_ok($$select public.food_go_record_birth_date('1990-01-01')$$,'identical declaration retry is safe');
select throws_ok($$select public.food_go_record_birth_date('1991-01-01')$$,'FG409',null,'changed declaration retry rejected');
select is(public.food_go_age_status()->>'status','eligible','adult declaration opens Feed');
select lives_ok('select public.food_go_community_feed_v2()','eligible user can read Feed');
select ok(public.food_go_age_status()::text !~ 'birth|1990|user_id|email','age response exposes no date or identity');
reset role;
delete from auth.sessions where user_id='c1000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok('select public.food_go_age_status()','42501',null,'revoked session cannot read age status');
select throws_ok('select public.food_go_community_feed_v2()','42501',null,'revoked session cannot read Feed');
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","session_id":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_age_status()->>'status','eligible','adult signup is eligible without repeating date');
select throws_ok($$update private.player_birth_dates set birth_date='2000-01-01' where user_id=auth.uid()$$,'42501',null,'client cannot overwrite stored birth date');
reset role;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","session_id":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write(jsonb_build_object('action','block','authorId',current_setting('food_go.age_adult_author')))$$,'under16 safety action remains callable');
select * from finish();
rollback;

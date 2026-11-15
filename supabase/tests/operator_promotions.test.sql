-- Disposable Supabase stack only. All fixture users, sessions and grants roll back.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $grant_test$
declare f record;
begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',f.nspname,f.proname,f.args); end loop;
end;
$grant_test$;
select plan(32);

insert into auth.users(id,email,email_confirmed_at) values
('75110000-0000-4000-8000-000000000001','operator@operators.example.invalid',now()),
('75110000-0000-4000-8000-000000000002','owner@operators.example.invalid',now());
insert into auth.sessions(id,user_id) values
('75110000-0000-4000-8000-000000000003','75110000-0000-4000-8000-000000000001'),
('75110000-0000-4000-8000-000000000004','75110000-0000-4000-8000-000000000002');
insert into private.food_go_operators(user_id) values ('75110000-0000-4000-8000-000000000001');
insert into public.organizations(id,name) values ('75110000-0000-4000-8000-000000000010','Operator test venue group');
insert into public.organization_members(organization_id,user_id,role) values
('75110000-0000-4000-8000-000000000010','75110000-0000-4000-8000-000000000002','owner');
insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode) values
('75110000-0000-4000-8000-000000000011','75110000-0000-4000-8000-000000000010','operator-fixture','Test restaurant','restaurant','Italian','123 Test Road','Melbourne','VIC','3000');
insert into private.community_posts(id,author_id,body,visibility) select
  '75110000-0000-4000-8000-000000000020',id,'Public fixture for moderation','public' from private.community_authors where user_id='75110000-0000-4000-8000-000000000002';
insert into private.community_posts(id,author_id,body,visibility) select
  '75110000-0000-4000-8000-000000000021',id,'Private fixture for exclusion','private' from private.community_authors where user_id='75110000-0000-4000-8000-000000000002';
insert into private.community_reports(author_id,post_id,reason)
select id,'75110000-0000-4000-8000-000000000020','spam' from private.community_authors where user_id='75110000-0000-4000-8000-000000000001';
insert into private.community_comments(id,post_id,author_id,body) select '75110000-0000-4000-8000-000000000022','75110000-0000-4000-8000-000000000020',id,'Review this comment'
from private.community_authors where user_id='75110000-0000-4000-8000-000000000002';

-- Read queue versions through the real RPC as the effective client role.
create function pg_temp.operator_test_action(section text, operation text, target text)
returns jsonb language sql security invoker as $$
  select jsonb_build_object('action',operation,'id',target,'requestId',gen_random_uuid(),'reason','Fixture verification',
    'version',(select item->>'version' from jsonb_array_elements(public.food_go_operator_queue(section,0)->'items') item where item->>'id'=target));
$$;
grant execute on function pg_temp.operator_test_action(text,text,text) to authenticated;
set local role anon;
select throws_ok($$select public.food_go_operator_queue('venues',0)$$,'42501',null,'anonymous users cannot read operator queues');
select throws_ok($$select public.food_go_operator_change('{}'::jsonb)$$,'42501',null,'anonymous users cannot change operator records');
select is(jsonb_array_length(public.food_go_active_promotions()),0,'an empty public promo catalogue is available anonymously');
reset role;
select set_config('request.jwt.claims','{"sub":"75110000-0000-4000-8000-000000000002","session_id":"75110000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated","user_metadata":{"operator":true}}',true);
set local role authenticated;
select is(public.food_go_operator_access(),'forbidden','owner membership and editable metadata do not confer operator access');
select throws_ok($$insert into private.food_go_operators(user_id) values(auth.uid())$$,'42501',null,'user cannot grant themselves operator access');
select throws_ok($$select * from private.operator_entries('venues')$$,'42501',null,'underlying unguarded queue projection is inaccessible');
select throws_ok($$select public.food_go_operator_change('{}')$$,'42501',null,'a verified partner cannot make operator decisions');
reset role;
select set_config('request.jwt.claims','{"sub":"75110000-0000-4000-8000-000000000001","session_id":"75110000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_operator_access(),'mfa','registered operator sees MFA prerequisite');
select throws_ok($$select public.food_go_operator_queue('reports',0)$$,'42501',null,'first-factor sessions cannot read private reports');
reset role;
select set_config('request.jwt.claims','{"sub":"75110000-0000-4000-8000-000000000001","session_id":"75110000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_operator_access(),'ready','operator with a live second-factor session has access');
select ok(public.food_go_operator_queue('venues',0)->'items' @> '[{"id":"75110000-0000-4000-8000-000000000011"}]','operator sees the draft application');
select throws_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.publish','75110000-0000-4000-8000-000000000011'))$$,'FG409',null,'unverified venue cannot publish');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.verify','75110000-0000-4000-8000-000000000011'))$$,'independent operator verifies ownership');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.publish','75110000-0000-4000-8000-000000000011'))$$,'verified venue can publish');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.locate','75110000-0000-4000-8000-000000000011') || '{"latitude":-37.81,"longitude":144.961}')$$,'operator sets venue coordinates');
select set_config('food_go.test_offer',jsonb_build_object('action','promo.create','id','75110000-0000-4000-8000-000000000012','requestId',gen_random_uuid(),
  'reason','Restaurant approved','venueId','75110000-0000-4000-8000-000000000011','title','Fixture lunch','description','Sauce included','startsAt',now()-interval '1 hour','endsAt',now()+interval '1 day')::text,true);
select lives_ok($$select public.food_go_operator_change(current_setting('food_go.test_offer')::jsonb)$$,'eligible restaurant gets a draft promotion');
select lives_ok($$select public.food_go_operator_change(current_setting('food_go.test_offer')::jsonb)$$,'an exact retry reuses its first decision');
select throws_ok($$select public.food_go_operator_change(current_setting('food_go.test_offer')::jsonb || '{"reason":"Changed retry"}')$$,'FG409',null,'a changed retry conflicts');
select is(jsonb_array_length(public.food_go_active_promotions()),0,'draft promotions stay private');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('promotions','promo.publish','75110000-0000-4000-8000-000000000012'))$$,'reviewed promotion can publish');
select ok(public.food_go_active_promotions() @> '[{"title":"Fixture lunch","venueSlug":"operator-fixture"}]','authenticated reader receives active offer');
reset role;
insert into public.promotions(venue_id,title,description,starts_at,ends_at,status) values
('75110000-0000-4000-8000-000000000011','Expired fixture','Old window',now()-interval '2 days',now()-interval '1 day','published'),
('75110000-0000-4000-8000-000000000011','Scheduled fixture','Future window',now()+interval '1 day',now()+interval '2 days','published');
set local role anon;
select is(jsonb_array_length(public.food_go_active_promotions()),1,'anonymous reader sees only active verified offer in date window');
reset role;
set local role authenticated;
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.suspend','75110000-0000-4000-8000-000000000011'))$$,'independent suspension succeeds');
select is(jsonb_array_length(public.food_go_active_promotions()),0,'suspension immediately removes public offers');
select ok(not (public.food_go_operator_queue('posts',0)->'items' @> '[{"id":"75110000-0000-4000-8000-000000000021"}]'),'private wall posts never appear in moderation');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('posts','post.publish','75110000-0000-4000-8000-000000000020'))$$,'public submission approval works');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('comments','comment.publish','75110000-0000-4000-8000-000000000022'))$$,'comment approval works');
select lives_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('reports','report.remove','75110000-0000-4000-8000-000000000020'))$$,'operator can remove reported post and resolve its reports');
select ok(not (public.food_go_operator_queue('posts',0)->'items' @> '[{"id":"75110000-0000-4000-8000-000000000020"}]'),'removed post leaves moderation queue');
select ok(public.food_go_operator_queue('audit',0)->'items' @> '[{"name":"report.remove","detail":"Fixture verification"}]','decision history includes operator reason');
reset role;
insert into public.organization_members(organization_id,user_id,role) values('75110000-0000-4000-8000-000000000010','75110000-0000-4000-8000-000000000001','staff');
set local role authenticated;
select throws_ok($$select public.food_go_operator_change(pg_temp.operator_test_action('venues','venue.publish','75110000-0000-4000-8000-000000000011'))$$,'42501',null,'operator cannot approve their own organisation');
reset role;
delete from auth.sessions where id='75110000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.food_go_operator_access(),'forbidden','a revoked session immediately loses operator access');
reset role;
select * from finish();
rollback;

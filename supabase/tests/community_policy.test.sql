-- All accounts, acknowledgement receipts and temporary grants roll back.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $test_grants$ declare f record; begin
  for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',f.nspname,f.proname,f.args); end loop;
end; $test_grants$;
select plan(35);
insert into auth.users(id,email,email_confirmed_at,is_anonymous,banned_until) values
 ('a1000000-0000-4000-8000-000000000001','policy-alex@example.invalid',now(),false,null),
 ('a1000000-0000-4000-8000-000000000002','policy-blair@example.invalid',now(),false,null),
 ('a1000000-0000-4000-8000-000000000003','policy-unconfirmed@example.invalid',null,false,null),
 ('a1000000-0000-4000-8000-000000000004','policy-anonymous@example.invalid',now(),true,null),
 ('a1000000-0000-4000-8000-000000000005','policy-banned@example.invalid',now(),false,now()+interval '1 day');
update auth.users set raw_user_meta_data='{"acceptedTerms":true,"policy_version":"food-go-community-2026-11-15","acceptedAt":"2000-01-01"}'::jsonb
where id='a1000000-0000-4000-8000-000000000001';
insert into private.community_policy_acceptances(user_id,policy_version)
values('a1000000-0000-4000-8000-000000000002','previous-policy-version');
insert into private.community_posts(id,author_id,body,visibility,moderation_status)
select 'a2000000-0000-4000-8000-000000000001',id,'Approved policy fixture','public','published'
from private.community_authors where user_id='a1000000-0000-4000-8000-000000000001';
insert into private.community_posts(id,author_id,body,visibility)
select 'a2000000-0000-4000-8000-000000000002',id,'Old private thought','private'
from private.community_authors where user_id='a1000000-0000-4000-8000-000000000002';
select set_config('food_go.other_author',(select id::text from private.community_authors where user_id='a1000000-0000-4000-8000-000000000003'),true);

set local role anon;
select throws_ok('select public.food_go_community_policy_status()','42501',null,'anonymous callers cannot read acknowledgement status');
select throws_ok($$select public.food_go_accept_community_policy('food-go-community-2026-11-15',true)$$,'42501',null,'anonymous callers cannot accept');
select throws_ok('select * from private.community_policy_acceptances','42501',null,'anonymous callers cannot read private receipts');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_community_policy_status()','42501',null,'unconfirmed accounts cannot read status');
select throws_ok($$select public.food_go_accept_community_policy('food-go-community-2026-11-15',true)$$,'42501',null,'unconfirmed accounts cannot accept');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_community_policy_status()','42501',null,'anonymous identities cannot satisfy consent');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_community_policy_status()->>'version','food-go-community-2026-11-15','server supplies the current version');
select is(public.food_go_community_policy_status()->'acceptedAt','null'::jsonb,'editable metadata cannot forge acknowledgement evidence');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Public without consent","visibility":"public","requestId":"a3000000-0000-4000-8000-000000000001"}')$$,'FC005',null,'direct RPC cannot post publicly without acceptance');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Private without consent","visibility":"private","requestId":"a3000000-0000-4000-8000-000000000002"}')$$,'FC005',null,'private wall posts also require acceptance');
select throws_ok($$select public.food_go_community_write('{"action":"comment","body":"Reply without consent","postId":"a2000000-0000-4000-8000-000000000001","requestId":"a3000000-0000-4000-8000-000000000003"}')$$,'FC005',null,'direct comments require acceptance');
select throws_ok($$select public.food_go_community_write('{"action":"like","postId":"a2000000-0000-4000-8000-000000000001","liked":true}')$$,'FC005',null,'likes require acceptance');
select throws_ok($$select public.food_go_community_write('{"action":"share","postId":"a2000000-0000-4000-8000-000000000001","shared":true}')$$,'FC005',null,'shares require acceptance');
select throws_ok($$select public.food_go_accept_community_policy('previous-policy-version',true)$$,'22023',null,'stale policy versions cannot satisfy acceptance');
select throws_ok($$select public.food_go_accept_community_policy('food-go-community-2026-11-15',false)$$,'22023',null,'unchecked acceptance is rejected');
select throws_ok($$select public.food_go_accept_community_policy(null,true)$$,'22023',null,'a missing version is rejected');
select throws_ok($$insert into private.community_policy_acceptances(user_id,policy_version) values('a1000000-0000-4000-8000-000000000002','food-go-community-2026-11-15')$$,'42501',null,'callers cannot forge another account receipt');
select throws_ok($$select private.community_write_original('{"action":"create"}')$$,'42501',null,'the original write implementation cannot bypass the guard');
select lives_ok($$select public.food_go_accept_community_policy('food-go-community-2026-11-15',true)$$,'the verified caller can explicitly accept');
select ok(public.food_go_community_policy_status()->>'acceptedAt' is not null,'acceptance has a server timestamp');
select set_config('food_go.receipt',public.food_go_community_policy_status()->>'acceptedAt',true);
select is(public.food_go_accept_community_policy('food-go-community-2026-11-15',true)->>'acceptedAt',current_setting('food_go.receipt'),'retry preserves the original acceptance time');
reset role;
select is((select count(*) from private.community_policy_acceptances where user_id='a1000000-0000-4000-8000-000000000001'),1::bigint,'retries keep a single immutable receipt');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_community_policy_status()->'acceptedAt','null'::jsonb,'another user and their old version are not accepted');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Another account","visibility":"public","requestId":"a3000000-0000-4000-8000-000000000004"}')$$,'FC005',null,'one users receipt cannot authorise another account');
select lives_ok($$select public.food_go_community_write('{"action":"report","postId":"a2000000-0000-4000-8000-000000000001","reason":"abuse"}')$$,'reporting remains available without acceptance');
select lives_ok($$select public.food_go_community_write(jsonb_build_object('action','block','authorId',current_setting('food_go.other_author')))$$,'blocking remains available without acceptance');
select lives_ok($$select public.food_go_community_write('{"action":"delete","postId":"a2000000-0000-4000-8000-000000000002"}')$$,'deleting ones own existing post remains available');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_community_write('{"action":"create","body":"An acknowledged public story","visibility":"public","requestId":"a3000000-0000-4000-8000-000000000005"}')->>'status','pending','accepted content still requires public moderation');
select is(public.food_go_community_write('{"action":"comment","body":"An acknowledged reply","postId":"a2000000-0000-4000-8000-000000000001","requestId":"a3000000-0000-4000-8000-000000000006"}')->>'status','pending','accepted replies still require moderation');
select throws_ok($$update private.community_policy_acceptances set accepted_at='2000-01-01' where user_id='a1000000-0000-4000-8000-000000000001'$$,'42501',null,'users cannot rewrite acknowledgement evidence');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_community_policy_status()','42501',null,'banned accounts cannot read acknowledgement status');
select throws_ok($$select public.food_go_accept_community_policy('food-go-community-2026-11-15',true)$$,'42501',null,'banned accounts cannot accept their way around suspension');
select throws_ok($$select public.food_go_community_write('{"action":"report","postId":"a2000000-0000-4000-8000-000000000001","reason":"other"}')$$,'42501',null,'all community writes reject banned accounts');
reset role;
select ok((select relrowsecurity from pg_class where oid='private.community_policy_acceptances'::regclass),'receipt table enables defence-in-depth RLS');
select ok((select bool_and(not has_table_privilege(r,'private.community_policy_acceptances','SELECT,INSERT,UPDATE,DELETE')) from unnest(array['anon','authenticated']) r),'neither client role has direct receipt table privileges');
select * from finish();
rollback;

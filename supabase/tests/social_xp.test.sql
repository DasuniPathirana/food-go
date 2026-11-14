-- Approved development target only. Fixtures and temporary pgTAP grants roll back.
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
select plan(83);

insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at,raw_user_meta_data) values
 ('91000000-0000-4000-8000-000000000001','xp-alex@example.invalid',now(),null,null,'{"display_name":"Alex XP"}'),
 ('91000000-0000-4000-8000-000000000002','xp-blair@example.invalid',now(),null,null,'{"display_name":"Blair XP"}'),
 ('91000000-0000-4000-8000-000000000003','xp-casey@example.invalid',now(),null,null,'{"display_name":"Casey XP"}'),
 ('91000000-0000-4000-8000-000000000004','xp-unconfirmed@example.invalid',null,null,null,'{}'),
 ('91000000-0000-4000-8000-000000000005',null,null,'61423456789',now(),'{}'),
 ('91000000-0000-4000-8000-000000000006',null,null,'447234567890',now(),'{}'),
 ('91000000-0000-4000-8000-000000000007','xp-cap-owner@example.invalid',now(),null,null,'{}'),
 ('91000000-0000-4000-8000-000000000008','xp-cap-commenter@example.invalid',now(),null,null,'{}');
select set_config('food_go.xp_a',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000001'),true);
select set_config('food_go.xp_b',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000002'),true);
select set_config('food_go.xp_c',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000003'),true);
select set_config('food_go.xp_au',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000005'),true);
select set_config('food_go.xp_cap_owner',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000007'),true);
select set_config('food_go.xp_cap_commenter',(select id::text from private.community_authors where user_id='91000000-0000-4000-8000-000000000008'),true);

insert into private.community_posts(id,author_id,body,visibility,moderation_status,deleted_at)
select '92000000-0000-4000-8000-000000000001'::uuid,current_setting('food_go.xp_a')::uuid,'Approved Alex food story','public','published',null::timestamptz union all
select '92000000-0000-4000-8000-000000000002',current_setting('food_go.xp_b')::uuid,'Approved Blair food story','public','published',null union all
select '92000000-0000-4000-8000-000000000003',current_setting('food_go.xp_a')::uuid,'Private Alex thought','private','pending',null union all
select '92000000-0000-4000-8000-000000000004',current_setting('food_go.xp_a')::uuid,'Pending Alex food story','public','pending',null union all
select '92000000-0000-4000-8000-000000000005',current_setting('food_go.xp_a')::uuid,'Removed Alex food story','public','published',now();

select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_a')::uuid and kind='post'),1,'only approved public non-deleted post creates initial XP');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('community_post_views','community_xp_events')),'reach and XP tables both enable RLS');
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok('select * from private.community_post_views','42501',null,'anonymous readers cannot inspect unique viewer records');
select throws_ok('select * from private.community_xp_events','42501',null,'anonymous readers cannot inspect the XP ledger');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous impressions cannot record reach');
select throws_ok('select public.food_go_game_profile()','42501',null,'anonymous readers cannot open a game profile');
select is((public.food_go_community_feed_v2(p_post=>'92000000-0000-4000-8000-000000000001')->'posts'->0->>'reachCount')::integer,0,'public DTO starts with zero qualified reach');
select ok(public.food_go_community_feed_v2()::text !~ 'user_id|viewer_id|beneficiary_id|actor_id|event_key|email|phone|91000000','public feed v2 excludes authentication and reach identities');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select * from private.community_post_views','42501',null,'signed-in role cannot inspect raw reach');
select throws_ok('select * from private.community_xp_events','42501',null,'signed-in role cannot inspect raw XP');
select throws_ok($$insert into private.community_post_views(post_id,viewer_id) values('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002')$$,'42501',null,'client cannot forge reach records');
select throws_ok($$select private.community_award('forged','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','post')$$,'42501',null,'client cannot call private XP award authority');
select throws_ok('select public.food_go_game_profile()','42501',null,'authenticated role without a subject is not a verified viewer');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'42501',null,'missing subject cannot record reach');
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_game_profile()','42501',null,'unconfirmed account cannot open earned progress');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'42501',null,'unconfirmed account cannot count as qualified reach');
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_game_profile()','42501',null,'confirmed foreign phone is outside the approved identity scope');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'42501',null,'foreign phone confirmation cannot mint reach');
reset role;

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((public.food_go_game_profile()->>'xp')::integer,25,'one approved public post awards 25 XP');
select is((public.food_go_game_profile()->>'level')::integer,1,'initial level matches the server threshold');
select is((public.food_go_game_profile()->>'nextLevelXp')::integer,250,'next-level threshold is explicit');
select lives_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'author can view own public story');
select is((public.food_go_game_profile()->>'reachCount')::integer,0,'self-view does not increase reach');
select is((public.food_go_game_profile()->>'xp')::integer,25,'self-view does not award XP');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000003')$$,'FC004',null,'private post cannot receive reach even from its author');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000004')$$,'FC004',null,'pending post cannot receive reach');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000005')$$,'FC004',null,'removed post cannot receive reach');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000099')$$,'FC004',null,'unknown post cannot receive reach');
select lives_ok($$select public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000001","liked":true}')$$,'self-like is a reaction without a reward');
select is((public.food_go_game_profile()->>'xp')::integer,25,'self-like awards no XP');
reset role;
select is((select count(*)::integer from private.community_post_views),0,'self and unavailable views never create private view records');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok('select public.food_go_game_profile()','verified Australian phone account can open progress');
select lives_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001');select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001');$$,'verified AU phone may record and retry a view');
select is((public.food_go_game_profile()->>'xp')::integer,0,'viewing awards XP to the creator rather than the viewer');
reset role;
select is((select count(*)::integer from private.community_post_views where post_id='92000000-0000-4000-8000-000000000001'),1,'repeated view from one account counts once');
select is((select count(*)::integer from private.community_xp_events where kind='reach'),1,'repeated view creates one reach reward');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'another confirmed account contributes independent reach');
select lives_ok($$select public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000001","liked":true}');select public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000001","liked":true}');$$,'like retry remains idempotent');
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((public.food_go_game_profile()->>'reachCount')::integer,2,'creator sees two qualified distinct accounts');
select is((public.food_go_game_profile()->>'xp')::integer,29,'post plus two qualified views and one other-account like total 29 XP');
select ok(public.food_go_game_profile()::text !~ 'user_id|viewer_id|beneficiary_id|actor_id|event_key|post_id|email|phone|91000000','game profile contains no private actor identifiers');
select ok((select bool_and((select array_agg(k order by k) from jsonb_object_keys(a) k)=array['at','kind','points']) from jsonb_array_elements(public.food_go_game_profile()->'activity') a),'activity exposes only kind, points and timestamp');
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000001","liked":false}')$$,'unlike is accepted');
reset role;
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),27,'unlike withdraws the active reward');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000001","liked":true}')$$,'re-like is accepted');
reset role;
select is((select count(*)::integer from private.community_xp_events where kind='like' and post_id='92000000-0000-4000-8000-000000000001'),1,'unlike and re-like retain one historical award key');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),29,'re-like restores the original reward without duplication');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_community_write('{"action":"comment","postId":"92000000-0000-4000-8000-000000000001","body":"A useful food reply","requestId":"94000000-0000-4000-8000-000000000001"}')->>'status','pending','new comment requires moderation before XP');
select set_config('food_go.xp_comment',public.food_go_community_write('{"action":"comment","postId":"92000000-0000-4000-8000-000000000001","body":"A useful food reply","requestId":"94000000-0000-4000-8000-000000000001"}')->>'id',true);
select is((public.food_go_game_profile()->>'xp')::integer,0,'pending comment and its retry award no XP');
reset role;
update private.community_comments set moderation_status='published' where id=current_setting('food_go.xp_comment')::uuid;
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_c')::uuid)),5,'approved reply on another author public post awards 5 XP');
update private.community_comments set moderation_status='pending' where id=current_setting('food_go.xp_comment')::uuid;
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_c')::uuid)),0,'withdrawing comment approval withdraws active comment XP');
update private.community_comments set moderation_status='published' where id=current_setting('food_go.xp_comment')::uuid;
select is((select count(*)::integer from private.community_xp_events where comment_id=current_setting('food_go.xp_comment')::uuid),1,'re-approving comment reuses its original event');
insert into private.community_comments(post_id,author_id,body,moderation_status) values
 ('92000000-0000-4000-8000-000000000001',current_setting('food_go.xp_a')::uuid,'Own reply','published'),
 ('92000000-0000-4000-8000-000000000004',current_setting('food_go.xp_c')::uuid,'Reply on pending post','published'),
 ('92000000-0000-4000-8000-000000000003',current_setting('food_go.xp_c')::uuid,'Reply on private post','published');
select is((select count(*)::integer from private.community_xp_events where kind='comment'),1,'own, pending-parent and private-parent replies award nothing');

update private.community_posts set moderation_status='published' where id='92000000-0000-4000-8000-000000000004';
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_a')::uuid and kind='post'),2,'approval awards a previously pending public post once');
update private.community_posts set moderation_status='pending' where id='92000000-0000-4000-8000-000000000001';
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),25,'unpublishing hides that post and all its active rewards');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_c')::uuid)),0,'unpublishing parent hides comment reward');
update private.community_posts set moderation_status='published' where id='92000000-0000-4000-8000-000000000001';
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),54,'republishing restores valid prior events without new XP');
update private.community_posts set visibility='private',moderation_status='pending' where id='92000000-0000-4000-8000-000000000001';
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),25,'making post private withdraws all its active rewards');
update private.community_posts set visibility='public',moderation_status='published' where id='92000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write('{"action":"delete","postId":"92000000-0000-4000-8000-000000000001"}')$$,'author can remove own rewarded post');
select is((public.food_go_game_profile()->>'xp')::integer,25,'soft removal withdraws post, like and reach XP');
select is((public.food_go_game_profile()->>'reachCount')::integer,0,'soft removal withdraws qualified reach total');
reset role;
update private.community_posts set deleted_at=null where id='92000000-0000-4000-8000-000000000001';

insert into private.community_blocks(author_id,blocked_id) values(current_setting('food_go.xp_a')::uuid,current_setting('food_go.xp_b')::uuid);
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000001')$$,'FC004',null,'blocked viewer cannot record even a repeat view');
select throws_ok($$select public.food_go_record_post_view('92000000-0000-4000-8000-000000000004')$$,'FC004',null,'blocked viewer cannot add new reach');
select throws_ok($$select public.food_go_community_write('{"action":"comment","postId":"92000000-0000-4000-8000-000000000001","body":"Blocked reply","requestId":"94000000-0000-4000-8000-000000000002"}')$$,'FC004',null,'blocked account cannot submit a reward-bearing comment');
reset role;
insert into private.community_comments(id,post_id,author_id,body,moderation_status) values('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001',current_setting('food_go.xp_b')::uuid,'Comment approved after a block','published');
select is((select count(*)::integer from private.community_xp_events where comment_id='93000000-0000-4000-8000-000000000002'),0,'approving comment while authors are blocked creates no reward event');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),51,'blocking withdraws that account like and reach rewards');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((public.food_go_game_profile()->>'reachCount')::integer,1,'blocked account no longer contributes qualified reach');
reset role;
delete from private.community_blocks where author_id=current_setting('food_go.xp_a')::uuid and blocked_id=current_setting('food_go.xp_b')::uuid;
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),54,'unblocking restores original valid events without duplicating them');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_b')::uuid)),25,'unblocking does not invent an award for a comment approved during the block');
update auth.users set phone_confirmed_at=null where id='91000000-0000-4000-8000-000000000005';
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_a')::uuid)),53,'withdrawn viewer verification withdraws reach XP');
update auth.users set phone_confirmed_at=now() where id='91000000-0000-4000-8000-000000000005';

-- Separate owners and actors keep cap assertions independent from interaction fixtures.
insert into private.community_posts(id,author_id,body,visibility,moderation_status)
select ('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,current_setting('food_go.xp_cap_owner')::uuid,'Cap food story '||i,'public','published' from generate_series(101,105) i;
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='post'),3,'daily approved-post XP cap permits three rewards');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_cap_owner')::uuid)),75,'five approved posts still earn only 75 post XP');
insert into private.community_comments(id,post_id,author_id,body,moderation_status)
select ('93000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'92000000-0000-4000-8000-000000000101',current_setting('food_go.xp_cap_commenter')::uuid,'Cap food reply '||i,'published' from generate_series(101,112) i;
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_commenter')::uuid and kind='comment'),10,'daily comment XP cap permits ten approved replies');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_cap_commenter')::uuid)),50,'twelve approved replies earn only 50 comment XP');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select ('96000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'xp-cap-viewer-'||i||'@example.invalid',now(),'{}'::jsonb from generate_series(1,60) i;
set local role authenticated;
do $cap_calls$ declare i integer; begin
  for i in 1..60 loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub','96000000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated')::text,true);
    perform public.food_go_record_post_view('92000000-0000-4000-8000-000000000101');
    perform public.food_go_community_write('{"action":"like","postId":"92000000-0000-4000-8000-000000000101","liked":true}');
  end loop;
end; $cap_calls$;
reset role;
select is((select count(*)::integer from private.community_post_views where post_id='92000000-0000-4000-8000-000000000101'),60,'qualified reach continues counting after reward cap');
select is((select count(*)::integer from private.community_xp_events where post_id='92000000-0000-4000-8000-000000000101' and kind='reach'),25,'reach XP is bounded to 25 accounts per post');
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='like'),50,'daily creator-like XP is capped at 50 unique events');
select is((select coalesce(sum(points),0)::integer from private.community_active_xp(current_setting('food_go.xp_cap_owner')::uuid)),200,'post, like and reach caps combine to the expected bounded total');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select is((public.food_go_game_profile()->>'reachCount')::integer,60,'profile distinguishes actual qualified reach from capped XP');
select is(jsonb_array_length(public.food_go_game_profile()->'activity'),12,'recent XP activity is bounded to twelve entries');
reset role;
update private.community_posts set deleted_at=now() where id=(select post_id from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='post' order by event_key limit 1);
insert into private.community_posts(id,author_id,body,visibility,moderation_status) values('92000000-0000-4000-8000-000000000106',current_setting('food_go.xp_cap_owner')::uuid,'Replacement cap story','public','published');
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='post'),3,'removing rewarded post does not free its daily XP cap slot');
update private.community_xp_events set awarded_at=now()-interval '2 days' where event_key=(select event_key from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='post' order by event_key limit 1);
insert into private.community_posts(id,author_id,body,visibility,moderation_status) values('92000000-0000-4000-8000-000000000107',current_setting('food_go.xp_cap_owner')::uuid,'New day cap story','public','published');
select is((select count(*)::integer from private.community_xp_events where beneficiary_id=current_setting('food_go.xp_cap_owner')::uuid and kind='post'),4,'historical events from an earlier day do not consume today cap');
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select ok(public.food_go_community_feed_v2()::text !~ 'user_id|viewer_id|beneficiary_id|actor_id|event_key|email|phone|91000000|96000000','enriched public counts still reveal no viewer or authentication identities');
reset role;
select * from finish();
rollback;

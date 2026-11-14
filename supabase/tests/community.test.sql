-- Approved development target only. The entire fixture suite rolls back.
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
select plan(46);
insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at,raw_user_meta_data) values
 ('81000000-0000-4000-8000-000000000001','community-a@example.invalid',now(),null,null,'{"display_name":"Alex"}'),
 ('81000000-0000-4000-8000-000000000002','community-b@example.invalid',now(),null,null,'{"display_name":"Blair"}'),
 ('81000000-0000-4000-8000-000000000003','community-c@example.invalid',now(),null,null,'{"display_name":"Casey"}'),
 ('81000000-0000-4000-8000-000000000004','community-unconfirmed@example.invalid',null,null,null,'{}'),
 ('81000000-0000-4000-8000-000000000005',null,null,'61412345678',now(),'{}'),
 ('81000000-0000-4000-8000-000000000006',null,null,'447123456789',now(),'{}');
select set_config('food_go.actor_a',(select id::text from private.community_authors where user_id='81000000-0000-4000-8000-000000000001'),true);
select set_config('food_go.actor_b',(select id::text from private.community_authors where user_id='81000000-0000-4000-8000-000000000002'),true);
select set_config('food_go.actor_c',(select id::text from private.community_authors where user_id='81000000-0000-4000-8000-000000000003'),true);
insert into private.community_posts(id,author_id,body,visibility,moderation_status)
select '82000000-0000-4000-8000-000000000001'::uuid,current_setting('food_go.actor_a')::uuid,'Approved Alex experience','public','published' union all
select '82000000-0000-4000-8000-000000000002',current_setting('food_go.actor_b')::uuid,'Approved Blair experience','public','published' union all
select '82000000-0000-4000-8000-000000000003',current_setting('food_go.actor_c')::uuid,'Approved Casey experience','public','published' union all
select '82000000-0000-4000-8000-000000000004',current_setting('food_go.actor_a')::uuid,'Private Alex thought','private','pending' union all
select '82000000-0000-4000-8000-000000000005',current_setting('food_go.actor_a')::uuid,'Pending Alex thought','public','pending';
insert into private.community_comments(post_id,author_id,body,moderation_status,created_at)
select '82000000-0000-4000-8000-000000000001',current_setting('food_go.actor_c')::uuid,'Approved comment '||i,'published',now()-i*interval '1 minute' from generate_series(1,22) i;
insert into private.community_shares(author_id,post_id) values(current_setting('food_go.actor_b')::uuid,'82000000-0000-4000-8000-000000000003');

set local role anon;
select throws_ok($$select public.food_go_community_write('{"action":"like","postId":"82000000-0000-4000-8000-000000000001","liked":true}')$$,'42501',null,'anonymous users cannot write');
select throws_ok('select * from private.community_posts','42501',null,'anonymous users cannot bypass presentation RPC');
select is(jsonb_array_length(public.food_go_community_feed()->'posts'),3,'public feed contains only approved public posts');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000004')->'posts'),0,'private post IDs are not public permalinks');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000005')->'posts'),0,'pending post IDs are not public permalinks');
select ok(public.food_go_community_feed()::text !~ 'user_id|email|phone|81000000|moderation_status','public DTO excludes private identities and moderation columns');
select is(public.food_go_community_feed()->'viewer','null'::jsonb,'anonymous reader has no viewer identity');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000001')->'posts'->0->'comments'),20,'comment previews are bounded');
select ok(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000001')->'posts'->0->>'commentsNextCursor' is not null,'comment continuation is provided');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000001',p_comments_cursor=>public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000001')->'posts'->0->>'commentsNextCursor')->'posts'->0->'comments'),2,'comment continuation reaches remaining replies');
select throws_ok($$select public.food_go_community_feed(p_cursor=>'not a cursor')$$,'22023',null,'direct query rejects malformed cursor');
select throws_ok($$select public.food_go_community_feed(p_wall=>'me')$$,'42501',null,'anonymous user cannot open an account wall');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"An unconfirmed post","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')$$,'42501',null,'unconfirmed identity cannot submit content');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write('{"action":"create","body":"My private phone thought","visibility":"private","requestId":"83000000-0000-4000-8000-000000000001"}')$$,'verified Australian phone identity can submit');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Foreign phone post","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')$$,'42501',null,'foreign phone does not bypass confirmed AU identity scope');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_community_write('{"action":"create","body":"My new experience","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')->>'status','pending','new public posts cannot publish themselves');
select is(public.food_go_community_write('{"action":"create","body":"My new experience","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')->>'id',public.food_go_community_write('{"action":"create","body":"My new experience","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')->>'id','same submission key returns the original post');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Changed retry text","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')$$,'FC003',null,'changed retry cannot create or overwrite content');
select throws_ok($$select public.food_go_community_write(jsonb_build_object('action','create','body','Forged authority','visibility','public','requestId','83000000-0000-4000-8000-000000000002','authorId',current_setting('food_go.actor_b')))$$,'22023',null,'caller cannot assign another author');
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Bypass approval","visibility":"public","requestId":"83000000-0000-4000-8000-000000000002","status":"published"}')$$,'22023',null,'caller cannot assign publication authority');
select throws_ok($$select public.food_go_community_write(jsonb_build_object('action','create','body',repeat('x',2001),'visibility','public','requestId','83000000-0000-4000-8000-000000000002'))$$,'22023',null,'database independently enforces text bounds');
select is(jsonb_array_length(public.food_go_community_feed(p_wall=>'me')->'posts'),4,'owner wall includes own published, pending and private posts without duplicate retries');
select is(jsonb_array_length(public.food_go_community_feed()->'posts'),3,'even own private and pending posts stay out of public feed');
select throws_ok($$select public.food_go_community_write('{"action":"like","postId":"82000000-0000-4000-8000-000000000004","liked":true}')$$,'FC004',null,'private thoughts cannot be liked as public experiences');
select lives_ok($$select public.food_go_community_write('{"action":"like","postId":"82000000-0000-4000-8000-000000000002","liked":true}');select public.food_go_community_write('{"action":"like","postId":"82000000-0000-4000-8000-000000000002","liked":true}');$$,'repeated like request succeeds idempotently');
select is((public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000002')->'posts'->0->>'likeCount')::integer,1,'repeated likes count once');
select lives_ok($$select public.food_go_community_write('{"action":"share","postId":"82000000-0000-4000-8000-000000000002"}');select public.food_go_community_write('{"action":"share","postId":"82000000-0000-4000-8000-000000000002"}');$$,'share to wall is idempotent');
select is((public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000002')->'posts'->0->>'shareCount')::integer,1,'repeated shares count once');
select is(jsonb_array_length(public.food_go_community_feed(p_wall=>'me')->'posts'),5,'shared public post appears once on personal wall');
select is(public.food_go_community_write('{"action":"comment","postId":"82000000-0000-4000-8000-000000000002","body":"A new reply","requestId":"83000000-0000-4000-8000-000000000002"}')->>'status','pending','comments also require approval before public display');
select is(public.food_go_community_write('{"action":"comment","postId":"82000000-0000-4000-8000-000000000002","body":"A new reply","requestId":"83000000-0000-4000-8000-000000000002"}')->>'id',public.food_go_community_write('{"action":"comment","postId":"82000000-0000-4000-8000-000000000002","body":"A new reply","requestId":"83000000-0000-4000-8000-000000000002"}')->>'id','comment retry returns the original reply');
select throws_ok($$select public.food_go_community_write('{"action":"delete","postId":"82000000-0000-4000-8000-000000000002"}')$$,'42501',null,'other authors cannot delete a post');
select lives_ok($$select public.food_go_community_write('{"action":"report","postId":"82000000-0000-4000-8000-000000000002","reason":"spam"}')$$,'private report can be submitted');
select throws_ok('select * from private.community_reports','42501',null,'report contents cannot be read through client grants');
select lives_ok($$select public.food_go_community_write(jsonb_build_object('action','block','authorId',current_setting('food_go.actor_b')))$$,'reader can block another community author');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000002')->'posts'),0,'blocked author post disappears even through guessed permalink');
select is(jsonb_array_length(public.food_go_community_feed(p_wall=>current_setting('food_go.actor_b'))->'posts'),0,'blocked wall cannot leak a third-party original through a reshare');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.food_go_community_feed(p_wall=>current_setting('food_go.actor_a'))->'posts'),0,'block is mutual for wall reads');
select throws_ok($$select public.food_go_community_write('{"action":"like","postId":"82000000-0000-4000-8000-000000000001","liked":true}')$$,'FC004',null,'blocked actor cannot react to the blocker');
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000004')->'posts'),0,'different authenticated account cannot read private thought');
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_community_write('{"action":"delete","postId":"82000000-0000-4000-8000-000000000001"}')$$,'author can remove own experience');
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select is(jsonb_array_length(public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000001')->'posts'),0,'deleted original and all its comments disappear from public read');
select is((public.food_go_community_feed(p_post=>'82000000-0000-4000-8000-000000000002')->'posts'->0->>'commentCount')::integer,0,'pending reply never enters another reader count');
reset role;
insert into private.community_posts(author_id,body,visibility)
select current_setting('food_go.actor_a')::uuid,'Daily limit fixture '||i,'private' from generate_series(1,20) i;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_community_write('{"action":"create","body":"Too many posts","visibility":"public","requestId":"83000000-0000-4000-8000-000000000003"}')$$,'FC002',null,'daily post limit is enforced by database direct calls');
select lives_ok($$select public.food_go_community_write('{"action":"create","body":"My new experience","visibility":"public","requestId":"83000000-0000-4000-8000-000000000001"}')$$,'unchanged successful retry still works after reaching the cap');
reset role;
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'community_%' and c.relkind='r'),'all private community tables also enable RLS');
select * from finish();
rollback;

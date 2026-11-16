-- Disposable test database only. All identities, grants and adventure state roll back.
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
select plan(82);
insert into auth.users(id,email,email_confirmed_at) values
 ('b1000000-0000-4000-8000-000000000001','owner@adventure.example.invalid',now()),
 ('b1000000-0000-4000-8000-000000000002','player@adventure.example.invalid',now()),
 ('b1000000-0000-4000-8000-000000000003','operator@adventure.example.invalid',now()),
 ('b1000000-0000-4000-8000-000000000004','other@adventure.example.invalid',now());
insert into auth.sessions(id,user_id) select id,id from auth.users where id::text like 'b1000000-%';
insert into private.food_go_operators(user_id) values('b1000000-0000-4000-8000-000000000003');
insert into public.organizations(id,name) values('b2000000-0000-4000-8000-000000000001','Adventure fixture group');
insert into public.organization_members(organization_id,user_id,role) values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','owner');
insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at,game_enabled)
 values('b2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','adventure-fixture','Adventure fixture restaurant','restaurant','Italian','1 Fixture Street','Melbourne','VIC','3000','published',now(),true);
insert into public.promotions(id,venue_id,title,description,starts_at,ends_at,status)
 values('b6000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','Venue offer','A genuine venue-wide offer.',now()-interval '1 hour',now()+interval '1 day','published');
insert into public.promotions(id,venue_id,title,description,starts_at,ends_at,status,kind)
 values('b6000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Lunch offer','An individual lunch offer.',now()-interval '1 hour',now()+interval '1 day','published','food');
select is((select kind from public.promotions where id='b6000000-0000-4000-8000-000000000001'),'restaurant','legacy offers default to Restaurant Deals');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('private.adventure_quests'::regclass,'private.outback_villages'::regclass,'private.outback_plots'::regclass,'private.adventure_rewards'::regclass)),'valuable game tables have RLS');
select is(private.adventure_level_xp(1),0::bigint,'level one starts at zero');
select is(private.adventure_level_xp(2),250::bigint,'first threshold preserves existing progress contract');
select ok(private.adventure_level_xp(101)-private.adventure_level_xp(100)>private.adventure_level_xp(100)-private.adventure_level_xp(99),'post-100 curve is steeper');
select ok((private.adventure_level_requirements(250)->>'questCategories')::integer>=4,'top level needs diverse genuine quests');
set local role anon;
select is((select p->>'kind' from jsonb_array_elements(public.food_go_active_promotions()) p where p->>'id'='b6000000-0000-4000-8000-000000000002'),'food','public offer DTO retains the Food Deals classification');
select throws_ok('select public.food_go_adventure()','42501',null,'anonymous game state denied');
select throws_ok('select * from private.outback_villages','42501',null,'private village balances cannot be read directly');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.food_go_adventure()','42501',null,'a live session is required');
select throws_ok('select public.food_go_game_profile()','42501',null,'canonical progress also requires a live session');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.food_go_adventure()->'village','null'::jsonb,'new players have no silently selected destination');
select lives_ok($$select public.food_go_adventure('{"action":"chooseDestination","region":"VIC","requestId":"b3000000-0000-4000-8000-000000000001"}')$$,'choose a permanent Australian destination');
select is((public.food_go_adventure()->'village'->'resources'->>'wood')::integer,100,'initial materials are server supplied');
select lives_ok($$select public.food_go_adventure('{"action":"chooseDestination","region":"VIC","requestId":"b3000000-0000-4000-8000-000000000001"}')$$,'identical retries are safe');
select throws_ok($$select public.food_go_adventure('{"action":"chooseDestination","region":"WA","requestId":"b3000000-0000-4000-8000-000000000001"}')$$,'FG409',null,'changed retry cannot reset resources');
select throws_ok($$select public.food_go_adventure('{"action":"chooseDestination","region":"WA","requestId":"b3000000-0000-4000-8000-000000000002"}')$$,'FG409',null,'home region cannot be changed');
select throws_ok($$update private.outback_villages set coins=10000 where user_id=auth.uid()$$,'42501',null,'clients cannot mint supplies');
select lives_ok($$select public.food_go_adventure('{"action":"clear","cell":0,"requestId":"b3000000-0000-4000-8000-000000000003"}')$$,'prepare a plot');
select is((public.food_go_adventure()->'village'->'resources'->>'wood')::integer,90,'clearing spends materials once');
select lives_ok($$select public.food_go_adventure('{"action":"build","cell":0,"structure":"shed","requestId":"b3000000-0000-4000-8000-000000000004"}')$$,'start a real server-timed construction');
select throws_ok($$select public.food_go_adventure('{"action":"finish","cell":0,"requestId":"b3000000-0000-4000-8000-000000000005"}')$$,'FG409',null,'cannot finish before the server clock');
select throws_ok($$select public.food_go_adventure('{"action":"plant","cell":6,"crop":"carrot","xp":99999,"requestId":"b3000000-0000-4000-8000-000000000006"}')$$,'22023',null,'RPC rejects forged XP fields');
reset role;
update private.outback_plots set ready_at=now()-interval '1 second' where user_id='b1000000-0000-4000-8000-000000000002' and cell=0;
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"finish","cell":0,"requestId":"b3000000-0000-4000-8000-000000000007"}')$$,'completed construction is persisted');
select lives_ok($$select public.food_go_adventure('{"action":"plant","cell":6,"crop":"carrot","requestId":"b3000000-0000-4000-8000-000000000008"}')$$,'plant a crop with server-owned seeds and water');
select throws_ok($$select public.food_go_adventure('{"action":"harvest","cell":6,"requestId":"b3000000-0000-4000-8000-000000000009"}')$$,'FG409',null,'cannot harvest before growing completes');
reset role;
update private.outback_plots set ready_at=now()-interval '1 second' where user_id='b1000000-0000-4000-8000-000000000002' and cell=6;
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"harvest","cell":6,"requestId":"b3000000-0000-4000-8000-000000000010"}')$$,'ready crop yields virtual supplies');
select is((public.food_go_adventure()->'village'->'resources'->>'coins')::integer,62,'server applies exact build costs and crop yield');
select throws_ok($$select public.food_go_adventure('{"action":"harvest","cell":6,"requestId":"b3000000-0000-4000-8000-000000000011"}')$$,'FG409',null,'fresh request cannot harvest a crop twice');
select lives_ok($$select public.food_go_adventure('{"action":"clear","cell":1,"requestId":"b3000000-0000-4000-8000-000000000027"}')$$,'prepare another construction plot');
select throws_ok($$select public.food_go_adventure('{"action":"build","cell":1,"structure":"bakery","requestId":"b3000000-0000-4000-8000-000000000028"}')$$,'FG409',null,'construction cannot overdraw earned supplies');
select is((select p->>'kind' from jsonb_array_elements(public.food_go_adventure()->'village'->'plots') p where p->>'cell'='1'),'cleared','failed spend rolls its tentative building mutation back');
select throws_ok($$select public.food_go_adventure('{"action":"claimDaily","requestId":"b3000000-0000-4000-8000-000000000012"}')$$,'FG409',null,'farm clicks alone do not earn daily food-activity supplies');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_partner_workspace(jsonb_build_object('action','promo','venueId','b2000000-0000-4000-8000-000000000002','id','b6000000-0000-4000-8000-000000000004','title','Owner meal offer','description','A genuine owner meal offer.','kind','food','startsAt',now(),'endsAt',now()+interval '1 day'))$$,'owner can submit a Food Deal for independent publication');
select is((select p->>'kind' from jsonb_array_elements(public.food_go_partner_workspace('{"action":"read","venueId":"b2000000-0000-4000-8000-000000000002"}')->'promotions') p where p->>'id'='b6000000-0000-4000-8000-000000000004'),'food','owner workspace retains the selected food category');
select throws_ok($$select public.food_go_partner_workspace(jsonb_build_object('action','promo','venueId','b2000000-0000-4000-8000-000000000002','id','b6000000-0000-4000-8000-000000000005','title','Bad category offer','description','A genuine owner meal offer.','kind','unsupported','startsAt',now(),'endsAt',now()+interval '1 day'))$$,'22023',null,'owner RPC rejects unsupported categories');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','questCreate','requestId','b3000000-0000-4000-8000-000000000013','id','b4000000-0000-4000-8000-000000000001','venueId','b2000000-0000-4000-8000-000000000002','title','Meet the local kitchen','description','Visit our restaurant and meet the team.','category','explore','startsAt',now()-interval '1 minute','endsAt',now()+interval '1 day','capacity',1))$$,'owner can create a private campaign');
select lives_ok($$select public.food_go_adventure('{"action":"questSubmit","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000014"}')$$,'owner submits campaign for independent approval');
select throws_ok($$select public.food_go_adventure('{"action":"questReview","questId":"b4000000-0000-4000-8000-000000000001","decision":"approve","reason":"Checked campaign","requestId":"b3000000-0000-4000-8000-000000000015"}')$$,'42501',null,'owners cannot approve their own campaign');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_adventure('{"action":"questReview","questId":"b4000000-0000-4000-8000-000000000001","decision":"approve","reason":"Checked campaign","requestId":"b3000000-0000-4000-8000-000000000016"}')$$,'42501',null,'operator review requires MFA');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_operator_change(jsonb_build_object('action','promo.create','id','b6000000-0000-4000-8000-000000000003','requestId','b3000000-0000-4000-8000-000000000040','reason','Checked fixture offer','venueId','b2000000-0000-4000-8000-000000000002','title','Invalid category offer','description','A genuine fixture offer.','kind','unsupported','startsAt',now(),'endsAt',now()+interval '1 day'))$$,'22023',null,'operator RPC rejects unsupported deal categories atomically');
select lives_ok($$select public.food_go_operator_change(jsonb_build_object('action','promo.create','id','b6000000-0000-4000-8000-000000000003','requestId','b3000000-0000-4000-8000-000000000041','reason','Checked fixture food offer','venueId','b2000000-0000-4000-8000-000000000002','title','Operator lunch offer','description','A genuine fixture lunch offer.','kind','food','startsAt',now(),'endsAt',now()+interval '1 day'))$$,'operator can atomically create a Food Deal');
select is((select p->>'kind' from jsonb_array_elements(public.food_go_operator_queue('promotions')->'items') p where p->>'id'='b6000000-0000-4000-8000-000000000003'),'food','operator queue preserves the persisted kind for later editing');
reset role;
insert into public.organization_members(organization_id,user_id,role) values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','manager');
set local role authenticated;
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','questCreate','requestId','b3000000-0000-4000-8000-000000000042','id','b4500000-0000-4000-8000-000000000001','venueId','b2000000-0000-4000-8000-000000000002','title','Former manager campaign','description','A genuine campaign needing independent review.','category','explore','startsAt',now()-interval '1 minute','endsAt',now()+interval '1 day','capacity',2));select public.food_go_adventure('{"action":"questSubmit","questId":"b4500000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000043"}')$$,'an operator acting as manager can author a pending campaign');
reset role;
delete from public.organization_members where organization_id='b2000000-0000-4000-8000-000000000001' and user_id='b1000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.food_go_adventure('{"action":"questReview","questId":"b4500000-0000-4000-8000-000000000001","decision":"approve","reason":"I authored this campaign","requestId":"b3000000-0000-4000-8000-000000000044"}')$$,'42501',null,'creator cannot approve their own campaign after losing membership');
select lives_ok($$select public.food_go_adventure('{"action":"questReview","questId":"b4000000-0000-4000-8000-000000000001","decision":"approve","reason":"Checked independent campaign","requestId":"b3000000-0000-4000-8000-000000000017"}')$$,'independent operator can approve a valid campaign');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"acceptQuest","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000018"}')$$,'customer accepts approved quest');
select throws_ok($$select public.food_go_adventure('{"action":"completeQuest","questId":"b4000000-0000-4000-8000-000000000001","code":"00000000000000000000000000000000","requestId":"b3000000-0000-4000-8000-000000000019"}')$$,'FG404',null,'unverified completion cannot award');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000004","session_id":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_adventure('{"action":"acceptQuest","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000020"}')$$,'FG429',null,'campaign capacity is enforced across accounts');
select is(public.food_go_adventure()->'village','null'::jsonb,'another player cannot access this village');
reset role;
update private.adventure_quests set capacity=2 where id='b4000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"acceptQuest","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000045"}')$$,'another customer can accept when a second place is available');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('food_go.quest_fixture_code',public.food_go_adventure('{"action":"questIssue","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000021"}')->>'code',true);
select throws_ok($$select public.food_go_adventure('{"action":"acceptQuest","questId":"b4000000-0000-4000-8000-000000000001","requestId":"b3000000-0000-4000-8000-000000000022"}')$$,'42501',null,'owners cannot farm their own quest rewards');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000001','code',current_setting('food_go.quest_fixture_code'),'requestId','b3000000-0000-4000-8000-000000000023'))$$,'genuine venue confirmation completes the quest');
select is((public.food_go_game_profile()->>'xp')::integer,50,'canonical profile includes fixed server quest XP');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000001','code',current_setting('food_go.quest_fixture_code'),'requestId','b3000000-0000-4000-8000-000000000024'))$$,'completion with a fresh retry key remains safe');
select is((public.food_go_game_profile()->>'xp')::integer,50,'quest award is issued exactly once');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000004","session_id":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000001','code',current_setting('food_go.quest_fixture_code'),'requestId','b3000000-0000-4000-8000-000000000046'))$$,'FG404',null,'a second accepted account cannot redeem a consumed staff code');
select is((public.food_go_game_profile()->>'xp')::integer,0,'cross-account code replay creates no XP');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"claimDaily","requestId":"b3000000-0000-4000-8000-000000000025"}')$$,'verified activity earns a daily supplies claim');
select throws_ok($$select public.food_go_adventure('{"action":"claimDaily","requestId":"b3000000-0000-4000-8000-000000000026"}')$$,'FG409',null,'new request keys cannot duplicate daily rewards');
reset role;
-- Independently reviewed campaign fixtures exercise category evidence and daily caps.
insert into private.adventure_quests(id,venue_id,creator,category,title,description,starts_at,ends_at,capacity,status)
 select ('b4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',
 case when n=2 then 'feedback' when n in (3,7) then 'community' else 'explore' end,'Independent campaign '||n,'A genuine experience campaign fixture.',now()-interval '1 day',now()+interval '1 day',100,'published'
 from generate_series(2,7) n;
insert into private.adventure_codes(quest_id,issuer,token_hash,expires_at)
 select id,'b1000000-0000-4000-8000-000000000001',md5(md5(id::text)),now()+interval '10 minutes' from private.adventure_quests where id::text like 'b4000000-%' and id<>'b4000000-0000-4000-8000-000000000001';
insert into private.adventure_participations(quest_id,user_id,accepted_at)
 select id,'b1000000-0000-4000-8000-000000000002',now()-interval '10 minutes' from private.adventure_quests where id::text like 'b4000000-%' and id<>'b4000000-0000-4000-8000-000000000001';
insert into private.community_posts(id,author_id,body,visibility,moderation_status)
 select 'b5000000-0000-4000-8000-000000000001',id,'An original first-hand food experience.','public','published' from private.community_authors where user_id='b1000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000002','code',md5('b4000000-0000-4000-8000-000000000002'),'requestId','b3000000-0000-4000-8000-000000000030'))$$,'22023',null,'feedback quest requires actual private feedback');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000002','code',md5('b4000000-0000-4000-8000-000000000002'),'feedback','Service was slow and the meal arrived cold.','requestId','b3000000-0000-4000-8000-000000000031'))$$,'honest critical feedback qualifies without any positivity test');
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000003','code',md5('b4000000-0000-4000-8000-000000000003'),'requestId','b3000000-0000-4000-8000-000000000032'))$$,'FG404',null,'community reward requires an original approved post');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000003','code',md5('b4000000-0000-4000-8000-000000000003'),'postId','b5000000-0000-4000-8000-000000000001','requestId','b3000000-0000-4000-8000-000000000033'))$$,'approved original post plus staff evidence qualifies');
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000007','code',md5('b4000000-0000-4000-8000-000000000007'),'postId','b5000000-0000-4000-8000-000000000001','requestId','b3000000-0000-4000-8000-000000000034'))$$,'23505',null,'one original post cannot mint rewards across campaigns');
select is((public.food_go_game_profile()->>'xp')::integer,225,'duplicate evidence rolls its attempted award back');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000004','code',md5('b4000000-0000-4000-8000-000000000004'),'requestId','b3000000-0000-4000-8000-000000000035'))$$,'fourth genuine completion remains within the cap');
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000005','code',md5('b4000000-0000-4000-8000-000000000005'),'requestId','b3000000-0000-4000-8000-000000000036'))$$,'the fifth completion can reach exactly 300 quest XP');
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','completeQuest','questId','b4000000-0000-4000-8000-000000000006','code',md5('b4000000-0000-4000-8000-000000000006'),'requestId','b3000000-0000-4000-8000-000000000037'))$$,'FG429',null,'awards cannot exceed the 300 XP daily quest cap');
select is((public.food_go_game_profile()->>'xp')::integer,325,'denied awards never partially mutate XP');
select throws_ok('select * from private.adventure_participations','42501',null,'private customer feedback and evidence cannot be read directly');
select ok((select bool_and(jsonb_array_length(item->'privateFeedback')=0) from jsonb_array_elements(public.food_go_adventure()->'quests') item),'customer quest results do not reveal other feedback');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select item->'privateFeedback'->>0 from jsonb_array_elements(public.food_go_adventure()->'quests') item where item->>'id'='b4000000-0000-4000-8000-000000000002'),'Service was slow and the meal arrived cold.','restaurant manager can read genuine private feedback');
reset role;
-- A shared venue quota includes all managers' campaigns, not just this caller's.
insert into auth.users(id,email,email_confirmed_at) values('b1000000-0000-4000-8000-000000000005','manager@adventure.example.invalid',now());
insert into auth.sessions(id,user_id) values('b1000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000005');
insert into public.organization_members(organization_id,user_id,role) values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000005','manager');
insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at)
 values('b2000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','quota-fixture','Quota fixture restaurant','restaurant','Italian','2 Fixture Street','Melbourne','VIC','3000','published',now());
insert into private.adventure_quests(id,venue_id,creator,category,title,description,starts_at,ends_at,capacity)
 select ('b7100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','explore',
 'Shared quota fixture '||n,'A genuine fixture campaign.',now(),now()+interval '1 day',10 from generate_series(1,9) n;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000005","session_id":"b1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_adventure(jsonb_build_object('action','questCreate','requestId','b3000000-0000-4000-8000-000000000047','id','b7100000-0000-4000-8000-000000000010','venueId','b2000000-0000-4000-8000-000000000003','title','Tenth venue campaign','description','A genuine shared venue campaign.','category','explore','startsAt',now(),'endsAt',now()+interval '1 day','capacity',2))$$,'a second manager can create the tenth venue campaign');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.food_go_adventure(jsonb_build_object('action','questCreate','requestId','b3000000-0000-4000-8000-000000000048','id','b7100000-0000-4000-8000-000000000011','venueId','b2000000-0000-4000-8000-000000000003','title','Eleventh venue campaign','description','A genuine shared venue campaign.','category','explore','startsAt',now(),'endsAt',now()+interval '1 day','capacity',2))$$,'FG429',null,'switching managers cannot bypass the venue-wide daily cap');
reset role;
select is((select count(*) from private.adventure_quests where venue_id='b2000000-0000-4000-8000-000000000003'),10::bigint,'shared quota keeps exactly ten campaigns');
insert into private.adventure_quests(id,venue_id,creator,category,title,description,starts_at,ends_at,capacity,status)
 select ('b7200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','explore',
 'Old quest fixture '||n,'A genuine fixture campaign.',now()-interval '1 day',now()+interval '1 day',100,case when n=21 then 'published' else 'withdrawn' end from generate_series(1,21) n;
insert into private.adventure_participations(quest_id,user_id)
 select id,'b1000000-0000-4000-8000-000000000004' from private.adventure_quests where id::text like 'b7200000-%' and status='withdrawn';
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000004","session_id":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.food_go_adventure('{"action":"acceptQuest","questId":"b7200000-0000-4000-8000-000000000021","requestId":"b3000000-0000-4000-8000-000000000049"}')$$,'twenty withdrawn quests do not trap the player active-quest slots');
reset role;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.reward_events(user_id,points,source_type,source_id)
 select 'b1000000-0000-4000-8000-000000000002',10000,'quest_completion',gen_random_uuid() from generate_series(1,25);
set local role authenticated;
select is((public.food_go_game_profile()->>'level')::integer,100,'large XP cannot bypass diverse achievement gates');
select ok((public.food_go_game_profile()->>'xpLevel')::integer>100,'profile explains XP eligibility separately from milestone gates');
reset role;
update auth.users set banned_until=now()+interval '1 day' where id='b1000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok('select public.food_go_game_profile()','42501',null,'banned account cannot read canonical earned progression');
reset role;
update auth.users set banned_until=null where id='b1000000-0000-4000-8000-000000000002';
delete from auth.sessions where id='b1000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok('select public.food_go_adventure()','42501',null,'revoked session loses adventure access');
select throws_ok('select public.food_go_game_profile()','42501',null,'revoked session loses canonical progress access');
reset role;
select * from finish();
rollback;

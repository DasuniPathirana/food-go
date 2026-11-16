begin;

-- Exactly two marketplace categories; existing offers remain Restaurant Deals.
alter table public.promotions add column kind text not null default 'restaurant' check(kind in ('food','restaurant'));
grant select(kind) on public.promotions to anon,authenticated;

-- All game balances, dates and eligibility are owned by checked database functions.
create table private.adventure_quests (
  id uuid primary key,
  venue_id uuid not null references public.venues(id) on delete restrict,
  creator uuid references auth.users(id) on delete set null,
  category text not null check(category in ('explore','try','feedback','community','promo')),
  title text not null check(char_length(btrim(title)) between 3 and 90),
  description text not null check(char_length(btrim(description)) between 10 and 1000),
  starts_at timestamptz not null, ends_at timestamptz not null,
  capacity integer not null check(capacity between 1 and 500),
  dish_id uuid references public.venue_dishes(id) on delete restrict,
  promotion_id uuid references public.promotions(id) on delete restrict,
  discount_percent integer check(discount_percent between 1 and 50),
  status text not null default 'draft' check(status in ('draft','pending','published','rejected','withdrawn')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at),
  check(category<>'try' or dish_id is not null),
  check(category<>'promo' or (promotion_id is not null and discount_percent is not null))
);
create index adventure_quests_venue_idx on private.adventure_quests(venue_id,created_at desc);
create index adventure_quests_board_idx on private.adventure_quests(status,ends_at);
create table private.adventure_participations (
  quest_id uuid not null references private.adventure_quests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
  awarded_xp integer not null default 0 check(awarded_xp between 0 and 100),
  feedback text check(char_length(feedback) between 10 and 1000),
  post_id uuid references private.community_posts(id) on delete set null,
  primary key(quest_id,user_id)
);
create index adventure_participations_user_idx on private.adventure_participations(user_id,completed_at);
create table private.adventure_codes (
  id uuid primary key default gen_random_uuid(), quest_id uuid not null references private.adventure_quests(id) on delete cascade,
  issuer uuid not null references auth.users(id) on delete cascade, token_hash text not null unique,
  redeemed_at timestamptz, redeemed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp()
);
create index adventure_codes_quest_idx on private.adventure_codes(quest_id,created_at desc);
create table private.adventure_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references private.adventure_quests(id) on delete restrict,
  points integer not null check(points between 1 and 100), created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,quest_id)
);
create index adventure_rewards_user_day_idx on private.adventure_rewards(user_id,created_at);
create table private.outback_villages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  region text not null check(region in ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT')),
  wood integer not null default 100 check(wood between 0 and 1000000),
  stone integer not null default 70 check(stone between 0 and 1000000),
  water integer not null default 60 check(water between 0 and 1000000),
  seeds integer not null default 12 check(seeds between 0 and 1000000),
  coins integer not null default 80 check(coins between 0 and 1000000),
  last_daily_claim date, created_at timestamptz not null default clock_timestamp()
);
create table private.outback_plots (
  user_id uuid not null references private.outback_villages(user_id) on delete cascade,
  cell integer not null check(cell between 0 and 15),
  kind text not null default 'wild' check(kind in ('wild','cleared','farmhouse','garden','shed','tank','bakery')),
  level integer not null default 0 check(level between 0 and 3),
  status text not null default 'ready' check(status in ('ready','building','growing')),
  ready_at timestamptz, crop text check(crop in ('carrot','wheat','tomato')),
  primary key(user_id,cell)
);
create table private.outback_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check(action in ('build','upgrade','harvest','daily')), cell integer,
  created_at timestamptz not null default clock_timestamp()
);
create index outback_events_user_idx on private.outback_events(user_id,action,created_at);
create table private.adventure_requests (
  user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
  request_hash text not null, result jsonb not null, created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_id)
);
alter table private.adventure_quests enable row level security;
alter table private.adventure_participations enable row level security;
alter table private.adventure_codes enable row level security;
alter table private.adventure_rewards enable row level security;
alter table private.outback_villages enable row level security;
alter table private.outback_plots enable row level security;
alter table private.outback_events enable row level security;
alter table private.adventure_requests enable row level security;
revoke all on private.adventure_quests,private.adventure_participations,private.adventure_codes,private.adventure_rewards,
  private.outback_villages,private.outback_plots,private.outback_events,private.adventure_requests from public,anon,authenticated;

create function private.adventure_level_xp(p_level integer) returns bigint
language plpgsql immutable set search_path='' as $$
declare total bigint:=0; n integer;
begin
  if p_level is null or p_level not between 1 and 250 then raise exception using errcode='22023',message='Invalid level'; end if;
  for n in 2..p_level loop
    total:=total+case when n<=50 then 250+(n-2)*20 when n<=100 then 1500+(n-51)*70
      else 8000+(n-101)*350+(n-101)*(n-101)*15 end;
  end loop;
  return total;
end;
$$;
create function private.adventure_level_requirements(p_level integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n integer:=p_level-101;
begin
  if p_level is null or p_level not between 1 and 250 then raise exception using errcode='22023',message='Invalid level'; end if;
  if p_level<=100 then return '{"visits":0,"cuisines":0,"quests":0,"questCategories":0,"posts":0,"harvests":0,"buildings":0}'::jsonb; end if;
  return jsonb_build_object('visits',5+n/25*5,'cuisines',3+n/50,'quests',3+n/10,
    'questCategories',least(5,2+n/50),'posts',1+n/50,'harvests',1+n/25,'buildings',least(6,1+n/50));
end;
$$;
revoke all on function private.adventure_level_xp(integer),private.adventure_level_requirements(integer) from public,anon,authenticated;

create function private.adventure_profile() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); social jsonb; total bigint; achievements jsonb; requirements jsonb;
  level_value integer:=1; xp_level integer:=1; candidate integer;
begin
  social:=public.food_go_social_game_profile();
  select (social->>'xp')::bigint+coalesce((select sum(points) from public.reward_events where user_id=actor),0)
    +coalesce((select sum(points) from private.adventure_rewards where user_id=actor),0) into total;
  select jsonb_build_object(
    'visits',(select count(distinct venue_id) from public.check_ins where user_id=actor),
    'cuisines',(select count(distinct v.cuisine) from public.check_ins c join public.venues v on v.id=c.venue_id where c.user_id=actor),
    'quests',(select count(*) from private.adventure_rewards where user_id=actor),
    'questCategories',(select count(distinct q.category) from private.adventure_rewards r join private.adventure_quests q on q.id=r.quest_id where r.user_id=actor),
    'posts',(select count(*) from private.community_posts p join private.community_authors a on a.id=p.author_id where a.user_id=actor and p.visibility='public' and p.moderation_status='published' and p.deleted_at is null),
    'harvests',(select count(*) from private.outback_events where user_id=actor and action='harvest'),
    'buildings',(select count(*) from private.outback_plots where user_id=actor and kind not in ('wild','cleared','garden') and status='ready')
  ) into achievements;
  for candidate in 2..250 loop
    exit when total<private.adventure_level_xp(candidate);
    xp_level:=candidate; requirements:=private.adventure_level_requirements(candidate);
    if not exists(select 1 from jsonb_each_text(requirements) r where (achievements->>r.key)::bigint<r.value::bigint) then level_value:=candidate; end if;
  end loop;
  return social || jsonb_build_object('xp',total,'level',level_value,'xpLevel',xp_level,
    'nextLevelXp',private.adventure_level_xp(least(250,level_value+1)),
    'tier',case when level_value=250 then 'legendary' when level_value>200 then 'golden' when level_value>150 then 'mighty' when level_value>100 then 'advanced' when level_value>50 then 'community' else 'foundation' end,
    'achievements',achievements,'nextRequirements',private.adventure_level_requirements(least(250,level_value+1)));
end;
$$;
revoke all on function private.adventure_profile() from public,anon,authenticated;
create or replace function public.food_go_game_profile() returns jsonb
language sql security invoker set search_path='' as $$select private.adventure_profile();$$;
revoke all on function public.food_go_game_profile() from public,anon,authenticated;
grant execute on function private.adventure_profile(),public.food_go_game_profile() to authenticated;

create function private.adventure_daily_eligible(actor uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from private.adventure_rewards where user_id=actor and (created_at at time zone 'Australia/Sydney')::date=(now() at time zone 'Australia/Sydney')::date)
    or exists(select 1 from public.check_ins where user_id=actor and (verified_at at time zone 'Australia/Sydney')::date=(now() at time zone 'Australia/Sydney')::date)
    or exists(select 1 from private.community_authors a cross join lateral private.community_active_xp(a.id) x
      where a.user_id=actor and x.kind in ('post','comment') and (x.awarded_at at time zone 'Australia/Sydney')::date=(now() at time zone 'Australia/Sydney')::date);
$$;
revoke all on function private.adventure_daily_eligible(uuid) from public,anon,authenticated;

create function private.adventure_state() returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); is_operator boolean:=private.food_go_operator_access()='ready'; village jsonb; quests jsonb; venues jsonb; dishes jsonb; promotions jsonb;
begin
  select jsonb_build_object('region',v.region,'createdAt',v.created_at,'resources',jsonb_build_object('wood',v.wood,'stone',v.stone,'water',v.water,'seeds',v.seeds,'coins',v.coins),
    'dailyClaimed',coalesce(v.last_daily_claim=(now() at time zone 'Australia/Sydney')::date,false),'dailyEligible',private.adventure_daily_eligible(actor),
    'plots',(select jsonb_agg(jsonb_build_object('cell',p.cell,'kind',p.kind,'level',p.level,'status',p.status,'readyAt',p.ready_at,'crop',p.crop) order by p.cell) from private.outback_plots p where p.user_id=actor))
    into village from private.outback_villages v where v.user_id=actor;
  select coalesce(jsonb_agg(row order by at_time,id),'[]'::jsonb) into quests from (
    select q.id,q.ends_at at_time,jsonb_build_object('id',q.id,'venueId',v.id,'venueName',v.name,'venueSlug',v.slug,
      'title',q.title,'description',q.description,'category',q.category,'rewardXp',case q.category when 'try' then 100 when 'feedback' then 75 when 'community' then 75 else 50 end,
      'capacity',q.capacity,'acceptedCount',(select count(*) from private.adventure_participations where quest_id=q.id),
      'startsAt',q.starts_at,'endsAt',q.ends_at,'status',q.status,'discountPercent',q.discount_percent,'dishId',q.dish_id,'promotionId',q.promotion_id,
      'privateFeedback',case when is_operator or exists(select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager'))
        then coalesce((select jsonb_agg(f.feedback order by f.completed_at desc) from (select ap.feedback,ap.completed_at from private.adventure_participations ap
          where ap.quest_id=q.id and ap.feedback is not null order by ap.completed_at desc limit 20) f),'[]'::jsonb) else '[]'::jsonb end,
      'managed',exists(select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager')),
      'participation',case when p.user_id is null then null else jsonb_build_object('acceptedAt',p.accepted_at,'completedAt',p.completed_at,'awardedXp',p.awarded_xp) end) row
    from private.adventure_quests q join public.venues v on v.id=q.venue_id
    left join private.adventure_participations p on p.quest_id=q.id and p.user_id=actor
    where is_operator or p.user_id is not null or exists(select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager'))
      or (q.status='published' and q.starts_at<=now() and q.ends_at>now() and v.status='published' and v.ownership_verified_at is not null)
    order by (q.status='published' and q.ends_at>now()) desc,q.ends_at desc,q.id limit 200
  ) visible;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]'::jsonb) into venues from (
    select v.id,v.name from public.venues v where v.status='published' and v.ownership_verified_at is not null and exists(
      select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager')) order by v.name,v.id limit 100
  ) managed;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'venueId',venue_id,'name',name)),'[]'::jsonb) into dishes from (
    select d.id,d.venue_id,d.name from public.venue_dishes d join public.venues v on v.id=d.venue_id where d.is_available and exists(
      select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager')) order by d.name,d.id limit 100
  ) owned_dishes;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'venueId',venue_id,'title',title,'startsAt',starts_at,'endsAt',ends_at)),'[]'::jsonb) into promotions from (
    select p.* from public.promotions p join public.venues v on v.id=p.venue_id where p.status='published' and p.ends_at>now() and exists(
      select 1 from public.organization_members m where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager')) order by p.ends_at,p.id limit 100
  ) owned_promotions;
  return jsonb_build_object('serverNow',clock_timestamp(),'profile',private.adventure_profile(),'quests',quests,'partnerVenues',venues,
    'partnerDishes',dishes,'partnerPromotions',promotions,'operator',is_operator,'village',village);
end;
$$;
revoke all on function private.adventure_state() from public,anon,authenticated;

-- A public community post can support at most one rewarded Community quest.
create unique index adventure_original_post_idx on private.adventure_participations(user_id,post_id) where post_id is not null;
create function private.adventure_action(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); operation text:=p_action->>'action'; request_id_value uuid;
  action_hash text:=md5(p_action::text); previous private.adventure_requests%rowtype; response jsonb:='{}'::jsonb;
  allowed text[]; q private.adventure_quests%rowtype; v public.venues%rowtype; participation private.adventure_participations%rowtype;
  proof private.adventure_codes%rowtype; village private.outback_villages%rowtype; plot private.outback_plots%rowtype;
  target uuid; cell_value integer; reward integer; token text; expiry timestamptz;
  wood_cost integer:=0; stone_cost integer:=0; coin_cost integer:=0; water_cost integer:=0; seconds_value integer:=0;
  structure text; crop_value text; region_value text; post_value uuid;
begin
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>4096 then
    raise exception using errcode='22023',message='Invalid adventure action'; end if;
  if operation='read' then
    if exists(select 1 from jsonb_object_keys(p_action) k where k<>'action') then raise exception using errcode='22023',message='Invalid read'; end if;
    return private.adventure_state();
  end if;
  allowed:=case operation
    when 'chooseDestination' then array['region'] when 'claimDaily' then array[]::text[]
    when 'clear' then array['cell'] when 'upgrade' then array['cell'] when 'finish' then array['cell'] when 'harvest' then array['cell']
    when 'build' then array['cell','structure'] when 'plant' then array['cell','crop']
    when 'questCreate' then array['id','venueId','title','description','category','startsAt','endsAt','capacity','dishId','promotionId','discountPercent']
    when 'questSubmit' then array['questId'] when 'questIssue' then array['questId'] when 'acceptQuest' then array['questId']
    when 'completeQuest' then array['questId','code','feedback','postId'] when 'questReview' then array['questId','decision','reason'] else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where k<>all(allowed||array['action','requestId'])) then
    raise exception using errcode='22023',message='Invalid adventure fields'; end if;
  request_id_value:=(p_action->>'requestId')::uuid;
  if request_id_value is null then raise exception using errcode='22023',message='A retry identifier is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,16060148));
  select * into previous from private.adventure_requests where user_id=actor and request_id=request_id_value;
  if found then
    if previous.request_hash<>action_hash then raise exception using errcode='FG409',message='Changed retry'; end if;
    return previous.result || jsonb_build_object('state',private.adventure_state());
  end if;

  if operation='questCreate' then
    -- The venue row serialises the shared quota across every owner and manager.
    select * into v from public.venues where id=(p_action->>'venueId')::uuid and status='published' and ownership_verified_at is not null for update;
    if not found or not exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor and role in ('owner','manager')) then
      raise exception using errcode='42501',message='A verified restaurant manager is required'; end if;
    if jsonb_typeof(p_action->'title') is distinct from 'string' or jsonb_typeof(p_action->'description') is distinct from 'string'
      or jsonb_typeof(p_action->'category') is distinct from 'string'
      or not private.partner_text_valid(p_action->>'title',3,90) or not private.partner_text_valid(p_action->>'description',10,1000)
      or jsonb_typeof(p_action->'capacity') is distinct from 'number' then raise exception using errcode='22023',message='Invalid quest'; end if;
    if (select count(*) from private.adventure_quests where venue_id=v.id and created_at>now()-interval '1 day')>=10 then
      raise exception using errcode='FG429',message='Daily campaign limit reached'; end if;
    if (p_action->>'endsAt')::timestamptz<=now() or (p_action->>'endsAt')::timestamptz>(p_action->>'startsAt')::timestamptz+interval '30 days'
      or (p_action->>'startsAt')::timestamptz>now()+interval '60 days' then raise exception using errcode='22023',message='Invalid campaign schedule'; end if;
    if p_action->>'dishId' is not null and not exists(select 1 from public.venue_dishes where id=(p_action->>'dishId')::uuid and venue_id=v.id and is_available) then
      raise exception using errcode='FG404',message='Dish unavailable'; end if;
    if p_action->>'promotionId' is not null and not exists(select 1 from public.promotions where id=(p_action->>'promotionId')::uuid and venue_id=v.id
      and status='published' and starts_at<=(p_action->>'startsAt')::timestamptz and ends_at>=(p_action->>'endsAt')::timestamptz) then
      raise exception using errcode='FG404',message='Published offer must cover the campaign'; end if;
    insert into private.adventure_quests(id,venue_id,creator,category,title,description,starts_at,ends_at,capacity,dish_id,promotion_id,discount_percent)
    values((p_action->>'id')::uuid,v.id,actor,p_action->>'category',btrim(p_action->>'title'),btrim(p_action->>'description'),
      (p_action->>'startsAt')::timestamptz,(p_action->>'endsAt')::timestamptz,(p_action->>'capacity')::integer,
      (p_action->>'dishId')::uuid,(p_action->>'promotionId')::uuid,(p_action->>'discountPercent')::integer);
  elsif operation in ('questSubmit','questIssue','questReview','acceptQuest','completeQuest') then
    target:=(p_action->>'questId')::uuid;
    select * into q from private.adventure_quests where id=target for update;
    if not found then raise exception using errcode='FG404',message='Quest unavailable'; end if;
    select * into v from public.venues where id=q.venue_id for share;
    if operation in ('questSubmit','questIssue') then
      if not exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor and role in ('owner','manager')) then
        raise exception using errcode='42501',message='Restaurant manager required'; end if;
      if v.status<>'published' or v.ownership_verified_at is null then raise exception using errcode='FG409',message='Published restaurant required'; end if;
      if operation='questSubmit' then
        if q.status not in ('draft','rejected') or q.ends_at<=now() then raise exception using errcode='FG409',message='Quest cannot be submitted'; end if;
        update private.adventure_quests set status='pending',updated_at=clock_timestamp() where id=q.id;
      else
        if q.status<>'published' or q.starts_at>now() or q.ends_at<=now() then raise exception using errcode='FG409',message='Active approved quest required'; end if;
        if (select count(*) from private.adventure_codes where quest_id=q.id and created_at>now()-interval '1 hour')>=60 then
          raise exception using errcode='FG429',message='Code issue limit reached'; end if;
        token:=replace(gen_random_uuid()::text,'-',''); expiry:=least(clock_timestamp()+interval '10 minutes',q.ends_at);
        update private.adventure_codes set expires_at=now() where quest_id=q.id and expires_at>now();
        insert into private.adventure_codes(quest_id,issuer,token_hash,expires_at) values(q.id,actor,md5(token),expiry);
        response:=jsonb_build_object('code',token,'expiresAt',expiry);
      end if;
    elsif operation='questReview' then
      if private.food_go_operator_access()<>'ready' or q.creator=actor
        or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
        raise exception using errcode='42501',message='Independent operator session required'; end if;
      if not private.partner_text_valid(p_action->>'reason',3,240) or jsonb_typeof(p_action->'decision') is distinct from 'string'
        or p_action->>'decision' not in ('approve','reject','withdraw') then
        raise exception using errcode='22023',message='Invalid quest decision'; end if;
      if p_action->>'decision' in ('approve','reject') and q.status<>'pending' then raise exception using errcode='FG409',message='Quest changed'; end if;
      if p_action->>'decision'='approve' and (q.ends_at<=now() or v.status<>'published' or v.ownership_verified_at is null) then
        raise exception using errcode='FG409',message='Published verified restaurant and current dates required'; end if;
      update private.adventure_quests set status=case p_action->>'decision' when 'approve' then 'published' when 'reject' then 'rejected' else 'withdrawn' end,
        updated_at=clock_timestamp() where id=q.id;
      insert into private.operator_audit(request_id,actor,action,target,reason,request_hash)
        values(request_id_value,actor,'quest.'||(p_action->>'decision'),q.id,btrim(p_action->>'reason'),action_hash);
    else
      if q.status<>'published' or q.starts_at>now() or q.ends_at<=now() or v.status<>'published' or v.ownership_verified_at is null then
        raise exception using errcode='FG404',message='Active quest unavailable'; end if;
      if exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
        raise exception using errcode='42501',message='Customers cannot complete their own restaurant campaigns'; end if;
      select * into participation from private.adventure_participations where quest_id=q.id and user_id=actor for update;
      if operation='acceptQuest' then
        if participation.user_id is null then
          if (select count(*) from private.adventure_participations where quest_id=q.id)>=q.capacity then raise exception using errcode='FG429',message='Quest is full'; end if;
          if (select count(*) from private.adventure_participations p join private.adventure_quests aq on aq.id=p.quest_id
            join public.venues av on av.id=aq.venue_id where p.user_id=actor and p.completed_at is null
            and aq.status='published' and aq.starts_at<=now() and aq.ends_at>now()
            and av.status='published' and av.ownership_verified_at is not null)>=20 then raise exception using errcode='FG429',message='Active quest limit reached'; end if;
          insert into private.adventure_participations(quest_id,user_id) values(q.id,actor);
        end if;
      else
        if participation.user_id is null then raise exception using errcode='FG409',message='Start the quest first'; end if;
        if participation.completed_at is null then
          if not coalesce(p_action->>'code' ~ '^[a-f0-9]{32}$',false) then raise exception using errcode='22023',message='Enter the venue confirmation code'; end if;
          select * into proof from private.adventure_codes where quest_id=q.id and token_hash=md5(p_action->>'code')
            and expires_at>now() and redeemed_at is null for update;
          if not found or not exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=proof.issuer and role in ('owner','manager')) then
            raise exception using errcode='FG404',message='Code expired or unavailable'; end if;
          if q.category='feedback' and (jsonb_typeof(p_action->'feedback') is distinct from 'string' or not private.partner_text_valid(p_action->>'feedback',10,1000)) then
            raise exception using errcode='22023',message='Provide honest private feedback'; end if;
          if q.category='community' then
            post_value:=(p_action->>'postId')::uuid;
            if not exists(select 1 from private.community_posts cp join private.community_authors a on a.id=cp.author_id
              where cp.id=post_value and a.user_id=actor and cp.visibility='public' and cp.moderation_status='published' and cp.deleted_at is null and cp.created_at>=participation.accepted_at) then
              raise exception using errcode='FG404',message='An original approved story created after starting is required'; end if;
          end if;
          if q.category='try' and not exists(select 1 from public.venue_dishes where id=q.dish_id and venue_id=v.id and is_available) then
            raise exception using errcode='FG404',message='Quest dish unavailable'; end if;
          if q.category='promo' and not exists(select 1 from public.promotions where id=q.promotion_id and venue_id=v.id and status='published' and starts_at<=now() and ends_at>now()) then
            raise exception using errcode='FG404',message='Quest offer unavailable'; end if;
          reward:=case q.category when 'try' then 100 when 'feedback' then 75 when 'community' then 75 else 50 end;
          if (select coalesce(sum(points),0) from private.adventure_rewards where user_id=actor and
            (created_at at time zone 'Australia/Sydney')::date=(now() at time zone 'Australia/Sydney')::date)+reward>300
            or (select count(*) from private.adventure_rewards where user_id=actor and
            (created_at at time zone 'Australia/Sydney')::date=(now() at time zone 'Australia/Sydney')::date)>=5 then
            raise exception using errcode='FG429',message='Daily quest reward limit reached'; end if;
          update private.adventure_codes set redeemed_at=clock_timestamp(),redeemed_by=actor where id=proof.id and redeemed_at is null;
          if not found then raise exception using errcode='FG404',message='Code already collected'; end if;
          insert into private.adventure_rewards(user_id,quest_id,points) values(actor,q.id,reward);
          update private.adventure_participations set completed_at=clock_timestamp(),awarded_xp=reward,
            feedback=case when q.category='feedback' then btrim(p_action->>'feedback') else null end,post_id=post_value
            where quest_id=q.id and user_id=actor;
        end if;
      end if;
    end if;
  elsif operation='chooseDestination' then
    region_value:=p_action->>'region';
    if region_value is null or region_value not in ('NSW','VIC','QLD','SA','WA','TAS','NT','ACT') then raise exception using errcode='22023',message='Choose an Australian region'; end if;
    select * into village from private.outback_villages where user_id=actor for update;
    if found then
      if village.region<>region_value then raise exception using errcode='FG409',message='Your home destination is permanent'; end if;
    else
      insert into private.outback_villages(user_id,region) values(actor,region_value);
      insert into private.outback_plots(user_id,cell,kind,level)
        select actor,n,case n when 5 then 'farmhouse' when 6 then 'garden' else 'wild' end,case when n in (5,6) then 1 else 0 end from generate_series(0,15) n;
    end if;
  else
    select * into village from private.outback_villages where user_id=actor for update;
    if not found then raise exception using errcode='FG409',message='Choose your home destination first'; end if;
    if operation='claimDaily' then
      if village.last_daily_claim=(now() at time zone 'Australia/Sydney')::date then raise exception using errcode='FG409',message='Daily supplies already claimed'; end if;
      if not private.adventure_daily_eligible(actor) then raise exception using errcode='FG409',message='Complete a verified food activity or approved contribution today'; end if;
      update private.outback_villages set wood=least(1000000,wood+20),stone=least(1000000,stone+10),water=least(1000000,water+15),
        seeds=least(1000000,seeds+5),coins=least(1000000,coins+15),last_daily_claim=(now() at time zone 'Australia/Sydney')::date where user_id=actor;
      insert into private.outback_events(user_id,action) values(actor,'daily');
    else
      if jsonb_typeof(p_action->'cell') is distinct from 'number' or p_action->>'cell' !~ '^([0-9]|1[0-5])$' then
        raise exception using errcode='22023',message='Choose a valid land plot'; end if;
      cell_value:=(p_action->>'cell')::integer;
      select * into plot from private.outback_plots where user_id=actor and cell=cell_value for update;
      if not found then raise exception using errcode='FG404',message='Plot unavailable'; end if;
      if operation='finish' then
        if plot.status<>'building' or plot.ready_at>clock_timestamp() then raise exception using errcode='FG409',message='Construction is not ready'; end if;
        update private.outback_plots set status='ready',ready_at=null where user_id=actor and cell=cell_value;
        insert into private.outback_events(user_id,action,cell) values(actor,'build',cell_value);
      elsif operation='harvest' then
        if plot.status<>'growing' or plot.ready_at>clock_timestamp() then raise exception using errcode='FG409',message='Crop is not ready'; end if;
        reward:=(case plot.crop when 'carrot' then 12 when 'wheat' then 10 when 'tomato' then 18 else 0 end)*plot.level;
        update private.outback_villages set coins=least(1000000,coins+reward),seeds=least(1000000,seeds+2) where user_id=actor;
        update private.outback_plots set status='ready',crop=null,ready_at=null where user_id=actor and cell=cell_value;
        insert into private.outback_events(user_id,action,cell) values(actor,'harvest',cell_value);
      else
        if plot.status<>'ready' then raise exception using errcode='FG409',message='Finish the current activity first'; end if;
        if operation='clear' then
          if plot.kind<>'wild' then raise exception using errcode='FG409',message='Plot already prepared'; end if;
          wood_cost:=10; coin_cost:=10;
          update private.outback_plots set kind='cleared' where user_id=actor and cell=cell_value;
        elsif operation='build' then
          structure:=p_action->>'structure';
          if plot.kind<>'cleared' or structure is null or structure not in ('garden','shed','tank','bakery') then raise exception using errcode='FG409',message='Prepare an empty plot before building'; end if;
          wood_cost:=case structure when 'garden' then 15 when 'shed' then 30 when 'tank' then 25 else 70 end;
          stone_cost:=case structure when 'garden' then 5 when 'shed' then 20 when 'tank' then 20 else 50 end;
          coin_cost:=case structure when 'garden' then 10 when 'shed' then 20 when 'tank' then 15 else 80 end;
          seconds_value:=case structure when 'garden' then 30 when 'shed' then 45 when 'tank' then 60 else 120 end;
          update private.outback_plots set kind=structure,level=1,status='building',ready_at=clock_timestamp()+seconds_value*interval '1 second' where user_id=actor and cell=cell_value;
        elsif operation='upgrade' then
          if plot.kind in ('wild','cleared') or plot.level>=3 then raise exception using errcode='FG409',message='Structure cannot be upgraded'; end if;
          wood_cost:=20*plot.level; stone_cost:=15*plot.level; coin_cost:=20*plot.level;
          update private.outback_plots set level=level+1,status='building',ready_at=clock_timestamp()+60*plot.level*interval '1 second' where user_id=actor and cell=cell_value;
        elsif operation='plant' then
          crop_value:=p_action->>'crop';
          if plot.kind<>'garden' or crop_value is null or crop_value not in ('carrot','wheat','tomato') then raise exception using errcode='FG409',message='Choose a crop for an empty garden'; end if;
          water_cost:=case crop_value when 'carrot' then 4 when 'wheat' then 3 else 5 end;
          seconds_value:=case crop_value when 'carrot' then 45 when 'wheat' then 60 else 90 end;
          if village.seeds<1 then raise exception using errcode='FG409',message='More seeds required'; end if;
          update private.outback_villages set seeds=seeds-1 where user_id=actor;
          update private.outback_plots set crop=crop_value,status='growing',ready_at=clock_timestamp()+seconds_value*interval '1 second' where user_id=actor and cell=cell_value;
        end if;
        update private.outback_villages set wood=wood-wood_cost,stone=stone-stone_cost,coins=coins-coin_cost,water=water-water_cost
          where user_id=actor and wood>=wood_cost and stone>=stone_cost and coins>=coin_cost and water>=water_cost;
        if not found then raise exception using errcode='FG409',message='More earned supplies are required'; end if;
      end if;
    end if;
  end if;
  insert into private.adventure_requests(user_id,request_id,request_hash,result) values(actor,request_id_value,action_hash,response);
  return response || jsonb_build_object('state',private.adventure_state());
end;
$$;
revoke all on function private.adventure_action(jsonb) from public,anon,authenticated;
create function public.food_go_adventure(p_action jsonb default '{"action":"read"}') returns jsonb
language sql security invoker set search_path='' as $$select private.adventure_action(p_action);$$;
revoke all on function public.food_go_adventure(jsonb) from public,anon,authenticated;
grant execute on function private.adventure_action(jsonb),public.food_go_adventure(jsonb) to authenticated;

comment on table private.outback_villages is 'Earned virtual-only supplies. No purchases, cash value, combat or client-supplied balances.';
comment on table private.adventure_quests is 'Independently approved restaurant support campaigns. Feedback must be honest and private; no positive public-review incentive.';
comment on function public.food_go_adventure(jsonb) is 'Verified live-session-only adventure state and locked/idempotent quests, daily supplies and village simulation.';
-- Preserve the reviewed operator workflow atomically while persisting offer classification.
create or replace function public.food_go_active_promotions()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(data.row order by data.ends_at, data.id),'[]'::jsonb) from (
    select p.id, p.ends_at, jsonb_build_object('id',p.id,'venueId',v.id,'venueSlug',v.slug,'venueName',v.name,
      'suburb',v.suburb,'title',p.title,'description',p.description,'kind',p.kind,'startsAt',p.starts_at,'endsAt',p.ends_at) as row
    from public.promotions p join public.venues v on v.id=p.venue_id
    where v.status='published' and v.ownership_verified_at is not null and p.status='published' and p.starts_at <= now() and p.ends_at > now()
    order by p.ends_at, p.id limit 100
  ) data;
$$;
revoke all on function public.food_go_active_promotions() from public, anon, authenticated;
grant execute on function public.food_go_active_promotions() to anon, authenticated;

create or replace function private.operator_entries(section text)
returns table(id uuid, at_time timestamptz, entry jsonb)
language plpgsql stable security invoker set search_path='' as $$
begin
  case section
  when 'venues' then return query
    select v.id,v.created_at,jsonb_build_object('id',v.id,'name',v.name,'detail',concat_ws(', ',v.address,v.suburb,v.state,v.postcode),
      'state',v.status,'verified',v.ownership_verified_at is not null,'version',v.updated_at,'latitude',v.latitude,'longitude',v.longitude,
      'organisation',o.name,'contactEmail',c.email,'contactPhone',c.phone)
    from public.venues v join public.organizations o on o.id=v.organization_id left join public.venue_contacts c on c.venue_id=v.id;
  when 'promotions' then return query
    select p.id,p.created_at,jsonb_build_object('id',p.id,'name',p.title,'detail',p.description,'state',p.status,
      'kind',p.kind,'venueId',p.venue_id,'venueName',v.name,'startsAt',p.starts_at,'endsAt',p.ends_at,'version',p.updated_at)
    from public.promotions p join public.venues v on v.id=p.venue_id;
  when 'posts' then return query
    select p.id,p.created_at,jsonb_build_object('id',p.id,'name',a.display_name,'detail',p.body,'state',p.moderation_status,'version',p.moderation_status)
    from private.community_posts p join private.community_authors a on a.id=p.author_id where p.visibility='public' and p.deleted_at is null;
  when 'comments' then return query
    select c.id,c.created_at,jsonb_build_object('id',c.id,'name',a.display_name,'detail',c.body,'state',c.moderation_status,'version',c.moderation_status,
      'context',left(p.body,250))
    from private.community_comments c join private.community_posts p on p.id=c.post_id join private.community_authors a on a.id=c.author_id
    where p.visibility='public' and p.deleted_at is null;
  when 'reports' then return query
    select p.id,max(r.created_at),jsonb_build_object('id',p.id,'name',count(*) || ' report' || case when count(*)=1 then '' else 's' end,
      'detail',p.body,'state',string_agg(distinct r.reason,', ' order by r.reason),'version',md5(string_agg(r.author_id::text || ':' || r.reason,',' order by r.author_id)))
    from private.community_reports r join private.community_posts p on p.id=r.post_id where p.visibility='public' and p.deleted_at is null group by p.id;
  when 'audit' then return query
    select a.request_id,a.created_at,jsonb_build_object('id',a.request_id,'name',a.action,'detail',a.reason,'state',a.target,'actor',a.actor,'at',a.created_at)
    from private.operator_audit a;
  else raise exception using errcode='22023',message='Unknown operator section';
  end case;
end;
$$;
revoke all on function private.operator_entries(text) from public, anon, authenticated;

create or replace function private.operator_change(p_action jsonb)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare
  actor uuid := auth.uid();
  operation text := p_action->>'action';
  target_id uuid;
  request_id_value uuid;
  expected text := p_action->>'version';
  note text := btrim(p_action->>'reason');
  action_hash text := md5(p_action::text);
  previous private.operator_audit%rowtype;
  venue public.venues%rowtype;
  promo public.promotions%rowtype;
  post private.community_posts%rowtype;
  comment_row private.community_comments%rowtype;
  reporters uuid[];
  reports_version text;
  venue_ref uuid;
  starts timestamptz;
  ends timestamptz;
  lat double precision;
  lon double precision;
  allowed text[] := array['action','id','requestId','reason','version'];
begin
  if private.food_go_operator_access()<>'ready' then raise exception using errcode='42501',message='Operator session required'; end if;
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>8192
     or not private.partner_text_valid(note,3,240) then raise exception using errcode='22023',message='Invalid decision'; end if;
  if operation in ('promo.create','promo.edit') then allowed:=allowed || array['venueId','title','description','startsAt','endsAt','kind']; end if;
  if operation='venue.locate' then allowed:=allowed || array['latitude','longitude']; end if;
  if exists(select 1 from jsonb_object_keys(p_action) k where k<>all(allowed))
    or jsonb_typeof(p_action->'reason') is distinct from 'string'
    or (operation is distinct from 'promo.create' and jsonb_typeof(p_action->'version') is distinct from 'string')
    then raise exception using errcode='22023',message='Invalid decision fields'; end if;
  request_id_value:=(p_action->>'requestId')::uuid;
  target_id:=(p_action->>'id')::uuid;
  if request_id_value is null or target_id is null then raise exception using errcode='22023',message='Missing decision identifier'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id_value::text,87146));
  select * into previous from private.operator_audit where request_id=request_id_value;
  if found then
    if previous.actor<>actor or previous.request_hash<>action_hash then raise exception using errcode='FG409',message='Decision key already used'; end if;
    return jsonb_build_object('ok',true);
  end if;
  if operation in ('venue.verify','venue.revoke','venue.publish','venue.suspend','venue.locate') then
    select * into venue from public.venues where id=target_id for update;
    if not found then raise exception using errcode='FG404',message='Venue unavailable'; end if;
    if expected::timestamptz is distinct from venue.updated_at then raise exception using errcode='FG409',message='Venue has changed'; end if;
    if exists(select 1 from public.organization_members where organization_id=venue.organization_id and user_id=actor) then
      raise exception using errcode='42501',message='An independent operator must review this venue'; end if;
    case operation
      when 'venue.verify' then
        update public.venues set ownership_verified_at=now(), status=case when status='draft' then 'pending' else status end where id=target_id;
      when 'venue.revoke' then update public.venues set ownership_verified_at=null,status='suspended' where id=target_id;
      when 'venue.publish' then
        if venue.ownership_verified_at is null then raise exception using errcode='FG409',message='Verify ownership before publication'; end if;
        update public.venues set status='published' where id=target_id;
      when 'venue.suspend' then update public.venues set status='suspended' where id=target_id;
      when 'venue.locate' then
        if jsonb_typeof(p_action->'latitude') is distinct from 'number' or jsonb_typeof(p_action->'longitude') is distinct from 'number'
          then raise exception using errcode='22023',message='Enter both coordinates'; end if;
        lat:=(p_action->>'latitude')::double precision; lon:=(p_action->>'longitude')::double precision;
        if lat not between -90 and 90 or lon not between -180 and 180 then raise exception using errcode='22023',message='Invalid map position'; end if;
        update public.venues set latitude=lat,longitude=lon where id=target_id;
    end case;
  elsif operation in ('promo.create','promo.edit','promo.publish','promo.withdraw') then
    if operation<>'promo.create' then
      select * into promo from public.promotions where id=target_id for update;
      if not found then raise exception using errcode='FG404',message='Promotion unavailable'; end if;
      if expected::timestamptz is distinct from promo.updated_at then raise exception using errcode='FG409',message='Promotion has changed'; end if;
      venue_ref:=promo.venue_id;
    else venue_ref:=(p_action->>'venueId')::uuid;
    end if;
    select * into venue from public.venues where id=venue_ref for share;
    if not found then raise exception using errcode='FG404',message='Venue unavailable'; end if;
    if operation<>'promo.withdraw' and (venue.status<>'published' or venue.ownership_verified_at is null) then
      raise exception using errcode='FG409',message='Select a published venue'; end if;
    if exists(select 1 from public.organization_members where organization_id=venue.organization_id and user_id=actor) then
      raise exception using errcode='42501',message='An independent operator must review this offer'; end if;
    if operation in ('promo.create','promo.edit') then
      if (p_action ? 'kind' and (jsonb_typeof(p_action->'kind') is distinct from 'string' or p_action->>'kind' not in ('food','restaurant'))) or jsonb_typeof(p_action->'title') is distinct from 'string' or jsonb_typeof(p_action->'description') is distinct from 'string'
        or not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400)
        or (p_action->>'venueId')::uuid is distinct from venue_ref then raise exception using errcode='22023',message='Invalid offer details'; end if;
      starts:=(p_action->>'startsAt')::timestamptz; ends:=(p_action->>'endsAt')::timestamptz;
      if starts is null or ends is null or not isfinite(starts) or not isfinite(ends) or ends<=starts or ends<=now()
        then raise exception using errcode='22023',message='Invalid offer dates'; end if;
      if operation='promo.create' then
        insert into public.promotions(id,venue_id,title,description,starts_at,ends_at,kind) values(target_id,venue_ref,btrim(p_action->>'title'),btrim(p_action->>'description'),starts,ends,coalesce(p_action->>'kind','restaurant'));
      else
        update public.promotions set kind=coalesce(p_action->>'kind',promo.kind),title=btrim(p_action->>'title'),description=btrim(p_action->>'description'),starts_at=starts,ends_at=ends,
          status='draft',updated_at=clock_timestamp() where id=target_id;
      end if;
    elsif operation='promo.publish' then
      if promo.ends_at<=now() then raise exception using errcode='FG409',message='Promotion has expired'; end if;
      update public.promotions set status='published',updated_at=clock_timestamp() where id=target_id;
    else update public.promotions set status='withdrawn',updated_at=clock_timestamp() where id=target_id;
    end if;
  elsif operation in ('post.publish','post.remove','report.dismiss','report.remove') then
    select * into post from private.community_posts p where p.id=target_id and p.visibility='public' and p.deleted_at is null for update;
    if not found then raise exception using errcode='FG404',message='Public post unavailable'; end if;
    if exists(select 1 from private.community_authors where id=post.author_id and user_id=actor) then
      raise exception using errcode='42501',message='An independent operator must review this post'; end if;
    if operation like 'report.%' then
      select array_agg(r.author_id),md5(string_agg(r.author_id::text || ':' || r.reason,',' order by r.author_id))
        into reporters,reports_version from (select author_id,reason from private.community_reports where post_id=target_id for update) r;
      if reporters is null or expected is distinct from reports_version then raise exception using errcode='FG409',message='Reports have changed'; end if;
      delete from private.community_reports where post_id=target_id and author_id=any(reporters);
    elsif expected is distinct from post.moderation_status then raise exception using errcode='FG409',message='Post has changed';
    end if;
    if operation='post.publish' then update private.community_posts set moderation_status='published' where id=target_id;
    elsif operation in ('post.remove','report.remove') then update private.community_posts set deleted_at=now() where id=target_id;
    end if;
  elsif operation in ('comment.publish','comment.remove') then
    select c.* into comment_row from private.community_comments c join private.community_posts p on p.id=c.post_id
      where c.id=target_id and p.visibility='public' and p.deleted_at is null for update of c,p;
    if not found then raise exception using errcode='FG404',message='Comment unavailable'; end if;
    if exists(select 1 from private.community_authors where id=comment_row.author_id and user_id=actor) then
      raise exception using errcode='42501',message='An independent operator must review this comment'; end if;
    if expected is distinct from comment_row.moderation_status then raise exception using errcode='FG409',message='Comment has changed'; end if;
    if operation='comment.publish' then update private.community_comments set moderation_status='published' where id=target_id;
    else delete from private.community_comments where id=target_id; end if;
  else raise exception using errcode='22023',message='Unknown decision';
  end if;
  insert into private.operator_audit(request_id,actor,action,target,reason,request_hash)
    values(request_id_value,actor,operation,target_id,note,action_hash);
  return jsonb_build_object('ok',true);
end;
$$;

-- Owner submissions retain independent publication while selecting either deal category.
create or replace function private.partner_workspace(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); operation text:=p_action->>'action'; venue public.venues%rowtype;
  target uuid:=(p_action->>'venueId')::uuid; selected_dish uuid; token text; expiry timestamptz; output jsonb;
  allowed text[]; existing_dish public.venue_dishes%rowtype; existing_promo public.promotions%rowtype;
begin
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>4096 then raise exception using errcode='22023',message='Invalid action'; end if;
  allowed:=case operation
    when 'read' then array['action','venueId']
    when 'submit' then array['action','venueId','version']
    when 'details' then array['action','venueId','version','name','description','cuisine','address','suburb','state','postcode','gameEnabled']
    when 'dish' then array['action','venueId','dishId','version','name','description','price','available']
    when 'issue' then array['action','venueId','dishId']
    when 'promo' then array['action','venueId','id','title','description','startsAt','endsAt','kind']
    else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where k<>all(allowed)) then
    raise exception using errcode='22023',message='Invalid action fields'; end if;
  select * into venue from public.venues v where v.id=target and exists(select 1 from public.organization_members m
    where m.organization_id=v.organization_id and m.user_id=actor and m.role in ('owner','manager')) for update;
  if not found then raise exception using errcode='42501',message='Restaurant manager required'; end if;
  if operation='submit' then
    if (p_action->>'version')::timestamptz is distinct from venue.updated_at then raise exception using errcode='FG409',message='Listing changed'; end if;
    if venue.status not in ('draft','pending') then raise exception using errcode='FG409',message='Listing already reviewed'; end if;
    update public.venues set status='pending' where id=target;
  elsif operation='details' then
    if (p_action->>'version')::timestamptz is distinct from venue.updated_at then raise exception using errcode='FG409',message='Listing changed'; end if;
    if not private.partner_text_valid(p_action->>'name',2,120)
      or not private.partner_text_valid(p_action->>'description',0,1000)
      or not private.partner_text_valid(p_action->>'cuisine',2,60)
      or not private.partner_text_valid(p_action->>'address',5,200)
      or not private.partner_text_valid(p_action->>'suburb',2,100)
      or p_action->>'state' not in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
      or not (p_action->>'postcode' ~ '^[0-9]{4}$') or jsonb_typeof(p_action->'gameEnabled') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Invalid venue details'; end if;
    update public.venues set name=btrim(p_action->>'name'),description=p_action->>'description',cuisine=btrim(p_action->>'cuisine'),
      address=btrim(p_action->>'address'),suburb=btrim(p_action->>'suburb'),state=p_action->>'state',
      postcode=p_action->>'postcode',game_enabled=(p_action->>'gameEnabled')::boolean where id=target;
  elsif operation='dish' then
    selected_dish:=(p_action->>'dishId')::uuid;
    if selected_dish is null or not private.partner_text_valid(p_action->>'name',2,120)
      or not private.partner_text_valid(coalesce(p_action->>'description',''),0,1000)
      or jsonb_typeof(p_action->'price') is distinct from 'number' or (p_action->>'price')::integer not between 0 and 1000000
      or jsonb_typeof(p_action->'available') is distinct from 'boolean' then raise exception using errcode='22023',message='Invalid dish'; end if;
    select * into existing_dish from public.venue_dishes where id=selected_dish for update;
    if found and existing_dish.venue_id<>target then raise exception using errcode='42501',message='Dish belongs to another venue'; end if;
    if found and (p_action->>'version')::timestamptz is distinct from existing_dish.updated_at then raise exception using errcode='FG409',message='Dish changed'; end if;
    if existing_dish.id is null and (select count(*) from public.venue_dishes where venue_id=target)>=100 then raise exception using errcode='FG429',message='Menu limit reached'; end if;
    insert into public.venue_dishes(id,venue_id,name,description,price_aud_cents,is_available)
    values(selected_dish,target,btrim(p_action->>'name'),coalesce(p_action->>'description',''),(p_action->>'price')::integer,(p_action->>'available')::boolean)
    on conflict(id) do update set name=excluded.name,description=excluded.description,price_aud_cents=excluded.price_aud_cents,is_available=excluded.is_available;
  elsif operation='issue' then
    if venue.status<>'published' or venue.ownership_verified_at is null or not venue.game_enabled then raise exception using errcode='FG409',message='Verified game-enabled published venue required'; end if;
    selected_dish:=(p_action->>'dishId')::uuid;
    if selected_dish is not null and not exists(select 1 from public.venue_dishes where id=selected_dish and venue_id=target and is_available) then raise exception using errcode='FG404',message='Dish unavailable'; end if;
    if (select count(*) from private.exploration_codes where venue_id=target and created_at>now()-interval '1 hour')>=60 then raise exception using errcode='FG429',message='Code limit reached'; end if;
    token:=replace(gen_random_uuid()::text,'-',''); expiry:=now()+interval '10 minutes';
    -- Issuing a replacement invalidates the older code for the same kind.
    update private.exploration_codes c set expires_at=now() where c.venue_id=target and c.dish_id is not distinct from selected_dish and c.expires_at>now();
    insert into private.exploration_codes(venue_id,dish_id,issuer,token_hash,expires_at) values(target,selected_dish,actor,md5(token),expiry);
    return jsonb_build_object('code',token,'expiresAt',expiry);
  elsif operation='promo' then
    if p_action ? 'kind' and (jsonb_typeof(p_action->'kind') is distinct from 'string' or p_action->>'kind' not in ('food','restaurant')) then raise exception using errcode='22023',message='Invalid offer category'; end if;
    if venue.status<>'published' or venue.ownership_verified_at is null then raise exception using errcode='FG409',message='Published venue required'; end if;
    select * into existing_promo from public.promotions where id=(p_action->>'id')::uuid for update;
    if found then
      if existing_promo.kind is distinct from coalesce(p_action->>'kind',existing_promo.kind) or existing_promo.venue_id<>target or existing_promo.title is distinct from btrim(p_action->>'title')
        or existing_promo.description is distinct from btrim(p_action->>'description')
        or existing_promo.starts_at is distinct from (p_action->>'startsAt')::timestamptz
        or existing_promo.ends_at is distinct from (p_action->>'endsAt')::timestamptz then
        raise exception using errcode='FG409',message='Offer already submitted'; end if;
    else
    if not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400) then
      raise exception using errcode='22023',message='Invalid offer'; end if;
    if (select count(*) from public.promotions where venue_id=target and created_at>now()-interval '1 day')>=20 then raise exception using errcode='FG429',message='Daily offer limit reached'; end if;
    insert into public.promotions(id,venue_id,title,description,starts_at,ends_at,kind)
    values((p_action->>'id')::uuid,target,btrim(p_action->>'title'),btrim(p_action->>'description'),(p_action->>'startsAt')::timestamptz,(p_action->>'endsAt')::timestamptz,coalesce(p_action->>'kind','restaurant'));
    end if;
  elsif operation is distinct from 'read' then raise exception using errcode='22023',message='Unknown action';
  end if;
  select jsonb_build_object('venue',to_jsonb(v)-'organization_id'-'location',
    'contact',(select jsonb_build_object('email',email,'phone',phone) from public.venue_contacts where venue_id=target),
    'dishes',coalesce((select jsonb_agg(to_jsonb(d) order by d.name) from public.venue_dishes d where venue_id=target),'[]'::jsonb),
    'promotions',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from
      (select * from public.promotions where venue_id=target order by created_at desc limit 100) p),'[]'::jsonb),
    'visits',(select count(*) from public.check_ins where venue_id=target),
    'discoveries',(select count(*) from public.food_discoveries where venue_id=target))
  into output from public.venues v where v.id=target;
  return output;
end;
$$;
revoke all on function private.partner_workspace(jsonb) from public,anon,authenticated;

grant execute on function private.partner_workspace(jsonb) to authenticated;
commit;

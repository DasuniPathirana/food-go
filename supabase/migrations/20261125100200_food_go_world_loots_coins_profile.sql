-- Stage 1 Real Coins, User Profile/Avatar Persistence, Dual AR Grab & Map Grab Loots, and Admin Special Game Rewards
begin;

-- Real Coin Wallet on Profiles + immutable Coin Ledger (separate from XP) + Avatar Persistence
alter table public.profiles
  add column if not exists coins integer not null default 0 check (coins between 0 and 100000000),
  add column if not exists avatar_id text not null default 'foodie' check (avatar_id in ('foodie','barista','chef','scout','explorer')),
  add column if not exists avatar_idle_motion boolean not null default true;

create table private.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount between 1 and 100000),
  source_type text not null check (source_type in ('world_loot','quest_bonus','deal_reward','admin_bonus','visit_bonus')),
  source_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, source_type, source_id)
);
create index coin_ledger_user_idx on private.coin_ledger(user_id, created_at desc);
alter table private.coin_ledger enable row level security;
revoke all on table private.coin_ledger from public, anon, authenticated;

-- Allow reward_events to accept verified world loots, deals and game rewards cleanly.
alter table public.reward_events drop constraint if exists reward_events_source_type_check;
alter table public.reward_events add constraint reward_events_source_type_check
  check (source_type in ('venue_visit','dish_discovery','quest_completion','world_loot','deal_reward','admin_bonus'));

-- Allow verified account profile & avatar persistence in Supabase while updating community author display name.
create function private.update_user_profile(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '6s' as $$
declare
  actor uuid := private.journey_user();
  next_name text;
  next_bio text;
  next_avatar text;
  next_motion boolean;
  allowed text[] := array['displayName','bio','avatarId','avatarIdleMotion'];
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 2048
    or exists(select 1 from jsonb_object_keys(p_action) k where k <> all(allowed)) then
    raise exception using errcode = '22023', message = 'Invalid profile fields';
  end if;
  if p_action ? 'displayName' then
    next_name := btrim(p_action->>'displayName');
    if not private.community_text_valid(next_name, 80) then
      raise exception using errcode = '22023', message = 'Display name must be between 1 and 80 characters';
    end if;
    update public.profiles set display_name = next_name where id = actor;
    update private.community_authors set display_name = next_name where user_id = actor;
  end if;
  if p_action ? 'bio' then
    next_bio := btrim(coalesce(p_action->>'bio', ''));
    if char_length(next_bio) > 300 or translate(next_bio, chr(9) || chr(10) || chr(13), '') ~ '[[:cntrl:]]' then
      raise exception using errcode = '22023', message = 'Bio must be 300 characters or fewer';
    end if;
    update public.profiles set bio = next_bio where id = actor;
  end if;
  if p_action ? 'avatarId' then
    next_avatar := p_action->>'avatarId';
    if next_avatar not in ('foodie','barista','chef','scout','explorer') then
      raise exception using errcode = '22023', message = 'Choose a valid 3D avatar style';
    end if;
    update public.profiles set avatar_id = next_avatar where id = actor;
  end if;
  if p_action ? 'avatarIdleMotion' then
    if jsonb_typeof(p_action->'avatarIdleMotion') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Invalid motion preference';
    end if;
    next_motion := (p_action->>'avatarIdleMotion')::boolean;
    update public.profiles set avatar_idle_motion = next_motion where id = actor;
  end if;

  return (
    select jsonb_build_object(
      'ok', true,
      'displayName', p.display_name,
      'bio', coalesce(p.bio, ''),
      'avatarId', p.avatar_id,
      'avatarIdleMotion', p.avatar_idle_motion,
      'coins', p.coins
    )
    from public.profiles p where p.id = actor
  );
end;
$$;
create function public.food_go_update_profile(p_action jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.update_user_profile(p_action); $$;
revoke all on function private.update_user_profile(jsonb), public.food_go_update_profile(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_update_profile(jsonb) to authenticated;

-- Unified World Loots table covering:
--   1. Restaurant-placed loots ('restaurant'): placed at venue/mall, requires Admin approval, supports AR Grab or Map Grab
--   2. Game-Admin Special Rewards ('game_admin'): placed anywhere inside Melbourne Pilot to help players level up
create table private.world_loots (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('restaurant','game_admin')),
  venue_id uuid references public.venues(id) on delete cascade,
  mall_id uuid references public.malls(id) on delete set null,
  mall_floor text check (mall_floor is null or char_length(btrim(mall_floor)) <= 24),
  creator uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 90),
  description text not null check (char_length(btrim(description)) between 2 and 600),
  grab_mode text not null check (grab_mode in ('map_grab','ar_grab')),
  reward_kind text not null check (reward_kind in ('collectible','offer','xp_coins')),
  model_style text not null default 'golden_crystal'
    check (model_style in ('golden_crystal','mystery_ring','reward_crate','dish_trophy','star_chest')),
  rarity text not null default 'rare' check (rarity in ('common','rare','epic','legendary')),
  visibility_mode text not null default 'always_visible'
    check (visibility_mode in ('always_visible','proximity_reveal','scheduled_drop')),
  xp_reward integer not null default 50 check (xp_reward between 10 and 1000),
  coin_reward integer not null default 25 check (coin_reward between 0 and 1000),
  promotion_id uuid references public.promotions(id) on delete set null,
  latitude double precision not null check (latitude between -38.05 and -37.65),
  longitude double precision not null check (longitude between 144.80 and 145.15),
  radius_metres integer not null default 65 check (radius_metres between 15 and 250),
  cooldown_hours integer not null default 24 check (cooldown_hours between 0 and 720),
  max_claims integer not null default 500 check (max_claims between 1 and 100000),
  claimed_count integer not null default 0 check (claimed_count >= 0 and claimed_count <= max_claims),
  starts_at timestamptz not null default clock_timestamp(),
  ends_at timestamptz not null default (clock_timestamp() + interval '180 days'),
  status text not null default 'draft' check (status in ('draft','pending','published','rejected','withdrawn')),
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 300),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((source = 'restaurant' and venue_id is not null) or (source = 'game_admin')),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at)
);
create index world_loots_public_idx on private.world_loots(status, ends_at, starts_at) where status = 'published';
create index world_loots_venue_idx on private.world_loots(venue_id, created_at desc) where venue_id is not null;
create trigger world_loots_updated_at before update on private.world_loots
  for each row execute function private.touch_updated_at();

create table private.world_loot_claims (
  id uuid primary key default gen_random_uuid(),
  loot_id uuid not null references private.world_loots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grab_mode text not null check (grab_mode in ('map_grab','ar_grab')),
  claimed_latitude double precision,
  claimed_longitude double precision,
  ar_verified boolean not null default false,
  xp_awarded integer not null check (xp_awarded >= 0),
  coins_awarded integer not null check (coins_awarded >= 0),
  claim_code text,
  claimed_at timestamptz not null default clock_timestamp()
);
create index world_loot_claims_user_idx on private.world_loot_claims(user_id, loot_id, claimed_at desc);

alter table private.world_loots enable row level security;
alter table private.world_loot_claims enable row level security;
revoke all on table private.world_loots, private.world_loot_claims from public, anon, authenticated;

-- Public & Player-aware World Loots feed for the 3D Explore Map
create function public.food_go_world_loots()
returns jsonb language plpgsql stable security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := auth.uid();
  now_at timestamptz := clock_timestamp();
begin
  return jsonb_build_object(
    'serverNow', now_at,
    'loots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'source', l.source,
        'venueId', l.venue_id,
        'venueName', v.name,
        'venueSlug', v.slug,
        'mallId', l.mall_id,
        'mallFloor', l.mall_floor,
        'title', l.title,
        'description', l.description,
        'grabMode', l.grab_mode,
        'rewardKind', l.reward_kind,
        'modelStyle', l.model_style,
        'rarity', l.rarity,
        'visibilityMode', l.visibility_mode,
        'xpReward', l.xp_reward,
        'coinReward', l.coin_reward,
        'promotionId', l.promotion_id,
        'coordinates', jsonb_build_object('latitude', l.latitude, 'longitude', l.longitude),
        'radiusMetres', l.radius_metres,
        'cooldownHours', l.cooldown_hours,
        'remainingClaims', greatest(0, l.max_claims - l.claimed_count),
        'endsAt', l.ends_at,
        'lastClaimedAt', last_c.claimed_at,
        'nextAvailableAt', case
          when last_c.claimed_at is null then null
          when l.cooldown_hours = 0 then null
          else last_c.claimed_at + make_interval(hours => l.cooldown_hours)
        end,
        'claimedOnce', last_c.claimed_at is not null,
        'eligibleNow', case
          when actor is null then true
          when last_c.claimed_at is not null and l.cooldown_hours = 0 then false
          when last_c.claimed_at is not null and last_c.claimed_at + make_interval(hours => l.cooldown_hours) > now_at then false
          else true
        end
      ) order by l.source desc, l.rarity desc, l.created_at desc)
      from private.world_loots l
      left join public.venues v on v.id = l.venue_id
      left join lateral (
        select c.claimed_at
        from private.world_loot_claims c
        where actor is not null and c.loot_id = l.id and c.user_id = actor
        order by c.claimed_at desc
        limit 1
      ) last_c on true
      where l.status = 'published'
        and l.starts_at <= now_at
        and l.ends_at > now_at
        and l.claimed_count < l.max_claims
        and (
          l.source = 'game_admin'
          or (v.id is not null and v.status = 'published' and v.ownership_verified_at is not null and v.game_enabled)
        )
      limit 150
    ), '[]'::jsonb),
    'myClaims', case when actor is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'lootId', c.loot_id,
        'title', l.title,
        'source', l.source,
        'grabMode', c.grab_mode,
        'rewardKind', l.reward_kind,
        'rarity', l.rarity,
        'xpAwarded', c.xp_awarded,
        'coinsAwarded', c.coins_awarded,
        'claimCode', c.claim_code,
        'venueName', v.name,
        'claimedAt', c.claimed_at
      ) order by c.claimed_at desc)
      from private.world_loot_claims c
      join private.world_loots l on l.id = c.loot_id
      left join public.venues v on v.id = l.venue_id
      where c.user_id = actor
      limit 100
    ), '[]'::jsonb) end
  );
end;
$$;
revoke all on function public.food_go_world_loots() from public, anon, authenticated;
grant execute on function public.food_go_world_loots() to anon, authenticated;

-- Server-verified claim for BOTH Map Grab and AR Grab loots + Admin Game Rewards
create function private.claim_world_loot(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  target_id uuid := (p_action->>'lootId')::uuid;
  lat double precision := (p_action->>'latitude')::double precision;
  lng double precision := (p_action->>'longitude')::double precision;
  ar_confirmed boolean := coalesce((p_action->>'arScanConfirmed')::boolean, false);
  loot private.world_loots%rowtype;
  venue public.venues%rowtype;
  last_claim private.world_loot_claims%rowtype;
  dist double precision;
  claim_id_val uuid;
  claim_code_val text;
  now_at timestamptz := clock_timestamp();
begin
  if target_id is null or lat is null or lng is null
    or lat not between -38.05 and -37.65 or lng not between 144.80 and 145.15 then
    raise exception using errcode = '22023', message = 'Valid Melbourne location coordinates are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text, 88214));

  select * into loot from private.world_loots where id = target_id for update;
  if not found or loot.status <> 'published' or loot.starts_at > now_at or loot.ends_at <= now_at then
    raise exception using errcode = 'FG404', message = 'This loot reward is no longer active';
  end if;
  if loot.claimed_count >= loot.max_claims then
    raise exception using errcode = 'FG409', message = 'All available claims for this reward have been collected';
  end if;

  if loot.source = 'restaurant' then
    select * into venue from public.venues where id = loot.venue_id;
    if not found or venue.status <> 'published' or venue.ownership_verified_at is null or not venue.game_enabled then
      raise exception using errcode = 'FG404', message = 'Participating restaurant is currently unavailable';
    end if;
    if exists(select 1 from public.organization_members m where m.organization_id = venue.organization_id and m.user_id = actor) then
      raise exception using errcode = '42501', message = 'Restaurant team members cannot collect their own venue loots';
    end if;
  end if;

  dist := private.geographic_distance(lng, lat, loot.longitude, loot.latitude);
  if dist > greatest(loot.radius_metres, 90) then
    raise exception using errcode = 'FG409', message = 'Walk closer to the reward location on the map to grab it';
  end if;

  if loot.grab_mode = 'ar_grab' and not ar_confirmed then
    raise exception using errcode = '22023', message = 'Open the AR camera view at the location and scan the reward to grab it';
  end if;

  select * into last_claim from private.world_loot_claims where loot_id = loot.id and user_id = actor order by claimed_at desc limit 1;
  if found then
    if loot.cooldown_hours = 0 then
      raise exception using errcode = 'FG409', message = 'You have already collected this reward';
    elsif last_claim.claimed_at + make_interval(hours => loot.cooldown_hours) > now_at then
      raise exception using errcode = 'FG429', message = 'This reward is still cooling down for your account';
    end if;
  end if;

  if (select count(*) from private.world_loot_claims where user_id = actor and claimed_at >= now_at - interval '24 hours') >= 40 then
    raise exception using errcode = 'FG429', message = 'Daily loot collection cap reached';
  end if;

  if loot.reward_kind = 'offer' then
    claim_code_val := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  insert into private.world_loot_claims(
    loot_id, user_id, grab_mode, claimed_latitude, claimed_longitude, ar_verified, xp_awarded, coins_awarded, claim_code
  )
  values (
    loot.id, actor, loot.grab_mode, lat, lng, ar_confirmed, loot.xp_reward, loot.coin_reward, claim_code_val
  )
  returning id into claim_id_val;

  update private.world_loots set claimed_count = claimed_count + 1 where id = loot.id;

  insert into public.reward_events(user_id, points, source_type, source_id)
  values (actor, loot.xp_reward, case when loot.source = 'game_admin' then 'admin_bonus' else 'world_loot' end, claim_id_val);

  if loot.coin_reward > 0 then
    insert into private.coin_ledger(user_id, amount, source_type, source_id)
    values (actor, loot.coin_reward, case when loot.source = 'game_admin' then 'admin_bonus' else 'world_loot' end, claim_id_val);
    update public.profiles set coins = least(100000000, coins + loot.coin_reward) where id = actor;
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimId', claim_id_val,
    'lootId', loot.id,
    'title', loot.title,
    'grabMode', loot.grab_mode,
    'rewardKind', loot.reward_kind,
    'rarity', loot.rarity,
    'xpAwarded', loot.xp_reward,
    'coinsAwarded', loot.coin_reward,
    'claimCode', claim_code_val,
    'profile', private.adventure_profile()
  );
end;
$$;
create function public.food_go_claim_world_loot(p_action jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.claim_world_loot(p_action); $$;
revoke all on function private.claim_world_loot(jsonb), public.food_go_claim_world_loot(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_claim_world_loot(jsonb) to authenticated;

-- Extend private.adventure_profile() to return coins, bio, avatarId, avatarIdleMotion and loots collected count!
create or replace function private.adventure_profile() returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  social jsonb;
  total bigint;
  achievements jsonb;
  requirements jsonb;
  level_value integer := 1;
  xp_level integer := 1;
  candidate integer;
  prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where id = actor;
  social := public.food_go_social_game_profile();
  select (social->>'xp')::bigint
    + coalesce((select sum(points) from public.reward_events where user_id = actor), 0)
    + coalesce((select sum(points) from private.adventure_rewards where user_id = actor), 0)
  into total;
  select jsonb_build_object(
    'visits', (select count(distinct venue_id) from public.check_ins where user_id = actor),
    'cuisines', (select count(distinct v.cuisine) from public.check_ins c join public.venues v on v.id = c.venue_id where c.user_id = actor),
    'quests', (select count(*) from private.adventure_rewards where user_id = actor),
    'questCategories', (select count(distinct q.category) from private.adventure_rewards r join private.adventure_quests q on q.id = r.quest_id where r.user_id = actor),
    'posts', (select count(*) from private.community_posts p join private.community_authors a on a.id = p.author_id where a.user_id = actor and p.visibility = 'public' and p.moderation_status = 'published' and p.deleted_at is null),
    'harvests', (select count(*) from private.world_loot_claims where user_id = actor),
    'buildings', (select count(*) from private.world_loot_claims where user_id = actor and grab_mode = 'ar_grab')
  ) into achievements;

  for candidate in 2..250 loop
    exit when total < private.adventure_level_xp(candidate);
    xp_level := candidate;
    requirements := private.adventure_level_requirements(candidate);
    if not exists(select 1 from jsonb_each_text(requirements) r where (achievements->>r.key)::bigint < r.value::bigint) then
      level_value := candidate;
    end if;
  end loop;

  return social || jsonb_build_object(
    'xp', total,
    'level', level_value,
    'xpLevel', xp_level,
    'nextLevelXp', private.adventure_level_xp(least(250, level_value + 1)),
    'tier', case when level_value = 250 then 'legendary' when level_value > 200 then 'golden' when level_value > 150 then 'mighty' when level_value > 100 then 'advanced' when level_value > 50 then 'community' else 'foundation' end,
    'coins', coalesce(prof.coins, 0),
    'displayName', coalesce(prof.display_name, 'Food explorer'),
    'bio', coalesce(prof.bio, ''),
    'avatarId', coalesce(prof.avatar_id, 'foodie'),
    'avatarIdleMotion', coalesce(prof.avatar_idle_motion, true),
    'lootsCollected', (select count(*) from private.world_loot_claims where user_id = actor),
    'achievements', achievements,
    'nextRequirements', private.adventure_level_requirements(least(250, level_value + 1))
  );
end;
$$;

commit;

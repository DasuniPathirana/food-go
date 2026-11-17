begin;

alter table public.profiles add column account_type text not null default 'explorer'
  check (account_type in ('explorer','partner'));
-- Account type chooses the interface. Organisation membership and operator grants
-- continue to authorise all business and administrative operations.
create or replace function private.create_user_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,account_type)
  values(new.id,coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'),80),''),'Food explorer'),
    case when new.raw_user_meta_data->>'account_type'='partner' then 'partner' else 'explorer' end);
  return new;
end;
$$;
update public.profiles p set account_type='partner'
where exists(select 1 from public.organization_members m where m.user_id=p.id);

create table private.saved_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('venue','dish')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,kind,target_id)
);
create table private.exploration_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  dish_id uuid references public.venue_dishes(id) on delete cascade,
  issuer uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index exploration_codes_venue_idx on private.exploration_codes(venue_id,created_at desc);
create table private.exploration_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('venue','dish')),
  target_id uuid not null,
  evidence_id uuid not null references private.exploration_codes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,kind,target_id)
);
alter table private.saved_items enable row level security;
alter table private.exploration_codes enable row level security;
alter table private.exploration_receipts enable row level security;
revoke all on private.saved_items,private.exploration_codes,private.exploration_receipts from public,anon,authenticated;

create function private.journey_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
  select u.id into actor from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
    and (s.not_after is null or s.not_after>now())
    and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
    and (u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'));
  if actor is null then raise exception using errcode='42501',message='Verified active session required'; end if;
  return actor;
end;
$$;
revoke all on function private.journey_user() from public,anon,authenticated;

create function private.customer_journey(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); operation text:=p_action->>'action';
  target uuid; item_kind text; proof private.exploration_codes%rowtype; venue public.venues%rowtype;
  dish public.venue_dishes%rowtype; visit uuid; discovery uuid; awarded integer:=0; result jsonb;
begin
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>4096 then
    raise exception using errcode='22023',message='Invalid action'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,99151));
  if operation='save' then
    if exists(select 1 from jsonb_object_keys(p_action) k where k<>all(array['action','kind','id','saved'])) then
      raise exception using errcode='22023',message='Invalid fields'; end if;
    target:=(p_action->>'id')::uuid; item_kind:=p_action->>'kind';
    if item_kind not in ('venue','dish') or target is null or jsonb_typeof(p_action->'saved') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Invalid saved item'; end if;
    if (p_action->>'saved')::boolean then
      if not exists(select 1 from public.venues v where v.status='published' and v.ownership_verified_at is not null
        and ((item_kind='venue' and v.id=target) or (item_kind='dish' and exists(
          select 1 from public.venue_dishes d where d.id=target and d.venue_id=v.id and d.is_available)))) then
        raise exception using errcode='FG404',message='Published item unavailable'; end if;
      if (select count(*) from private.saved_items where user_id=actor and kind=item_kind)>=100
        and not exists(select 1 from private.saved_items where user_id=actor and kind=item_kind and target_id=target) then
        raise exception using errcode='FG429',message='Collection limit reached'; end if;
      insert into private.saved_items(user_id,kind,target_id) values(actor,item_kind,target) on conflict do nothing;
    else delete from private.saved_items where user_id=actor and kind=item_kind and target_id=target;
    end if;
  elsif operation='redeem' then
    if exists(select 1 from jsonb_object_keys(p_action) k where k<>all(array['action','code'])) then
      raise exception using errcode='22023',message='Invalid fields'; end if;
    if not (p_action->>'code' ~ '^[a-f0-9]{32}$') then raise exception using errcode='22023',message='Invalid code'; end if;
    select * into proof from private.exploration_codes where token_hash=md5(p_action->>'code') and expires_at>now();
    if not found then raise exception using errcode='FG404',message='Code expired or unavailable'; end if;
    select * into venue from public.venues where id=proof.venue_id and status='published' and ownership_verified_at is not null and game_enabled;
    if not found or exists(select 1 from public.organization_members where organization_id=venue.organization_id and user_id=actor)
      then raise exception using errcode='42501',message='Customer visit required'; end if;
    if not exists(select 1 from public.organization_members where organization_id=venue.organization_id and user_id=proof.issuer and role in ('owner','manager')) then
      raise exception using errcode='FG404',message='Code issuer no longer authorised'; end if;
    item_kind:=case when proof.dish_id is null then 'venue' else 'dish' end;
    target:=coalesce(proof.dish_id,proof.venue_id);
    if exists(select 1 from private.exploration_receipts where user_id=actor and kind=item_kind and target_id=target) then
      return jsonb_build_object('ok',true,'points',0,'alreadyCollected',true); end if;
    if (select count(*) from private.exploration_receipts where user_id=actor and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then
      raise exception using errcode='FG429',message='Daily discovery limit reached'; end if;
    if proof.dish_id is null then
      insert into public.check_ins(user_id,venue_id,verification_method,idempotency_key)
      values(actor,venue.id,'staff_confirmation',proof.id) returning id into visit;
      awarded:=50;
      insert into public.reward_events(user_id,points,source_type,source_id) values(actor,awarded,'venue_visit',visit);
    else
      select * into dish from public.venue_dishes where id=proof.dish_id and venue_id=venue.id and is_available for update;
      if not found then raise exception using errcode='FG404',message='Dish unavailable'; end if;
      if dish.canonical_food_id is null then
        insert into public.canonical_foods(slug,name,cuisine) values('dish-'||dish.id,dish.name,venue.cuisine) returning id into dish.canonical_food_id;
        update public.venue_dishes set canonical_food_id=dish.canonical_food_id where id=dish.id;
      end if;
      select id into visit from public.check_ins where user_id=actor and venue_id=venue.id order by verified_at desc limit 1;
      insert into public.food_discoveries(user_id,venue_id,venue_dish_id,canonical_food_id,check_in_id,verification_method,idempotency_key)
      values(actor,venue.id,dish.id,dish.canonical_food_id,visit,'staff_confirmation',proof.id) returning id into discovery;
      awarded:=100;
      insert into public.reward_events(user_id,points,source_type,source_id) values(actor,awarded,'dish_discovery',discovery);
    end if;
    insert into private.exploration_receipts(user_id,kind,target_id,evidence_id) values(actor,item_kind,target,proof.id);
    if (select count(distinct venue_id) from public.check_ins where user_id=actor)>=3 then
      insert into public.reward_events(user_id,points,source_type,source_id)
      values(actor,100,'quest_completion','00000000-0000-4000-8000-000000000003') on conflict do nothing;
    end if;
    return jsonb_build_object('ok',true,'points',awarded,'alreadyCollected',false);
  elsif operation='account' then
    if p_action->>'accountType' not in ('explorer','partner') or
      exists(select 1 from jsonb_object_keys(p_action) k where k<>all(array['action','accountType'])) then
      raise exception using errcode='22023',message='Invalid account type'; end if;
    update public.profiles set account_type=p_action->>'accountType' where id=actor;
  elsif operation is distinct from 'read' then raise exception using errcode='22023',message='Unknown action';
  end if;
  select jsonb_build_object('ok',true,'accountType',p.account_type,'displayName',p.display_name,'progress',public.food_go_game_profile(),
    'savedVenues',coalesce((select jsonb_agg(target_id order by created_at desc) from private.saved_items where user_id=actor and kind='venue'),'[]'::jsonb),
    'savedDishes',coalesce((select jsonb_agg(target_id order by created_at desc) from private.saved_items where user_id=actor and kind='dish'),'[]'::jsonb),
    'visits',coalesce((select jsonb_agg(x) from (select distinct on (c.venue_id) c.venue_id as id,v.name,v.suburb,c.verified_at as at
      from public.check_ins c join public.venues v on v.id=c.venue_id where c.user_id=actor order by c.venue_id,c.verified_at desc limit 500)x),'[]'::jsonb),
    'discoveries',coalesce((select jsonb_agg(x) from (select distinct on (d.venue_dish_id) d.venue_dish_id as id,vd.name,v.name as venue,v.cuisine,d.verified_at as at
      from public.food_discoveries d join public.venue_dishes vd on vd.id=d.venue_dish_id join public.venues v on v.id=d.venue_id
      where d.user_id=actor order by d.venue_dish_id,d.verified_at desc limit 500)x),'[]'::jsonb))
    into result from public.profiles p where p.id=actor;
  return result;
end;
$$;
revoke all on function private.customer_journey(jsonb) from public,anon,authenticated;
create function public.food_go_customer_journey(p_action jsonb default '{"action":"read"}') returns jsonb
language sql security invoker set search_path='' as $$select private.customer_journey(p_action);$$;
revoke all on function public.food_go_customer_journey(jsonb) from public,anon,authenticated;
grant execute on function private.customer_journey(jsonb),public.food_go_customer_journey(jsonb) to authenticated;

-- Preserve social eligibility and add verified exploration to the same progression.
alter function public.food_go_game_profile() rename to food_go_social_game_profile;
revoke all on function public.food_go_social_game_profile() from public,anon,authenticated;
create function public.food_go_game_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); social jsonb; total bigint;
begin
  social:=public.food_go_social_game_profile();
  select (social->>'xp')::bigint+coalesce(sum(points),0) into total from public.reward_events where user_id=actor;
  return social || jsonb_build_object('xp',total,'level',1+total/250,'nextLevelXp',(1+total/250)*250);
end;
$$;
revoke all on function public.food_go_game_profile() from public,anon,authenticated;
grant execute on function public.food_go_game_profile() to authenticated;

create function private.partner_workspace(p_action jsonb) returns jsonb
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
    when 'promo' then array['action','venueId','id','title','description','startsAt','endsAt']
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
    if venue.status<>'published' or venue.ownership_verified_at is null then raise exception using errcode='FG409',message='Published venue required'; end if;
    select * into existing_promo from public.promotions where id=(p_action->>'id')::uuid for update;
    if found then
      if existing_promo.venue_id<>target or existing_promo.title is distinct from btrim(p_action->>'title')
        or existing_promo.description is distinct from btrim(p_action->>'description')
        or existing_promo.starts_at is distinct from (p_action->>'startsAt')::timestamptz
        or existing_promo.ends_at is distinct from (p_action->>'endsAt')::timestamptz then
        raise exception using errcode='FG409',message='Offer already submitted'; end if;
    else
    if not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400) then
      raise exception using errcode='22023',message='Invalid offer'; end if;
    if (select count(*) from public.promotions where venue_id=target and created_at>now()-interval '1 day')>=20 then raise exception using errcode='FG429',message='Daily offer limit reached'; end if;
    insert into public.promotions(id,venue_id,title,description,starts_at,ends_at)
    values((p_action->>'id')::uuid,target,btrim(p_action->>'title'),btrim(p_action->>'description'),(p_action->>'startsAt')::timestamptz,(p_action->>'endsAt')::timestamptz);
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
create function public.food_go_partner_workspace(p_action jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.partner_workspace(p_action);$$;
revoke all on function public.food_go_partner_workspace(jsonb) from public,anon,authenticated;
grant execute on function private.partner_workspace(jsonb),public.food_go_partner_workspace(jsonb) to authenticated;

commit;

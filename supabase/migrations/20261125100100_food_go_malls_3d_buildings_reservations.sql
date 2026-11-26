-- Stage 1 Malls, Multi-Restaurant Buildings, 3D Building Presets, Location Proposals & Zero-Payment Reservations
begin;

-- Expand allowed venue_type values for bakery & food_truck alongside existing restaurant/cafe/market.
alter table public.venues drop constraint if exists venues_venue_type_check;
alter table public.venues add constraint venues_venue_type_check
  check (venue_type in ('restaurant', 'cafe', 'market', 'bakery', 'food_truck'));

-- Update partner draft RPC so bakery and food_truck drafts can also be submitted cleanly.
create or replace function public.food_go_create_venue_draft(p_draft jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  normalized jsonb;
  request_hash text;
  previous private.venue_draft_requests%rowtype;
  result public.venues%rowtype;
  organization uuid;
  venue uuid := gen_random_uuid();
  field text;
  venue_slug text;
begin
  if actor is null or (select auth.role()) is distinct from 'authenticated'
    or not exists (select 1 from auth.users u where u.id = actor and (
      u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$')
    )) then
    raise exception using errcode = '42501', message = 'A confirmed account is required';
  end if;
  if p_idempotency_key is null or p_draft is null
    or jsonb_typeof(p_draft) is distinct from 'object'
    or octet_length(p_draft::text) > 16384 then
    raise exception using errcode = '22023', message = 'Invalid venue draft';
  end if;
  if (select count(*) from jsonb_object_keys(p_draft)) <> 12
    or exists (select 1 from jsonb_object_keys(p_draft) as k(key) where k.key <> all(array[
      'name','email','phone','address','suburb','state','postcode','cuisine',
      'venueType','description','gameEnabled','acceptedTerms']))
    or jsonb_typeof(p_draft -> 'gameEnabled') is distinct from 'boolean'
    or p_draft -> 'acceptedTerms' is distinct from 'true'::jsonb then
    raise exception using errcode = '22023', message = 'Invalid venue draft fields';
  end if;
  normalized := p_draft;
  foreach field in array array['name','email','phone','address','suburb','state','postcode','cuisine','venueType','description'] loop
    if jsonb_typeof(p_draft -> field) is distinct from 'string' then
      raise exception using errcode = '22023', message = 'Venue fields must be text';
    end if;
    normalized := jsonb_set(normalized, array[field], to_jsonb(btrim(p_draft ->> field)));
  end loop;
  normalized := jsonb_set(normalized, '{email}', to_jsonb(lower(normalized ->> 'email')));
  if not private.partner_text_valid(normalized ->> 'name', 2, 120)
    or not private.partner_text_valid(normalized ->> 'address', 5, 200)
    or not private.partner_text_valid(normalized ->> 'suburb', 2, 100)
    or not private.partner_text_valid(normalized ->> 'cuisine', 2, 60)
    or not private.partner_text_valid(normalized ->> 'description', 20, 1000)
    or not private.partner_text_valid(normalized ->> 'email', 3, 254)
    or (normalized ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized ->> 'phone') not between 8 and 24
    or (normalized ->> 'phone') !~ '^\+?[0-9 ()-]+$'
    or char_length(regexp_replace(normalized ->> 'phone', '[^0-9]', '', 'g')) not between 8 and 15
    or (normalized ->> 'postcode') !~ '^[0-9]{4}$'
    or (normalized ->> 'state') <> all(array['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'])
    or (normalized ->> 'venueType') <> all(array['restaurant','cafe','market','bakery','food_truck']) then
    raise exception using errcode = '22023', message = 'Invalid venue details';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  request_hash := encode(sha256(convert_to(normalized::text, 'UTF8')), 'hex');
  select * into previous from private.venue_draft_requests r
    where r.user_id = actor and r.idempotency_key = p_idempotency_key;
  if found then
    if previous.request_hash <> request_hash then
      raise exception using errcode = 'FG003', message = 'Submission key already used';
    end if;
    select * into result from public.venues v where v.id = previous.venue_id;
    if not found or not private.can_manage_organization(result.organization_id) then
      raise exception using errcode = '42501', message = 'Venue access is no longer available';
    end if;
  else
    if exists (select 1 from public.venues v join public.organization_members m
      on m.organization_id = v.organization_id where m.user_id = actor
      and lower(regexp_replace(v.name, '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(normalized ->> 'name', '[[:space:]]+', ' ', 'g'))
      and lower(regexp_replace(v.address, '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(normalized ->> 'address', '[[:space:]]+', ' ', 'g'))
      and lower(v.suburb) = lower(normalized ->> 'suburb')
      and v.state = normalized ->> 'state' and v.postcode = normalized ->> 'postcode') then
      raise exception using errcode = 'FG001', message = 'Venue already belongs to this account';
    end if;
    if (select count(*) from private.venue_draft_requests r where r.user_id = actor) >= 5 then
      raise exception using errcode = 'FG002', message = 'Venue creation limit reached';
    end if;
    insert into public.organizations(name) values (normalized ->> 'name') returning id into organization;
    insert into public.organization_members(organization_id, user_id, role) values (organization, actor, 'owner');
    venue_slug := trim(both '-' from left(trim(both '-' from regexp_replace(lower(normalized ->> 'name'), '[^a-z0-9]+', '-', 'g')), 100));
    if venue_slug = '' then venue_slug := 'venue'; end if;
    insert into public.venues(id, organization_id, slug, name, description, venue_type, cuisine,
      address, suburb, state, postcode, timezone, status, game_enabled)
    values (venue, organization, venue_slug || '-' || venue::text,
      normalized ->> 'name', normalized ->> 'description', normalized ->> 'venueType', normalized ->> 'cuisine',
      normalized ->> 'address', normalized ->> 'suburb', normalized ->> 'state', normalized ->> 'postcode',
      case normalized ->> 'state' when 'VIC' then 'Australia/Melbourne' when 'NT' then 'Australia/Darwin'
        when 'QLD' then 'Australia/Brisbane' when 'SA' then 'Australia/Adelaide' when 'TAS' then 'Australia/Hobart'
        when 'WA' then 'Australia/Perth' else 'Australia/Sydney' end,
      'draft', (normalized ->> 'gameEnabled')::boolean) returning * into result;
    insert into public.venue_contacts(venue_id, email, phone)
      values (venue, normalized ->> 'email', normalized ->> 'phone');
    insert into private.venue_draft_requests(user_id, idempotency_key, request_hash, venue_id)
      values (actor, p_idempotency_key, request_hash, venue);
  end if;
  return jsonb_build_object('id', result.id, 'name', result.name, 'suburb', result.suburb,
    'state', result.state, 'status', result.status, 'created_at', result.created_at,
    'updated_at', result.updated_at, 'ownership_verified_at', result.ownership_verified_at);
end;
$$;

-- Public malls & multi-restaurant complexes inside the Melbourne Pilot zone.
create table public.malls (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  address text not null check (char_length(btrim(address)) between 5 and 200),
  suburb text not null default 'Melbourne' check (char_length(btrim(suburb)) between 2 and 100),
  state text not null default 'VIC' check (state in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')),
  postcode text not null default '3000' check (postcode ~ '^[0-9]{4}$'),
  latitude double precision not null check (latitude between -85.05112877980659 and 85.05112877980659),
  longitude double precision not null check (longitude between -180 and 180),
  entrance_description text not null default 'Main street entrance' check (char_length(btrim(entrance_description)) between 2 and 180),
  model_preset text not null default 'city-mall' check (model_preset in ('city-mall','arcade-heritage','urban-precinct','skyline-complex')),
  floors jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('pending','published','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger malls_updated_at before update on public.malls
  for each row execute function private.touch_updated_at();

alter table public.malls enable row level security;
revoke all on table public.malls from public, anon, authenticated;
create policy malls_read_published on public.malls for select to anon, authenticated
  using (status = 'published');
grant select (id, slug, name, address, suburb, state, postcode, latitude, longitude, entrance_description, model_preset, floors, status, created_at, updated_at)
  on public.malls to anon, authenticated;
grant all on table public.malls to service_role;

-- Seed real Melbourne CBD shopping centres inside FoodGo_Melbourne_Pilot.geojson.
insert into public.malls (id, slug, name, address, suburb, state, postcode, latitude, longitude, entrance_description, model_preset, floors, status)
values
  (
    '11111111-1111-4111-8111-111111111001'::uuid,
    'melbourne-central',
    'Melbourne Central',
    '211 La Trobe St',
    'Melbourne',
    'VIC',
    '3000',
    -37.8102,
    144.9628,
    'La Trobe St and Swanston St concourse entrance',
    'city-mall',
    '[
      {"id":"lg","code":"LG","name":"Lower Ground","description":"Food hall, quick bites and train station dining"},
      {"id":"g","code":"G","name":"Ground Floor","description":"Street-level cafes, laneway bakeries and grab-and-go"},
      {"id":"l1","code":"L1","name":"Level 1","description":"Casual dining and specialty dessert counters"},
      {"id":"l2","code":"L2","name":"Level 2","description":"Dining Hall and full-service restaurants"},
      {"id":"l3","code":"L3","name":"Level 3","description":"Terrace restaurants and evening kitchens"}
    ]'::jsonb,
    'published'
  ),
  (
    '11111111-1111-4111-8111-111111111002'::uuid,
    'qv-melbourne',
    'QV Melbourne',
    '292 Swanston St',
    'Melbourne',
    'VIC',
    '3000',
    -37.8108,
    144.9652,
    'Swanston St and Lonsdale St open-air lane entrance',
    'urban-precinct',
    '[
      {"id":"b1","code":"B1","name":"Basement Food Hall","description":"Asian eateries, noodle bars and market grocers"},
      {"id":"g","code":"G","name":"Ground Square","description":"Outdoor plaza cafes and artisan bakeries"},
      {"id":"l1","code":"L1","name":"Level 1","description":"Boutique bistros and dessert bars"},
      {"id":"l2","code":"L2","name":"Level 2","description":"Rooftop hospitality and group dining"}
    ]'::jsonb,
    'published'
  ),
  (
    '11111111-1111-4111-8111-111111111003'::uuid,
    'emporium-melbourne',
    'Emporium Melbourne',
    '287 Lonsdale St',
    'Melbourne',
    'VIC',
    '3000',
    -37.8124,
    144.9638,
    'Lonsdale St and Little Bourke St arcade entrance',
    'skyline-complex',
    '[
      {"id":"lg","code":"LG","name":"Lower Ground","description":"Cafe Court and specialty patisseries"},
      {"id":"g","code":"G","name":"Ground Floor","description":"Flagship espresso bars and chocolatiers"},
      {"id":"l3","code":"L3","name":"Level 3 Cafe Court","description":"Elevated multi-kitchen food court and dining terrace"}
    ]'::jsonb,
    'published'
  ),
  (
    '11111111-1111-4111-8111-111111111004'::uuid,
    'the-block-arcade',
    'The Block Arcade',
    '282 Collins St',
    'Melbourne',
    'VIC',
    '3000',
    -37.8157,
    144.9647,
    'Collins St and Elizabeth St heritage mosaic archway',
    'arcade-heritage',
    '[
      {"id":"g","code":"G","name":"Ground Arcade","description":"Historic tea rooms, patisseries and cellar cafes"},
      {"id":"l1","code":"L1","name":"Level 1 Mezzanine","description":"Private dining rooms and specialty roasters"}
    ]'::jsonb,
    'published'
  )
on conflict (id) do nothing;

-- Extend venues & venue_dishes with approved 3D building style, mall slot, imagery and zero-payment reservation settings.
alter table public.venues
  add column if not exists cover_image_url text,
  add column if not exists building_preset text not null default 'isometric-cafe'
    check (building_preset in ('isometric-cafe','japanese-bakery','kyoto-restaurant','stylized-food-truck','city-bistro','mall-unit')),
  add column if not exists building_accent_colour text not null default '#00c49a'
    check (building_accent_colour ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists building_signage text check (building_signage is null or char_length(btrim(building_signage)) <= 40),
  add column if not exists building_review_status text not null default 'approved'
    check (building_review_status in ('draft','pending','approved','rejected')),
  add column if not exists mall_id uuid references public.malls(id) on delete set null,
  add column if not exists mall_floor text check (mall_floor is null or char_length(btrim(mall_floor)) <= 24),
  add column if not exists mall_unit text check (mall_unit is null or char_length(btrim(mall_unit)) <= 40),
  add column if not exists reservations_enabled boolean not null default true,
  add column if not exists reservation_notes text check (reservation_notes is null or char_length(btrim(reservation_notes)) <= 300);

create index if not exists venues_mall_idx on public.venues(mall_id, mall_floor) where mall_id is not null;

alter table public.venue_dishes
  add column if not exists image_url text;

-- Ensure public & authenticated readers can select the new presentation columns.
grant select (cover_image_url, building_preset, building_accent_colour, building_signage, building_review_status, mall_id, mall_floor, mall_unit, reservations_enabled, reservation_notes)
  on public.venues to anon, authenticated;
grant select (image_url) on public.venue_dishes to anon, authenticated;

-- Private table storing pending/reviewed owner proposals for 3D buildings, mall placement and pin coordinates.
create table private.venue_building_proposals (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  proposed_latitude double precision check (proposed_latitude is null or (proposed_latitude between -38.05 and -37.65)),
  proposed_longitude double precision check (proposed_longitude is null or (proposed_longitude between 144.80 and 145.15)),
  proposed_mall_id uuid references public.malls(id) on delete set null,
  proposed_floor text check (proposed_floor is null or char_length(btrim(proposed_floor)) <= 24),
  proposed_unit text check (proposed_unit is null or char_length(btrim(proposed_unit)) <= 40),
  proposed_building_preset text not null default 'isometric-cafe'
    check (proposed_building_preset in ('isometric-cafe','japanese-bakery','kyoto-restaurant','stylized-food-truck','city-bistro','mall-unit')),
  proposed_accent_colour text not null default '#00c49a' check (proposed_accent_colour ~ '^#[0-9a-fA-F]{6}$'),
  proposed_signage text check (proposed_signage is null or char_length(btrim(proposed_signage)) <= 40),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 300),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
alter table private.venue_building_proposals enable row level security;
revoke all on table private.venue_building_proposals from public, anon, authenticated;

-- Public read-only function returning published malls with approved published venues grouped cleanly.
create function public.food_go_malls()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'slug', m.slug,
    'name', m.name,
    'address', m.address,
    'suburb', m.suburb,
    'state', m.state,
    'postcode', m.postcode,
    'coordinates', jsonb_build_object('latitude', m.latitude, 'longitude', m.longitude),
    'entranceDescription', m.entrance_description,
    'modelPreset', m.model_preset,
    'floors', m.floors,
    'shopCount', (select count(*) from public.venues v where v.mall_id = m.id and v.status = 'published' and v.ownership_verified_at is not null),
    'shops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'slug', v.slug,
        'name', v.name,
        'venueType', v.venue_type,
        'cuisine', v.cuisine,
        'floor', coalesce(v.mall_floor, 'G'),
        'unit', coalesce(v.mall_unit, ''),
        'buildingPreset', v.building_preset,
        'coverImageUrl', v.cover_image_url,
        'reservationsEnabled', v.reservations_enabled
      ) order by v.mall_floor, v.name)
      from public.venues v
      where v.mall_id = m.id and v.status = 'published' and v.ownership_verified_at is not null
    ), '[]'::jsonb)
  ) order by m.name), '[]'::jsonb)
  from public.malls m
  where m.status = 'published';
$$;
revoke all on function public.food_go_malls() from public, anon, authenticated;
grant execute on function public.food_go_malls() to anon, authenticated;

-- Zero-payment Table Reservations (Customer request -> Restaurant owner approve/decline/complete).
create table private.venue_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  reserved_for timestamptz not null check (isfinite(reserved_for)),
  party_size integer not null check (party_size between 1 and 20),
  guest_name text not null check (char_length(btrim(guest_name)) between 2 and 80),
  guest_contact text check (guest_contact is null or char_length(btrim(guest_contact)) <= 80),
  notes text check (notes is null or char_length(btrim(notes)) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled','completed')),
  decision_note text check (decision_note is null or char_length(btrim(decision_note)) <= 240),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index venue_reservations_user_idx on private.venue_reservations(user_id, reserved_for desc);
create index venue_reservations_venue_idx on private.venue_reservations(venue_id, status, reserved_for asc);
create trigger venue_reservations_updated_at before update on private.venue_reservations
  for each row execute function private.touch_updated_at();

alter table private.venue_reservations enable row level security;
revoke all on table private.venue_reservations from public, anon, authenticated;

create function private.customer_reservation(p_action jsonb default '{"action":"list"}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  operation text := coalesce(p_action->>'action', 'list');
  target_id uuid;
  venue public.venues%rowtype;
  booking private.venue_reservations%rowtype;
  reserved_at timestamptz;
  guests integer;
  gname text;
  gcontact text;
  gnotes text;
  created_id uuid;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 4096 then
    raise exception using errcode = '22023', message = 'Invalid reservation request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 73109));

  if operation = 'create' then
    target_id := (p_action->>'venueId')::uuid;
    reserved_at := (p_action->>'reservedFor')::timestamptz;
    guests := (p_action->>'partySize')::integer;
    gname := btrim(coalesce(p_action->>'guestName', ''));
    gcontact := nullif(btrim(coalesce(p_action->>'guestContact', '')), '');
    gnotes := nullif(btrim(coalesce(p_action->>'notes', '')), '');

    select * into venue from public.venues
      where id = target_id and status = 'published' and ownership_verified_at is not null;
    if not found then raise exception using errcode = 'FG404', message = 'Published venue unavailable'; end if;
    if not venue.reservations_enabled then raise exception using errcode = 'FG409', message = 'Reservations are closed for this venue'; end if;
    if exists(select 1 from public.organization_members m where m.organization_id = venue.organization_id and m.user_id = actor) then
      raise exception using errcode = '42501', message = 'Owners cannot book their own restaurant';
    end if;
    if reserved_at is null or reserved_at <= clock_timestamp() or reserved_at > clock_timestamp() + interval '60 days'
      or guests is null or guests not between 1 and 20 or char_length(gname) not between 2 and 80 then
      raise exception using errcode = '22023', message = 'Check the date, time, guest name and party size';
    end if;
    if (select count(*) from private.venue_reservations where user_id = actor and status in ('pending','approved') and reserved_for > clock_timestamp()) >= 10 then
      raise exception using errcode = 'FG429', message = 'You already have ten upcoming table requests';
    end if;

    insert into private.venue_reservations(user_id, venue_id, reserved_for, party_size, guest_name, guest_contact, notes)
    values (actor, venue.id, reserved_at, guests, gname, gcontact, gnotes)
    returning id into created_id;
  elsif operation = 'cancel' then
    target_id := (p_action->>'reservationId')::uuid;
    select * into booking from private.venue_reservations where id = target_id and user_id = actor for update;
    if not found then raise exception using errcode = 'FG404', message = 'Reservation unavailable'; end if;
    if booking.status not in ('pending','approved') then raise exception using errcode = 'FG409', message = 'This reservation cannot be cancelled'; end if;
    update private.venue_reservations set status = 'cancelled', decision_note = 'Cancelled by guest' where id = booking.id;
  elsif operation <> 'list' then
    raise exception using errcode = '22023', message = 'Unknown reservation action';
  end if;

  return jsonb_build_object(
    'ok', true,
    'createdId', created_id,
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'venueId', r.venue_id,
        'venueName', v.name,
        'venueSlug', v.slug,
        'suburb', v.suburb,
        'reservedFor', r.reserved_for,
        'partySize', r.party_size,
        'guestName', r.guest_name,
        'notes', r.notes,
        'status', r.status,
        'decisionNote', r.decision_note,
        'createdAt', r.created_at
      ) order by r.reserved_for desc)
      from private.venue_reservations r
      join public.venues v on v.id = r.venue_id
      where r.user_id = actor
      limit 100
    ), '[]'::jsonb)
  );
end;
$$;
create function public.food_go_customer_reservations(p_action jsonb default '{"action":"list"}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.customer_reservation(p_action); $$;
revoke all on function private.customer_reservation(jsonb), public.food_go_customer_reservations(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_customer_reservations(jsonb) to authenticated;

create function private.partner_reservation(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  operation text := coalesce(p_action->>'action', 'list');
  target_venue uuid := (p_action->>'venueId')::uuid;
  target_res uuid;
  booking private.venue_reservations%rowtype;
  venue public.venues%rowtype;
  next_status text;
  note text;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid request';
  end if;
  select * into venue from public.venues v
    where v.id = target_venue
      and exists(select 1 from public.organization_members m where m.organization_id = v.organization_id and m.user_id = actor and m.role in ('owner','manager'));
  if not found then raise exception using errcode = '42501', message = 'Restaurant manager required'; end if;

  if operation = 'decide' then
    target_res := (p_action->>'reservationId')::uuid;
    next_status := p_action->>'status';
    note := nullif(btrim(coalesce(p_action->>'decisionNote', '')), '');
    if next_status not in ('approved','declined','completed') then
      raise exception using errcode = '22023', message = 'Choose approved, declined or completed';
    end if;
    select * into booking from private.venue_reservations where id = target_res and venue_id = venue.id for update;
    if not found then raise exception using errcode = 'FG404', message = 'Reservation unavailable'; end if;
    if next_status in ('approved','declined') and booking.status <> 'pending' then
      raise exception using errcode = 'FG409', message = 'Only pending reservations can be approved or declined';
    end if;
    if next_status = 'completed' and booking.status <> 'approved' then
      raise exception using errcode = 'FG409', message = 'Approve the booking before completing it';
    end if;
    update private.venue_reservations
      set status = next_status, decision_note = note, decided_by = actor, decided_at = clock_timestamp()
      where id = booking.id;
  elsif operation = 'settings' then
    if jsonb_typeof(p_action->'reservationsEnabled') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Provide reservations setting';
    end if;
    update public.venues
      set reservations_enabled = (p_action->>'reservationsEnabled')::boolean,
          reservation_notes = nullif(btrim(coalesce(p_action->>'reservationNotes', '')), '')
      where id = venue.id;
  elsif operation <> 'list' then
    raise exception using errcode = '22023', message = 'Unknown reservation action';
  end if;

  return jsonb_build_object(
    'ok', true,
    'reservationsEnabled', coalesce((select v.reservations_enabled from public.venues v where v.id = venue.id), true),
    'reservationNotes', (select v.reservation_notes from public.venues v where v.id = venue.id),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'guestName', r.guest_name,
        'guestContact', r.guest_contact,
        'partySize', r.party_size,
        'reservedFor', r.reserved_for,
        'notes', r.notes,
        'status', r.status,
        'decisionNote', r.decision_note,
        'createdAt', r.created_at
      ) order by (r.status = 'pending') desc, r.reserved_for asc)
      from private.venue_reservations r
      where r.venue_id = venue.id
      limit 150
    ), '[]'::jsonb)
  );
end;
$$;
create function public.food_go_partner_reservations(p_action jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.partner_reservation(p_action); $$;
revoke all on function private.partner_reservation(jsonb), public.food_go_partner_reservations(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_partner_reservations(jsonb) to authenticated;

commit;

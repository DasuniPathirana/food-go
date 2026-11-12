-- Food Go foundation. Apply to a dedicated Supabase project.
-- This migration is source code, not evidence of a provisioned or tested database.
begin;

-- This is a first-install migration. Never adapt an existing application's
-- private schema, storage bucket or PostGIS installation by overwriting it.
-- Run supabase/preflight.sql and review its results before applying this file.
do $food_go_preflight$
declare
  postgis_schema text;
begin
  if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null
    or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.role()') is null then
    raise exception 'Food Go requires a Supabase database with auth and storage installed';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'private') then
    raise exception 'The private schema already exists. Stop and review the target before installing Food Go';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any (array[
      'profiles', 'organizations', 'organization_members', 'venues', 'venue_contacts',
      'canonical_foods', 'venue_dishes', 'check_ins', 'food_discoveries', 'reward_events'
    ])
  ) then
    raise exception 'A Food Go relation name already exists. Stop and review the target before installing';
  end if;
  select n.nspname into postgis_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis';
  if postgis_schema is not null and postgis_schema <> 'extensions' then
    raise exception 'PostGIS is installed outside extensions. Review a compatible migration without moving or dropping it';
  end if;
  if exists (select 1 from storage.buckets where id = 'food-go-venue-media') then
    raise exception 'The Food Go storage bucket already exists. Stop and review it before installing';
  end if;
end;
$food_go_preflight$;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id, organization_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  venue_type text not null check (venue_type in ('restaurant', 'cafe', 'market')),
  cuisine text not null check (char_length(trim(cuisine)) between 2 and 60),
  address text not null check (char_length(trim(address)) between 5 and 200),
  suburb text not null check (char_length(trim(suburb)) between 2 and 100),
  state text not null check (state in ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA')),
  postcode text not null check (postcode ~ '^[0-9]{4}$'),
  timezone text not null default 'Australia/Sydney' check (timezone in (
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide',
    'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin', 'Australia/Lord_Howe',
    'Australia/Broken_Hill', 'Australia/Lindeman', 'Australia/Eucla'
  )),
  latitude double precision,
  longitude double precision,
  location extensions.geography(point, 4326) generated always as (
    case when latitude is not null and longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
      else null end
  ) stored,
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'suspended')),
  ownership_verified_at timestamptz,
  game_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_location_pair check ((latitude is null) = (longitude is null)),
  constraint venues_latitude_range check (latitude between -90 and 90),
  constraint venues_longitude_range check (longitude between -180 and 180),
  constraint venues_published_verified check (status <> 'published' or ownership_verified_at is not null)
);
create index venues_organization_idx on public.venues(organization_id);
create index venues_published_location_idx on public.venues using gist(location)
  where status = 'published' and ownership_verified_at is not null;
create index venues_discovery_idx on public.venues(state, suburb, cuisine)
  where status = 'published' and ownership_verified_at is not null;

-- Contact details and verification evidence are private, never part of a public venue row.
create table public.venue_contacts (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 8 and 24),
  updated_at timestamptz not null default now()
);

create table public.canonical_foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  cuisine text not null check (char_length(trim(cuisine)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.venue_dishes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  canonical_food_id uuid references public.canonical_foods(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  price_aud_cents integer check (price_aud_cents >= 0 and price_aud_cents <= 1000000),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id, canonical_food_id)
);
create index venue_dishes_venue_idx on public.venue_dishes(venue_id);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete restrict,
  verification_method text not null check (verification_method in ('signed_qr', 'staff_confirmation')),
  idempotency_key uuid not null,
  verified_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (id, user_id, venue_id)
);
create index check_ins_user_history_idx on public.check_ins(user_id, verified_at desc);
create index check_ins_venue_idx on public.check_ins(venue_id, verified_at desc);

create table public.food_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete restrict,
  venue_dish_id uuid not null,
  canonical_food_id uuid not null references public.canonical_foods(id) on delete restrict,
  check_in_id uuid,
  verification_method text not null check (verification_method in ('staff_confirmation', 'dish_redemption', 'transaction')),
  idempotency_key uuid not null,
  verified_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (venue_dish_id, venue_id, canonical_food_id)
    references public.venue_dishes(id, venue_id, canonical_food_id) on delete restrict,
  foreign key (check_in_id, user_id, venue_id)
    references public.check_ins(id, user_id, venue_id) on delete restrict
);
create index food_discoveries_user_history_idx on public.food_discoveries(user_id, verified_at desc);

create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points between 1 and 10000),
  source_type text not null check (source_type in ('venue_visit', 'dish_discovery', 'quest_completion')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);
create index reward_events_user_idx on public.reward_events(user_id, created_at desc);

-- Fixed-search-path helpers avoid recursive membership policies and metadata roles.
create function private.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
  );
$$;

create function private.can_manage_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
  );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_organization(uuid) from public, anon, authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated, service_role;
grant execute on function private.can_manage_organization(uuid) to authenticated, service_role;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create function private.recheck_venue_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- A client cannot preserve a verified identity after changing the business identity.
  if (select auth.role()) = 'authenticated' and
    (new.name, new.address, new.suburb, new.state, new.postcode) is distinct from
    (old.name, old.address, old.suburb, old.state, old.postcode) then
    new.status = 'pending';
    new.ownership_verified_at = null;
    new.latitude = null;
    new.longitude = null;
  end if;
  return new;
end;
$$;
revoke all on function private.recheck_venue_identity() from public, anon, authenticated;

create function private.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, case
    when jsonb_typeof(new.raw_user_meta_data -> 'display_name') = 'string'
      and char_length(trim(new.raw_user_meta_data ->> 'display_name')) > 0
    then left(trim(new.raw_user_meta_data ->> 'display_name'), 80)
    else 'Food explorer' end);
  return new;
end;
$$;
revoke all on function private.create_user_profile() from public, anon, authenticated;

create trigger food_go_create_user_profile after insert on auth.users
  for each row execute function private.create_user_profile();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.touch_updated_at();
create trigger venues_recheck_identity before update on public.venues
  for each row execute function private.recheck_venue_identity();
create trigger venues_updated_at before update on public.venues
  for each row execute function private.touch_updated_at();
create trigger venue_contacts_updated_at before update on public.venue_contacts
  for each row execute function private.touch_updated_at();
create trigger venue_dishes_updated_at before update on public.venue_dishes
  for each row execute function private.touch_updated_at();

-- Existing users receive a plain profile, never a role from editable user metadata.
insert into public.profiles(id, display_name)
select id, 'Food explorer' from auth.users on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.venues enable row level security;
alter table public.venue_contacts enable row level security;
alter table public.canonical_foods enable row level security;
alter table public.venue_dishes enable row level security;
alter table public.check_ins enable row level security;
alter table public.food_discoveries enable row level security;
alter table public.reward_events enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_read_member on public.organizations for select to authenticated
  using (private.is_organization_member(id));
create policy organizations_update_manager on public.organizations for update to authenticated
  using (private.can_manage_organization(id)) with check (private.can_manage_organization(id));
create policy members_read_own_or_manager on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_organization(organization_id));

create policy venues_read_public on public.venues for select to anon
  using (status = 'published' and ownership_verified_at is not null);
create policy venues_read_public_or_member on public.venues for select to authenticated
  using ((status = 'published' and ownership_verified_at is not null)
    or private.is_organization_member(organization_id));
create policy venues_update_manager on public.venues for update to authenticated
  using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));

create policy venue_contacts_read_manager on public.venue_contacts for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)));
create policy venue_contacts_update_manager on public.venue_contacts for update to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)))
  with check (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)));

create policy canonical_foods_read_active on public.canonical_foods for select to anon, authenticated
  using (is_active);
create policy dishes_read_public on public.venue_dishes for select to anon
  using (is_available and exists (select 1 from public.venues v where v.id = venue_id
    and v.status = 'published' and v.ownership_verified_at is not null));
create policy dishes_read_public_or_member on public.venue_dishes for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and
    ((is_available and v.status = 'published' and v.ownership_verified_at is not null)
      or private.is_organization_member(v.organization_id))));
create policy dishes_insert_manager on public.venue_dishes for insert to authenticated
  with check (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)));
create policy dishes_update_manager on public.venue_dishes for update to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)))
  with check (exists (select 1 from public.venues v where v.id = venue_id
    and private.can_manage_organization(v.organization_id)));

create policy check_ins_read_own on public.check_ins for select to authenticated
  using (user_id = (select auth.uid()));
create policy discoveries_read_own on public.food_discoveries for select to authenticated
  using (user_id = (select auth.uid()));
create policy rewards_read_own on public.reward_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Start with no client permissions, then allow only intended operations/columns.
-- All ownership, team invitations, publishing, location verification and reward
-- mutations require a separately authenticated and audited server workflow.
revoke all on table public.profiles, public.organizations, public.organization_members,
  public.venues, public.venue_contacts, public.canonical_foods, public.venue_dishes,
  public.check_ins, public.food_discoveries, public.reward_events from public, anon, authenticated;

grant select on public.venues, public.canonical_foods, public.venue_dishes to anon;
grant select on public.profiles, public.organizations, public.organization_members,
  public.venues, public.venue_contacts, public.canonical_foods, public.venue_dishes,
  public.check_ins, public.food_discoveries, public.reward_events to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;
grant update (name) on public.organizations to authenticated;
grant update (name, description, venue_type, cuisine, address, suburb, state, postcode,
  timezone, game_enabled) on public.venues to authenticated;
grant update (email, phone) on public.venue_contacts to authenticated;
grant insert (venue_id, canonical_food_id, name, description, price_aud_cents, is_available)
  on public.venue_dishes to authenticated;
grant update (canonical_food_id, name, description, price_aud_cents, is_available)
  on public.venue_dishes to authenticated;
grant all on table public.profiles, public.organizations, public.organization_members,
  public.venues, public.venue_contacts, public.canonical_foods, public.venue_dishes,
  public.check_ins, public.food_discoveries, public.reward_events to service_role;

-- Keep uploads closed until a scoped upload/signing workflow is implemented.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-go-venue-media', 'food-go-venue-media', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);

commit;

-- Confirmed accounts can create private venue drafts atomically. No service key
-- or user-supplied organisation, membership or verification authority is used.
begin;

create table private.venue_draft_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (char_length(request_hash) = 64),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key),
  unique (venue_id)
);
alter table private.venue_draft_requests enable row level security;
revoke all on table private.venue_draft_requests from public, anon, authenticated;

create function private.partner_text_valid(value text, minimum integer, maximum integer)
returns boolean language sql immutable set search_path = '' as $$
  select value is not null and char_length(btrim(value)) between minimum and maximum
    and translate(value, chr(9) || chr(10) || chr(13), '') !~ '[[:cntrl:]]';
$$;
revoke all on function private.partner_text_valid(text, integer, integer) from public, anon, authenticated;

create function public.food_go_create_venue_draft(p_draft jsonb, p_idempotency_key uuid)
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
    or (normalized ->> 'venueType') <> all(array['restaurant','cafe','market']) then
    raise exception using errcode = '22023', message = 'Invalid venue details';
  end if;

  -- Serialise each account's creation, duplicate checks and replay handling.
  -- Limits are enforced here even when a client calls the RPC directly.
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
revoke all on function public.food_go_create_venue_draft(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.food_go_create_venue_draft(jsonb, uuid) to authenticated;

commit;

begin;

-- Private cosmetic exploration. Device assertions are never verified visits and
-- never call the XP, discovery receipt, quest, promotion or reward functions.
create table private.geographic_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version integer check (consent_version=1),
  enabled boolean not null default false,
  consented_at timestamptz,
  last_fix_at timestamptz,
  last_cell_x integer check (last_cell_x between 0 and 262143),
  last_cell_y integer check (last_cell_y between 0 and 262143),
  last_received_at timestamptz,
  last_attempt_at timestamptz,
  sample_day date,
  samples_today integer not null default 0 check (samples_today between 0 and 1000),
  check (not enabled or (consent_version=1 and consented_at is not null)),
  check ((last_cell_x is null)=(last_cell_y is null))
);
create table private.geographic_cells (
  user_id uuid not null references private.geographic_accounts(user_id) on delete cascade,
  x integer not null check (x between 0 and 262143),
  y integer not null check (y between 0 and 262143),
  created_at timestamptz not null default now(),
  primary key(user_id,x,y)
);
create table private.geographic_requests (
  user_id uuid not null references private.geographic_accounts(user_id) on delete cascade,
  request_id uuid not null,
  payload_hash bytea not null,
  accepted boolean not null,
  reason text check (reason in ('accuracy','stale','rapid','travel','capacity')),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id),
  check (accepted=(reason is null))
);
alter table private.geographic_accounts enable row level security;
alter table private.geographic_cells enable row level security;
alter table private.geographic_requests enable row level security;
revoke all on private.geographic_accounts,private.geographic_cells,private.geographic_requests from public,anon,authenticated;

-- Helpers take no authority from client user IDs. Only the checked entry point
-- is executable by authenticated callers; all geometry is derived on the server.
create function private.geographic_cell(lng double precision, lat double precision)
returns table(x integer,y integer) language sql immutable set search_path='' as $$
  select ((floor((lng+180)/360*262144)::bigint % 262144 + 262144) % 262144)::integer,
    least(262143,greatest(0,floor((1-asinh(tan(radians(lat)))/pi())/2*262144)))::integer;
$$;
create function private.geographic_distance(lng1 double precision,lat1 double precision,lng2 double precision,lat2 double precision)
returns double precision language sql immutable set search_path='' as $$
  select 12742017.6*asin(sqrt(least(1.0,greatest(0.0,
    power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)))));
$$;
create function private.geographic_reveal(lng double precision,lat double precision,accuracy double precision)
returns table(x integer,y integer) language sql immutable set search_path='' as $$
  with origin as (select * from private.geographic_cell(lng,lat)), candidates as (
    select ((o.x+dx+262144)%262144)::integer x,(o.y+dy)::integer y,dx*dx+dy*dy centre
    from origin o cross join generate_series(-4,4) dx cross join generate_series(-4,4) dy
    where o.y+dy between 0 and 262143
  ), bounds as (
    select *,x::double precision/262144*360-180 west,(x+1)::double precision/262144*360-180 east,
      degrees(atan(sinh(pi()*(1-2*y::double precision/262144)))) north,
      degrees(atan(sinh(pi()*(1-2*(y+1)::double precision/262144)))) south from candidates
  ), nearest as (
    select *,lng+((west+east)/2-lng)-floor(((west+east)/2-lng+180)/360)*360 middle from bounds
  ), distances as (
    select *,private.geographic_distance(lng,lat,
      least(middle+(east-west)/2,greatest(middle-(east-west)/2,lng)),least(north,greatest(south,lat))) distance
    from nearest
  ) select d.x,d.y from distances d
    where distance<=greatest(0,60-accuracy)+.001 or centre=0
    order by distance,centre,d.y,d.x limit 25;
$$;
create function private.geographic_snapshot(actor uuid, observation jsonb default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ok',true,'version',1,'enabled',coalesce(a.enabled,false),
    'consented',coalesce(a.consent_version=1 and a.consented_at is not null,false),
    'cells',coalesce((select jsonb_agg('wm18:'||c.x||':'||c.y order by c.y,c.x)
      from private.geographic_cells c where c.user_id=actor),'[]'::jsonb),
    'observation',observation,'rewardEligible',false)
  from (select 1) one left join private.geographic_accounts a on a.user_id=actor;
$$;

create function private.geographic_exploration(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); operation text:=p_action->>'action';
  account private.geographic_accounts%rowtype; previous private.geographic_requests%rowtype;
  ticket uuid; fingerprint bytea; lng double precision; lat double precision; uncertainty double precision;
  observed_at timestamptz; received_at timestamptz:=clock_timestamp(); today date;
  cell record; ids text[]; rejection text; extra integer; separation double precision; elapsed double precision;
begin
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>4096
    or jsonb_typeof(p_action->'action') is distinct from 'string' then
    raise exception using errcode='22023',message='Invalid exploration action'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,99154));
  received_at:=clock_timestamp();
  if operation='read' then
    if p_action<>jsonb_build_object('action','read') then raise exception using errcode='22023',message='Invalid fields'; end if;
    return private.geographic_snapshot(actor);
  elsif operation='consent' then
    if exists(select 1 from jsonb_object_keys(p_action) k where k<>all(array['action','version','enabled']))
      or p_action->'version' is distinct from '1'::jsonb or jsonb_typeof(p_action->'enabled') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Review current consent'; end if;
    insert into private.geographic_accounts(user_id) values(actor) on conflict do nothing;
    if (p_action->>'enabled')::boolean then
      update private.geographic_accounts set enabled=true,consent_version=1,consented_at=received_at where user_id=actor;
    else
      update private.geographic_accounts set enabled=false,last_fix_at=null,last_cell_x=null,last_cell_y=null,last_received_at=null where user_id=actor;
    end if;
  elsif operation='clear' then
    if p_action<>jsonb_build_object('action','clear') then raise exception using errcode='22023',message='Invalid fields'; end if;
    delete from private.geographic_cells where user_id=actor;
    delete from private.geographic_requests where user_id=actor;
    -- Keep only abuse counters, so clearing cannot reset the daily/spacing cap.
    update private.geographic_accounts set enabled=false,consent_version=null,consented_at=null,
      last_fix_at=null,last_cell_x=null,last_cell_y=null,last_received_at=null where user_id=actor;
  elsif operation='observe' then
    if exists(select 1 from jsonb_object_keys(p_action) k where k<>all(array['action','requestId','longitude','latitude','accuracy','timestamp']))
      or jsonb_typeof(p_action->'requestId') is distinct from 'string'
      or jsonb_typeof(p_action->'longitude') is distinct from 'number' or (p_action->>'longitude')::numeric not between -180 and 180
      or jsonb_typeof(p_action->'latitude') is distinct from 'number' or (p_action->>'latitude')::numeric not between -85.0511287798066 and 85.0511287798066
      or jsonb_typeof(p_action->'accuracy') is distinct from 'number' or (p_action->>'accuracy')::numeric not between 0 and 100000
      or jsonb_typeof(p_action->'timestamp') is distinct from 'number' or (p_action->>'timestamp')::numeric not between 1 and 4102444800000
      or mod((p_action->>'timestamp')::numeric,1)<>0 then
      raise exception using errcode='22023',message='Invalid device observation'; end if;
    ticket:=(p_action->>'requestId')::uuid;
    lng:=(p_action->>'longitude')::double precision; lat:=(p_action->>'latitude')::double precision;
    uncertainty:=(p_action->>'accuracy')::double precision; observed_at:=to_timestamp((p_action->>'timestamp')::double precision/1000);
    select * into account from private.geographic_accounts where user_id=actor;
    if not found or not account.enabled or account.consent_version is distinct from 1 or account.consented_at is null then
      raise exception using errcode='42501',message='Exploration consent required'; end if;
    -- Hash includes the random id; no raw fix or path is retained in receipts.
    fingerprint:=extensions.digest(p_action::text,'sha256');
    select * into previous from private.geographic_requests where user_id=actor and request_id=ticket;
    if found then
      if previous.payload_hash<>fingerprint then raise exception using errcode='FG409',message='Request changed'; end if;
      return private.geographic_snapshot(actor,jsonb_build_object('accepted',previous.accepted,'reason',previous.reason));
    end if;
    today:=(received_at at time zone 'Australia/Sydney')::date;
    if account.sample_day is distinct from today then account.samples_today:=0; end if;
    if account.samples_today>=1000 then raise exception using errcode='FG429',message='Daily observation limit reached'; end if;
    if uncertainty>35 then rejection:='accuracy';
    elsif observed_at<received_at-interval '15 seconds' or observed_at>received_at+interval '3 seconds'
      or (account.last_fix_at is not null and observed_at<=account.last_fix_at) then rejection:='stale';
    elsif account.last_attempt_at is not null and received_at-account.last_attempt_at<interval '5 seconds' then rejection:='rapid';
    end if;
    select * into cell from private.geographic_cell(lng,lat);
    if rejection is null and account.last_received_at is not null and account.last_cell_x is not null then
      elapsed:=extract(epoch from received_at-account.last_received_at);
      separation:=private.geographic_distance(lng,lat,(account.last_cell_x+.5)/262144*360-180,
        degrees(atan(sinh(pi()*(1-2*(account.last_cell_y+.5)/262144)))));
      if elapsed<300 and separation>greatest(0,elapsed)*8+250 then rejection:='travel'; end if;
    end if;
    if rejection is null then
      select array_agg('wm18:'||r.x||':'||r.y) into ids from private.geographic_reveal(lng,lat,uncertainty) r;
      select count(*) into extra from unnest(ids) id where not exists(select 1 from private.geographic_cells c
        where c.user_id=actor and 'wm18:'||c.x||':'||c.y=id);
      if (select count(*) from private.geographic_cells where user_id=actor)+extra>4096 then rejection:='capacity'; end if;
    end if;
    update private.geographic_accounts set last_attempt_at=received_at,sample_day=today,samples_today=account.samples_today+1 where user_id=actor;
    if rejection is null then
      insert into private.geographic_cells(user_id,x,y)
        select actor,r.x,r.y from private.geographic_reveal(lng,lat,uncertainty) r on conflict do nothing;
      update private.geographic_accounts set last_fix_at=observed_at,last_cell_x=cell.x,last_cell_y=cell.y,last_received_at=received_at where user_id=actor;
    end if;
    -- Lazy two-day receipt retention. Cells remain until explicitly cleared.
    delete from private.geographic_requests where user_id=actor and created_at<received_at-interval '2 days';
    insert into private.geographic_requests(user_id,request_id,payload_hash,accepted,reason,created_at)
      values(actor,ticket,fingerprint,rejection is null,rejection,received_at);
    return private.geographic_snapshot(actor,jsonb_build_object('accepted',rejection is null,'reason',rejection));
  else raise exception using errcode='22023',message='Unknown exploration action';
  end if;
  return private.geographic_snapshot(actor);
end;
$$;
revoke all on function private.geographic_cell(double precision,double precision),
  private.geographic_distance(double precision,double precision,double precision,double precision),
  private.geographic_reveal(double precision,double precision,double precision),
  private.geographic_snapshot(uuid,jsonb),private.geographic_exploration(jsonb) from public,anon,authenticated;
grant execute on function private.geographic_exploration(jsonb) to authenticated;
create function public.food_go_geographic_exploration(p_action jsonb default '{"action":"read"}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.geographic_exploration(p_action); $$;
revoke all on function public.food_go_geographic_exploration(jsonb) from public,anon,authenticated;
grant execute on function public.food_go_geographic_exploration(jsonb) to authenticated;

commit;

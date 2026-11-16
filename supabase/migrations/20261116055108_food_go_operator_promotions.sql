begin;

create table private.food_go_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table private.operator_audit (
  request_id uuid primary key,
  actor uuid not null,
  action text not null,
  target uuid not null,
  reason text not null,
  request_hash text not null,
  created_at timestamptz not null default now()
);
create index operator_audit_created_idx on private.operator_audit(created_at desc, request_id desc);
alter table private.food_go_operators enable row level security;
alter table private.operator_audit enable row level security;
revoke all on private.food_go_operators, private.operator_audit from public, anon, authenticated;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 90),
  description text not null check (char_length(trim(description)) between 2 and 400),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index promotions_active_idx on public.promotions(ends_at, id) where status='published';
create index promotions_venue_idx on public.promotions(venue_id);
alter table public.promotions enable row level security;
revoke all on public.promotions from public, anon, authenticated;
grant select (id, venue_id, title, description, starts_at, ends_at, status) on public.promotions to anon, authenticated;
create policy active_verified_venue_promotions on public.promotions for select to anon, authenticated
  using (status='published' and starts_at <= now() and ends_at > now() and exists (
    select 1 from public.venues v where v.id=venue_id and v.status='published' and v.ownership_verified_at is not null
  ));
create function public.food_go_active_promotions()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(data.row order by data.ends_at, data.id),'[]'::jsonb) from (
    select p.id, p.ends_at, jsonb_build_object('id',p.id,'venueId',v.id,'venueSlug',v.slug,'venueName',v.name,
      'suburb',v.suburb,'title',p.title,'description',p.description,'startsAt',p.starts_at,'endsAt',p.ends_at) as row
    from public.promotions p join public.venues v on v.id=p.venue_id
    where v.status='published' and v.ownership_verified_at is not null and p.status='published' and p.starts_at <= now() and p.ends_at > now()
    order by p.ends_at, p.id limit 100
  ) data;
$$;
revoke all on function public.food_go_active_promotions() from public, anon, authenticated;
grant execute on function public.food_go_active_promotions() to anon, authenticated;

-- Role membership is database-owned. Session revocation, confirmation, bans and the
-- signed second-factor assurance claim are checked again by each privileged RPC.
create function private.food_go_operator_access()
returns text language sql stable security definer set search_path='' as $$
  select case when not exists (
    select 1 from private.food_go_operators o join auth.users u on u.id=o.user_id
    join auth.sessions s on s.user_id=u.id and s.id::text=auth.jwt()->>'session_id'
    where u.id=auth.uid() and (s.not_after is null or s.not_after > now())
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= now())
      and (u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'))
  ) then 'forbidden' when auth.jwt()->>'aal'='aal2' then 'ready' else 'mfa' end;
$$;
create function public.food_go_operator_access()
returns text language sql stable security invoker set search_path='' as $$ select private.food_go_operator_access(); $$;
revoke all on function private.food_go_operator_access(), public.food_go_operator_access() from public, anon, authenticated;
grant execute on function private.food_go_operator_access(), public.food_go_operator_access() to authenticated;

-- Each section uses the same paged read shape. Ownership evidence and operator
-- notes stay private, and private personal-wall posts are never review candidates.
create function private.operator_entries(section text)
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
      'venueId',p.venue_id,'venueName',v.name,'startsAt',p.starts_at,'endsAt',p.ends_at,'version',p.updated_at)
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

create function private.operator_queue(p_section text, p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb;
begin
  if private.food_go_operator_access()<>'ready' then raise exception using errcode='42501',message='Operator session required'; end if;
  if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='Invalid page'; end if;
  with rows as (
    select *, (entry->>'state'='pending') is true as pending from private.operator_entries(p_section)
    order by pending desc, at_time desc,id desc limit 21 offset p_page*20
  ), numbered as (select *,row_number() over(order by pending desc,at_time desc,id desc) as n from rows)
  select jsonb_build_object('items',coalesce(jsonb_agg(entry order by n) filter(where n<=20),'[]'::jsonb),
    'hasMore',count(*)>20) into result from numbered;
  return result;
end;
$$;
create function public.food_go_operator_queue(p_section text, p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.operator_queue(p_section,p_page); $$;
revoke all on function private.operator_queue(text,integer), public.food_go_operator_queue(text,integer) from public, anon, authenticated;
grant execute on function private.operator_queue(text,integer), public.food_go_operator_queue(text,integer) to authenticated;

create function private.operator_change(p_action jsonb)
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
  if operation in ('promo.create','promo.edit') then allowed:=allowed || array['venueId','title','description','startsAt','endsAt']; end if;
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
      if jsonb_typeof(p_action->'title') is distinct from 'string' or jsonb_typeof(p_action->'description') is distinct from 'string'
        or not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400)
        or (p_action->>'venueId')::uuid is distinct from venue_ref then raise exception using errcode='22023',message='Invalid offer details'; end if;
      starts:=(p_action->>'startsAt')::timestamptz; ends:=(p_action->>'endsAt')::timestamptz;
      if starts is null or ends is null or not isfinite(starts) or not isfinite(ends) or ends<=starts or ends<=now()
        then raise exception using errcode='22023',message='Invalid offer dates'; end if;
      if operation='promo.create' then
        insert into public.promotions(id,venue_id,title,description,starts_at,ends_at) values(target_id,venue_ref,btrim(p_action->>'title'),btrim(p_action->>'description'),starts,ends);
      else
        update public.promotions set title=btrim(p_action->>'title'),description=btrim(p_action->>'description'),starts_at=starts,ends_at=ends,
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
create function public.food_go_operator_change(p_action jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.operator_change(p_action); $$;
revoke all on function private.operator_change(jsonb), public.food_go_operator_change(jsonb) from public, anon, authenticated;
grant execute on function private.operator_change(jsonb), public.food_go_operator_change(jsonb) to authenticated;

commit;

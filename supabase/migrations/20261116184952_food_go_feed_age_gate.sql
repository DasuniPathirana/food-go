begin;

create table private.player_birth_dates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null check(isfinite(birth_date)),
  declared_at timestamptz not null default clock_timestamp(),
  source text not null check(source in ('signup','account'))
);
alter table private.player_birth_dates enable row level security;
revoke all on private.player_birth_dates from public,anon,authenticated;

create function private.feed_calendar_today() returns date
language sql stable set search_path='' as $$select (statement_timestamp() at time zone 'Australia/Sydney')::date;$$;
create function private.valid_player_birth_date(p_birth_date date,p_today date) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(isfinite(p_birth_date) and isfinite(p_today) and p_birth_date<=p_today
    and p_birth_date>=(p_today-interval '120 years')::date,false);
$$;
create function private.feed_birth_date_eligible(p_birth_date date,p_today date) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(isfinite(p_birth_date) and isfinite(p_today) and p_birth_date<=(p_today-interval '16 years')::date,false);
$$;
revoke all on function private.feed_calendar_today(),private.valid_player_birth_date(date,date),private.feed_birth_date_eligible(date,date) from public,anon,authenticated;

create function private.capture_initial_birth_date() returns trigger
language plpgsql security definer set search_path='' as $$
declare supplied text:=new.raw_user_meta_data->>'date_of_birth'; parsed date;
begin
  if not (coalesce(new.raw_user_meta_data,'{}'::jsonb) ? 'date_of_birth') then return new; end if;
  if jsonb_typeof(new.raw_user_meta_data->'date_of_birth') is distinct from 'string'
    or supplied !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='22023',message='Enter a valid date of birth'; end if;
  begin parsed:=supplied::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode='22023',message='Enter a valid date of birth'; end;
  if to_char(parsed,'YYYY-MM-DD')<>supplied or not private.valid_player_birth_date(parsed,private.feed_calendar_today()) then
    raise exception using errcode='22023',message='Enter a valid date of birth within the past 120 years'; end if;
  insert into private.player_birth_dates(user_id,birth_date,source) values(new.id,parsed,'signup');
  return new;
end;
$$;
revoke all on function private.capture_initial_birth_date() from public,anon,authenticated;
create trigger food_go_initial_birth_date after insert on auth.users for each row execute function private.capture_initial_birth_date();

create function private.protect_player_birth_date() returns trigger
language plpgsql set search_path='' as $$
begin raise exception using errcode='42501',message='A birth date declaration cannot be changed through the application'; end;
$$;
revoke all on function private.protect_player_birth_date() from public,anon,authenticated;
create trigger food_go_birth_date_immutable before update on private.player_birth_dates for each row execute function private.protect_player_birth_date();

create function private.player_age_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.journey_user(); birth date;
begin
  select d.birth_date into birth from private.player_birth_dates d where d.user_id=actor;
  if birth is null then return '{"status":"unknown","feedEligible":false}'::jsonb; end if;
  if private.feed_birth_date_eligible(birth,private.feed_calendar_today()) then return '{"status":"eligible","feedEligible":true}'::jsonb; end if;
  return '{"status":"under16","feedEligible":false}'::jsonb;
end;
$$;
create function public.food_go_age_status() returns jsonb
language sql security invoker set search_path='' as $$select private.player_age_status();$$;
create function private.record_player_birth_date(p_birth_date date) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare actor uuid:=private.journey_user(); original date;
begin
  if not private.valid_player_birth_date(p_birth_date,private.feed_calendar_today()) then
    raise exception using errcode='22023',message='Enter a valid date of birth within the past 120 years'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,174916));
  select birth_date into original from private.player_birth_dates where user_id=actor;
  if found then
    if original is distinct from p_birth_date then raise exception using errcode='FG409',message='Date of birth has already been recorded'; end if;
  else insert into private.player_birth_dates(user_id,birth_date,source) values(actor,p_birth_date,'account');
  end if;
  return private.player_age_status();
end;
$$;
create function public.food_go_record_birth_date(p_birth_date date) returns jsonb
language sql security invoker set search_path='' as $$select private.record_player_birth_date(p_birth_date);$$;
revoke all on function private.player_age_status(),public.food_go_age_status(),private.record_player_birth_date(date),public.food_go_record_birth_date(date) from public,anon,authenticated;
grant execute on function private.player_age_status(),public.food_go_age_status(),private.record_player_birth_date(date),public.food_go_record_birth_date(date) to authenticated;

create function private.require_feed_age() returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if private.player_age_status()->>'status'<>'eligible' then
    raise exception using errcode='FA016',message='Feed is available to account holders aged 16 and over'; end if;
end;
$$;
revoke all on function private.require_feed_age() from public,anon,authenticated;

-- Keep one checked write boundary. Safety actions remain possible for an active
-- verified account without granting access to read anyone else's Feed or wall.
create or replace function private.community_write_acknowledged(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user();
begin
  if p_action->>'action' in ('create','comment','like','share') then
    perform private.require_feed_age();
    if not exists(select 1 from private.community_policy_acceptances a where a.user_id=actor and a.policy_version=private.community_policy_version()) then
      raise exception using errcode='FC005',message='Accept the community acknowledgement before taking part'; end if;
  end if;
  return private.community_write_original(p_action);
end;
$$;
revoke all on function private.community_write_original(jsonb) from public,anon,authenticated;
comment on table private.player_birth_dates is 'Private once-only self-declared birth dates. Initial signup metadata is captured once; editable metadata and JWT age claims never authorise Feed access. Dates are not identity or age verification.';

-- Preserve existing paging, privacy, blocks and moderation behind the age gate.
create or replace function public.food_go_community_feed(
  p_wall text default 'public', p_post uuid default null,
  p_cursor text default null, p_comments_cursor text default null
)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  viewer private.community_authors%rowtype;
  wall_owner private.community_authors%rowtype;
  before_time timestamptz; before_id uuid;
  comment_time timestamptz; comment_id uuid;
  selected_posts uuid[];
  result_posts jsonb; next_cursor text;
begin
  perform private.require_feed_age();
  if p_wall is null or length(p_wall) > 40 or length(p_cursor) > 200 or length(p_comments_cursor) > 200
    or (p_comments_cursor is not null and p_post is null) or (p_post is not null and p_cursor is not null) then
    raise exception using errcode = '22023', message = 'Invalid community query';
  end if;
  select a.* into viewer from private.community_authors a join auth.users u on u.id = a.user_id
    where a.user_id = (select auth.uid()) and (u.email_confirmed_at is not null or
      (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'));
  if p_wall = 'me' then
    if viewer.id is null then raise exception using errcode = '42501', message = 'Sign in required'; end if;
    wall_owner := viewer;
  elsif p_wall <> 'public' then
    begin
      select a.* into wall_owner from private.community_authors a where a.id = p_wall::uuid;
    exception when invalid_text_representation then raise exception using errcode='22023', message='Invalid wall'; end;
  end if;
  if p_cursor is not null then
    if p_cursor !~ '^[^|]+\|[0-9a-fA-F-]{36}$' then raise exception using errcode='22023',message='Invalid cursor'; end if;
    begin before_time := split_part(p_cursor,'|',1)::timestamptz; before_id := split_part(p_cursor,'|',2)::uuid;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='22023',message='Invalid cursor'; end;
  end if;
  if p_comments_cursor is not null then
    if p_comments_cursor !~ '^[^|]+\|[0-9a-fA-F-]{36}$' then raise exception using errcode='22023',message='Invalid cursor'; end if;
    begin comment_time := split_part(p_comments_cursor,'|',1)::timestamptz; comment_id := split_part(p_comments_cursor,'|',2)::uuid;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='22023',message='Invalid cursor'; end;
  end if;

  select array_agg(chosen.id order by chosen.created_at desc, chosen.id desc) into selected_posts from (
    select p.id,p.created_at from private.community_posts p where p.deleted_at is null
      and ((p.visibility='public' and p.moderation_status='published') or
        (p.author_id=viewer.id and (p_wall='me' or p_wall=viewer.id::text or p_post is not null)))
      and not private.community_blocked(p.author_id, viewer.id)
      and (wall_owner.id is null or not private.community_blocked(wall_owner.id,viewer.id))
      and (p_post is null or p.id=p_post)
      and (p_wall='public' or (wall_owner.id is not null and (p.author_id=wall_owner.id or
        (p.visibility='public' and p.moderation_status='published' and exists (
          select 1 from private.community_shares s where s.author_id=wall_owner.id and s.post_id=p.id)))))
      and (before_time is null or (p.created_at,p.id)<(before_time,before_id))
    order by p.created_at desc,p.id desc limit 21
  ) chosen;
  if coalesce(array_length(selected_posts,1),0)>20 then
    select p.created_at::text || '|' || p.id::text into next_cursor from private.community_posts p where p.id=selected_posts[20];
    selected_posts := selected_posts[1:20];
  end if;
  select coalesce(jsonb_agg(item.value order by item.created_at desc,item.id desc),'[]'::jsonb) into result_posts from (
    select p.id,p.created_at,
      jsonb_build_object('id',p.id,'author',jsonb_build_object('id',a.id,'name',a.display_name),
        'body',p.body,'createdAt',p.created_at,'visibility',p.visibility,
        'status',case when p.visibility='private' then 'private' else p.moderation_status end,
        'likeCount',(select count(*) from private.community_likes l where l.post_id=p.id and not private.community_blocked(l.author_id,viewer.id)),
        'shareCount',(select count(*) from private.community_shares s where s.post_id=p.id and not private.community_blocked(s.author_id,viewer.id)),
        'liked',exists(select 1 from private.community_likes l where l.post_id=p.id and l.author_id=viewer.id),
        'shared',exists(select 1 from private.community_shares s where s.post_id=p.id and s.author_id=viewer.id),
        'commentCount',(select count(*) from private.community_comments c where c.post_id=p.id
          and (c.moderation_status='published' or c.author_id=viewer.id) and not private.community_blocked(c.author_id,viewer.id)),
        'comments',coalesce(comments.items,'[]'::jsonb),'commentsNextCursor',comments.next_cursor)
      || case when wall_owner.id is not null and wall_owner.id<>p.author_id and exists (
          select 1 from private.community_shares s where s.author_id=wall_owner.id and s.post_id=p.id)
        then jsonb_build_object('sharedBy',jsonb_build_object('id',wall_owner.id,'name',wall_owner.display_name)) else '{}'::jsonb end as value
    from private.community_posts p join private.community_authors a on a.id=p.author_id
    left join lateral (
      select jsonb_agg(q.value order by q.created_at desc,q.id desc) filter(where q.ordinal<=20) as items,
        case when count(*)>20 then max(q.cursor_value) filter(where q.ordinal=20) end as next_cursor
      from (
        select c.id,c.created_at,row_number() over(order by c.created_at desc,c.id desc) as ordinal,
          c.created_at::text || '|' || c.id::text as cursor_value,
          jsonb_build_object('id',c.id,'author',jsonb_build_object('id',ca.id,'name',ca.display_name),
            'body',c.body,'createdAt',c.created_at,'status',c.moderation_status) as value
        from private.community_comments c join private.community_authors ca on ca.id=c.author_id
        where c.post_id=p.id and (c.moderation_status='published' or c.author_id=viewer.id)
          and not private.community_blocked(c.author_id,viewer.id)
          and (comment_time is null or (c.created_at,c.id)<(comment_time,comment_id))
        order by c.created_at desc,c.id desc limit 21
      ) q
    ) comments on true
    where p.id=any(coalesce(selected_posts,'{}'::uuid[]))
  ) item;
  return jsonb_build_object('status','ready','posts',result_posts,
    'viewer',case when viewer.id is null then null else jsonb_build_object('id',viewer.id,'name',viewer.display_name) end,
    'wallOwner',case when wall_owner.id is null or private.community_blocked(wall_owner.id,viewer.id)
      or (wall_owner.id is distinct from viewer.id and jsonb_array_length(result_posts)=0) then null
      else jsonb_build_object('id',wall_owner.id,'name',wall_owner.display_name) end,'nextCursor',next_cursor);
end;
$$;
create or replace function public.food_go_community_feed_v2(p_wall text default 'public',p_post uuid default null,p_cursor text default null,p_comments_cursor text default null)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb; enriched jsonb;
begin
  perform private.require_feed_age();
  result := public.food_go_community_feed(p_wall,p_post,p_cursor,p_comments_cursor);
  select coalesce(jsonb_agg(item || jsonb_build_object('reachCount',(
    select count(*) from private.community_post_views v join private.community_posts p on p.id=v.post_id
    where v.post_id=(item->>'id')::uuid and p.visibility='public' and p.moderation_status='published' and p.deleted_at is null
      and private.community_verified_author(v.viewer_id) and not private.community_blocked(p.author_id,v.viewer_id)
  )) order by ordinal),'[]'::jsonb) into enriched from jsonb_array_elements(result->'posts') with ordinality x(item,ordinal);
  return jsonb_set(result,'{posts}',enriched);
end;
$$;
create or replace function public.food_go_record_post_view(p_post uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare viewer uuid; owner_id uuid;
begin
  perform private.require_feed_age();
  select id into viewer from private.community_authors where user_id=(select auth.uid());
  if viewer is null or not private.community_verified_author(viewer) then
    raise exception using errcode='42501',message='Verified sign in required';
  end if;
  select author_id into owner_id from private.community_posts where id=p_post and visibility='public' and moderation_status='published' and deleted_at is null;
  if owner_id is null or private.community_blocked(owner_id,viewer) then raise exception using errcode='FC004',message='Post unavailable'; end if;
  if owner_id<>viewer then
    insert into private.community_post_views(post_id,viewer_id) values(p_post,viewer) on conflict do nothing;
    perform private.community_award('reach:'||p_post||':'||viewer,owner_id,viewer,p_post,'reach');
  end if;
  return jsonb_build_object('ok',true,'reachCount',(select count(*) from private.community_post_views v
    where v.post_id=p_post and private.community_verified_author(v.viewer_id) and not private.community_blocked(owner_id,v.viewer_id)));
end;
$$;

revoke all on function public.food_go_community_feed(text,uuid,text,text), public.food_go_community_feed_v2(text,uuid,text,text), public.food_go_record_post_view(uuid) from public,anon,authenticated;
grant execute on function public.food_go_community_feed(text,uuid,text,text), public.food_go_community_feed_v2(text,uuid,text,text), public.food_go_record_post_view(uuid) to authenticated;

-- A community quest must never be an alternate way to participate in Feed.
create function private.check_community_quest_age() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.adventure_quests q where q.id=new.quest_id and q.category='community') then
    perform private.require_feed_age();
  end if;
  return new;
end;
$$;
revoke all on function private.check_community_quest_age() from public,anon,authenticated;
create trigger food_go_community_quest_age before insert or update on private.adventure_participations
for each row execute function private.check_community_quest_age();

commit;

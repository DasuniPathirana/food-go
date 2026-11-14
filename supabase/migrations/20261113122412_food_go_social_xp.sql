-- Social progression is derived from qualified server events, never browser XP.
begin;
create table private.community_post_views (
  post_id uuid not null references private.community_posts(id) on delete cascade,
  viewer_id uuid not null references private.community_authors(id) on delete cascade,
  viewed_at timestamptz not null default now(), primary key(post_id,viewer_id)
);
create index community_post_views_viewer_idx on private.community_post_views(viewer_id);
create table private.community_xp_events (
  event_key text primary key,
  beneficiary_id uuid not null references private.community_authors(id) on delete cascade,
  actor_id uuid not null references private.community_authors(id) on delete cascade,
  post_id uuid not null references private.community_posts(id) on delete cascade,
  comment_id uuid references private.community_comments(id) on delete cascade,
  kind text not null check(kind in ('post','comment','like','reach')),
  points integer not null check(points in (1,2,5,25)),
  awarded_at timestamptz not null default now()
);
create index community_xp_beneficiary_idx on private.community_xp_events(beneficiary_id,kind,awarded_at);
create index community_xp_post_idx on private.community_xp_events(post_id,kind);
create index community_xp_actor_idx on private.community_xp_events(actor_id);
create index community_xp_comment_idx on private.community_xp_events(comment_id) where comment_id is not null;
alter table private.community_post_views enable row level security;
alter table private.community_xp_events enable row level security;
revoke all on private.community_post_views,private.community_xp_events from public,anon,authenticated;

create function private.community_verified_author(p_author uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from private.community_authors a join auth.users u on u.id=a.user_id
    where a.id=p_author and (u.email_confirmed_at is not null or
      (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$')));
$$;
revoke all on function private.community_verified_author(uuid) from public,anon,authenticated;

create function private.community_award(p_key text,p_beneficiary uuid,p_actor uuid,p_post uuid,p_kind text,p_comment uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare day_start timestamptz := date_trunc('day',now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
  reward integer;
begin
  if not private.community_verified_author(p_beneficiary) or not private.community_verified_author(p_actor) then return; end if;
  if private.community_blocked(p_beneficiary,p_actor) then return; end if;
  -- Separate lock namespace from community submission idempotency. Awards take
  -- one beneficiary lock and never call the submission RPC while holding it.
  perform pg_advisory_xact_lock(hashtextextended(p_beneficiary::text,9214));
  if exists(select 1 from private.community_xp_events where event_key=p_key) then return; end if;
  reward := case p_kind when 'post' then 25 when 'comment' then 5 when 'like' then 2 when 'reach' then 1 end;
  if reward is null then raise exception 'Unknown XP event'; end if;
  if p_kind in ('post','comment','like') and (
    select count(*) from private.community_xp_events where beneficiary_id=p_beneficiary and kind=p_kind and awarded_at>=day_start
  ) >= (case p_kind when 'post' then 3 when 'comment' then 10 else 50 end) then return; end if;
  if p_kind='reach' and (select count(*) from private.community_xp_events where post_id=p_post and kind='reach')>=25 then return; end if;
  insert into private.community_xp_events(event_key,beneficiary_id,actor_id,post_id,comment_id,kind,points)
    values(p_key,p_beneficiary,p_actor,p_post,p_comment,p_kind,reward) on conflict do nothing;
end;
$$;
revoke all on function private.community_award(text,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;

create function private.community_content_xp() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  if tg_table_name='community_posts' then
    if new.visibility='public' and new.moderation_status='published' and new.deleted_at is null then
      perform private.community_award('post:'||new.id,new.author_id,new.author_id,new.id,'post');
    end if;
  elsif tg_table_name='community_comments' then
    select author_id into owner_id from private.community_posts where id=new.post_id and visibility='public' and moderation_status='published' and deleted_at is null;
    if new.moderation_status='published' and owner_id is not null and owner_id<>new.author_id and not private.community_blocked(owner_id,new.author_id) then
      perform private.community_award('comment:'||new.id,new.author_id,new.author_id,new.post_id,'comment',new.id);
    end if;
  elsif tg_table_name='community_likes' then
    select author_id into owner_id from private.community_posts where id=new.post_id and visibility='public' and moderation_status='published' and deleted_at is null;
    if owner_id is not null and owner_id<>new.author_id then
      perform private.community_award('like:'||new.post_id||':'||new.author_id,owner_id,new.author_id,new.post_id,'like');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.community_content_xp() from public,anon,authenticated;
create trigger community_post_xp after insert or update of moderation_status,visibility,deleted_at on private.community_posts for each row execute function private.community_content_xp();
create trigger community_comment_xp after insert or update of moderation_status on private.community_comments for each row execute function private.community_content_xp();
create trigger community_like_xp after insert on private.community_likes for each row execute function private.community_content_xp();

-- Retain the historical event key and cap slot when eligibility is withdrawn.
-- Unlike/re-like and unpublish/re-publish cannot create another award.
create function private.community_active_xp(p_author uuid)
returns setof private.community_xp_events language sql stable set search_path='' as $$
  select e.* from private.community_xp_events e join private.community_posts p on p.id=e.post_id
  where e.beneficiary_id=p_author and p.visibility='public' and p.moderation_status='published' and p.deleted_at is null
    and private.community_verified_author(e.actor_id) and private.community_verified_author(e.beneficiary_id)
    and not private.community_blocked(e.beneficiary_id,e.actor_id)
    and not private.community_blocked(p.author_id,e.beneficiary_id)
    and (e.kind<>'like' or exists(select 1 from private.community_likes l where l.post_id=e.post_id and l.author_id=e.actor_id))
    and (e.kind<>'comment' or exists(select 1 from private.community_comments c where c.id=e.comment_id and c.moderation_status='published'));
$$;
revoke all on function private.community_active_xp(uuid) from public,anon,authenticated;

create function public.food_go_record_post_view(p_post uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare viewer uuid; owner_id uuid;
begin
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
revoke all on function public.food_go_record_post_view(uuid) from public,anon,authenticated;
grant execute on function public.food_go_record_post_view(uuid) to authenticated;

create function public.food_go_game_profile() returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare viewer uuid; total bigint; reach bigint; activity jsonb;
begin
  select id into viewer from private.community_authors where user_id=(select auth.uid());
  if viewer is null or not private.community_verified_author(viewer) then raise exception using errcode='42501',message='Verified sign in required'; end if;
  select coalesce(sum(points),0) into total from private.community_active_xp(viewer);
  select count(*) into reach from private.community_post_views v join private.community_posts p on p.id=v.post_id
    where p.author_id=viewer and p.visibility='public' and p.moderation_status='published' and p.deleted_at is null
      and private.community_verified_author(v.viewer_id) and not private.community_blocked(viewer,v.viewer_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind',a.kind,'points',a.points,'at',a.awarded_at) order by a.awarded_at desc,a.event_key),'[]'::jsonb)
    into activity from (select * from private.community_active_xp(viewer) order by awarded_at desc,event_key limit 12) a;
  return jsonb_build_object('xp',total,'level',1+total/250,'nextLevelXp',(1+total/250)*250,'reachCount',reach,'activity',activity);
end;
$$;
revoke all on function public.food_go_game_profile() from public,anon,authenticated;
grant execute on function public.food_go_game_profile() to authenticated;

create function public.food_go_community_feed_v2(p_wall text default 'public',p_post uuid default null,p_cursor text default null,p_comments_cursor text default null)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb; enriched jsonb;
begin
  result := public.food_go_community_feed(p_wall,p_post,p_cursor,p_comments_cursor);
  select coalesce(jsonb_agg(item || jsonb_build_object('reachCount',(
    select count(*) from private.community_post_views v join private.community_posts p on p.id=v.post_id
    where v.post_id=(item->>'id')::uuid and p.visibility='public' and p.moderation_status='published' and p.deleted_at is null
      and private.community_verified_author(v.viewer_id) and not private.community_blocked(p.author_id,v.viewer_id)
  )) order by ordinal),'[]'::jsonb) into enriched from jsonb_array_elements(result->'posts') with ordinality x(item,ordinal);
  return jsonb_set(result,'{posts}',enriched);
end;
$$;
revoke all on function public.food_go_community_feed_v2(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.food_go_community_feed_v2(text,uuid,text,text) to anon,authenticated;
commit;

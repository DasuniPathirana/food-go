-- Community content is private at rest. Narrow RPCs return only moderated public
-- presentation data, or the verified caller's own submissions. No service key.
begin;

create table private.community_authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Food explorer' check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table private.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references private.community_authors(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  visibility text not null check (visibility in ('public', 'private')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'published')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (visibility <> 'private' or moderation_status = 'pending')
);
create index community_posts_author_idx on private.community_posts(author_id, created_at desc, id desc) where deleted_at is null;
create index community_posts_public_idx on private.community_posts(created_at desc, id desc) where deleted_at is null and visibility = 'public' and moderation_status = 'published';
create table private.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts(id) on delete cascade,
  author_id uuid not null references private.community_authors(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'published')),
  created_at timestamptz not null default now()
);
create index community_comments_post_idx on private.community_comments(post_id, created_at desc, id desc);
create index community_comments_author_idx on private.community_comments(author_id, created_at desc);
create table private.community_likes (
  author_id uuid not null references private.community_authors(id) on delete cascade,
  post_id uuid not null references private.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (author_id, post_id)
);
create index community_likes_post_idx on private.community_likes(post_id);
create table private.community_shares (
  author_id uuid not null references private.community_authors(id) on delete cascade,
  post_id uuid not null references private.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (author_id, post_id)
);
create index community_shares_post_idx on private.community_shares(post_id);
create table private.community_reports (
  author_id uuid not null references private.community_authors(id) on delete cascade,
  post_id uuid not null references private.community_posts(id) on delete cascade,
  reason text not null check (reason in ('spam','abuse','other')),
  created_at timestamptz not null default now(), primary key (author_id, post_id)
);
create index community_reports_post_idx on private.community_reports(post_id);
create table private.community_blocks (
  author_id uuid not null references private.community_authors(id) on delete cascade,
  blocked_id uuid not null references private.community_authors(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (author_id, blocked_id), check (author_id <> blocked_id)
);
create index community_blocks_target_idx on private.community_blocks(blocked_id, author_id);
create table private.community_requests (
  author_id uuid not null references private.community_authors(id) on delete cascade,
  request_id uuid not null, request_hash text not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key (author_id, request_id)
);

alter table private.community_authors enable row level security;
alter table private.community_posts enable row level security;
alter table private.community_comments enable row level security;
alter table private.community_likes enable row level security;
alter table private.community_shares enable row level security;
alter table private.community_reports enable row level security;
alter table private.community_blocks enable row level security;
alter table private.community_requests enable row level security;
revoke all on table private.community_authors, private.community_posts, private.community_comments,
  private.community_likes, private.community_shares, private.community_reports, private.community_blocks,
  private.community_requests from public, anon, authenticated;

create function private.community_text_valid(value text, maximum integer)
returns boolean language sql immutable set search_path = '' as $$
  select value is not null and char_length(btrim(value)) between 1 and maximum
    and translate(value, chr(9) || chr(10) || chr(13), '') !~ '[[:cntrl:]]';
$$;
revoke all on function private.community_text_valid(text,integer) from public, anon, authenticated;

create function private.community_new_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_name text := btrim(new.raw_user_meta_data ->> 'display_name');
begin
  -- A user-chosen display name is untrusted presentation text, never authority.
  if not coalesce(private.community_text_valid(chosen_name,80),false) then chosen_name := 'Food explorer'; end if;
  insert into private.community_authors(user_id, display_name) values (new.id, chosen_name) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.community_new_author() from public, anon, authenticated;
create trigger community_author_after_signup after insert on auth.users for each row execute function private.community_new_author();
insert into private.community_authors(user_id,display_name)
  select u.id, case when private.community_text_valid(p.display_name,80) then btrim(p.display_name) else 'Food explorer' end
  from auth.users u left join public.profiles p on p.id = u.id;

create function private.community_blocked(first_author uuid, second_author uuid)
returns boolean language sql stable set search_path = '' as $$
  select first_author is not null and second_author is not null and exists (
    select 1 from private.community_blocks b where
      (b.author_id = first_author and b.blocked_id = second_author) or
      (b.author_id = second_author and b.blocked_id = first_author));
$$;
revoke all on function private.community_blocked(uuid,uuid) from public, anon, authenticated;

create function public.food_go_community_feed(
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
revoke all on function public.food_go_community_feed(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.food_go_community_feed(text,uuid,text,text) to anon, authenticated;

create function public.food_go_community_write(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor_user_id uuid := (select auth.uid()); actor private.community_authors%rowtype;
  action text; allowed text[]; field text; post private.community_posts%rowtype;
  target_post_id uuid; target_author_id uuid; request_key uuid; content text; result jsonb;
  previous private.community_requests%rowtype; result_id uuid;
begin
  if actor_user_id is null or not exists (select 1 from auth.users u where u.id=actor_user_id and
    (u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'))) then
    raise exception using errcode='42501',message='A verified account is required';
  end if;
  select a.* into actor from private.community_authors a where a.user_id=actor_user_id;
  if actor.id is null then raise exception using errcode='42501',message='A verified account is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_user_id::text,8726));
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>16384 then
    raise exception using errcode='22023',message='Invalid community action'; end if;
  action := p_action->>'action';
  allowed := case action
    when 'create' then array['action','body','visibility','requestId']
    when 'comment' then array['action','body','postId','requestId']
    when 'like' then array['action','postId','liked']
    when 'share' then array['action','postId','shared']
    when 'delete' then array['action','postId']
    when 'report' then array['action','postId','reason']
    when 'block' then array['action','authorId'] else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where not k=any(allowed)) then
    raise exception using errcode='22023',message='Invalid community action'; end if;
  begin
    if action in ('create','comment') then request_key := (p_action->>'requestId')::uuid;
      if request_key is null or jsonb_typeof(p_action->'body') is distinct from 'string'
        or not private.community_text_valid(p_action->>'body',case when action='create' then 2000 else 1000 end) then
        raise exception using errcode='22023',message='Invalid community content'; end if;
      content := btrim(p_action->>'body');
      select r.* into previous from private.community_requests r where r.author_id=actor.id and r.request_id=request_key;
      if found then
        if previous.request_hash<>md5(p_action::text) then raise exception using errcode='FC003',message='Changed retry'; end if;
        return previous.result;
      end if;
    end if;
    if action not in ('create','block') then target_post_id := (p_action->>'postId')::uuid;
      if target_post_id is null then raise exception using errcode='22023',message='Invalid post'; end if;
      select p.* into post from private.community_posts p where p.id=target_post_id and p.deleted_at is null
        and (p.author_id=actor.id or (p.visibility='public' and p.moderation_status='published'))
        and not private.community_blocked(p.author_id,actor.id);
      if post.id is null then raise exception using errcode='FC004',message='Post not available'; end if;
    end if;
    if action='create' then
      if (p_action->>'visibility') not in ('public','private') or (p_action->>'visibility') is null then
        raise exception using errcode='22023',message='Invalid visibility'; end if;
      if (select count(*) from private.community_posts p where p.author_id=actor.id and p.created_at>now()-interval '1 day')>=20 then
        raise exception using errcode='FC002',message='Posting limit'; end if;
      insert into private.community_posts(author_id,body,visibility) values(actor.id,content,p_action->>'visibility') returning id into result_id;
      result := jsonb_build_object('ok',true,'id',result_id,'status',case when p_action->>'visibility'='private' then 'private' else 'pending' end);
    elsif action='delete' then
      if post.author_id<>actor.id then raise exception using errcode='42501',message='Post not available'; end if;
      update private.community_posts p set deleted_at=now() where p.id=target_post_id;
      result := jsonb_build_object('ok',true);
    elsif action='block' then
      target_author_id := (p_action->>'authorId')::uuid;
      if target_author_id is null or target_author_id=actor.id or not exists(select 1 from private.community_authors a where a.id=target_author_id) then
        raise exception using errcode='FC004',message='Profile not available'; end if;
      insert into private.community_blocks(author_id,blocked_id) values(actor.id,target_author_id) on conflict do nothing;
      result := jsonb_build_object('ok',true);
    elsif action='comment' then
      if (select count(*) from private.community_comments c where c.author_id=actor.id and c.created_at>now()-interval '1 day')>=100 then
        raise exception using errcode='FC002',message='Comment limit'; end if;
      insert into private.community_comments(post_id,author_id,body) values(target_post_id,actor.id,content) returning id into result_id;
      result := jsonb_build_object('ok',true,'id',result_id,'status','pending');
    elsif action='report' then
      if (p_action->>'reason') not in ('spam','abuse','other') or (p_action->>'reason') is null then
        raise exception using errcode='22023',message='Invalid reason'; end if;
      insert into private.community_reports(author_id,post_id,reason) values(actor.id,target_post_id,p_action->>'reason')
        on conflict(author_id,post_id) do update set reason=excluded.reason;
      result := jsonb_build_object('ok',true);
    else
      if post.visibility<>'public' or post.moderation_status<>'published' then
        raise exception using errcode='FC004',message='Post not available'; end if;
      if action='like' then
        if jsonb_typeof(p_action->'liked') is distinct from 'boolean' then raise exception using errcode='22023',message='Invalid reaction'; end if;
        if (p_action->>'liked')::boolean then insert into private.community_likes(author_id,post_id) values(actor.id,target_post_id) on conflict do nothing;
        else delete from private.community_likes l where l.author_id=actor.id and l.post_id=target_post_id; end if;
      else
        if p_action ? 'shared' and jsonb_typeof(p_action->'shared') is distinct from 'boolean' then
          raise exception using errcode='22023',message='Invalid share'; end if;
        if coalesce((p_action->>'shared')::boolean,true) then insert into private.community_shares(author_id,post_id) values(actor.id,target_post_id) on conflict do nothing;
        else delete from private.community_shares s where s.author_id=actor.id and s.post_id=target_post_id; end if;
      end if;
      result := jsonb_build_object('ok',true);
    end if;
  exception when invalid_text_representation then raise exception using errcode='22023',message='Invalid community identifier'; end;
  if request_key is not null then insert into private.community_requests(author_id,request_id,request_hash,result)
    values(actor.id,request_key,md5(p_action::text),result); end if;
  return result;
end;
$$;
revoke all on function public.food_go_community_write(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_community_write(jsonb) to authenticated;
comment on function public.food_go_community_feed(text,uuid,text,text) is 'Bounded presentation-only reads. Private tables, identities, blocks and moderation metadata are never exposed directly.';
comment on function public.food_go_community_write(jsonb) is 'Verified caller-only moderated text submissions and interactions. Public content remains pending until operator approval.';

commit;

-- Stage 1 Feed Edit + Media Storage, Deal Cafe Offers & Claim Passes, Partner Extensions & Admin Analytics/Reports
begin;

-- 1. Verified In-Database Image Media Service + Storage Bucket Configuration
-- Avoids reliance on service_role keys or storage.objects table ownership while capping binary payloads safely.
create table private.uploaded_media (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('community','venue','dish','promotion')),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  bytes_base64 text not null check (char_length(bytes_base64) between 32 and 1400000),
  created_at timestamptz not null default clock_timestamp()
);
create index uploaded_media_uploader_idx on private.uploaded_media(uploader_id, created_at desc);
alter table private.uploaded_media enable row level security;
revoke all on table private.uploaded_media from public, anon, authenticated;

create function private.upload_media(p_scope text, p_content_type text, p_base64 text)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  media_id uuid;
  cleaned text;
begin
  if p_scope not in ('community','venue','dish','promotion') or p_content_type not in ('image/jpeg','image/png','image/webp') then
    raise exception using errcode = '22023', message = 'Use JPEG, PNG or WebP image files';
  end if;
  cleaned := regexp_replace(coalesce(p_base64, ''), '\s+', '', 'g');
  if char_length(cleaned) < 32 or char_length(cleaned) > 1400000 or cleaned !~ '^[A-Za-z0-9+/=]+$' then
    raise exception using errcode = '22023', message = 'Image size must be under 950 KB';
  end if;
  if (select count(*) from private.uploaded_media where uploader_id = actor and created_at > clock_timestamp() - interval '1 hour') >= 40 then
    raise exception using errcode = 'FG429', message = 'Hourly image upload limit reached';
  end if;
  insert into private.uploaded_media(uploader_id, scope, content_type, bytes_base64)
  values (actor, p_scope, p_content_type, cleaned)
  returning id into media_id;
  return jsonb_build_object('ok', true, 'id', media_id, 'url', '/api/media/' || media_id::text);
end;
$$;
create function public.food_go_upload_media(p_scope text, p_content_type text, p_base64 text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.upload_media(p_scope, p_content_type, p_base64); $$;
revoke all on function private.upload_media(text,text,text), public.food_go_upload_media(text,text,text) from public, anon, authenticated;
grant execute on function public.food_go_upload_media(text,text,text) to authenticated;

create function public.food_go_read_media(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('contentType', m.content_type, 'base64', m.bytes_base64)
  from private.uploaded_media m where m.id = p_id;
$$;
revoke all on function public.food_go_read_media(uuid) from public, anon, authenticated;
grant execute on function public.food_go_read_media(uuid) to anon, authenticated;

update storage.buckets set public = true where id = 'food-go-venue-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-go-community-media', 'food-go-community-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

do $storage_policies$
begin
  drop policy if exists food_go_media_public_read on storage.objects;
  create policy food_go_media_public_read on storage.objects for select to public
    using (bucket_id in ('food-go-venue-media','food-go-community-media'));
  drop policy if exists food_go_media_auth_insert on storage.objects;
  create policy food_go_media_auth_insert on storage.objects for insert to authenticated
    with check (
      bucket_id in ('food-go-venue-media','food-go-community-media')
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
  drop policy if exists food_go_media_auth_delete on storage.objects;
  create policy food_go_media_auth_delete on storage.objects for delete to authenticated
    using (
      bucket_id in ('food-go-venue-media','food-go-community-media')
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when insufficient_privilege then
  raise notice 'Skipping direct storage.objects policy statements on hosted storage role; database media RPC active.';
end;
$storage_policies$;

-- 2. Promotions: 3rd Category ('cafe' / Cafe Offers), Badge Headline & Image + Zero-Payment Claim Passes
alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions add constraint promotions_kind_check
  check (kind in ('food','restaurant','cafe'));

alter table public.promotions
  add column if not exists badge_text text check (badge_text is null or char_length(btrim(badge_text)) <= 40),
  add column if not exists image_url text;

grant select (badge_text, image_url) on public.promotions to anon, authenticated;

create or replace function public.food_go_active_promotions()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(data.row order by data.ends_at, data.id), '[]'::jsonb) from (
    select p.id, p.ends_at, jsonb_build_object(
      'id', p.id,
      'venueId', v.id,
      'venueSlug', v.slug,
      'venueName', v.name,
      'venueType', v.venue_type,
      'suburb', v.suburb,
      'venueImage', v.cover_image_url,
      'venueBuildingPreset', v.building_preset,
      'venueLatitude', v.latitude,
      'venueLongitude', v.longitude,
      'title', p.title,
      'description', p.description,
      'kind', p.kind,
      'badgeText', p.badge_text,
      'imageUrl', p.image_url,
      'startsAt', p.starts_at,
      'endsAt', p.ends_at
    ) as row
    from public.promotions p join public.venues v on v.id = p.venue_id
    where v.status = 'published' and v.ownership_verified_at is not null
      and p.status = 'published' and p.starts_at <= now() and p.ends_at > now()
    order by p.ends_at, p.id limit 120
  ) data;
$$;
revoke all on function public.food_go_active_promotions() from public, anon, authenticated;
grant execute on function public.food_go_active_promotions() to anon, authenticated;

create table private.promotion_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  claim_code text not null unique,
  status text not null default 'active' check (status in ('active','redeemed','expired')),
  claimed_at timestamptz not null default clock_timestamp(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  unique (user_id, promotion_id)
);
alter table private.promotion_claims enable row level security;
revoke all on table private.promotion_claims from public, anon, authenticated;

create function private.customer_promotion_claim(p_action jsonb default '{"action":"list"}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  operation text := coalesce(p_action->>'action', 'list');
  target_promo uuid;
  promo public.promotions%rowtype;
  venue public.venues%rowtype;
  claim_row private.promotion_claims%rowtype;
  code_val text;
  total_claims integer := 0;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid deal action';
  end if;
  if operation = 'claim' then
    target_promo := (p_action->>'promotionId')::uuid;
    select * into promo from public.promotions where id = target_promo and status = 'published' and starts_at <= clock_timestamp() and ends_at > clock_timestamp();
    if not found then raise exception using errcode = 'FG404', message = 'Deal is not currently active'; end if;
    select * into venue from public.venues where id = promo.venue_id and status = 'published' and ownership_verified_at is not null;
    if not found then raise exception using errcode = 'FG404', message = 'Restaurant unavailable'; end if;
    if exists(select 1 from public.organization_members m where m.organization_id = venue.organization_id and m.user_id = actor) then
      raise exception using errcode = '42501', message = 'Owners cannot claim their own deals';
    end if;
    select * into claim_row from private.promotion_claims where user_id = actor and promotion_id = promo.id;
    if not found then
      code_val := 'FG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      insert into private.promotion_claims(user_id, promotion_id, venue_id, claim_code)
      values (actor, promo.id, venue.id, code_val)
      returning * into claim_row;
      insert into private.coin_ledger(user_id, amount, source_type, source_id)
      values (actor, 10, 'deal_reward', claim_row.id) on conflict do nothing;
      update public.profiles set coins = least(100000000, coins + 10) where id = actor;
    end if;
  elsif operation <> 'list' then
    raise exception using errcode = '22023', message = 'Unknown deal action';
  end if;

  select count(*) into total_claims from private.promotion_claims where user_id = actor;
  return jsonb_build_object(
    'ok', true,
    'claim', case when claim_row.id is null then null else jsonb_build_object(
      'id', claim_row.id, 'promotionId', claim_row.promotion_id, 'claimCode', claim_row.claim_code, 'status', claim_row.status
    ) end,
    'rewardsProgress', jsonb_build_object(
      'totalClaims', total_claims,
      'cycleCount', total_claims % 5,
      'cycleTarget', 5
    ),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'promotionId', c.promotion_id,
        'venueId', c.venue_id,
        'venueName', v.name,
        'title', p.title,
        'badgeText', p.badge_text,
        'claimCode', c.claim_code,
        'status', c.status,
        'claimedAt', c.claimed_at,
        'endsAt', p.ends_at
      ) order by c.claimed_at desc)
      from private.promotion_claims c
      join public.promotions p on p.id = c.promotion_id
      join public.venues v on v.id = c.venue_id
      where c.user_id = actor
      limit 100
    ), '[]'::jsonb)
  );
end;
$$;
create function public.food_go_claim_promotion(p_action jsonb default '{"action":"list"}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.customer_promotion_claim(p_action); $$;
revoke all on function private.customer_promotion_claim(jsonb), public.food_go_claim_promotion(jsonb) from public, anon, authenticated;
grant execute on function public.food_go_claim_promotion(jsonb) to authenticated;

-- 3. Community Feed: Add Image URL, Tagged Venue, Updated Timestamp & Post Editing
alter table private.community_posts
  add column if not exists image_url text,
  add column if not exists venue_id uuid references public.venues(id) on delete set null,
  add column if not exists updated_at timestamptz;

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
    select p.id, p.created_at from private.community_posts p where p.deleted_at is null
      and ((p.visibility = 'public' and p.moderation_status = 'published') or
        (p.author_id = viewer.id and (p_wall = 'me' or p_wall = viewer.id::text or p_post is not null)))
      and not private.community_blocked(p.author_id, viewer.id)
      and (wall_owner.id is null or not private.community_blocked(wall_owner.id, viewer.id))
      and (p_post is null or p.id = p_post)
      and (p_wall = 'public' or (wall_owner.id is not null and (p.author_id = wall_owner.id or
        (p.visibility = 'public' and p.moderation_status = 'published' and exists (
          select 1 from private.community_shares s where s.author_id = wall_owner.id and s.post_id = p.id)))))
      and (before_time is null or (p.created_at, p.id) < (before_time, before_id))
    order by p.created_at desc, p.id desc limit 21
  ) chosen;
  if coalesce(array_length(selected_posts, 1), 0) > 20 then
    select p.created_at::text || '|' || p.id::text into next_cursor from private.community_posts p where p.id = selected_posts[20];
    selected_posts := selected_posts[1:20];
  end if;
  select coalesce(jsonb_agg(item.value order by item.created_at desc, item.id desc), '[]'::jsonb) into result_posts from (
    select p.id, p.created_at,
      jsonb_build_object(
        'id', p.id,
        'author', jsonb_build_object('id', a.id, 'name', a.display_name),
        'body', p.body,
        'imageUrl', p.image_url,
        'venueId', p.venue_id,
        'venueName', v.name,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at,
        'visibility', p.visibility,
        'status', case when p.visibility = 'private' then 'private' else p.moderation_status end,
        'likeCount', (select count(*) from private.community_likes l where l.post_id = p.id and not private.community_blocked(l.author_id, viewer.id)),
        'shareCount', (select count(*) from private.community_shares s where s.post_id = p.id and not private.community_blocked(s.author_id, viewer.id)),
        'liked', exists(select 1 from private.community_likes l where l.post_id = p.id and l.author_id = viewer.id),
        'shared', exists(select 1 from private.community_shares s where s.post_id = p.id and s.author_id = viewer.id),
        'commentCount', (select count(*) from private.community_comments c where c.post_id = p.id
          and (c.moderation_status = 'published' or c.author_id = viewer.id) and not private.community_blocked(c.author_id, viewer.id)),
        'comments', coalesce(comments.items, '[]'::jsonb),
        'commentsNextCursor', comments.next_cursor
      )
      || case when wall_owner.id is not null and wall_owner.id <> p.author_id and exists (
          select 1 from private.community_shares s where s.author_id = wall_owner.id and s.post_id = p.id)
        then jsonb_build_object('sharedBy', jsonb_build_object('id', wall_owner.id, 'name', wall_owner.display_name)) else '{}'::jsonb end as value
    from private.community_posts p
    join private.community_authors a on a.id = p.author_id
    left join public.venues v on v.id = p.venue_id and v.status = 'published'
    left join lateral (
      select jsonb_agg(q.value order by q.created_at desc, q.id desc) filter(where q.ordinal <= 20) as items,
        case when count(*) > 20 then max(q.cursor_value) filter(where q.ordinal = 20) end as next_cursor
      from (
        select c.id, c.created_at, row_number() over(order by c.created_at desc, c.id desc) as ordinal,
          c.created_at::text || '|' || c.id::text as cursor_value,
          jsonb_build_object('id', c.id, 'author', jsonb_build_object('id', ca.id, 'name', ca.display_name),
            'body', c.body, 'createdAt', c.created_at, 'status', c.moderation_status) as value
        from private.community_comments c join private.community_authors ca on ca.id = c.author_id
        where c.post_id = p.id and (c.moderation_status = 'published' or c.author_id = viewer.id)
          and not private.community_blocked(c.author_id, viewer.id)
          and (comment_time is null or (c.created_at, c.id) < (comment_time, comment_id))
        order by c.created_at desc, c.id desc limit 21
      ) q
    ) comments on true
    where p.id = any(coalesce(selected_posts, '{}'::uuid[]))
  ) item;
  return jsonb_build_object('status', 'ready', 'posts', result_posts,
    'viewer', case when viewer.id is null then null else jsonb_build_object('id', viewer.id, 'name', viewer.display_name) end,
    'nextCursor', next_cursor,
    'wallOwner', case when wall_owner.id is null then null else jsonb_build_object('id', wall_owner.id, 'name', wall_owner.display_name) end);
end;
$$;

-- Update community_write_original & community_write_acknowledged to support post editing, optional image & tagged venue.
create or replace function private.community_write_original(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor_user_id uuid := (select auth.uid()); actor private.community_authors%rowtype;
  action text; allowed text[]; post private.community_posts%rowtype;
  target_post_id uuid; target_author_id uuid; request_key uuid; content text; result jsonb;
  previous private.community_requests%rowtype; result_id uuid;
  img_url text; tag_venue uuid;
begin
  if actor_user_id is null or not exists (select 1 from auth.users u where u.id = actor_user_id and
    (u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'))) then
    raise exception using errcode = '42501', message = 'A verified account is required';
  end if;
  select a.* into actor from private.community_authors a where a.user_id = actor_user_id;
  if actor.id is null then raise exception using errcode = '42501', message = 'A verified account is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_user_id::text, 8726));
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 16384 then
    raise exception using errcode = '22023', message = 'Invalid community action';
  end if;
  action := p_action->>'action';
  allowed := case action
    when 'create' then array['action','body','visibility','requestId','imageUrl','venueId']
    when 'edit' then array['action','postId','body','imageUrl','venueId']
    when 'comment' then array['action','body','postId','requestId']
    when 'like' then array['action','postId','liked']
    when 'share' then array['action','postId','shared']
    when 'delete' then array['action','postId']
    when 'report' then array['action','postId','reason']
    when 'block' then array['action','authorId'] else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where not k = any(allowed)) then
    raise exception using errcode = '22023', message = 'Invalid community action';
  end if;
  begin
    if action in ('create','comment') then
      request_key := (p_action->>'requestId')::uuid;
      if request_key is null or jsonb_typeof(p_action->'body') is distinct from 'string'
        or not private.community_text_valid(p_action->>'body', case when action = 'create' then 2000 else 1000 end) then
        raise exception using errcode = '22023', message = 'Invalid community content';
      end if;
      content := btrim(p_action->>'body');
      select r.* into previous from private.community_requests r where r.author_id = actor.id and r.request_id = request_key;
      if found then
        if previous.request_hash <> md5(p_action::text) then raise exception using errcode = 'FC003', message = 'Changed retry'; end if;
        return previous.result;
      end if;
    end if;

    if action not in ('create','block') then
      target_post_id := (p_action->>'postId')::uuid;
      if target_post_id is null then raise exception using errcode = '22023', message = 'Invalid post'; end if;
      select p.* into post from private.community_posts p where p.id = target_post_id and p.deleted_at is null
        and (p.author_id = actor.id or (p.visibility = 'public' and p.moderation_status = 'published'))
        and not private.community_blocked(p.author_id, actor.id);
      if post.id is null then raise exception using errcode = 'FC004', message = 'Post not available'; end if;
    end if;

    if action in ('create','edit') then
      img_url := nullif(btrim(coalesce(p_action->>'imageUrl', '')), '');
      if img_url is not null and (char_length(img_url) > 500 or img_url !~ '^(/api/media/[0-9a-f-]{36}|https?://)') then
        raise exception using errcode = '22023', message = 'Invalid photo link';
      end if;
      if nullif(p_action->>'venueId', '') is not null then
        tag_venue := (p_action->>'venueId')::uuid;
        if not exists(select 1 from public.venues v where v.id = tag_venue and v.status = 'published' and v.ownership_verified_at is not null) then
          raise exception using errcode = '22023', message = 'Tagged venue unavailable';
        end if;
      end if;
    end if;

    if action = 'create' then
      if (p_action->>'visibility') not in ('public','private') or (p_action->>'visibility') is null then
        raise exception using errcode = '22023', message = 'Invalid visibility';
      end if;
      if (select count(*) from private.community_posts p where p.author_id = actor.id and p.created_at > now() - interval '1 day') >= 20 then
        raise exception using errcode = 'FC002', message = 'Posting limit';
      end if;
      insert into private.community_posts(author_id, body, visibility, image_url, venue_id)
      values (actor.id, content, p_action->>'visibility', img_url, tag_venue) returning id into result_id;
      result := jsonb_build_object('ok', true, 'id', result_id, 'status', case when p_action->>'visibility' = 'private' then 'private' else 'pending' end);
    elsif action = 'edit' then
      if post.author_id <> actor.id then raise exception using errcode = '42501', message = 'Post not available'; end if;
      if not private.community_text_valid(p_action->>'body', 2000) then
        raise exception using errcode = '22023', message = 'Check post text length';
      end if;
      content := btrim(p_action->>'body');
      update private.community_posts
        set body = content,
            image_url = case when p_action ? 'imageUrl' then img_url else image_url end,
            venue_id = case when p_action ? 'venueId' then tag_venue else venue_id end,
            moderation_status = case when visibility = 'public' then 'pending' else moderation_status end,
            updated_at = clock_timestamp()
        where id = post.id;
      result := jsonb_build_object('ok', true, 'id', post.id, 'status', case when post.visibility = 'private' then 'private' else 'pending' end);
    elsif action = 'delete' then
      if post.author_id <> actor.id then raise exception using errcode = '42501', message = 'Post not available'; end if;
      update private.community_posts p set deleted_at = now() where p.id = target_post_id;
      result := jsonb_build_object('ok', true);
    elsif action = 'block' then
      target_author_id := (p_action->>'authorId')::uuid;
      if target_author_id is null or target_author_id = actor.id or not exists(select 1 from private.community_authors a where a.id = target_author_id) then
        raise exception using errcode = 'FC004', message = 'Profile not available';
      end if;
      insert into private.community_blocks(author_id, blocked_id) values (actor.id, target_author_id) on conflict do nothing;
      result := jsonb_build_object('ok', true);
    elsif action = 'comment' then
      if (select count(*) from private.community_comments c where c.author_id = actor.id and c.created_at > now() - interval '1 day') >= 100 then
        raise exception using errcode = 'FC002', message = 'Comment limit';
      end if;
      insert into private.community_comments(post_id, author_id, body) values (target_post_id, actor.id, content) returning id into result_id;
      result := jsonb_build_object('ok', true, 'id', result_id, 'status', 'pending');
    elsif action = 'report' then
      if (p_action->>'reason') not in ('spam','abuse','other') or (p_action->>'reason') is null then
        raise exception using errcode = '22023', message = 'Invalid reason';
      end if;
      insert into private.community_reports(author_id, post_id, reason) values (actor.id, target_post_id, p_action->>'reason')
        on conflict(author_id, post_id) do update set reason = excluded.reason;
      result := jsonb_build_object('ok', true);
    else
      if post.visibility <> 'public' or post.moderation_status <> 'published' then
        raise exception using errcode = 'FC004', message = 'Post not available';
      end if;
      if action = 'like' then
        if jsonb_typeof(p_action->'liked') is distinct from 'boolean' then raise exception using errcode = '22023', message = 'Invalid reaction'; end if;
        if (p_action->>'liked')::boolean then insert into private.community_likes(author_id, post_id) values (actor.id, target_post_id) on conflict do nothing;
        else delete from private.community_likes l where l.author_id = actor.id and l.post_id = target_post_id; end if;
      else
        if p_action ? 'shared' and jsonb_typeof(p_action->'shared') is distinct from 'boolean' then
          raise exception using errcode = '22023', message = 'Invalid share';
        end if;
        if coalesce((p_action->>'shared')::boolean, true) then insert into private.community_shares(author_id, post_id) values (actor.id, target_post_id) on conflict do nothing;
        else delete from private.community_shares s where s.author_id = actor.id and s.post_id = target_post_id; end if;
      end if;
      result := jsonb_build_object('ok', true);
    end if;
  exception when invalid_text_representation then raise exception using errcode = '22023', message = 'Invalid community identifier';
  end;
  if request_key is not null then
    insert into private.community_requests(author_id, request_id, request_hash, result)
    values (actor.id, request_key, md5(p_action::text), result);
  end if;
  return result;
end;
$$;
revoke all on function private.community_write_original(jsonb) from public, anon, authenticated;

create or replace function private.community_write_acknowledged(p_action jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare actor uuid := private.community_policy_user();
begin
  if p_action->>'action' in ('create','edit','comment','like','share') then
    perform private.require_feed_age();
  end if;
  if p_action->>'action' in ('create','edit','comment','like','share') and not exists(
    select 1 from private.community_policy_acceptances a where a.user_id = actor and a.policy_version = private.community_policy_version()) then
    raise exception using errcode = 'FC005', message = 'Accept the community acknowledgement before taking part';
  end if;
  return private.community_write_original(p_action);
end;
$$;
revoke all on function private.community_write_acknowledged(jsonb) from public, anon, authenticated;
grant execute on function private.community_write_acknowledged(jsonb) to authenticated;

-- 4. Partner Workspace Extensions: 3D Building/Mall/Location Proposals, Photos, Loots ('ar_grab'|'map_grab'), Deals ('cafe' + badge + photo)
create or replace function private.partner_workspace(p_action jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  actor uuid := private.journey_user();
  operation text := p_action->>'action';
  venue public.venues%rowtype;
  target uuid := (p_action->>'venueId')::uuid;
  selected_dish uuid;
  token text;
  expiry timestamptz;
  output jsonb;
  allowed text[];
  existing_dish public.venue_dishes%rowtype;
  existing_promo public.promotions%rowtype;
  loot_id_val uuid;
  lat_val double precision;
  lng_val double precision;
  mall_val uuid;
  preset_val text;
  accent_val text;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 8192 then
    raise exception using errcode = '22023', message = 'Invalid action';
  end if;
  allowed := case operation
    when 'read' then array['action','venueId']
    when 'submit' then array['action','venueId','version']
    when 'details' then array['action','venueId','version','name','description','venueType','cuisine','address','suburb','state','postcode','gameEnabled']
    when 'building' then array['action','venueId','latitude','longitude','mallId','floor','unit','buildingPreset','accentColour','signage']
    when 'media' then array['action','venueId','coverImageUrl']
    when 'dish' then array['action','venueId','dishId','version','name','description','price','available','imageUrl']
    when 'issue' then array['action','venueId','dishId']
    when 'promo' then array['action','venueId','id','title','description','startsAt','endsAt','kind','badgeText','imageUrl']
    when 'lootCreate' then array['action','venueId','id','title','description','grabMode','rewardKind','modelStyle','rarity','xpReward','coinReward','promotionId','latitude','longitude','radiusMetres','cooldownHours','maxClaims','startsAt','endsAt','mallFloor']
    when 'lootWithdraw' then array['action','venueId','lootId']
    else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where k <> all(allowed)) then
    raise exception using errcode = '22023', message = 'Invalid action fields';
  end if;

  select * into venue from public.venues v where v.id = target and exists(select 1 from public.organization_members m
    where m.organization_id = v.organization_id and m.user_id = actor and m.role in ('owner','manager')) for update;
  if not found then raise exception using errcode = '42501', message = 'Restaurant manager required'; end if;

  if operation = 'submit' then
    if (p_action->>'version')::timestamptz is distinct from venue.updated_at then raise exception using errcode = 'FG409', message = 'Listing changed'; end if;
    if venue.status not in ('draft','pending') then raise exception using errcode = 'FG409', message = 'Listing already reviewed'; end if;
    update public.venues set status = 'pending' where id = target;
  elsif operation = 'details' then
    if (p_action->>'version')::timestamptz is distinct from venue.updated_at then raise exception using errcode = 'FG409', message = 'Listing changed'; end if;
    if not private.partner_text_valid(p_action->>'name',2,120)
      or not private.partner_text_valid(p_action->>'description',0,1000)
      or not private.partner_text_valid(p_action->>'cuisine',2,60)
      or not private.partner_text_valid(p_action->>'address',5,200)
      or not private.partner_text_valid(p_action->>'suburb',2,100)
      or p_action->>'state' not in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
      or not (p_action->>'postcode' ~ '^[0-9]{4}$')
      or jsonb_typeof(p_action->'gameEnabled') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Invalid venue details';
    end if;
    update public.venues set
      name = btrim(p_action->>'name'),
      description = p_action->>'description',
      venue_type = coalesce(nullif(p_action->>'venueType',''), venue_type),
      cuisine = btrim(p_action->>'cuisine'),
      address = btrim(p_action->>'address'),
      suburb = btrim(p_action->>'suburb'),
      state = p_action->>'state',
      postcode = p_action->>'postcode',
      game_enabled = (p_action->>'gameEnabled')::boolean
    where id = target;
  elsif operation = 'building' then
    lat_val := nullif(p_action->>'latitude', '')::double precision;
    lng_val := nullif(p_action->>'longitude', '')::double precision;
    mall_val := nullif(p_action->>'mallId', '')::uuid;
    preset_val := coalesce(nullif(p_action->>'buildingPreset', ''), venue.building_preset);
    accent_val := coalesce(nullif(p_action->>'accentColour', ''), '#00c49a');
    if preset_val not in ('isometric-cafe','japanese-bakery','kyoto-restaurant','stylized-food-truck','city-bistro','mall-unit')
      or accent_val !~ '^#[0-9a-fA-F]{6}$' then
      raise exception using errcode = '22023', message = 'Invalid 3D building style';
    end if;
    if (lat_val is not null and (lat_val not between -38.05 and -37.65 or lng_val not between 144.80 and 145.15)) then
      raise exception using errcode = '22023', message = 'Select coordinates inside the Melbourne Pilot boundary';
    end if;
    insert into private.venue_building_proposals(
      venue_id, proposed_latitude, proposed_longitude, proposed_mall_id, proposed_floor, proposed_unit,
      proposed_building_preset, proposed_accent_colour, proposed_signage, review_status, submitted_by, submitted_at
    ) values (
      target, lat_val, lng_val, mall_val,
      nullif(btrim(coalesce(p_action->>'floor', '')), ''),
      nullif(btrim(coalesce(p_action->>'unit', '')), ''),
      preset_val, accent_val, nullif(btrim(coalesce(p_action->>'signage', '')), ''),
      'pending', actor, clock_timestamp()
    )
    on conflict (venue_id) do update set
      proposed_latitude = coalesce(excluded.proposed_latitude, private.venue_building_proposals.proposed_latitude),
      proposed_longitude = coalesce(excluded.proposed_longitude, private.venue_building_proposals.proposed_longitude),
      proposed_mall_id = excluded.proposed_mall_id,
      proposed_floor = excluded.proposed_floor,
      proposed_unit = excluded.proposed_unit,
      proposed_building_preset = excluded.proposed_building_preset,
      proposed_accent_colour = excluded.proposed_accent_colour,
      proposed_signage = excluded.proposed_signage,
      review_status = 'pending',
      review_note = null,
      submitted_by = actor,
      submitted_at = clock_timestamp();
    update public.venues set building_review_status = 'pending' where id = target;
  elsif operation = 'media' then
    update public.venues set cover_image_url = nullif(btrim(coalesce(p_action->>'coverImageUrl', '')), '') where id = target;
  elsif operation = 'dish' then
    selected_dish := (p_action->>'dishId')::uuid;
    if selected_dish is null or not private.partner_text_valid(p_action->>'name',2,120)
      or not private.partner_text_valid(coalesce(p_action->>'description',''),0,1000)
      or jsonb_typeof(p_action->'price') is distinct from 'number' or (p_action->>'price')::integer not between 0 and 1000000
      or jsonb_typeof(p_action->'available') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Invalid dish';
    end if;
    select * into existing_dish from public.venue_dishes where id = selected_dish for update;
    if found and existing_dish.venue_id <> target then raise exception using errcode = '42501', message = 'Dish belongs to another venue'; end if;
    if found and (p_action->>'version')::timestamptz is distinct from existing_dish.updated_at then raise exception using errcode = 'FG409', message = 'Dish changed'; end if;
    if existing_dish.id is null and (select count(*) from public.venue_dishes where venue_id = target) >= 100 then raise exception using errcode = 'FG429', message = 'Menu limit reached'; end if;
    insert into public.venue_dishes(id, venue_id, name, description, price_aud_cents, is_available, image_url)
    values (selected_dish, target, btrim(p_action->>'name'), coalesce(p_action->>'description',''), (p_action->>'price')::integer, (p_action->>'available')::boolean, nullif(btrim(coalesce(p_action->>'imageUrl', '')), ''))
    on conflict(id) do update set
      name = excluded.name,
      description = excluded.description,
      price_aud_cents = excluded.price_aud_cents,
      is_available = excluded.is_available,
      image_url = coalesce(excluded.image_url, public.venue_dishes.image_url);
  elsif operation = 'issue' then
    if venue.status <> 'published' or venue.ownership_verified_at is null or not venue.game_enabled then
      raise exception using errcode = 'FG409', message = 'Verified game-enabled published venue required';
    end if;
    selected_dish := (p_action->>'dishId')::uuid;
    if selected_dish is not null and not exists(select 1 from public.venue_dishes where id = selected_dish and venue_id = target and is_available) then
      raise exception using errcode = 'FG404', message = 'Dish unavailable';
    end if;
    if (select count(*) from private.exploration_codes where venue_id = target and created_at > now() - interval '1 hour') >= 60 then
      raise exception using errcode = 'FG429', message = 'Code limit reached';
    end if;
    token := replace(gen_random_uuid()::text, '-', ''); expiry := now() + interval '10 minutes';
    update private.exploration_codes c set expires_at = now() where c.venue_id = target and c.dish_id is not distinct from selected_dish and c.expires_at > now();
    insert into private.exploration_codes(venue_id, dish_id, issuer, token_hash, expires_at) values (target, selected_dish, actor, md5(token), expiry);
    return jsonb_build_object('code', token, 'expiresAt', expiry);
  elsif operation = 'promo' then
    if p_action ? 'kind' and (jsonb_typeof(p_action->'kind') is distinct from 'string' or p_action->>'kind' not in ('food','restaurant','cafe')) then
      raise exception using errcode = '22023', message = 'Invalid offer category';
    end if;
    if venue.status <> 'published' or venue.ownership_verified_at is null then raise exception using errcode = 'FG409', message = 'Published venue required'; end if;
    select * into existing_promo from public.promotions where id = (p_action->>'id')::uuid for update;
    if found then
      raise exception using errcode = 'FG409', message = 'Offer already submitted';
    end if;
    if not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400) then
      raise exception using errcode = '22023', message = 'Invalid offer';
    end if;
    if (select count(*) from public.promotions where venue_id = target and created_at > now() - interval '1 day') >= 20 then
      raise exception using errcode = 'FG429', message = 'Daily offer limit reached';
    end if;
    insert into public.promotions(id, venue_id, title, description, starts_at, ends_at, kind, badge_text, image_url)
    values (
      (p_action->>'id')::uuid, target, btrim(p_action->>'title'), btrim(p_action->>'description'),
      (p_action->>'startsAt')::timestamptz, (p_action->>'endsAt')::timestamptz,
      coalesce(p_action->>'kind', 'restaurant'),
      nullif(btrim(coalesce(p_action->>'badgeText', '')), ''),
      nullif(btrim(coalesce(p_action->>'imageUrl', '')), '')
    );
  elsif operation = 'lootCreate' then
    if venue.status <> 'published' or venue.ownership_verified_at is null then
      raise exception using errcode = 'FG409', message = 'Published venue required before placing loots';
    end if;
    lat_val := coalesce(nullif(p_action->>'latitude','')::double precision, venue.latitude);
    lng_val := coalesce(nullif(p_action->>'longitude','')::double precision, venue.longitude);
    if lat_val is null or lng_val is null then
      raise exception using errcode = 'FG409', message = 'Verify venue coordinates before placing map or AR loots';
    end if;
    insert into private.world_loots(
      id, source, venue_id, mall_id, mall_floor, creator, title, description, grab_mode, reward_kind,
      model_style, rarity, xp_reward, coin_reward, promotion_id, latitude, longitude, radius_metres,
      cooldown_hours, max_claims, starts_at, ends_at, status
    ) values (
      coalesce((p_action->>'id')::uuid, gen_random_uuid()),
      'restaurant',
      target,
      venue.mall_id,
      coalesce(nullif(btrim(coalesce(p_action->>'mallFloor','')), ''), venue.mall_floor),
      actor,
      btrim(p_action->>'title'),
      btrim(p_action->>'description'),
      coalesce(p_action->>'grabMode', 'ar_grab'),
      coalesce(p_action->>'rewardKind', 'collectible'),
      coalesce(p_action->>'modelStyle', 'reward_crate'),
      coalesce(p_action->>'rarity', 'rare'),
      least(300, greatest(25, coalesce((p_action->>'xpReward')::integer, 60))),
      least(200, greatest(0, coalesce((p_action->>'coinReward')::integer, 25))),
      nullif(p_action->>'promotionId', '')::uuid,
      lat_val, lng_val,
      least(150, greatest(25, coalesce((p_action->>'radiusMetres')::integer, 65))),
      least(168, greatest(0, coalesce((p_action->>'cooldownHours')::integer, 24))),
      least(5000, greatest(1, coalesce((p_action->>'maxClaims')::integer, 250))),
      coalesce((p_action->>'startsAt')::timestamptz, clock_timestamp()),
      coalesce((p_action->>'endsAt')::timestamptz, clock_timestamp() + interval '60 days'),
      'pending'
    );
  elsif operation = 'lootWithdraw' then
    loot_id_val := (p_action->>'lootId')::uuid;
    update private.world_loots set status = 'withdrawn' where id = loot_id_val and venue_id = target;
  elsif operation is distinct from 'read' then
    raise exception using errcode = '22023', message = 'Unknown action';
  end if;

  select jsonb_build_object(
    'venue', to_jsonb(v) - 'organization_id' - 'location',
    'buildingProposal', (select to_jsonb(bp) from private.venue_building_proposals bp where bp.venue_id = target),
    'malls', public.food_go_malls(),
    'contact', (select jsonb_build_object('email', email, 'phone', phone) from public.venue_contacts where venue_id = target),
    'dishes', coalesce((select jsonb_agg(to_jsonb(d) order by d.name) from public.venue_dishes d where venue_id = target), '[]'::jsonb),
    'promotions', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select * from public.promotions where venue_id = target order by created_at desc limit 100) p), '[]'::jsonb),
    'loots', coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'description', l.description, 'grabMode', l.grab_mode,
      'rewardKind', l.reward_kind, 'modelStyle', l.model_style, 'rarity', l.rarity,
      'xpReward', l.xp_reward, 'coinReward', l.coin_reward, 'status', l.status, 'reviewNote', l.review_note,
      'claimedCount', l.claimed_count, 'maxClaims', l.max_claims, 'latitude', l.latitude, 'longitude', l.longitude,
      'startsAt', l.starts_at, 'endsAt', l.ends_at
    ) order by l.created_at desc) from private.world_loots l where l.venue_id = target limit 50), '[]'::jsonb),
    'visits', (select count(*) from public.check_ins where venue_id = target),
    'discoveries', (select count(*) from public.food_discoveries where venue_id = target),
    'pendingReservations', (select count(*) from private.venue_reservations r where r.venue_id = target and r.status = 'pending')
  ) into output from public.venues v where v.id = target;
  return output;
end;
$$;
revoke all on function private.partner_workspace(jsonb) from public, anon, authenticated;
grant execute on function private.partner_workspace(jsonb) to authenticated;

-- 5. Operator Portal Extensions: Buildings/Malls Approval, World Loots & Special Game Rewards Placement, Quests Approval, Full Reports & Analytics
create or replace function private.operator_entries(section text)
returns table(id uuid, at_time timestamptz, entry jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
  case section
  when 'venues' then return query
    select v.id, v.created_at, jsonb_build_object(
      'id', v.id, 'name', v.name,
      'detail', concat_ws(', ', v.address, v.suburb, v.state, v.postcode),
      'state', v.status, 'verified', v.ownership_verified_at is not null, 'version', v.updated_at,
      'latitude', v.latitude, 'longitude', v.longitude,
      'organisation', o.name, 'contactEmail', c.email, 'contactPhone', c.phone,
      'buildingPreset', v.building_preset, 'mallId', v.mall_id, 'mallFloor', v.mall_floor, 'mallUnit', v.mall_unit
    )
    from public.venues v join public.organizations o on o.id = v.organization_id left join public.venue_contacts c on c.venue_id = v.id;
  when 'buildings' then return query
    select bp.venue_id, bp.submitted_at, jsonb_build_object(
      'id', bp.venue_id,
      'name', v.name,
      'detail', coalesce(m.name, 'Standalone Storefront') || coalesce(' · Floor ' || bp.proposed_floor, '') || coalesce(' · Unit ' || bp.proposed_unit, '') || ' · 3D Model: ' || bp.proposed_building_preset,
      'state', bp.review_status,
      'version', bp.submitted_at::text,
      'proposedLatitude', bp.proposed_latitude,
      'proposedLongitude', bp.proposed_longitude,
      'proposedPreset', bp.proposed_building_preset,
      'proposedAccent', bp.proposed_accent_colour,
      'proposedSignage', bp.proposed_signage,
      'proposedMallId', bp.proposed_mall_id,
      'proposedFloor', bp.proposed_floor,
      'proposedUnit', bp.proposed_unit
    )
    from private.venue_building_proposals bp
    join public.venues v on v.id = bp.venue_id
    left join public.malls m on m.id = bp.proposed_mall_id;
  when 'malls' then return query
    select m.id, m.created_at, jsonb_build_object(
      'id', m.id, 'name', m.name,
      'detail', m.address || ', ' || m.suburb || ' · Shops: ' || (select count(*) from public.venues v where v.mall_id = m.id),
      'state', m.status, 'version', m.updated_at::text,
      'latitude', m.latitude, 'longitude', m.longitude, 'modelPreset', m.model_preset, 'floors', m.floors
    )
    from public.malls m;
  when 'loots' then return query
    select l.id, l.created_at, jsonb_build_object(
      'id', l.id, 'name', l.title,
      'detail', l.source || ' · ' || l.grab_mode || ' · +' || l.xp_reward || ' XP / ' || l.coin_reward || ' Coins' || coalesce(' · ' || v.name, ' · City Game Drop'),
      'state', l.status, 'source', l.source, 'grabMode', l.grab_mode, 'rewardKind', l.reward_kind,
      'modelStyle', l.model_style, 'rarity', l.rarity, 'visibilityMode', l.visibility_mode,
      'xpReward', l.xp_reward, 'coinReward', l.coin_reward,
      'latitude', l.latitude, 'longitude', l.longitude, 'radiusMetres', l.radius_metres,
      'claimedCount', l.claimed_count, 'maxClaims', l.max_claims,
      'version', l.updated_at::text
    )
    from private.world_loots l left join public.venues v on v.id = l.venue_id;
  when 'promotions' then return query
    select p.id, p.created_at, jsonb_build_object(
      'id', p.id, 'name', p.title, 'detail', p.description, 'state', p.status,
      'kind', p.kind, 'badgeText', p.badge_text, 'venueId', p.venue_id, 'venueName', v.name,
      'startsAt', p.starts_at, 'endsAt', p.ends_at, 'version', p.updated_at
    )
    from public.promotions p join public.venues v on v.id = p.venue_id;
  when 'quests' then return query
    select q.id, q.created_at, jsonb_build_object(
      'id', q.id, 'name', q.title, 'detail', v.name || ' · ' || q.category || ' · ' || q.description,
      'state', q.status, 'venueId', q.venue_id, 'venueName', v.name, 'startsAt', q.starts_at, 'endsAt', q.ends_at, 'version', q.updated_at::text
    )
    from private.adventure_quests q join public.venues v on v.id = q.venue_id;
  when 'posts' then return query
    select p.id, p.created_at, jsonb_build_object('id', p.id, 'name', a.display_name, 'detail', p.body, 'state', p.moderation_status, 'version', p.moderation_status)
    from private.community_posts p join private.community_authors a on a.id = p.author_id where p.visibility = 'public' and p.deleted_at is null;
  when 'comments' then return query
    select c.id, c.created_at, jsonb_build_object('id', c.id, 'name', a.display_name, 'detail', c.body, 'state', c.moderation_status, 'version', c.moderation_status, 'context', left(p.body, 250))
    from private.community_comments c join private.community_posts p on p.id = c.post_id join private.community_authors a on a.id = c.author_id
    where p.visibility = 'public' and p.deleted_at is null;
  when 'reports' then return query
    select p.id, max(r.created_at), jsonb_build_object('id', p.id, 'name', count(*) || ' report' || case when count(*) = 1 then '' else 's' end,
      'detail', p.body, 'state', string_agg(distinct r.reason, ', ' order by r.reason),
      'version', md5(string_agg(r.author_id::text || ':' || r.reason, ',' order by r.author_id)))
    from private.community_reports r join private.community_posts p on p.id = r.post_id where p.visibility = 'public' and p.deleted_at is null group by p.id;
  when 'audit' then return query
    select a.request_id, a.created_at, jsonb_build_object('id', a.request_id, 'name', a.action, 'detail', a.reason, 'state', a.target, 'actor', a.actor, 'at', a.created_at)
    from private.operator_audit a;
  else raise exception using errcode = '22023', message = 'Unknown operator section';
  end case;
end;
$$;
revoke all on function private.operator_entries(text) from public, anon, authenticated;

create or replace function private.operator_change(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
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
  bp private.venue_building_proposals%rowtype;
  loot_row private.world_loots%rowtype;
  reporters uuid[];
  reports_version text;
  venue_ref uuid;
  starts timestamptz;
  ends timestamptz;
  lat double precision;
  lon double precision;
  allowed text[] := array['action','id','requestId','reason','version'];
begin
  if private.food_go_operator_access() <> 'ready' then raise exception using errcode = '42501', message = 'Operator session required'; end if;
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 12288
    or not private.partner_text_valid(note, 3, 240) then
    raise exception using errcode = '22023', message = 'Invalid decision';
  end if;
  if operation in ('promo.create','promo.edit') then
    allowed := allowed || array['venueId','title','description','startsAt','endsAt','kind','badgeText','imageUrl'];
  elsif operation = 'venue.locate' then
    allowed := allowed || array['latitude','longitude'];
  elsif operation in ('reward.upsert') then
    allowed := allowed || array['title','description','grabMode','rewardKind','modelStyle','rarity','visibilityMode','xpReward','coinReward','latitude','longitude','radiusMetres','cooldownHours','maxClaims','startsAt','endsAt'];
  elsif operation in ('mall.upsert') then
    allowed := allowed || array['name','address','suburb','postcode','latitude','longitude','entranceDescription','modelPreset'];
  end if;
  if exists(select 1 from jsonb_object_keys(p_action) k where k <> all(allowed)) then
    raise exception using errcode = '22023', message = 'Invalid decision fields';
  end if;
  request_id_value := (p_action->>'requestId')::uuid;
  target_id := (p_action->>'id')::uuid;
  if request_id_value is null or target_id is null then raise exception using errcode = '22023', message = 'Missing decision identifier'; end if;

  perform pg_advisory_xact_lock(hashtextextended(request_id_value::text, 87146));
  select * into previous from private.operator_audit where request_id = request_id_value;
  if found then
    if previous.actor <> actor or previous.request_hash <> action_hash then raise exception using errcode = 'FG409', message = 'Decision key already used'; end if;
    return jsonb_build_object('ok', true);
  end if;

  if operation in ('venue.verify','venue.revoke','venue.publish','venue.suspend','venue.locate') then
    select * into venue from public.venues where id = target_id for update;
    if not found then raise exception using errcode = 'FG404', message = 'Venue unavailable'; end if;
    if expected::timestamptz is distinct from venue.updated_at then raise exception using errcode = 'FG409', message = 'Venue has changed'; end if;
    if exists(select 1 from public.organization_members where organization_id = venue.organization_id and user_id = actor) then
      raise exception using errcode = '42501', message = 'An independent operator must review this venue';
    end if;
    case operation
      when 'venue.verify' then update public.venues set ownership_verified_at = now(), status = case when status = 'draft' then 'pending' else status end where id = target_id;
      when 'venue.revoke' then update public.venues set ownership_verified_at = null, status = 'suspended' where id = target_id;
      when 'venue.publish' then
        if venue.ownership_verified_at is null then raise exception using errcode = 'FG409', message = 'Verify ownership before publication'; end if;
        update public.venues set status = 'published' where id = target_id;
      when 'venue.suspend' then update public.venues set status = 'suspended' where id = target_id;
      when 'venue.locate' then
        lat := (p_action->>'latitude')::double precision; lon := (p_action->>'longitude')::double precision;
        if lat not between -90 and 90 or lon not between -180 and 180 then raise exception using errcode = '22023', message = 'Invalid map position'; end if;
        update public.venues set latitude = lat, longitude = lon where id = target_id;
    end case;
  elsif operation in ('building.approve','building.reject') then
    select * into bp from private.venue_building_proposals where venue_id = target_id for update;
    if not found then raise exception using errcode = 'FG404', message = 'Building proposal unavailable'; end if;
    select * into venue from public.venues where id = target_id for update;
    if exists(select 1 from public.organization_members where organization_id = venue.organization_id and user_id = actor) then
      raise exception using errcode = '42501', message = 'Independent operator review required';
    end if;
    if operation = 'building.approve' then
      update public.venues set
        latitude = coalesce(bp.proposed_latitude, latitude),
        longitude = coalesce(bp.proposed_longitude, longitude),
        mall_id = bp.proposed_mall_id,
        mall_floor = bp.proposed_floor,
        mall_unit = bp.proposed_unit,
        building_preset = bp.proposed_building_preset,
        building_accent_colour = bp.proposed_accent_colour,
        building_signage = bp.proposed_signage,
        building_review_status = 'approved'
      where id = target_id;
      update private.venue_building_proposals set review_status = 'approved', review_note = note, reviewed_by = actor, reviewed_at = clock_timestamp() where venue_id = target_id;
    else
      update public.venues set building_review_status = 'rejected' where id = target_id;
      update private.venue_building_proposals set review_status = 'rejected', review_note = note, reviewed_by = actor, reviewed_at = clock_timestamp() where venue_id = target_id;
    end if;
  elsif operation in ('mall.upsert','mall.publish','mall.suspend') then
    if operation = 'mall.upsert' then
      lat := (p_action->>'latitude')::double precision; lon := (p_action->>'longitude')::double precision;
      insert into public.malls (id, slug, name, address, suburb, postcode, latitude, longitude, entrance_description, model_preset, floors, status)
      values (
        target_id,
        lower(regexp_replace(btrim(p_action->>'name'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(target_id::text, 1, 6),
        btrim(p_action->>'name'),
        btrim(p_action->>'address'),
        coalesce(nullif(btrim(coalesce(p_action->>'suburb','')),''), 'Melbourne'),
        coalesce(nullif(btrim(coalesce(p_action->>'postcode','')),''), '3000'),
        lat, lon,
        coalesce(nullif(btrim(coalesce(p_action->>'entranceDescription','')),''), 'Main street entrance'),
        coalesce(nullif(p_action->>'modelPreset',''), 'city-mall'),
        '[{"id":"g","code":"G","name":"Ground Floor","description":"Street entrance level"},{"id":"l1","code":"L1","name":"Level 1","description":"Dining terrace and cafes"}]'::jsonb,
        'published'
      )
      on conflict (id) do update set
        name = excluded.name, address = excluded.address, suburb = excluded.suburb,
        postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude,
        entrance_description = excluded.entrance_description, model_preset = excluded.model_preset;
    elsif operation = 'mall.publish' then
      update public.malls set status = 'published' where id = target_id;
    else
      update public.malls set status = 'suspended' where id = target_id;
    end if;
  elsif operation in ('reward.upsert','loot.approve','loot.reject','loot.withdraw') then
    if operation = 'reward.upsert' then
      lat := (p_action->>'latitude')::double precision; lon := (p_action->>'longitude')::double precision;
      if lat not between -38.05 and -37.65 or lon not between 144.80 and 145.15 then
        raise exception using errcode = '22023', message = 'Game reward coordinates must fall inside the Melbourne Pilot zone';
      end if;
      insert into private.world_loots(
        id, source, creator, title, description, grab_mode, reward_kind, model_style, rarity, visibility_mode,
        xp_reward, coin_reward, latitude, longitude, radius_metres, cooldown_hours, max_claims, starts_at, ends_at, status, review_note
      ) values (
        target_id, 'game_admin', actor,
        btrim(p_action->>'title'), btrim(p_action->>'description'),
        coalesce(p_action->>'grabMode', 'map_grab'),
        coalesce(p_action->>'rewardKind', 'xp_coins'),
        coalesce(p_action->>'modelStyle', 'golden_crystal'),
        coalesce(p_action->>'rarity', 'epic'),
        coalesce(p_action->>'visibilityMode', 'always_visible'),
        least(1000, greatest(10, coalesce((p_action->>'xpReward')::integer, 100))),
        least(1000, greatest(0, coalesce((p_action->>'coinReward')::integer, 50))),
        lat, lon,
        least(250, greatest(20, coalesce((p_action->>'radiusMetres')::integer, 75))),
        least(720, greatest(0, coalesce((p_action->>'cooldownHours')::integer, 24))),
        least(100000, greatest(1, coalesce((p_action->>'maxClaims')::integer, 2000))),
        coalesce((p_action->>'startsAt')::timestamptz, clock_timestamp()),
        coalesce((p_action->>'endsAt')::timestamptz, clock_timestamp() + interval '180 days'),
        'published', note
      )
      on conflict (id) do update set
        title = excluded.title, description = excluded.description, grab_mode = excluded.grab_mode,
        model_style = excluded.model_style, rarity = excluded.rarity, visibility_mode = excluded.visibility_mode,
        xp_reward = excluded.xp_reward, coin_reward = excluded.coin_reward,
        latitude = excluded.latitude, longitude = excluded.longitude, radius_metres = excluded.radius_metres,
        cooldown_hours = excluded.cooldown_hours, max_claims = excluded.max_claims, status = 'published', review_note = note;
    else
      select * into loot_row from private.world_loots where id = target_id for update;
      if not found then raise exception using errcode = 'FG404', message = 'Loot item unavailable'; end if;
      if operation = 'loot.approve' then
        update private.world_loots set status = 'published', review_note = note where id = target_id;
      elsif operation = 'loot.reject' then
        update private.world_loots set status = 'rejected', review_note = note where id = target_id;
      else
        update private.world_loots set status = 'withdrawn', review_note = note where id = target_id;
      end if;
    end if;
  elsif operation in ('promo.create','promo.edit','promo.publish','promo.withdraw') then
    if operation <> 'promo.create' then
      select * into promo from public.promotions where id = target_id for update;
      if not found then raise exception using errcode = 'FG404', message = 'Promotion unavailable'; end if;
      if expected::timestamptz is distinct from promo.updated_at then raise exception using errcode = 'FG409', message = 'Promotion has changed'; end if;
      venue_ref := promo.venue_id;
    else venue_ref := (p_action->>'venueId')::uuid;
    end if;
    select * into venue from public.venues where id = venue_ref for share;
    if not found then raise exception using errcode = 'FG404', message = 'Venue unavailable'; end if;
    if operation <> 'promo.withdraw' and (venue.status <> 'published' or venue.ownership_verified_at is null) then
      raise exception using errcode = 'FG409', message = 'Select a published venue';
    end if;
    if exists(select 1 from public.organization_members where organization_id = venue.organization_id and user_id = actor) then
      raise exception using errcode = '42501', message = 'An independent operator must review this offer';
    end if;
    if operation in ('promo.create','promo.edit') then
      if (p_action ? 'kind' and (jsonb_typeof(p_action->'kind') is distinct from 'string' or p_action->>'kind' not in ('food','restaurant','cafe')))
        or not private.partner_text_valid(p_action->>'title',2,90) or not private.partner_text_valid(p_action->>'description',2,400)
        or (p_action->>'venueId')::uuid is distinct from venue_ref then
        raise exception using errcode = '22023', message = 'Invalid offer details';
      end if;
      starts := (p_action->>'startsAt')::timestamptz; ends := (p_action->>'endsAt')::timestamptz;
      if starts is null or ends is null or not isfinite(starts) or not isfinite(ends) or ends <= starts or ends <= now() then
        raise exception using errcode = '22023', message = 'Invalid offer dates';
      end if;
      if operation = 'promo.create' then
        insert into public.promotions(id, venue_id, title, description, starts_at, ends_at, kind, badge_text, image_url)
        values (target_id, venue_ref, btrim(p_action->>'title'), btrim(p_action->>'description'), starts, ends,
          coalesce(p_action->>'kind', 'restaurant'), nullif(btrim(coalesce(p_action->>'badgeText','')), ''), nullif(btrim(coalesce(p_action->>'imageUrl','')), ''));
      else
        update public.promotions set kind = coalesce(p_action->>'kind', promo.kind), title = btrim(p_action->>'title'),
          description = btrim(p_action->>'description'), badge_text = coalesce(nullif(btrim(coalesce(p_action->>'badgeText','')), ''), badge_text),
          starts_at = starts, ends_at = ends, status = 'draft', updated_at = clock_timestamp()
        where id = target_id;
      end if;
    elsif operation = 'promo.publish' then
      if promo.ends_at <= now() then raise exception using errcode = 'FG409', message = 'Promotion has expired'; end if;
      update public.promotions set status = 'published', updated_at = clock_timestamp() where id = target_id;
    else
      update public.promotions set status = 'withdrawn', updated_at = clock_timestamp() where id = target_id;
    end if;
  elsif operation in ('post.publish','post.remove','report.dismiss','report.remove') then
    select * into post from private.community_posts p where p.id = target_id and p.visibility = 'public' and p.deleted_at is null for update;
    if not found then raise exception using errcode = 'FG404', message = 'Public post unavailable'; end if;
    if exists(select 1 from private.community_authors where id = post.author_id and user_id = actor) then
      raise exception using errcode = '42501', message = 'An independent operator must review this post';
    end if;
    if operation like 'report.%' then
      select array_agg(r.author_id), md5(string_agg(r.author_id::text || ':' || r.reason, ',' order by r.author_id))
        into reporters, reports_version from (select author_id, reason from private.community_reports where post_id = target_id for update) r;
      if reporters is null or expected is distinct from reports_version then raise exception using errcode = 'FG409', message = 'Reports have changed'; end if;
      delete from private.community_reports where post_id = target_id and author_id = any(reporters);
    elsif expected is distinct from post.moderation_status then
      raise exception using errcode = 'FG409', message = 'Post has changed';
    end if;
    if operation = 'post.publish' then update private.community_posts set moderation_status = 'published' where id = target_id;
    elsif operation in ('post.remove','report.remove') then update private.community_posts set deleted_at = now() where id = target_id;
    end if;
  elsif operation in ('comment.publish','comment.remove') then
    select c.* into comment_row from private.community_comments c join private.community_posts p on p.id = c.post_id
      where c.id = target_id and p.visibility = 'public' and p.deleted_at is null for update of c, p;
    if not found then raise exception using errcode = 'FG404', message = 'Comment unavailable'; end if;
    if exists(select 1 from private.community_authors where id = comment_row.author_id and user_id = actor) then
      raise exception using errcode = '42501', message = 'An independent operator must review this comment';
    end if;
    if expected is distinct from comment_row.moderation_status then raise exception using errcode = 'FG409', message = 'Comment has changed'; end if;
    if operation = 'comment.publish' then update private.community_comments set moderation_status = 'published' where id = target_id;
    else delete from private.community_comments where id = target_id;
    end if;
  else
    raise exception using errcode = '22023', message = 'Unknown decision';
  end if;

  insert into private.operator_audit(request_id, actor, action, target, reason, request_hash)
  values (request_id_value, actor, operation, target_id, note, action_hash);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function private.operator_change(jsonb) from public, anon, authenticated;

-- Admin Analytics & Reports endpoint
create function private.operator_analytics_report()
returns jsonb language plpgsql stable security definer set search_path = '' set statement_timeout = '8s' as $$
begin
  if private.food_go_operator_access() <> 'ready' then
    raise exception using errcode = '42501', message = 'Operator session required';
  end if;
  return jsonb_build_object(
    'generatedAt', clock_timestamp(),
    'accountsTotal', (select count(*) from public.profiles),
    'partnerAccounts', (select count(*) from public.profiles where account_type = 'partner'),
    'venues', jsonb_build_object(
      'total', (select count(*) from public.venues),
      'published', (select count(*) from public.venues where status = 'published' and ownership_verified_at is not null),
      'pending', (select count(*) from public.venues where status in ('draft','pending')),
      'suspended', (select count(*) from public.venues where status = 'suspended'),
      'pendingBuildingReviews', (select count(*) from private.venue_building_proposals where review_status = 'pending')
    ),
    'malls', jsonb_build_object(
      'total', (select count(*) from public.malls),
      'published', (select count(*) from public.malls where status = 'published'),
      'assignedShops', (select count(*) from public.venues where mall_id is not null and status = 'published')
    ),
    'deals', jsonb_build_object(
      'published', (select count(*) from public.promotions where status = 'published' and ends_at > now()),
      'draft', (select count(*) from public.promotions where status = 'draft'),
      'claims', (select count(*) from private.promotion_claims),
      'foodDeals', (select count(*) from public.promotions where status = 'published' and kind = 'food' and ends_at > now()),
      'restaurantDeals', (select count(*) from public.promotions where status = 'published' and kind = 'restaurant' and ends_at > now()),
      'cafeOffers', (select count(*) from public.promotions where status = 'published' and kind = 'cafe' and ends_at > now())
    ),
    'loots', jsonb_build_object(
      'publishedRestaurantLoots', (select count(*) from private.world_loots where source = 'restaurant' and status = 'published'),
      'pendingRestaurantLoots', (select count(*) from private.world_loots where source = 'restaurant' and status = 'pending'),
      'publishedGameRewards', (select count(*) from private.world_loots where source = 'game_admin' and status = 'published'),
      'totalClaims', (select count(*) from private.world_loot_claims),
      'arGrabs', (select count(*) from private.world_loot_claims where grab_mode = 'ar_grab'),
      'mapGrabs', (select count(*) from private.world_loot_claims where grab_mode = 'map_grab')
    ),
    'reservations', jsonb_build_object(
      'total', (select count(*) from private.venue_reservations),
      'pending', (select count(*) from private.venue_reservations where status = 'pending'),
      'approved', (select count(*) from private.venue_reservations where status = 'approved'),
      'completed', (select count(*) from private.venue_reservations where status = 'completed'),
      'declined', (select count(*) from private.venue_reservations where status = 'declined')
    ),
    'quests', jsonb_build_object(
      'published', (select count(*) from private.adventure_quests where status = 'published'),
      'pending', (select count(*) from private.adventure_quests where status = 'pending'),
      'completions', (select count(*) from private.adventure_participations where completed_at is not null)
    ),
    'community', jsonb_build_object(
      'publishedPosts', (select count(*) from private.community_posts where deleted_at is null and visibility = 'public' and moderation_status = 'published'),
      'pendingPosts', (select count(*) from private.community_posts where deleted_at is null and visibility = 'public' and moderation_status = 'pending'),
      'pendingComments', (select count(*) from private.community_comments where moderation_status = 'pending'),
      'openReports', (select count(distinct post_id) from private.community_reports)
    ),
    'visitsAndCheckIns', (select count(*) from public.check_ins),
    'topVenues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'suburb', v.suburb,
        'visits', (select count(*) from public.check_ins c where c.venue_id = v.id),
        'reservations', (select count(*) from private.venue_reservations r where r.venue_id = v.id),
        'lootClaims', (select count(*) from private.world_loot_claims wc join private.world_loots wl on wl.id = wc.loot_id where wl.venue_id = v.id)
      ) order by (select count(*) from public.check_ins c where c.venue_id = v.id) desc, v.name)
      from public.venues v
      where v.status = 'published'
      limit 15
    ), '[]'::jsonb)
  );
end;
$$;
create function public.food_go_operator_analytics()
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.operator_analytics_report(); $$;
revoke all on function private.operator_analytics_report(), public.food_go_operator_analytics() from public, anon, authenticated;
grant execute on function public.food_go_operator_analytics() to authenticated;

commit;

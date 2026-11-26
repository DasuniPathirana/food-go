-- Align DB avatar_id check constraint with canonical @food-go/domain AVATARS identifiers
begin;

alter table public.profiles drop constraint if exists profiles_avatar_id_check;
update public.profiles set avatar_id = 'explorer'
where avatar_id not in ('explorer','foodie','trailblazer','anime-sky','anime-violet');
alter table public.profiles add constraint profiles_avatar_id_check
  check (avatar_id in ('explorer','foodie','trailblazer','anime-sky','anime-violet'));

create or replace function private.update_user_profile(p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '6s' as $$
declare
  actor uuid := private.journey_user();
  next_name text;
  next_bio text;
  next_avatar text;
  next_motion boolean;
  allowed text[] := array['displayName','bio','avatarId','avatarIdleMotion'];
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 2048
    or exists(select 1 from jsonb_object_keys(p_action) k where k <> all(allowed)) then
    raise exception using errcode = '22023', message = 'Invalid profile fields';
  end if;
  if p_action ? 'displayName' then
    next_name := btrim(p_action->>'displayName');
    if not private.community_text_valid(next_name, 80) then
      raise exception using errcode = '22023', message = 'Display name must be between 1 and 80 characters';
    end if;
    update public.profiles set display_name = next_name where id = actor;
    update private.community_authors set display_name = next_name where user_id = actor;
  end if;
  if p_action ? 'bio' then
    next_bio := btrim(coalesce(p_action->>'bio', ''));
    if char_length(next_bio) > 300 or translate(next_bio, chr(9) || chr(10) || chr(13), '') ~ '[[:cntrl:]]' then
      raise exception using errcode = '22023', message = 'Bio must be 300 characters or fewer';
    end if;
    update public.profiles set bio = next_bio where id = actor;
  end if;
  if p_action ? 'avatarId' then
    next_avatar := p_action->>'avatarId';
    if next_avatar not in ('explorer','foodie','trailblazer','anime-sky','anime-violet') then
      raise exception using errcode = '22023', message = 'Choose a valid 3D avatar style';
    end if;
    update public.profiles set avatar_id = next_avatar where id = actor;
  end if;
  if p_action ? 'avatarIdleMotion' then
    if jsonb_typeof(p_action->'avatarIdleMotion') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Invalid motion preference';
    end if;
    next_motion := (p_action->>'avatarIdleMotion')::boolean;
    update public.profiles set avatar_idle_motion = next_motion where id = actor;
  end if;

  return (
    select jsonb_build_object(
      'ok', true,
      'displayName', p.display_name,
      'bio', coalesce(p.bio, ''),
      'avatarId', p.avatar_id,
      'avatarIdleMotion', p.avatar_idle_motion,
      'coins', p.coins
    )
    from public.profiles p where p.id = actor
  );
end;
$$;

commit;

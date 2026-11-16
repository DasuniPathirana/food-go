begin;

create table private.community_policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check(char_length(policy_version) between 1 and 120),
  accepted_at timestamptz not null default clock_timestamp(),
  primary key(user_id,policy_version)
);
alter table private.community_policy_acceptances enable row level security;
revoke all on private.community_policy_acceptances from public,anon,authenticated;

create function private.community_policy_version() returns text
language sql immutable set search_path='' as $$select 'food-go-community-2026-11-15'::text;$$;
revoke all on function private.community_policy_version() from public,anon,authenticated;

create function private.community_policy_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
  select u.id into actor from auth.users u where u.id=(select auth.uid())
    and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
    and (u.email_confirmed_at is not null or (u.phone_confirmed_at is not null and u.phone ~ '^\+?614[0-9]{8}$'));
  if actor is null then raise exception using errcode='42501',message='A verified active account is required'; end if;
  return actor;
end;
$$;
revoke all on function private.community_policy_user() from public,anon,authenticated;

create function private.community_policy_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.community_policy_user(); version text:=private.community_policy_version(); accepted timestamptz;
begin
  select a.accepted_at into accepted from private.community_policy_acceptances a where a.user_id=actor and a.policy_version=version;
  return jsonb_build_object('version',version,'acceptedAt',accepted);
end;
$$;
create function public.food_go_community_policy_status() returns jsonb
language sql security invoker set search_path='' as $$select private.community_policy_status();$$;

create function private.accept_community_policy(p_version text,p_accepted boolean) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare actor uuid:=private.community_policy_user(); version text:=private.community_policy_version();
begin
  if p_version is distinct from version or p_accepted is distinct from true then
    raise exception using errcode='22023',message='Accept the current community acknowledgement'; end if;
  insert into private.community_policy_acceptances(user_id,policy_version) values(actor,version) on conflict do nothing;
  return private.community_policy_status();
end;
$$;
create function public.food_go_accept_community_policy(p_version text,p_accepted boolean) returns jsonb
language sql security invoker set search_path='' as $$select private.accept_community_policy(p_version,p_accepted);$$;

revoke all on function private.community_policy_status(),public.food_go_community_policy_status(),
  private.accept_community_policy(text,boolean),public.food_go_accept_community_policy(text,boolean) from public,anon,authenticated;
grant execute on function private.community_policy_status(),public.food_go_community_policy_status(),
  private.accept_community_policy(text,boolean),public.food_go_accept_community_policy(text,boolean) to authenticated;

-- Preserve the reviewed content/rate-limit/idempotency implementation but remove
-- every direct client grant before exposing it through the checked wrapper.
alter function public.food_go_community_write(jsonb) set schema private;
alter function private.food_go_community_write(jsonb) rename to community_write_original;
revoke all on function private.community_write_original(jsonb) from public,anon,authenticated;

create function private.community_write_acknowledged(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.community_policy_user();
begin
  if p_action->>'action' in ('create','comment','like','share') and not exists(
    select 1 from private.community_policy_acceptances a where a.user_id=actor and a.policy_version=private.community_policy_version()) then
    raise exception using errcode='FC005',message='Accept the community acknowledgement before taking part';
  end if;
  return private.community_write_original(p_action);
end;
$$;
create function public.food_go_community_write(p_action jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.community_write_acknowledged(p_action);$$;
revoke all on function private.community_write_acknowledged(jsonb),public.food_go_community_write(jsonb) from public,anon,authenticated;
grant execute on function private.community_write_acknowledged(jsonb),public.food_go_community_write(jsonb) to authenticated;
comment on function public.food_go_community_write(jsonb) is 'Verified active caller-only moderated community actions. Participation requires the current acknowledgement; reporting, blocking and deletion remain available without it.';
comment on table private.community_policy_acceptances is 'Server-timestamped caller-bound acknowledgement receipts. No editable user metadata, IP address or user agent is used as acceptance authority.';

commit;

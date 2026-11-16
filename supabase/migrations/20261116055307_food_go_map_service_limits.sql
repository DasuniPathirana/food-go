begin;
create table private.map_service_limits (
  service text primary key check(service in ('geocoding','routing')),
  available_at timestamptz not null default '-infinity'
);
insert into private.map_service_limits(service) values('geocoding'),('routing');
alter table private.map_service_limits enable row level security;
revoke all on private.map_service_limits from public,anon,authenticated;

-- Shared across web processes. The lease contains a service name and timestamp,
-- with no coordinates, search terms, account IDs or routes.
create function private.map_service_lease(p_service text) returns boolean
language plpgsql security definer set search_path='' set statement_timeout='2s' as $$
begin
  if p_service is null or p_service not in ('geocoding','routing') then
    raise exception using errcode='22023',message='Invalid map service'; end if;
  update private.map_service_limits set available_at=clock_timestamp()+interval '1.1 seconds'
    where service=p_service and available_at<=clock_timestamp();
  return found;
end;
$$;
create function public.food_go_map_service_lease(p_service text) returns boolean
language sql security invoker set search_path='' as $$select private.map_service_lease(p_service);$$;
revoke all on function private.map_service_lease(text),public.food_go_map_service_lease(text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.map_service_lease(text),public.food_go_map_service_lease(text) to anon,authenticated;
commit;

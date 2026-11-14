-- Event trigger functions are invoked by PostgreSQL, never application clients.
-- Some hosted projects include this platform-installed helper with broad grants.
begin;
do $restrict_event_helper$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
      and p.pronargs = 0 and p.prorettype = 'event_trigger'::regtype) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$restrict_event_helper$;
commit;

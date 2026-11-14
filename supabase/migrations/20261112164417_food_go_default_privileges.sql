-- New postgres-owned application objects start closed to client roles.
-- This changes defaults for future objects, not grants on existing objects.
begin;

do $food_go_default_privileges_preflight$
begin
  if to_regclass('public.venues') is null
    or to_regclass('public.organizations') is null then
    raise exception 'Install the Food Go foundation before changing its default privileges';
  end if;
end;
$food_go_default_privileges_preflight$;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Schema defaults are additive. A schema-level REVOKE cannot remove the
-- implicit global PUBLIC EXECUTE privilege for newly created functions.
-- Remove that global default; add explicit grants in each future migration.
-- Existing function grants and service_role's explicit defaults are untouched.
alter default privileges for role postgres
  revoke execute on functions from public;

commit;

-- Read-only first-install checks. No data, permissions or settings are changed.
-- Run with the intended database administrator after independently confirming
-- the Supabase dashboard project name and reference. This SQL cannot determine
-- whether an otherwise empty database is the intended client project.
begin transaction read only;

select current_database() as database_name,
  current_user as database_role,
  current_setting('server_version') as postgres_version;

select required.role_name,
  exists (select 1 from pg_roles r where r.rolname = required.role_name) as installed
from (values ('anon'), ('authenticated'), ('service_role')) as required(role_name);

select required.object_name,
  case when required.object_type = 'relation'
    then to_regclass(required.object_name) is not null
    else to_regprocedure(required.object_name) is not null
  end as installed
from (values
  ('auth.users', 'relation'), ('storage.buckets', 'relation'),
  ('auth.uid()', 'function'), ('auth.role()', 'function')
) as required(object_name, object_type);

-- Empty result means no application relation name collides. A relation can be
-- a table, view, materialized view or another named PostgreSQL relation.
select n.nspname as schema_name, c.relname as existing_relation, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = any (array[
  'profiles', 'organizations', 'organization_members', 'venues', 'venue_contacts',
  'canonical_foods', 'venue_dishes', 'check_ins', 'food_discoveries', 'reward_events'
])
order by c.relname;

-- Existing private schema means stop. Its privileges and objects may belong
-- to a different application and must not be changed by a first installation.
select exists (select 1 from pg_namespace where nspname = 'private')
  as private_schema_collision;

-- PostGIS may be absent or installed in extensions. Any other schema means
-- stop and review compatibility. Do not drop or relocate an existing extension.
select e.extname, e.extversion, n.nspname as installed_schema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('postgis', 'pgtap')
order by e.extname;

select exists (
  select 1 from storage.buckets where id = 'food-go-venue-media'
) as storage_bucket_collision;

-- Inventory only, without reading application rows. Non-system relations
-- require review even if none use Food Go's proposed names.
select n.nspname as schema_name, c.relname as existing_relation, c.relkind,
  greatest(c.reltuples::bigint, 0) as estimated_rows
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
order by c.relname;

rollback;

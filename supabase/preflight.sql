-- Single SELECT for the CLI's --read-only mode and the dashboard SQL editor.
-- Metadata and counts only. No customer records, credentials or mutations.
-- Independently confirm the intended project before using these results.
select jsonb_build_object(
  'database', jsonb_build_object(
    'name', current_database(), 'role', current_user,
    'postgres_version', current_setting('server_version')
  ),
  'required_roles', (
    select jsonb_object_agg(required.role_name,
      exists (select 1 from pg_roles r where r.rolname = required.role_name))
    from (values ('anon'), ('authenticated'), ('service_role')) as required(role_name)
  ),
  'required_objects', (
    select jsonb_object_agg(required.object_name,
      case when required.object_type = 'relation'
        then to_regclass(required.object_name) is not null
        else to_regprocedure(required.object_name) is not null end)
    from (values
      ('auth.users', 'relation'), ('storage.buckets', 'relation'),
      ('auth.uid()', 'function'), ('auth.role()', 'function')
    ) as required(object_name, object_type)
  ),
  'relation_collisions', coalesce((
    select jsonb_agg(c.relname order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any (array[
      'profiles', 'organizations', 'organization_members', 'venues', 'venue_contacts',
      'canonical_foods', 'venue_dishes', 'check_ins', 'food_discoveries', 'reward_events'
    ])
  ), '[]'::jsonb),
  'private_schema_collision', exists (
    select 1 from pg_namespace where nspname = 'private'
  ),
  'extensions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', e.extname, 'version', e.extversion, 'schema', n.nspname
    ) order by e.extname)
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('postgis', 'pgtap')
  ), '[]'::jsonb),
  'storage_bucket_collision', exists (
    select 1 from storage.buckets where id = 'food-go-venue-media'
  ),
  'public_relations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', c.relname, 'kind', c.relkind,
      'estimated_rows', greatest(c.reltuples::bigint, 0)
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and not exists (
        select 1 from pg_depend d where d.classid = 'pg_class'::regclass
          and d.objid = c.oid and d.deptype = 'e'
      )
  ), '[]'::jsonb),
  'auth_user_count', (select count(*) from auth.users),
  'storage_object_count', (select count(*) from storage.objects),
  'storage_bucket_count', (select count(*) from storage.buckets)
) as food_go_preflight;

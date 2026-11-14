-- Read-only installed-schema checks. This does not replace tenant fixture tests.
with app_tables as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname = any (array[
    'profiles', 'organizations', 'organization_members', 'venues', 'venue_contacts',
    'canonical_foods', 'venue_dishes', 'check_ins', 'food_discoveries', 'reward_events'
  ])
)
select jsonb_build_object(
  'application_table_count', (select count(*) from app_tables),
  'all_application_tables_have_rls', (select bool_and(relrowsecurity) from app_tables),
  'application_policy_count', (select count(*) from pg_policies p where p.schemaname = 'public'
    and p.tablename in (select relname from app_tables)),
  'anonymous_contact_read_denied', not has_table_privilege('anon', 'public.venue_contacts', 'SELECT'),
  'anonymous_profile_read_denied', not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'authenticated_publish_denied', not has_column_privilege('authenticated', 'public.venues', 'status', 'UPDATE'),
  'authenticated_verification_denied', not has_column_privilege('authenticated', 'public.venues', 'ownership_verified_at', 'UPDATE'),
  'authenticated_membership_insert_denied', not has_table_privilege('authenticated', 'public.organization_members', 'INSERT'),
  'authenticated_check_in_insert_denied', not has_table_privilege('authenticated', 'public.check_ins', 'INSERT'),
  'authenticated_reward_insert_denied', not has_table_privilege('authenticated', 'public.reward_events', 'INSERT'),
  'media_bucket', (select jsonb_build_object('private', not public, 'max_bytes', file_size_limit,
    'allowed_mime_types', allowed_mime_types) from storage.buckets where id = 'food-go-venue-media'),
  'auth_user_count', (select count(*) from auth.users),
  'venue_count', (select count(*) from public.venues)
) as food_go_foundation;

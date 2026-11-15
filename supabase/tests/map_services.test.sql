begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
do $test_grants$
declare item record;
begin
  for item in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgtap' and p.prokind='f'
  loop execute format('grant execute on function %I.%I(%s) to anon,authenticated',item.nspname,item.proname,item.args); end loop;
end;
$test_grants$;
select plan(6);
update private.map_service_limits set available_at='-infinity';
set local role anon;
select ok(public.food_go_map_service_lease('routing'),'anonymous public route can obtain a shared lease');
select ok(not public.food_go_map_service_lease('routing'),'immediate second route is denied across callers');
select ok(public.food_go_map_service_lease('geocoding'),'search uses its own provider lease');
select throws_ok($$select public.food_go_map_service_lease('other')$$,'22023',null,'unknown services cannot allocate state');
select throws_ok($$select * from private.map_service_limits$$,'42501',null,'lease timestamps remain private');
select throws_ok($$select * from private.community_posts$$,'42501',null,'anonymous schema usage does not expose posts');
reset role;
select * from finish();
rollback;

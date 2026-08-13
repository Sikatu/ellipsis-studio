do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'discovery_projects'
  ) then
    execute 'alter publication supabase_realtime add table public.discovery_projects';
  end if;
end
$$;
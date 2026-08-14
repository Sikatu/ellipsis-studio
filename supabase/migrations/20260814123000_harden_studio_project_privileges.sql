-- S12.1.2
-- Harden Studio project privileges before VA Hub membership expansion.
--
-- RLS protects row operations, but does not protect TRUNCATE.
-- Supabase default table privileges can grant authenticated more rights
-- than the application requires, so explicitly reset the ACL.

revoke all
  on table public.studio_projects
  from anon, authenticated;

grant select, insert, update, delete
  on table public.studio_projects
  to authenticated;

grant all
  on table public.studio_projects
  to service_role;

-- Trigger function is internal implementation detail.
-- Authenticated users do not need to invoke it directly.

revoke execute
  on function private.validate_studio_project_write()
  from public, anon, authenticated;

grant execute
  on function private.validate_studio_project_write()
  to service_role;
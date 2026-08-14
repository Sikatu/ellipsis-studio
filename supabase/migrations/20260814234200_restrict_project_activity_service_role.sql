-- S12.5A hardening 2
-- Restrict the application service role to append/read only.

revoke all
  on table public.studio_project_activity_events
  from service_role;

grant select, insert
  on table public.studio_project_activity_events
  to service_role;

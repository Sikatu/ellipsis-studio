-- S12.5A hardening
-- Keep project activity history append-oriented at the application boundary.

revoke update, delete, truncate
  on table public.studio_project_activity_events
  from service_role;

grant select, insert
  on table public.studio_project_activity_events
  to service_role;

alter table public.studio_project_activity_events
  add constraint studio_project_activity_events_entity_pair_check
  check (
    (
      entity_type is null
      and entity_id is null
    )
    or
    (
      entity_type is not null
      and entity_id is not null
    )
  );

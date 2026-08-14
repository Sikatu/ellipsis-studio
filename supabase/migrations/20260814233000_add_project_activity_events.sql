-- S12.5A
-- ELLIPSIS Studio append-oriented project activity history.

create table public.studio_project_activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.studio_projects(id)
    on delete cascade,
  actor_user_id uuid
    references auth.users(id)
    on delete set null,
  actor_role text not null default 'owner',
  event_type text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint studio_project_activity_events_actor_role_check
    check (
      actor_role in (
        'owner',
        'va',
        'system'
      )
    ),

  constraint studio_project_activity_events_event_type_check
    check (
      char_length(event_type) between 1 and 120
    ),

  constraint studio_project_activity_events_entity_type_check
    check (
      entity_type is null
      or char_length(entity_type) between 1 and 80
    ),

  constraint studio_project_activity_events_summary_check
    check (
      char_length(summary) between 1 and 4000
    ),

  constraint studio_project_activity_events_metadata_object_check
    check (
      jsonb_typeof(metadata) = 'object'
    )
);

create index studio_project_activity_events_project_time_idx
  on public.studio_project_activity_events (
    project_id,
    occurred_at desc,
    id desc
  );

create index studio_project_activity_events_project_type_time_idx
  on public.studio_project_activity_events (
    project_id,
    event_type,
    occurred_at desc
  );

create index studio_project_activity_events_actor_time_idx
  on public.studio_project_activity_events (
    actor_user_id,
    occurred_at desc
  )
  where actor_user_id is not null;

create index studio_project_activity_events_entity_idx
  on public.studio_project_activity_events (
    entity_type,
    entity_id
  )
  where entity_type is not null
    and entity_id is not null;

alter table public.studio_project_activity_events
  enable row level security;

create policy studio_project_activity_events_select_owner
on public.studio_project_activity_events
for select
to authenticated
using (
  exists (
    select 1
    from public.studio_projects p
    where p.id = studio_project_activity_events.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
      and a.role = 'owner'
  )
);

revoke all
  on table public.studio_project_activity_events
  from public,
       anon,
       authenticated;

grant select
  on table public.studio_project_activity_events
  to authenticated;

grant all
  on table public.studio_project_activity_events
  to service_role;

comment on table public.studio_project_activity_events is
  'Append-oriented significant activity history for Studio projects.';

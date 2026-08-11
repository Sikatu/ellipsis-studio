create table public.client_delivery_handoffs (
  project_id uuid primary key references public.discovery_projects(id) on delete cascade,
  studio_notes text not null default '' check (char_length(studio_notes) <= 5000),
  follow_up_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_delivery_handoffs_completion_state check (
    (completed_at is null and completed_by is null)
    or
    (completed_at is not null and completed_by is not null)
  )
);

create index client_delivery_handoffs_created_by_idx
  on public.client_delivery_handoffs (created_by);

create index client_delivery_handoffs_updated_by_idx
  on public.client_delivery_handoffs (updated_by);

create index client_delivery_handoffs_completed_by_idx
  on public.client_delivery_handoffs (completed_by)
  where completed_by is not null;

create or replace function public.protect_client_delivery_handoff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := now();
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Client delivery handoff ownership metadata is immutable.';
  end if;

  if new.completed_at is null then
    new.completed_by := null;
  elsif new.completed_by is null then
    raise exception 'completed_by is required for a completed handoff.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_client_delivery_handoff
before insert or update on public.client_delivery_handoffs
for each row
execute function public.protect_client_delivery_handoff();

alter table public.client_delivery_handoffs enable row level security;

create policy client_delivery_handoffs_select_owned
on public.client_delivery_handoffs
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoffs.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

create policy client_delivery_handoffs_insert_owned
on public.client_delivery_handoffs
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoffs.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

create policy client_delivery_handoffs_update_owned
on public.client_delivery_handoffs
for update
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoffs.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoffs.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.client_delivery_handoffs from anon;
grant select, insert, update on public.client_delivery_handoffs to authenticated;
grant select, insert, update, delete on public.client_delivery_handoffs to service_role;

create table public.client_delivery_handoff_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.discovery_projects(id) on delete cascade,
  event_type text not null check (event_type in (
    'note_updated',
    'follow_up_scheduled',
    'follow_up_cleared',
    'handoff_completed',
    'handoff_reopened'
  )),
  actor_admin_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index client_delivery_handoff_events_project_time_idx
  on public.client_delivery_handoff_events (project_id, occurred_at desc);

create index client_delivery_handoff_events_actor_admin_idx
  on public.client_delivery_handoff_events (actor_admin_id);

create or replace function public.protect_client_delivery_handoff_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Client delivery handoff events are immutable.';
end;
$$;

create trigger protect_client_delivery_handoff_event
before update or delete on public.client_delivery_handoff_events
for each row
execute function public.protect_client_delivery_handoff_event();

alter table public.client_delivery_handoff_events enable row level security;

create policy client_delivery_handoff_events_select_owned
on public.client_delivery_handoff_events
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoff_events.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

create policy client_delivery_handoff_events_insert_owned
on public.client_delivery_handoff_events
for insert
to authenticated
with check (
  actor_admin_id = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_handoff_events.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.client_delivery_handoff_events from anon;
revoke update, delete on public.client_delivery_handoff_events from authenticated;
grant select, insert on public.client_delivery_handoff_events to authenticated;
grant select, insert on public.client_delivery_handoff_events to service_role;
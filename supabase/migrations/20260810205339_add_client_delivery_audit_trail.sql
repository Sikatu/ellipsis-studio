create table public.client_delivery_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.discovery_projects(id) on delete cascade,
  access_id uuid not null references public.client_delivery_access(id) on delete cascade,
  event_type text not null check (event_type in ('access_activated','link_rotated','access_revoked','portal_viewed','file_downloaded')),
  actor_type text not null check (actor_type in ('admin','client','system')),
  actor_admin_id uuid references auth.users(id) on delete restrict,
  file_id uuid references public.strategy_report_files(id) on delete restrict,
  report_id uuid references public.strategy_reports(id) on delete restrict,
  token_version integer check (token_version is null or token_version > 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint client_delivery_events_actor_state check (
    (actor_type = 'admin' and actor_admin_id is not null)
    or
    (actor_type <> 'admin' and actor_admin_id is null)
  ),
  constraint client_delivery_events_download_state check (
    event_type <> 'file_downloaded'
    or
    (file_id is not null and report_id is not null)
  )
);

create index client_delivery_events_project_time_idx
  on public.client_delivery_events (project_id, occurred_at desc);

create index client_delivery_events_access_time_idx
  on public.client_delivery_events (access_id, occurred_at desc);

create index client_delivery_events_file_idx
  on public.client_delivery_events (file_id)
  where file_id is not null;

create index client_delivery_events_report_idx
  on public.client_delivery_events (report_id)
  where report_id is not null;

create index client_delivery_events_actor_admin_idx
  on public.client_delivery_events (actor_admin_id)
  where actor_admin_id is not null;

create or replace function public.validate_client_delivery_event_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  access_project uuid;
  file_project uuid;
  file_report uuid;
  report_project uuid;
begin
  select project_id
  into access_project
  from public.client_delivery_access
  where id = new.access_id;

  if not found then
    raise exception 'Client delivery access does not exist.';
  end if;

  if access_project <> new.project_id then
    raise exception 'Delivery event project does not match access project.';
  end if;

  if new.report_id is not null then
    select project_id
    into report_project
    from public.strategy_reports
    where id = new.report_id;

    if not found or report_project <> new.project_id then
      raise exception 'Delivery event report does not belong to project.';
    end if;
  end if;

  if new.file_id is not null then
    select project_id, report_id
    into file_project, file_report
    from public.strategy_report_files
    where id = new.file_id;

    if not found or file_project <> new.project_id then
      raise exception 'Delivery event file does not belong to project.';
    end if;

    if new.report_id is not null and file_report <> new.report_id then
      raise exception 'Delivery event file does not match report.';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_client_delivery_event_insert
before insert on public.client_delivery_events
for each row
execute function public.validate_client_delivery_event_insert();

create or replace function public.protect_client_delivery_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Client delivery audit events are immutable.';
end;
$$;

create trigger protect_client_delivery_event
before update or delete on public.client_delivery_events
for each row
execute function public.protect_client_delivery_event();

alter table public.client_delivery_events enable row level security;

create policy client_delivery_events_select_owned
on public.client_delivery_events
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_events.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.client_delivery_events from anon;
revoke insert, update, delete on public.client_delivery_events from authenticated;
grant select on public.client_delivery_events to authenticated;
grant select, insert on public.client_delivery_events to service_role;
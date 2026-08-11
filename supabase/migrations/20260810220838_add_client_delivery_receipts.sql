create table public.client_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.discovery_projects(id) on delete cascade,
  access_id uuid not null references public.client_delivery_access(id) on delete cascade,
  report_id uuid not null references public.strategy_reports(id) on delete restrict,
  file_id uuid not null unique references public.strategy_report_files(id) on delete restrict,
  report_number integer not null check (report_number > 0),
  filename text not null check (char_length(filename) between 1 and 180),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  token_version integer not null check (token_version > 0),
  acknowledgment text not null default '' check (char_length(acknowledgment) <= 1000),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index client_delivery_receipts_project_time_idx
  on public.client_delivery_receipts (project_id, accepted_at desc);

create index client_delivery_receipts_access_idx
  on public.client_delivery_receipts (access_id);

create index client_delivery_receipts_report_idx
  on public.client_delivery_receipts (report_id);

create or replace function public.validate_client_delivery_receipt_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  access_project uuid;
  access_status text;
  access_token_version integer;
  report_project uuid;
  report_status text;
  actual_report_number integer;
  file_project uuid;
  file_report uuid;
  actual_filename text;
  actual_sha256 text;
begin
  select project_id, status, token_version
  into access_project, access_status, access_token_version
  from public.client_delivery_access
  where id = new.access_id;

  if not found then
    raise exception 'Client delivery access does not exist.';
  end if;

  if access_project <> new.project_id then
    raise exception 'Delivery receipt project does not match access project.';
  end if;

  if access_status <> 'active' then
    raise exception 'Delivery receipt requires active client access.';
  end if;

  if access_token_version <> new.token_version then
    raise exception 'Delivery receipt token version is stale.';
  end if;

  select project_id, status, report_number
  into report_project, report_status, actual_report_number
  from public.strategy_reports
  where id = new.report_id;

  if not found or report_project <> new.project_id then
    raise exception 'Delivery receipt report does not belong to project.';
  end if;

  if report_status <> 'issued' then
    raise exception 'Delivery receipt requires an issued report.';
  end if;

  if actual_report_number <> new.report_number then
    raise exception 'Delivery receipt report number does not match source report.';
  end if;

  select project_id, report_id, filename, sha256
  into file_project, file_report, actual_filename, actual_sha256
  from public.strategy_report_files
  where id = new.file_id;

  if not found or file_project <> new.project_id then
    raise exception 'Delivery receipt file does not belong to project.';
  end if;

  if file_report <> new.report_id then
    raise exception 'Delivery receipt file does not match report.';
  end if;

  if actual_filename <> new.filename then
    raise exception 'Delivery receipt filename does not match sealed file.';
  end if;

  if actual_sha256 <> new.file_sha256 then
    raise exception 'Delivery receipt SHA-256 does not match sealed file.';
  end if;

  if not exists (
    select 1
    from public.client_delivery_events e
    where e.project_id = new.project_id
      and e.access_id = new.access_id
      and e.file_id = new.file_id
      and e.report_id = new.report_id
      and e.event_type = 'file_downloaded'
  ) then
    raise exception 'Delivery receipt requires a verified PDF download first.';
  end if;

  new.accepted_at := now();
  new.created_at := now();
  return new;
end;
$$;

create trigger validate_client_delivery_receipt_insert
before insert on public.client_delivery_receipts
for each row
execute function public.validate_client_delivery_receipt_insert();

create or replace function public.protect_client_delivery_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Client delivery receipts are immutable.';
end;
$$;

create trigger protect_client_delivery_receipt
before update or delete on public.client_delivery_receipts
for each row
execute function public.protect_client_delivery_receipt();

alter table public.client_delivery_receipts enable row level security;

create policy client_delivery_receipts_select_owned
on public.client_delivery_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_receipts.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.client_delivery_receipts from anon;
revoke insert, update, delete on public.client_delivery_receipts from authenticated;
grant select on public.client_delivery_receipts to authenticated;
grant select, insert on public.client_delivery_receipts to service_role;
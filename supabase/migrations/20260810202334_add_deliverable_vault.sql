create table public.strategy_report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.strategy_reports(id) on delete restrict,
  project_id uuid not null references public.discovery_projects(id) on delete cascade,
  report_number integer not null check (report_number > 0),
  source_strategy_version_id uuid not null references public.strategy_versions(id) on delete restrict,
  source_strategy_version_number integer not null check (source_strategy_version_number > 0),
  storage_bucket text not null default 'brand-deliverables',
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 180),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  generated_by uuid not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index strategy_report_files_project_created_idx
  on public.strategy_report_files (project_id, created_at desc);

create index strategy_report_files_report_number_idx
  on public.strategy_report_files (project_id, report_number);

create or replace function public.validate_strategy_report_file_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_report public.strategy_reports%rowtype;
begin
  select *
  into source_report
  from public.strategy_reports
  where id = new.report_id;

  if not found then
    raise exception 'Source report does not exist.';
  end if;

  if source_report.status <> 'ready' then
    raise exception 'Deliverable files can only be sealed from ready reports.';
  end if;

  if new.project_id <> source_report.project_id then
    raise exception 'Deliverable project does not match report project.';
  end if;

  if new.report_number <> source_report.report_number then
    raise exception 'Deliverable report number does not match source report.';
  end if;

  if new.source_strategy_version_id <> source_report.source_strategy_version_id then
    raise exception 'Deliverable strategy source does not match source report.';
  end if;

  if new.source_strategy_version_number <> source_report.source_strategy_version_number then
    raise exception 'Deliverable strategy version number does not match source report.';
  end if;

  if new.storage_bucket <> 'brand-deliverables' then
    raise exception 'Deliverable must use the private brand-deliverables bucket.';
  end if;

  if new.storage_path not like (new.project_id::text || '/report-' || new.report_number::text || '/%') then
    raise exception 'Deliverable storage path is outside the report namespace.';
  end if;

  return new;
end;
$$;

create trigger validate_strategy_report_file_insert
before insert on public.strategy_report_files
for each row
execute function public.validate_strategy_report_file_insert();

create or replace function public.protect_strategy_report_file()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_status text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Sealed deliverable metadata is immutable.';
  end if;

  select status
  into source_status
  from public.strategy_reports
  where id = old.report_id;

  if source_status = 'issued' then
    raise exception 'Issued deliverables cannot be deleted.';
  end if;

  return old;
end;
$$;

create trigger protect_strategy_report_file
before update or delete on public.strategy_report_files
for each row
execute function public.protect_strategy_report_file();

create or replace function public.require_report_file_before_issue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    if not exists (
      select 1
      from public.strategy_report_files f
      where f.report_id = new.id
        and f.project_id = new.project_id
        and f.report_number = new.report_number
        and f.source_strategy_version_id = new.source_strategy_version_id
        and f.source_strategy_version_number = new.source_strategy_version_number
    ) then
      raise exception 'A sealed deliverable file is required before a report can be issued.';
    end if;
  end if;

  return new;
end;
$$;

create trigger require_report_file_before_issue
before update of status on public.strategy_reports
for each row
execute function public.require_report_file_before_issue();

alter table public.strategy_report_files enable row level security;

create policy strategy_report_files_select_owned
on public.strategy_report_files
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = strategy_report_files.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.strategy_report_files from anon;
revoke insert, update, delete on public.strategy_report_files from authenticated;
grant select on public.strategy_report_files to authenticated;
grant select, insert, delete on public.strategy_report_files to service_role;
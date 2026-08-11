create table public.strategy_reports (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  report_number integer not null
    check (report_number > 0),

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'ready',
        'issued'
      )
    ),

  source_strategy_version_id uuid not null
    references public.strategy_versions(id)
    on delete restrict,

  source_strategy_version_number integer not null
    check (
      source_strategy_version_number > 0
    ),

  strategy_snapshot jsonb not null,

  configuration jsonb not null
    default '{}'::jsonb,

  created_by uuid not null,

  issued_by uuid,

  issued_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique(
    project_id,
    report_number
  ),

  check (
    (
      status in (
        'draft',
        'ready'
      )
      and issued_by is null
      and issued_at is null
    )
    or
    (
      status = 'issued'
      and issued_by is not null
      and issued_at is not null
    )
  )
);

create unique index
  strategy_reports_one_working_per_project_idx
on public.strategy_reports(project_id)
where status in (
  'draft',
  'ready'
);

create index
  strategy_reports_project_created_idx
on public.strategy_reports(
  project_id,
  created_at desc
);

create or replace function
  public.protect_strategy_reports()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then

    if old.status = 'issued' then
      raise exception
        'Issued strategy reports are immutable';
    end if;

    return old;
  end if;

  if old.status = 'issued' then
    raise exception
      'Issued strategy reports are immutable';
  end if;

  if new.project_id <> old.project_id
     or new.report_number <> old.report_number
     or new.source_strategy_version_id
        <> old.source_strategy_version_id
     or new.source_strategy_version_number
        <> old.source_strategy_version_number
     or new.strategy_snapshot
        <> old.strategy_snapshot
     or new.created_by
        <> old.created_by
     or new.created_at
        <> old.created_at then

    raise exception
      'Strategy report source snapshot is immutable';
  end if;

  return new;
end;
$$;

create trigger
  strategy_reports_protect_issued
before update or delete
on public.strategy_reports
for each row
execute function
  public.protect_strategy_reports();

alter table public.strategy_reports
enable row level security;

create policy
  strategy_reports_select_owned
on public.strategy_reports
for select
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_reports.project_id
      and dp.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
);

create policy
  strategy_reports_insert_owned
on public.strategy_reports
for insert
to authenticated
with check (
  created_by =
    (select auth.uid())

  and status = 'draft'

  and issued_by is null

  and issued_at is null

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_reports.project_id
      and dp.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
);

create policy
  strategy_reports_update_owned
on public.strategy_reports
for update
to authenticated
using (
  created_by =
    (select auth.uid())

  and status in (
    'draft',
    'ready'
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_reports.project_id
      and dp.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
)
with check (
  created_by =
    (select auth.uid())

  and status in (
    'draft',
    'ready',
    'issued'
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_reports.project_id
      and dp.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
);

create policy
  strategy_reports_delete_owned
on public.strategy_reports
for delete
to authenticated
using (
  created_by =
    (select auth.uid())

  and status in (
    'draft',
    'ready'
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_reports.project_id
      and dp.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
);

grant
  select,
  insert,
  update,
  delete
on public.strategy_reports
to authenticated;

revoke all
on public.strategy_reports
from anon;
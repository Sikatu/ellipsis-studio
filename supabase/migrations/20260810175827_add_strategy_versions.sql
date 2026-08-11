create table public.strategy_versions (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  version_number integer not null
    check (version_number > 0),

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'approved'
      )
    ),

  source_ai_run_id uuid
    references public.strategy_ai_runs(id)
    on delete set null,

  source_fingerprint text not null,

  source_model text not null,

  prompt_version text not null,

  strategy jsonb not null,

  editorial_notes text not null
    default '',

  created_by uuid not null,

  approved_by uuid,

  approved_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique(
    project_id,
    version_number
  ),

  check (
    (
      status = 'draft'
      and approved_by is null
      and approved_at is null
    )
    or
    (
      status = 'approved'
      and approved_by is not null
      and approved_at is not null
    )
  )
);

create unique index
  strategy_versions_one_draft_per_project_idx
on public.strategy_versions(project_id)
where status = 'draft';

create index
  strategy_versions_project_created_idx
on public.strategy_versions(
  project_id,
  created_at desc
);

create or replace function
  public.protect_approved_strategy_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then

    if old.status = 'approved' then
      raise exception
        'Approved strategy versions are immutable';
    end if;

    return old;
  end if;

  if old.status = 'approved' then
    raise exception
      'Approved strategy versions are immutable';
  end if;

  if new.project_id <> old.project_id
     or new.version_number <> old.version_number
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at
     or new.source_fingerprint <> old.source_fingerprint
     or new.source_model <> old.source_model
     or new.prompt_version <> old.prompt_version
     or new.source_ai_run_id
        is distinct from old.source_ai_run_id then

    raise exception
      'Strategy version source metadata is immutable';
  end if;

  return new;
end;
$$;

create trigger
  strategy_versions_protect_approved
before update or delete
on public.strategy_versions
for each row
execute function
  public.protect_approved_strategy_versions();

alter table public.strategy_versions
enable row level security;

create policy
  strategy_versions_select_owned
on public.strategy_versions
for select
to authenticated
using (
  created_by = (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_versions.project_id
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
  strategy_versions_insert_owned
on public.strategy_versions
for insert
to authenticated
with check (
  created_by = (select auth.uid())

  and status = 'draft'

  and approved_by is null

  and approved_at is null

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_versions.project_id
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
  strategy_versions_update_owned
on public.strategy_versions
for update
to authenticated
using (
  created_by = (select auth.uid())

  and status = 'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_versions.project_id
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
  created_by = (select auth.uid())

  and (
    (
      status = 'draft'
      and approved_by is null
      and approved_at is null
    )
    or
    (
      status = 'approved'
      and approved_by =
        (select auth.uid())
      and approved_at is not null
    )
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_versions.project_id
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
  strategy_versions_delete_owned
on public.strategy_versions
for delete
to authenticated
using (
  created_by = (select auth.uid())

  and status = 'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      strategy_versions.project_id
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
on public.strategy_versions
to authenticated;

revoke all
on public.strategy_versions
from anon;
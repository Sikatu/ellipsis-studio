create table public.visual_system_versions (
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

  source_creative_direction_version_id uuid not null
    references public.creative_direction_versions(id)
    on delete restrict,

  source_creative_direction_version_number integer not null
    check (
      source_creative_direction_version_number > 0
    ),

  system jsonb not null,

  editorial_notes text not null
    default ''
    check (
      char_length(editorial_notes) <= 10000
    ),

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  approved_by uuid
    references auth.users(id)
    on delete restrict,

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
  visual_system_versions_one_draft_idx
on public.visual_system_versions(
  project_id
)
where status = 'draft';

create index
  visual_system_versions_project_created_idx
on public.visual_system_versions(
  project_id,
  created_at desc
);

create index
  visual_system_versions_source_direction_idx
on public.visual_system_versions(
  source_creative_direction_version_id
);

create index
  visual_system_versions_created_by_idx
on public.visual_system_versions(
  created_by
);

create index
  visual_system_versions_approved_by_idx
on public.visual_system_versions(
  approved_by
)
where approved_by is not null;

create or replace function
  public.validate_visual_system_version_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_project uuid;
  source_number integer;
  source_status text;
begin
  select
    project_id,
    version_number,
    status
  into
    source_project,
    source_number,
    source_status
  from public.creative_direction_versions
  where id =
    new.source_creative_direction_version_id;

  if not found then
    raise exception
      'Visual system source Creative Direction does not exist.';
  end if;

  if source_status <> 'approved' then
    raise exception
      'Visual system requires an approved Creative Direction source.';
  end if;

  if source_project <> new.project_id then
    raise exception
      'Visual system source Creative Direction belongs to another project.';
  end if;

  if source_number <>
     new.source_creative_direction_version_number then
    raise exception
      'Visual system Creative Direction version number does not match its source.';
  end if;

  return new;
end;
$$;

create trigger
  validate_visual_system_version_insert
before insert
on public.visual_system_versions
for each row
execute function
  public.validate_visual_system_version_insert();

create or replace function
  public.protect_visual_system_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      raise exception
        'Approved visual system versions are immutable.';
    end if;

    return old;
  end if;

  if old.status = 'approved' then
    raise exception
      'Approved visual system versions are immutable.';
  end if;

  if new.project_id <> old.project_id
     or new.version_number <> old.version_number
     or new.source_creative_direction_version_id
        <> old.source_creative_direction_version_id
     or new.source_creative_direction_version_number
        <> old.source_creative_direction_version_number
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at then
    raise exception
      'Visual system source metadata is immutable.';
  end if;

  return new;
end;
$$;

create trigger
  protect_visual_system_version
before update or delete
on public.visual_system_versions
for each row
execute function
  public.protect_visual_system_version();

alter table public.visual_system_versions
enable row level security;

create policy
  visual_system_versions_select_owned
on public.visual_system_versions
for select
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      visual_system_versions.project_id
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
  visual_system_versions_insert_owned
on public.visual_system_versions
for insert
to authenticated
with check (
  created_by =
    (select auth.uid())

  and status = 'draft'

  and approved_by is null

  and approved_at is null

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      visual_system_versions.project_id
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
  visual_system_versions_update_owned
on public.visual_system_versions
for update
to authenticated
using (
  created_by =
    (select auth.uid())

  and status = 'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      visual_system_versions.project_id
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
      visual_system_versions.project_id
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
  visual_system_versions_delete_owned
on public.visual_system_versions
for delete
to authenticated
using (
  created_by =
    (select auth.uid())

  and status = 'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      visual_system_versions.project_id
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
on public.visual_system_versions
to authenticated;

revoke all
on public.visual_system_versions
from anon;

revoke execute
on function
  public.validate_visual_system_version_insert()
from public, anon, authenticated;

revoke execute
on function
  public.protect_visual_system_version()
from public, anon, authenticated;

grant execute
on function
  public.validate_visual_system_version_insert()
to service_role;

grant execute
on function
  public.protect_visual_system_version()
to service_role;

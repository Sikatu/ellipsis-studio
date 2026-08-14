create table public.visual_reference_assets (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  storage_bucket text not null
    default 'brand-visual-references',

  storage_path text not null
    unique,

  original_filename text not null
    check (
      char_length(original_filename)
      between 1 and 240
    ),

  mime_type text not null
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif'
      )
    ),

  byte_size bigint not null
    check (
      byte_size > 0
      and byte_size <= 12582912
    ),

  sha256 text not null
    check (
      sha256 ~ '^[0-9a-f]{64}$'
    ),

  width_px integer not null
    check (
      width_px > 0
      and width_px <= 8000
    ),

  height_px integer not null
    check (
      height_px > 0
      and height_px <= 8000
    ),

  check (
    width_px::bigint
    * height_px::bigint
    <= 40000000
  ),

  source_type text not null
    default 'studio_reference'
    check (
      source_type in (
        'studio_reference',
        'client_supplied',
        'web_reference',
        'licensed_source',
        'other'
      )
    ),

  source_url text not null
    default ''
    check (
      char_length(source_url)
      <= 2048
    ),

  source_title text not null
    default ''
    check (
      char_length(source_title)
      <= 500
    ),

  creator_name text not null
    default ''
    check (
      char_length(creator_name)
      <= 500
    ),

  rights_status text not null
    default 'unknown'
    check (
      rights_status in (
        'unknown',
        'reference_only',
        'client_supplied',
        'studio_owned',
        'permission_confirmed',
        'licensed',
        'public_domain'
      )
    ),

  attribution text not null
    default ''
    check (
      char_length(attribution)
      <= 2000
    ),

  provenance_notes text not null
    default ''
    check (
      char_length(provenance_notes)
      <= 10000
    ),

  studio_notes text not null
    default ''
    check (
      char_length(studio_notes)
      <= 10000
    ),

  is_archived boolean not null
    default false,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index
  visual_reference_assets_project_created_idx
on public.visual_reference_assets(
  project_id,
  created_at desc
);

create index
  visual_reference_assets_project_active_idx
on public.visual_reference_assets(
  project_id,
  is_archived,
  created_at desc
);

create index
  visual_reference_assets_sha256_idx
on public.visual_reference_assets(
  sha256
);

create index
  visual_reference_assets_created_by_idx
on public.visual_reference_assets(
  created_by
);

create table public.moodboard_versions (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  version_number integer not null
    check (
      version_number > 0
    ),

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'approved'
      )
    ),

  source_visual_system_version_id uuid not null
    references public.visual_system_versions(id)
    on delete restrict,

  source_visual_system_version_number integer not null
    check (
      source_visual_system_version_number > 0
    ),

  board jsonb not null,

  editorial_notes text not null
    default ''
    check (
      char_length(editorial_notes)
      <= 10000
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
  moodboard_versions_one_draft_idx
on public.moodboard_versions(
  project_id
)
where status = 'draft';

create index
  moodboard_versions_project_created_idx
on public.moodboard_versions(
  project_id,
  created_at desc
);

create index
  moodboard_versions_source_visual_idx
on public.moodboard_versions(
  source_visual_system_version_id
);

create index
  moodboard_versions_created_by_idx
on public.moodboard_versions(
  created_by
);

create index
  moodboard_versions_approved_by_idx
on public.moodboard_versions(
  approved_by
)
where approved_by is not null;

create table public.moodboard_items (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  moodboard_version_id uuid not null
    references public.moodboard_versions(id)
    on delete cascade,

  asset_id uuid not null
    references public.visual_reference_assets(id)
    on delete restrict,

  sort_order integer not null
    default 0
    check (
      sort_order >= 0
    ),

  category text not null
    default ''
    check (
      char_length(category)
      <= 120
    ),

  visual_territory text not null
    default ''
    check (
      char_length(visual_territory)
      <= 240
    ),

  why_it_belongs text not null
    default ''
    check (
      char_length(why_it_belongs)
      <= 5000
    ),

  borrow_guidance text not null
    default ''
    check (
      char_length(borrow_guidance)
      <= 5000
    ),

  avoid_guidance text not null
    default ''
    check (
      char_length(avoid_guidance)
      <= 5000
    ),

  composition_cues text not null
    default ''
    check (
      char_length(composition_cues)
      <= 5000
    ),

  lighting_cues text not null
    default ''
    check (
      char_length(lighting_cues)
      <= 5000
    ),

  color_relationship text not null
    default ''
    check (
      char_length(color_relationship)
      <= 5000
    ),

  texture_material_cues text not null
    default ''
    check (
      char_length(texture_material_cues)
      <= 5000
    ),

  subject_treatment text not null
    default ''
    check (
      char_length(subject_treatment)
      <= 5000
    ),

  relevance_score integer
    check (
      relevance_score is null
      or relevance_score between 1 and 5
    ),

  studio_rationale text not null
    default ''
    check (
      char_length(studio_rationale)
      <= 5000
    ),

  asset_snapshot jsonb not null
    default '{}'::jsonb,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique(
    moodboard_version_id,
    asset_id
  )
);

create index
  moodboard_items_version_sort_idx
on public.moodboard_items(
  moodboard_version_id,
  sort_order,
  created_at
);

create index
  moodboard_items_project_idx
on public.moodboard_items(
  project_id
);

create index
  moodboard_items_asset_idx
on public.moodboard_items(
  asset_id
);

create index
  moodboard_items_created_by_idx
on public.moodboard_items(
  created_by
);

create or replace function
  public.validate_visual_reference_asset_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.storage_bucket <>
     'brand-visual-references' then
    raise exception
      'Visual reference asset must use the private brand-visual-references bucket.';
  end if;

  if new.storage_path not like (
    new.project_id::text
    || '/asset-'
    || new.id::text
    || '/%'
  ) then
    raise exception
      'Visual reference asset storage path is invalid.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.project_id <> old.project_id
       or new.storage_bucket <> old.storage_bucket
       or new.storage_path <> old.storage_path
       or new.original_filename <> old.original_filename
       or new.mime_type <> old.mime_type
       or new.byte_size <> old.byte_size
       or new.sha256 <> old.sha256
       or new.width_px <> old.width_px
       or new.height_px <> old.height_px
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception
        'Visual reference binary identity is immutable.';
    end if;
  end if;

  return new;
end;
$$;

create trigger
  validate_visual_reference_asset_write
before insert or update
on public.visual_reference_assets
for each row
execute function
  public.validate_visual_reference_asset_write();

create or replace function
  public.validate_moodboard_version_insert()
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
  from public.visual_system_versions
  where id =
    new.source_visual_system_version_id;

  if not found then
    raise exception
      'Moodboard source Visual System does not exist.';
  end if;

  if source_status <> 'approved' then
    raise exception
      'Moodboard requires an approved Visual System source.';
  end if;

  if source_project <> new.project_id then
    raise exception
      'Moodboard source Visual System belongs to another project.';
  end if;

  if source_number <>
     new.source_visual_system_version_number then
    raise exception
      'Moodboard Visual System version number does not match its source.';
  end if;

  return new;
end;
$$;

create trigger
  validate_moodboard_version_insert
before insert
on public.moodboard_versions
for each row
execute function
  public.validate_moodboard_version_insert();

create or replace function
  public.protect_moodboard_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  latest_visual_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      raise exception
        'Approved moodboard versions are immutable.';
    end if;

    return old;
  end if;

  if old.status = 'approved' then
    raise exception
      'Approved moodboard versions are immutable.';
  end if;

  if new.project_id <> old.project_id
     or new.version_number <> old.version_number
     or new.source_visual_system_version_id
        <> old.source_visual_system_version_id
     or new.source_visual_system_version_number
        <> old.source_visual_system_version_number
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at then
    raise exception
      'Moodboard source metadata is immutable.';
  end if;

  if old.status = 'draft'
     and new.status = 'approved' then
    select id
    into latest_visual_id
    from public.visual_system_versions
    where project_id =
      new.project_id
      and status =
        'approved'
    order by
      version_number desc
    limit 1;

    if latest_visual_id is null
       or latest_visual_id <>
          new.source_visual_system_version_id then
      raise exception
        'Moodboard approval requires the current approved Visual System source.';
    end if;
  end if;

  return new;
end;
$$;

create trigger
  protect_moodboard_version
before update or delete
on public.moodboard_versions
for each row
execute function
  public.protect_moodboard_version();

create or replace function
  public.validate_moodboard_item_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_project uuid;
  parent_status text;
  asset_record public.visual_reference_assets%rowtype;
begin
  if tg_op = 'DELETE' then
    select
      project_id,
      status
    into
      parent_project,
      parent_status
    from public.moodboard_versions
    where id =
      old.moodboard_version_id;

    if not found then
      raise exception
        'Moodboard version does not exist.';
    end if;

    if parent_status <> 'draft' then
      raise exception
        'Approved moodboard items are immutable.';
    end if;

    return old;
  end if;

  select
    project_id,
    status
  into
    parent_project,
    parent_status
  from public.moodboard_versions
  where id =
    new.moodboard_version_id;

  if not found then
    raise exception
      'Moodboard version does not exist.';
  end if;

  if parent_status <> 'draft' then
    raise exception
      'Approved moodboard items are immutable.';
  end if;

  if parent_project <>
     new.project_id then
    raise exception
      'Moodboard item project does not match its version.';
  end if;

  select *
  into asset_record
  from public.visual_reference_assets
  where id =
    new.asset_id;

  if not found then
    raise exception
      'Visual reference asset does not exist.';
  end if;

  if asset_record.project_id <>
     new.project_id then
    raise exception
      'Visual reference asset belongs to another project.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.moodboard_version_id
          <> old.moodboard_version_id
       or new.project_id <> old.project_id
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception
        'Moodboard item ownership metadata is immutable.';
    end if;
  end if;

  new.asset_snapshot =
    jsonb_build_object(
      'assetId',
        asset_record.id,
      'sha256',
        asset_record.sha256,
      'originalFilename',
        asset_record.original_filename,
      'mimeType',
        asset_record.mime_type,
      'byteSize',
        asset_record.byte_size,
      'widthPx',
        asset_record.width_px,
      'heightPx',
        asset_record.height_px,
      'sourceType',
        asset_record.source_type,
      'sourceUrl',
        asset_record.source_url,
      'sourceTitle',
        asset_record.source_title,
      'creatorName',
        asset_record.creator_name,
      'rightsStatus',
        asset_record.rights_status,
      'attribution',
        asset_record.attribution,
      'provenanceNotes',
        asset_record.provenance_notes
    );

  return new;
end;
$$;

create trigger
  validate_moodboard_item_write
before insert or update or delete
on public.moodboard_items
for each row
execute function
  public.validate_moodboard_item_write();

create or replace function
  public.refresh_draft_moodboard_item_snapshots()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.moodboard_items mi
  set
    asset_snapshot =
      jsonb_build_object(
        'assetId',
          new.id,
        'sha256',
          new.sha256,
        'originalFilename',
          new.original_filename,
        'mimeType',
          new.mime_type,
        'byteSize',
          new.byte_size,
        'widthPx',
          new.width_px,
        'heightPx',
          new.height_px,
        'sourceType',
          new.source_type,
        'sourceUrl',
          new.source_url,
        'sourceTitle',
          new.source_title,
        'creatorName',
          new.creator_name,
        'rightsStatus',
          new.rights_status,
        'attribution',
          new.attribution,
        'provenanceNotes',
          new.provenance_notes
      ),
    updated_at =
      now()
  where mi.asset_id =
    new.id
    and exists (
      select 1
      from public.moodboard_versions mv
      where mv.id =
        mi.moodboard_version_id
        and mv.status =
          'draft'
    );

  return new;
end;
$$;

create trigger
  refresh_draft_moodboard_item_snapshots
after update of
  source_type,
  source_url,
  source_title,
  creator_name,
  rights_status,
  attribution,
  provenance_notes
on public.visual_reference_assets
for each row
execute function
  public.refresh_draft_moodboard_item_snapshots();

alter table
  public.visual_reference_assets
enable row level security;

alter table
  public.moodboard_versions
enable row level security;

alter table
  public.moodboard_items
enable row level security;

create policy
  visual_reference_assets_select_owned
on public.visual_reference_assets
for select
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      visual_reference_assets.project_id
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
  moodboard_versions_select_owned
on public.moodboard_versions
for select
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_versions.project_id
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
  moodboard_versions_insert_owned
on public.moodboard_versions
for insert
to authenticated
with check (
  created_by =
    (select auth.uid())

  and status =
    'draft'

  and approved_by is null

  and approved_at is null

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_versions.project_id
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
  moodboard_versions_update_owned
on public.moodboard_versions
for update
to authenticated
using (
  created_by =
    (select auth.uid())

  and status =
    'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_versions.project_id
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
      status =
        'draft'
      and approved_by is null
      and approved_at is null
    )
    or
    (
      status =
        'approved'
      and approved_by =
        (select auth.uid())
      and approved_at is not null
    )
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_versions.project_id
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
  moodboard_versions_delete_owned
on public.moodboard_versions
for delete
to authenticated
using (
  created_by =
    (select auth.uid())

  and status =
    'draft'

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_versions.project_id
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
  moodboard_items_select_owned
on public.moodboard_items
for select
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_items.project_id
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
  moodboard_items_insert_owned
on public.moodboard_items
for insert
to authenticated
with check (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.moodboard_versions mv
    where mv.id =
      moodboard_items.moodboard_version_id
      and mv.project_id =
        moodboard_items.project_id
      and mv.status =
        'draft'
      and mv.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_items.project_id
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
  moodboard_items_update_owned
on public.moodboard_items
for update
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.moodboard_versions mv
    where mv.id =
      moodboard_items.moodboard_version_id
      and mv.status =
        'draft'
      and mv.created_by =
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

  and exists (
    select 1
    from public.moodboard_versions mv
    where mv.id =
      moodboard_items.moodboard_version_id
      and mv.project_id =
        moodboard_items.project_id
      and mv.status =
        'draft'
      and mv.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id =
      moodboard_items.project_id
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
  moodboard_items_delete_owned
on public.moodboard_items
for delete
to authenticated
using (
  created_by =
    (select auth.uid())

  and exists (
    select 1
    from public.moodboard_versions mv
    where mv.id =
      moodboard_items.moodboard_version_id
      and mv.status =
        'draft'
      and mv.created_by =
        (select auth.uid())
  )

  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (select auth.uid())
  )
);

revoke all
on public.visual_reference_assets
from anon;

revoke insert, update, delete
on public.visual_reference_assets
from authenticated;

grant select
on public.visual_reference_assets
to authenticated;

grant select, insert, update, delete
on public.visual_reference_assets
to service_role;

revoke all
on public.moodboard_versions
from anon;

grant select, insert, update, delete
on public.moodboard_versions
to authenticated;

grant select, insert, update, delete
on public.moodboard_versions
to service_role;

revoke all
on public.moodboard_items
from anon;

grant select, insert, update, delete
on public.moodboard_items
to authenticated;

grant select, insert, update, delete
on public.moodboard_items
to service_role;

revoke all
on function
  public.validate_visual_reference_asset_write()
from public;

revoke execute
on function
  public.validate_visual_reference_asset_write()
from anon, authenticated;

grant execute
on function
  public.validate_visual_reference_asset_write()
to service_role;

revoke all
on function
  public.validate_moodboard_version_insert()
from public;

revoke execute
on function
  public.validate_moodboard_version_insert()
from anon, authenticated;

grant execute
on function
  public.validate_moodboard_version_insert()
to service_role;

revoke all
on function
  public.protect_moodboard_version()
from public;

revoke execute
on function
  public.protect_moodboard_version()
from anon, authenticated;

grant execute
on function
  public.protect_moodboard_version()
to service_role;

revoke all
on function
  public.validate_moodboard_item_write()
from public;

revoke execute
on function
  public.validate_moodboard_item_write()
from anon, authenticated;

grant execute
on function
  public.validate_moodboard_item_write()
to service_role;

revoke all
on function
  public.refresh_draft_moodboard_item_snapshots()
from public;

revoke execute
on function
  public.refresh_draft_moodboard_item_snapshots()
from anon, authenticated;

grant execute
on function
  public.refresh_draft_moodboard_item_snapshots()
to service_role;

-- S12.4
-- ELLIPSIS Studio Project Deliverables and Approvals foundation.
--
-- This is the general-purpose deliverable layer beneath studio_projects.
--
-- Existing Brand Discovery deliverables remain independent and unchanged.
--
-- Ownership:
--   created_by remains the canonical project Owner auth identity.
--
-- Browser mutations remain disabled.
-- Controlled server APIs will use the service role for writes.


-- ============================================================
-- PROJECT DELIVERABLES
-- ============================================================

create table public.studio_project_deliverables (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.studio_projects(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,

  description text not null
    default '',

  deliverable_type text not null
    default 'general',

  source_kind text not null,

  version_number integer not null
    default 1,

  review_status text not null
    default 'not_started',

  approval_status text not null
    default 'not_requested',

  external_url text,

  storage_bucket text,

  storage_path text,

  filename text,

  mime_type text,

  byte_size bigint,

  sha256 text,

  approved_at timestamptz,

  delivered_at timestamptz,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),


  constraint studio_project_deliverables_title_check
    check (
      char_length(
        btrim(title)
      ) between 1 and 240
    ),


  constraint studio_project_deliverables_description_check
    check (
      char_length(description)
      <= 20000
    ),


  constraint studio_project_deliverables_type_check
    check (
      char_length(
        btrim(deliverable_type)
      ) between 1 and 80
    ),


  constraint studio_project_deliverables_source_kind_check
    check (
      source_kind in (
        'file',
        'external_url'
      )
    ),


  constraint studio_project_deliverables_version_check
    check (
      version_number >= 1
    ),


  constraint studio_project_deliverables_review_status_check
    check (
      review_status in (
        'not_started',
        'in_review',
        'changes_requested',
        'reviewed'
      )
    ),


  constraint studio_project_deliverables_approval_status_check
    check (
      approval_status in (
        'not_requested',
        'pending',
        'approved',
        'rejected'
      )
    ),


  constraint studio_project_deliverables_external_url_check
    check (
      external_url is null
      or (
        char_length(external_url)
        <= 2048
        and external_url ~*
          '^https?://'
      )
    ),


  constraint studio_project_deliverables_storage_bucket_check
    check (
      storage_bucket is null
      or char_length(
        btrim(storage_bucket)
      ) between 1 and 120
    ),


  constraint studio_project_deliverables_storage_path_check
    check (
      storage_path is null
      or char_length(
        btrim(storage_path)
      ) between 1 and 1024
    ),


  constraint studio_project_deliverables_filename_check
    check (
      filename is null
      or char_length(
        btrim(filename)
      ) between 1 and 255
    ),


  constraint studio_project_deliverables_mime_type_check
    check (
      mime_type is null
      or char_length(
        btrim(mime_type)
      ) between 1 and 255
    ),


  constraint studio_project_deliverables_byte_size_check
    check (
      byte_size is null
      or byte_size >= 0
    ),


  constraint studio_project_deliverables_sha256_check
    check (
      sha256 is null
      or sha256 ~
        '^[0-9A-Fa-f]{64}$'
    ),


  constraint studio_project_deliverables_sort_order_check
    check (
      sort_order >= 0
    ),


  constraint studio_project_deliverables_source_check
    check (
      (
        source_kind =
          'external_url'

        and external_url
          is not null

        and storage_bucket
          is null

        and storage_path
          is null

        and filename
          is null

        and mime_type
          is null

        and byte_size
          is null

        and sha256
          is null
      )
      or
      (
        source_kind =
          'file'

        and external_url
          is null

        and storage_bucket
          is not null

        and storage_path
          is not null

        and filename
          is not null
      )
    ),


  constraint studio_project_deliverables_approval_timestamp_check
    check (
      (
        approval_status =
          'approved'

        and approved_at
          is not null
      )
      or
      (
        approval_status <>
          'approved'

        and approved_at
          is null
      )
    )
);


-- ============================================================
-- INDEXES
-- ============================================================

create index
  studio_project_deliverables_project_order_idx
on public.studio_project_deliverables (
  project_id,
  sort_order,
  created_at
);


create index
  studio_project_deliverables_project_review_idx
on public.studio_project_deliverables (
  project_id,
  review_status,
  approval_status,
  updated_at
);


create index
  studio_project_deliverables_pending_approval_idx
on public.studio_project_deliverables (
  project_id,
  updated_at
)
where approval_status =
  'pending';


create index
  studio_project_deliverables_undelivered_idx
on public.studio_project_deliverables (
  project_id,
  updated_at
)
where delivered_at
  is null;


-- ============================================================
-- WRITE VALIDATION
-- ============================================================

create or replace function
  private.validate_studio_project_deliverable_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  select
    sp.created_by
  into
    project_owner
  from public.studio_projects sp
  where sp.id =
    new.project_id;


  if project_owner is null then
    raise exception
      'Deliverable project does not exist.';
  end if;


  if project_owner <>
     new.created_by then
    raise exception
      'Deliverable owner must match project owner.';
  end if;


  if tg_op = 'UPDATE' then
    if new.project_id
       is distinct from
       old.project_id then
      raise exception
        'Deliverable project is immutable.';
    end if;


    if new.created_by
       is distinct from
       old.created_by then
      raise exception
        'Deliverable owner is immutable.';
    end if;
  end if;


  new.title =
    btrim(
      new.title
    );


  new.deliverable_type =
    btrim(
      new.deliverable_type
    );


  if new.external_url
     is not null then
    new.external_url =
      btrim(
        new.external_url
      );
  end if;


  if new.storage_bucket
     is not null then
    new.storage_bucket =
      btrim(
        new.storage_bucket
      );
  end if;


  if new.storage_path
     is not null then
    new.storage_path =
      btrim(
        new.storage_path
      );
  end if;


  if new.filename
     is not null then
    new.filename =
      btrim(
        new.filename
      );
  end if;


  if new.mime_type
     is not null then
    new.mime_type =
      btrim(
        new.mime_type
      );
  end if;


  if new.approval_status =
     'approved' then

    if new.approved_at
       is null then
      new.approved_at =
        now();
    end if;

  else
    new.approved_at =
      null;
  end if;


  return new;
end;
$$;


create trigger
  studio_project_deliverables_validate_write
before insert or update
on public.studio_project_deliverables
for each row
execute function
  private.validate_studio_project_deliverable_write();


create trigger
  studio_project_deliverables_set_updated_at
before update
on public.studio_project_deliverables
for each row
execute function
  private.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
  public.studio_project_deliverables
enable row level security;


-- S12.4 remains Owner-controlled.
--
-- Future VA/client delivery permissions should be introduced
-- explicitly in their own phases instead of widening access here.

create policy
  studio_project_deliverables_select_owner
on public.studio_project_deliverables
for select
to authenticated
using (
  exists (
    select 1
    from public.studio_projects sp
    join public.admin_profiles ap
      on ap.user_id =
         (
           select auth.uid()
         )
    where sp.id =
      studio_project_deliverables.project_id

      and sp.created_by =
        (
          select auth.uid()
        )

      and ap.role =
        'owner'
  )
);


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
  on table public.studio_project_deliverables
  from public, anon, authenticated;


grant select
  on table public.studio_project_deliverables
  to authenticated;


grant all
  on table public.studio_project_deliverables
  to service_role;


revoke execute
  on function private.validate_studio_project_deliverable_write()
  from public, anon, authenticated;


grant execute
  on function private.validate_studio_project_deliverable_write()
  to service_role;
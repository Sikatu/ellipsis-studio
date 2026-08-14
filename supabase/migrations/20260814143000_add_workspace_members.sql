-- S13.1
-- ELLIPSIS VA Hub workspace identity foundation.
--
-- workspace_members becomes the canonical internal workforce identity layer.
--
-- Existing Studio Owner access through admin_profiles remains intact.
-- Future VAs must NOT be inserted into admin_profiles.

create table public.workspace_members (
  id uuid primary key
    default gen_random_uuid(),

  user_id uuid not null
    unique
    references auth.users(id)
    on delete cascade,

  role text not null
    check (
      role in (
        'owner',
        'va'
      )
    ),

  display_name text not null
    check (
      char_length(
        btrim(display_name)
      ) between 1 and 120
    ),

  avatar_url text not null
    default ''
    check (
      char_length(avatar_url)
      <= 2048
    ),

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'disabled'
      )
    ),

  timezone text not null
    default 'Asia/Manila'
    check (
      char_length(
        btrim(timezone)
      ) between 1 and 100
    ),

  disabled_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  check (
    (
      status = 'active'
      and disabled_at is null
    )
    or
    (
      status = 'disabled'
      and disabled_at is not null
    )
  )
);

create index
  workspace_members_role_status_idx
on public.workspace_members(
  role,
  status
);

create index
  workspace_members_status_created_idx
on public.workspace_members(
  status,
  created_at desc
);

create or replace function
  private.validate_workspace_member_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  legacy_admin_role text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id then
      raise exception
        'Workspace member identity is immutable.';
    end if;

    if new.user_id <> old.user_id then
      raise exception
        'Workspace member Auth identity is immutable.';
    end if;

    if new.created_at <> old.created_at then
      raise exception
        'Workspace member creation timestamp is immutable.';
    end if;
  end if;

  select
    ap.role
  into
    legacy_admin_role
  from public.admin_profiles ap
  where ap.user_id =
    new.user_id;

  if new.role = 'owner' then
    if legacy_admin_role is distinct from 'owner' then
      raise exception
        'Workspace Owner must correspond to an existing Owner admin profile.';
    end if;

    if new.status <> 'active' then
      raise exception
        'Workspace Owner cannot be disabled while the Owner admin profile is active.';
    end if;
  elsif new.role = 'va' then
    if legacy_admin_role is not null then
      raise exception
        'VA workspace members cannot also be admin profiles.';
    end if;
  end if;

  if new.status = 'active' then
    new.disabled_at =
      null;
  elsif new.disabled_at is null then
    new.disabled_at =
      now();
  end if;

  return new;
end;
$$;

create trigger
  workspace_members_validate_write
before insert or update
on public.workspace_members
for each row
execute function
  private.validate_workspace_member_write();

create trigger
  workspace_members_set_updated_at
before update
on public.workspace_members
for each row
execute function
  private.set_updated_at();

-- Keep future Owner creation synchronized with the
-- canonical workspace identity layer.
--
-- This covers fresh installations where /api/admin/setup
-- creates the Owner after database migrations have already run.
--
-- Only legacy admin_profiles.role = 'owner' is synchronized.
-- Legacy role = 'admin' is intentionally excluded.

create or replace function
  private.sync_workspace_owner_from_admin_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_workspace_role text;
begin
  if new.role <> 'owner' then
    return new;
  end if;

  select
    wm.role
  into
    existing_workspace_role
  from public.workspace_members wm
  where wm.user_id =
    new.user_id;

  if found
     and existing_workspace_role <> 'owner' then
    raise exception
      'An existing VA workspace member cannot be promoted through admin_profiles.';
  end if;

  insert into public.workspace_members (
    user_id,
    role,
    display_name,
    status,
    timezone
  )
  values (
    new.user_id,
    'owner',
    left(
      coalesce(
        nullif(
          btrim(new.display_name),
          ''
        ),
        'ELLIPSIS Owner'
      ),
      120
    ),
    'active',
    'Asia/Manila'
  )
  on conflict (user_id)
  do update
  set
    display_name =
      excluded.display_name,
    status =
      'active',
    disabled_at =
      null;

  return new;
end;
$$;

create trigger
  admin_profiles_sync_workspace_owner
after insert or update of
  role,
  display_name
on public.admin_profiles
for each row
when (
  new.role = 'owner'
)
execute function
  private.sync_workspace_owner_from_admin_profile();
-- Remove stale workspace Owner identity if the corresponding
-- legacy Owner profile is demoted or deleted.
--
-- This keeps admin_profiles and workspace_members from
-- disagreeing about who holds Owner authority.

create or replace function
  private.unsync_workspace_owner_from_admin_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      delete from public.workspace_members
      where user_id =
        old.user_id
        and role =
          'owner';
    end if;

    return old;
  end if;

  if old.role = 'owner'
     and new.role <> 'owner' then
    delete from public.workspace_members
    where user_id =
      old.user_id
      and role =
        'owner';
  end if;

  return new;
end;
$$;

create trigger
  admin_profiles_unsync_workspace_owner_on_role_change
after update of role
on public.admin_profiles
for each row
when (
  old.role = 'owner'
  and new.role <> 'owner'
)
execute function
  private.unsync_workspace_owner_from_admin_profile();

create trigger
  admin_profiles_unsync_workspace_owner_on_delete
after delete
on public.admin_profiles
for each row
when (
  old.role = 'owner'
)
execute function
  private.unsync_workspace_owner_from_admin_profile();
-- Backfill the existing Studio Owner into the new
-- canonical workspace identity layer.
--
-- Legacy admin profiles with role = 'admin' are intentionally
-- NOT promoted into workspace Owner access.

insert into public.workspace_members (
  user_id,
  role,
  display_name,
  status,
  timezone
)
select
  ap.user_id,
  'owner',
  left(
    coalesce(
      nullif(
        btrim(ap.display_name),
        ''
      ),
      'ELLIPSIS Owner'
    ),
    120
  ),
  'active',
  'Asia/Manila'
from public.admin_profiles ap
where ap.role = 'owner'
on conflict (user_id)
do nothing;

alter table
  public.workspace_members
enable row level security;

-- Every authenticated workspace member may identify
-- their own workspace profile.
create policy
  workspace_members_select_self
on public.workspace_members
for select
to authenticated
using (
  user_id =
    (
      select auth.uid()
    )
);

-- During the S13 transition, the existing Studio Owner
-- retains visibility over the full workforce.
--
-- This deliberately uses admin_profiles instead of recursively
-- querying workspace_members from its own RLS policy.
create policy
  workspace_members_select_owner
on public.workspace_members
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id =
      (
        select auth.uid()
      )
      and ap.role = 'owner'
  )
);

-- No direct browser mutations.
--
-- Owner/VA lifecycle operations will go through controlled
-- server-side APIs using the service role.
revoke all
  on table public.workspace_members
  from public, anon, authenticated;

grant select
  on table public.workspace_members
  to authenticated;

grant all
  on table public.workspace_members
  to service_role;

-- Trigger validator is internal implementation detail.
revoke execute
  on function private.validate_workspace_member_write()
  from public, anon, authenticated;

grant execute
  on function private.validate_workspace_member_write()
  to service_role;


revoke execute
  on function private.sync_workspace_owner_from_admin_profile()
  from public, anon, authenticated;

grant execute
  on function private.sync_workspace_owner_from_admin_profile()
  to service_role;

revoke execute
  on function private.unsync_workspace_owner_from_admin_profile()
  from public, anon, authenticated;

grant execute
  on function private.unsync_workspace_owner_from_admin_profile()
  to service_role;


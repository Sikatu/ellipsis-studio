create table public.client_delivery_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.discovery_projects(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  token_version integer not null default 1 check (token_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  rotated_by uuid references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete restrict,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint client_delivery_access_revocation_state check (
    (status = 'active' and revoked_at is null and revoked_by is null)
    or
    (status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create index client_delivery_access_project_status_idx
  on public.client_delivery_access (project_id, status);

create or replace function public.protect_client_delivery_access()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.rotated_by is null then
      new.rotated_by := new.created_by;
    end if;

    new.token_version := 1;
    new.rotated_at := now();
    new.updated_at := now();

    if new.status = 'active' then
      new.revoked_at := null;
      new.revoked_by := null;
    end if;

    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Client delivery ownership metadata is immutable.';
  end if;

  if new.token_hash is distinct from old.token_hash then
    if new.rotated_by is null then
      raise exception 'rotated_by is required when rotating a delivery token.';
    end if;

    new.token_version := old.token_version + 1;
    new.rotated_at := now();
  else
    new.token_version := old.token_version;
    new.rotated_at := old.rotated_at;
    new.rotated_by := old.rotated_by;
  end if;

  if new.status = 'active' then
    new.revoked_at := null;
    new.revoked_by := null;
  elsif old.status is distinct from 'revoked' then
    if new.revoked_by is null then
      raise exception 'revoked_by is required when revoking delivery access.';
    end if;

    if new.revoked_at is null then
      new.revoked_at := now();
    end if;
  else
    new.revoked_at := old.revoked_at;
    new.revoked_by := old.revoked_by;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_client_delivery_access
before insert or update on public.client_delivery_access
for each row
execute function public.protect_client_delivery_access();

alter table public.client_delivery_access enable row level security;

create policy client_delivery_access_select_owned
on public.client_delivery_access
for select
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_access.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

create policy client_delivery_access_insert_owned
on public.client_delivery_access
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and rotated_by = (select auth.uid())
  and status = 'active'
  and exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_access.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

create policy client_delivery_access_update_owned
on public.client_delivery_access
for update
to authenticated
using (
  exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_access.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects p
    where p.id = client_delivery_access.project_id
      and p.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles a
    where a.user_id = (select auth.uid())
  )
);

revoke all on public.client_delivery_access from anon;
grant select, insert, update on public.client_delivery_access to authenticated;
grant select, insert, update, delete on public.client_delivery_access to service_role;
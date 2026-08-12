create table public.invoice_delivery_access (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','revoked')),
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
  constraint invoice_delivery_access_revocation_state check (
    (status = 'active' and revoked_at is null and revoked_by is null)
    or
    (status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create index invoice_delivery_access_owner_status_idx
  on public.invoice_delivery_access (created_by, status);

create index invoice_delivery_access_invoice_status_idx
  on public.invoice_delivery_access (invoice_id, status);

create table public.invoice_delivery_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  access_id uuid not null references public.invoice_delivery_access(id) on delete cascade,
  event_type text not null check (event_type in (
    'access_activated',
    'link_rotated',
    'access_revoked',
    'portal_viewed',
    'pdf_downloaded'
  )),
  actor_type text not null check (actor_type in ('admin','client','system')),
  actor_admin_id uuid references auth.users(id) on delete restrict,
  token_version integer check (token_version is null or token_version > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint invoice_delivery_events_actor_state check (
    (actor_type = 'admin' and actor_admin_id is not null)
    or
    (actor_type in ('client','system') and actor_admin_id is null)
  )
);

create index invoice_delivery_events_invoice_time_idx
  on public.invoice_delivery_events (invoice_id, occurred_at desc);

create index invoice_delivery_events_access_time_idx
  on public.invoice_delivery_events (access_id, occurred_at desc);

create or replace function public.protect_invoice_delivery_access()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_invoice_owner uuid;
  v_invoice_status text;
  v_pdf_bucket text;
  v_pdf_path text;
  v_pdf_sha256 text;
  v_pdf_bytes bigint;
  v_pdf_created_at timestamptz;
begin
  select
    i.created_by,
    i.status,
    i.final_pdf_bucket,
    i.final_pdf_path,
    i.final_pdf_sha256,
    i.final_pdf_bytes,
    i.final_pdf_created_at
  into
    v_invoice_owner,
    v_invoice_status,
    v_pdf_bucket,
    v_pdf_path,
    v_pdf_sha256,
    v_pdf_bytes,
    v_pdf_created_at
  from public.invoices i
  where i.id = new.invoice_id;

  if v_invoice_owner is null or v_invoice_owner <> new.created_by then
    raise exception 'Invoice delivery access must belong to the invoice owner.';
  end if;

  if tg_op = 'INSERT' then
    if new.rotated_by is null then
      new.rotated_by := new.created_by;
    end if;

    new.token_version := 1;
    new.rotated_at := now();
    new.updated_at := now();

    if new.status <> 'active' then
      raise exception 'New invoice delivery access must start active.';
    end if;
  else
    if new.invoice_id is distinct from old.invoice_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Invoice delivery ownership metadata is immutable.';
    end if;

    if old.status = 'revoked'
      and new.status = 'active'
      and new.token_hash is not distinct from old.token_hash
    then
      raise exception 'Revoked invoice delivery access requires token rotation before reactivation.';
    end if;

    if new.token_hash is distinct from old.token_hash then
      if new.rotated_by is null then
        raise exception 'rotated_by is required when rotating an invoice delivery token.';
      end if;

      new.token_version := old.token_version + 1;
      new.rotated_at := now();
    else
      new.token_version := old.token_version;
      new.rotated_at := old.rotated_at;
      new.rotated_by := old.rotated_by;
    end if;
  end if;

  if new.status = 'active' then
    if v_invoice_status not in ('issued','paid')
      or v_pdf_bucket <> 'studio-invoices'
      or v_pdf_path is null
      or v_pdf_sha256 is null
      or v_pdf_bytes is null
      or v_pdf_created_at is null
    then
      raise exception 'Only issued or paid invoices with an immutable final PDF can be shared.';
    end if;

    if new.expires_at is not null and new.expires_at <= now() then
      raise exception 'Invoice delivery expiration must be in the future.';
    end if;

    new.revoked_at := null;
    new.revoked_by := null;
  elsif new.status = 'revoked' then
    if tg_op = 'INSERT' then
      raise exception 'New invoice delivery access cannot start revoked.';
    end if;

    if old.status is distinct from 'revoked' then
      if new.revoked_by is null then
        raise exception 'revoked_by is required when revoking invoice delivery access.';
      end if;

      if new.revoked_at is null then
        new.revoked_at := now();
      end if;
    else
      new.revoked_at := old.revoked_at;
      new.revoked_by := old.revoked_by;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_invoice_delivery_access
before insert or update on public.invoice_delivery_access
for each row execute function public.protect_invoice_delivery_access();

alter table public.invoice_delivery_access enable row level security;
alter table public.invoice_delivery_events enable row level security;

revoke all on table public.invoice_delivery_access from public, anon, authenticated;
revoke all on table public.invoice_delivery_events from public, anon, authenticated;

revoke all on table public.invoice_delivery_access from service_role;
grant select, insert, update on table public.invoice_delivery_access to service_role;

revoke all on table public.invoice_delivery_events from service_role;
grant select, insert on table public.invoice_delivery_events to service_role;

revoke execute on function public.protect_invoice_delivery_access() from public, anon, authenticated;
grant execute on function public.protect_invoice_delivery_access() to service_role;

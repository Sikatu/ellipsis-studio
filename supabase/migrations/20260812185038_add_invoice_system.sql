create table if not exists public.studio_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  business_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  city text not null default '',
  region text not null default '',
  postal_code text not null default '',
  country text not null default '',
  default_currency text not null default 'USD'
    check (default_currency = any (array['USD','PHP','AUD','CAD','GBP','EUR'])),
  default_payment_terms_days integer not null default 14
    check (default_payment_terms_days between 0 and 365),
  invoice_prefix text not null default 'ELL'
    check (invoice_prefix ~ '^[A-Z0-9-]{2,12}$'),
  payment_instructions text not null default ''
    check (char_length(payment_instructions) <= 10000),
  default_notes text not null default ''
    check (char_length(default_notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(display_name) <= 240),
  check (char_length(business_name) <= 240),
  check (char_length(email) <= 320),
  check (char_length(phone) <= 80),
  check (char_length(address_line_1) <= 500),
  check (char_length(address_line_2) <= 500),
  check (char_length(city) <= 240),
  check (char_length(region) <= 240),
  check (char_length(postal_code) <= 80),
  check (char_length(country) <= 240)
);

create table if not exists public.client_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  billing_name text not null default '',
  company_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  city text not null default '',
  region text not null default '',
  postal_code text not null default '',
  country text not null default '',
  currency text not null default 'USD'
    check (currency = any (array['USD','PHP','AUD','CAD','GBP','EUR'])),
  payment_terms_days integer not null default 14
    check (payment_terms_days between 0 and 365),
  notes text not null default ''
    check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(billing_name) <= 240),
  check (char_length(company_name) <= 240),
  check (char_length(email) <= 320),
  check (char_length(phone) <= 80),
  check (char_length(address_line_1) <= 500),
  check (char_length(address_line_2) <= 500),
  check (char_length(city) <= 240),
  check (char_length(region) <= 240),
  check (char_length(postal_code) <= 80),
  check (char_length(country) <= 240)
);

create table if not exists public.invoice_counters (
  created_by uuid not null references auth.users(id) on delete cascade,
  invoice_year integer not null check (invoice_year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (created_by, invoice_year)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_number text not null,
  status text not null default 'draft'
    check (status = any (array['draft','issued','paid','overdue','void'])),
  invoice_date date not null default current_date,
  due_date date not null default current_date,
  currency text not null
    check (currency = any (array['USD','PHP','AUD','CAD','GBP','EUR'])),
  sender_snapshot jsonb not null default '{}'::jsonb,
  client_snapshot jsonb not null default '{}'::jsonb,
  payment_instructions_snapshot text not null default ''
    check (char_length(payment_instructions_snapshot) <= 10000),
  notes text not null default ''
    check (char_length(notes) <= 10000),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  adjustment_cents bigint not null default 0,
  total_cents bigint not null default 0,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, invoice_number),
  check (char_length(invoice_number) between 1 and 80),
  check (due_date >= invoice_date),
  check (total_cents >= 0)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  description text not null check (char_length(description) between 1 and 1000),
  quantity numeric(12,4) not null default 1 check (quantity > 0),
  unit_label text not null default 'service'
    check (char_length(unit_label) between 1 and 80),
  unit_rate_cents bigint not null default 0 check (unit_rate_cents >= 0),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_billing_profiles_created_by_idx
  on public.client_billing_profiles(created_by);

create index if not exists invoices_created_by_created_at_idx
  on public.invoices(created_by, created_at desc);

create index if not exists invoices_client_id_created_at_idx
  on public.invoices(client_id, created_at desc);

create index if not exists invoices_status_due_date_idx
  on public.invoices(status, due_date);

create index if not exists invoice_items_invoice_id_sort_order_idx
  on public.invoice_items(invoice_id, sort_order, created_at);

create or replace function public.validate_studio_billing_profile_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.created_by <> old.created_by then
    raise exception 'Billing profile owner is immutable.';
  end if;

  new.invoice_prefix := upper(trim(new.invoice_prefix));
  new.updated_at := now();

  return new;
end;
$$;

create or replace function public.validate_client_billing_profile_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_owner uuid;
begin
  select c.created_by
    into client_owner
  from public.clients c
  where c.id = new.client_id;

  if client_owner is null or client_owner <> new.created_by then
    raise exception 'Client billing profile owner must match client owner.';
  end if;

  if tg_op = 'UPDATE' then
    if new.client_id <> old.client_id then
      raise exception 'Client billing profile client is immutable.';
    end if;

    if new.created_by <> old.created_by then
      raise exception 'Client billing profile owner is immutable.';
    end if;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create or replace function public.prepare_invoice_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_owner uuid;
  next_number integer;
  prefix text;
  invoice_year integer;
begin
  select c.created_by
    into client_owner
  from public.clients c
  where c.id = new.client_id;

  if client_owner is null or client_owner <> new.created_by then
    raise exception 'Invoice client must belong to invoice owner.';
  end if;

  if tg_op = 'INSERT' then
    invoice_year := extract(year from new.invoice_date)::integer;

    select coalesce(nullif(trim(sbp.invoice_prefix), ''), 'ELL')
      into prefix
    from public.studio_billing_profiles sbp
    where sbp.created_by = new.created_by;

    prefix := coalesce(prefix, 'ELL');

    insert into public.invoice_counters (
      created_by,
      invoice_year,
      last_number,
      updated_at
    )
    values (
      new.created_by,
      invoice_year,
      1,
      now()
    )
    on conflict (created_by, invoice_year)
    do update
      set last_number = public.invoice_counters.last_number + 1,
          updated_at = now()
    returning last_number into next_number;

    new.invoice_number :=
      prefix || '-' ||
      invoice_year::text || '-' ||
      lpad(next_number::text, 4, '0');
  else
    if new.created_by <> old.created_by then
      raise exception 'Invoice owner is immutable.';
    end if;

    if new.invoice_number <> old.invoice_number then
      raise exception 'Invoice number is immutable.';
    end if;
  end if;

  if new.status = 'issued' and old.status is distinct from 'issued' and new.issued_at is null then
    new.issued_at := now();
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  if new.status = 'void' and old.status is distinct from 'void' and new.voided_at is null then
    new.voided_at := now();
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create or replace function public.prepare_invoice_item_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  invoice_owner uuid;
begin
  select i.created_by
    into invoice_owner
  from public.invoices i
  where i.id = new.invoice_id;

  if invoice_owner is null or invoice_owner <> new.created_by then
    raise exception 'Invoice item owner must match invoice owner.';
  end if;

  if tg_op = 'UPDATE' then
    if new.invoice_id <> old.invoice_id then
      raise exception 'Invoice item invoice is immutable.';
    end if;

    if new.created_by <> old.created_by then
      raise exception 'Invoice item owner is immutable.';
    end if;
  end if;

  new.amount_cents :=
    round(new.quantity * new.unit_rate_cents)::bigint;

  new.updated_at := now();

  return new;
end;
$$;

create or replace function public.recalculate_invoice_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_invoice_id uuid;
  new_subtotal bigint;
begin
  target_invoice_id :=
    case
      when tg_op = 'DELETE' then old.invoice_id
      else new.invoice_id
    end;

  select coalesce(sum(ii.amount_cents), 0)::bigint
    into new_subtotal
  from public.invoice_items ii
  where ii.invoice_id = target_invoice_id;

  update public.invoices i
  set subtotal_cents = new_subtotal,
      total_cents = greatest(
        0,
        new_subtotal
        - i.discount_cents
        + i.tax_cents
        + i.adjustment_cents
      ),
      updated_at = now()
  where i.id = target_invoice_id;

  return null;
end;
$$;

drop trigger if exists validate_studio_billing_profile_write
  on public.studio_billing_profiles;

create trigger validate_studio_billing_profile_write
before insert or update
on public.studio_billing_profiles
for each row
execute function public.validate_studio_billing_profile_write();

drop trigger if exists validate_client_billing_profile_write
  on public.client_billing_profiles;

create trigger validate_client_billing_profile_write
before insert or update
on public.client_billing_profiles
for each row
execute function public.validate_client_billing_profile_write();

drop trigger if exists prepare_invoice_write
  on public.invoices;

create trigger prepare_invoice_write
before insert or update
on public.invoices
for each row
execute function public.prepare_invoice_write();

drop trigger if exists prepare_invoice_item_write
  on public.invoice_items;

create trigger prepare_invoice_item_write
before insert or update
on public.invoice_items
for each row
execute function public.prepare_invoice_item_write();

drop trigger if exists recalculate_invoice_totals
  on public.invoice_items;

create trigger recalculate_invoice_totals
after insert or update or delete
on public.invoice_items
for each row
execute function public.recalculate_invoice_totals();

alter table public.studio_billing_profiles enable row level security;
alter table public.client_billing_profiles enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists studio_billing_profiles_select_owned
  on public.studio_billing_profiles;

create policy studio_billing_profiles_select_owned
on public.studio_billing_profiles
for select
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists client_billing_profiles_select_owned
  on public.client_billing_profiles;

create policy client_billing_profiles_select_owned
on public.client_billing_profiles
for select
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists invoices_select_owned
  on public.invoices;

create policy invoices_select_owned
on public.invoices
for select
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists invoice_items_select_owned
  on public.invoice_items;

create policy invoice_items_select_owned
on public.invoice_items
for select
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

revoke all on public.invoice_counters from anon, authenticated;
revoke insert, update, delete on public.studio_billing_profiles from authenticated;
revoke insert, update, delete on public.client_billing_profiles from authenticated;
revoke insert, update, delete on public.invoices from authenticated;
revoke insert, update, delete on public.invoice_items from authenticated;

grant select on public.studio_billing_profiles to authenticated;
grant select on public.client_billing_profiles to authenticated;
grant select on public.invoices to authenticated;
grant select on public.invoice_items to authenticated;

revoke execute on function public.validate_studio_billing_profile_write()
  from public, anon, authenticated;
revoke execute on function public.validate_client_billing_profile_write()
  from public, anon, authenticated;
revoke execute on function public.prepare_invoice_write()
  from public, anon, authenticated;
revoke execute on function public.prepare_invoice_item_write()
  from public, anon, authenticated;
revoke execute on function public.recalculate_invoice_totals()
  from public, anon, authenticated;

grant execute on function public.validate_studio_billing_profile_write()
  to service_role;
grant execute on function public.validate_client_billing_profile_write()
  to service_role;
grant execute on function public.prepare_invoice_write()
  to service_role;
grant execute on function public.prepare_invoice_item_write()
  to service_role;
grant execute on function public.recalculate_invoice_totals()
  to service_role;

grant all on public.studio_billing_profiles to service_role;
grant all on public.client_billing_profiles to service_role;
grant all on public.invoice_counters to service_role;
grant all on public.invoices to service_role;
grant all on public.invoice_items to service_role;

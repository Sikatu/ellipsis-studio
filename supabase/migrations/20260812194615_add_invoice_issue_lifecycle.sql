alter table public.invoices
  add column if not exists final_pdf_bucket text,
  add column if not exists final_pdf_path text,
  add column if not exists final_pdf_sha256 text,
  add column if not exists final_pdf_bytes bigint,
  add column if not exists final_pdf_created_at timestamptz;

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status = any (array['draft','issued','paid','void']));

alter table public.invoices
  drop constraint if exists invoices_final_pdf_sha256_check;

alter table public.invoices
  add constraint invoices_final_pdf_sha256_check
  check (
    final_pdf_sha256 is null
    or final_pdf_sha256 ~ '^[0-9a-f]{64}$'
  );

alter table public.invoices
  drop constraint if exists invoices_final_pdf_bytes_check;

alter table public.invoices
  add constraint invoices_final_pdf_bytes_check
  check (
    final_pdf_bytes is null
    or final_pdf_bytes > 0
  );

alter table public.invoices
  drop constraint if exists invoices_final_pdf_all_or_none_check;

alter table public.invoices
  add constraint invoices_final_pdf_all_or_none_check
  check (
    (
      final_pdf_bucket is null
      and final_pdf_path is null
      and final_pdf_sha256 is null
      and final_pdf_bytes is null
      and final_pdf_created_at is null
    )
    or
    (
      final_pdf_bucket is not null
      and final_pdf_path is not null
      and final_pdf_sha256 is not null
      and final_pdf_bytes is not null
      and final_pdf_created_at is not null
    )
  );

create unique index if not exists invoices_final_pdf_path_uidx
  on public.invoices(final_pdf_path)
  where final_pdf_path is not null;

do $$
declare
  existing_public boolean;
  existing_limit bigint;
  existing_mimes text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
    into existing_public, existing_limit, existing_mimes
  from storage.buckets b
  where b.id = 'studio-invoices';

  if not found then
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    values (
      'studio-invoices',
      'studio-invoices',
      false,
      5242880,
      array['application/pdf']
    );
  else
    if existing_public is distinct from false then
      raise exception 'studio-invoices bucket must remain private';
    end if;

    if existing_limit is distinct from 5242880 then
      raise exception 'studio-invoices bucket file size limit is unexpected';
    end if;

    if existing_mimes is distinct from array['application/pdf']::text[] then
      raise exception 'studio-invoices bucket MIME policy is unexpected';
    end if;
  end if;
end;
$$;

create or replace function public.prepare_invoice_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client_owner uuid;
  v_next_number integer;
  v_prefix text;
  v_invoice_year integer;
begin
  select c.created_by
    into v_client_owner
  from public.clients c
  where c.id = new.client_id;

  if v_client_owner is null or v_client_owner <> new.created_by then
    raise exception 'Invoice client must belong to invoice owner.';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New invoices must start as draft.';
    end if;

    if new.final_pdf_bucket is not null
      or new.final_pdf_path is not null
      or new.final_pdf_sha256 is not null
      or new.final_pdf_bytes is not null
      or new.final_pdf_created_at is not null
    then
      raise exception 'Draft invoices cannot have a final PDF.';
    end if;

    v_invoice_year := extract(year from new.invoice_date)::integer;

    select coalesce(nullif(trim(sbp.invoice_prefix), ''), 'ELL')
      into v_prefix
    from public.studio_billing_profiles sbp
    where sbp.created_by = new.created_by;

    v_prefix := coalesce(v_prefix, 'ELL');

    insert into public.invoice_counters (
      created_by,
      invoice_year,
      last_number,
      updated_at
    )
    values (
      new.created_by,
      v_invoice_year,
      1,
      now()
    )
    on conflict on constraint invoice_counters_pkey
    do update
      set last_number = public.invoice_counters.last_number + 1,
          updated_at = now()
    returning last_number into v_next_number;

    new.invoice_number :=
      v_prefix || '-' ||
      v_invoice_year::text || '-' ||
      lpad(v_next_number::text, 4, '0');
  else
    if new.created_by <> old.created_by then
      raise exception 'Invoice owner is immutable.';
    end if;

    if new.invoice_number <> old.invoice_number then
      raise exception 'Invoice number is immutable.';
    end if;

    if old.status = 'draft' then
      if new.status not in ('draft','issued','void') then
        raise exception 'Invalid invoice status transition from draft.';
      end if;
    elsif old.status = 'issued' then
      if new.status not in ('issued','paid','void') then
        raise exception 'Invalid invoice status transition from issued.';
      end if;
    elsif old.status = 'paid' then
      if new.status <> 'paid' then
        raise exception 'Paid invoices are terminal.';
      end if;
    elsif old.status = 'void' then
      if new.status <> 'void' then
        raise exception 'Void invoices are terminal.';
      end if;
    else
      raise exception 'Unknown invoice status.';
    end if;

    if old.status <> 'draft' then
      if new.client_id is distinct from old.client_id
        or new.invoice_date is distinct from old.invoice_date
        or new.due_date is distinct from old.due_date
        or new.currency is distinct from old.currency
        or new.sender_snapshot is distinct from old.sender_snapshot
        or new.client_snapshot is distinct from old.client_snapshot
        or new.payment_instructions_snapshot is distinct from old.payment_instructions_snapshot
        or new.notes is distinct from old.notes
        or new.subtotal_cents is distinct from old.subtotal_cents
        or new.discount_cents is distinct from old.discount_cents
        or new.tax_cents is distinct from old.tax_cents
        or new.adjustment_cents is distinct from old.adjustment_cents
        or new.total_cents is distinct from old.total_cents
        or new.issued_at is distinct from old.issued_at
        or new.final_pdf_bucket is distinct from old.final_pdf_bucket
        or new.final_pdf_path is distinct from old.final_pdf_path
        or new.final_pdf_sha256 is distinct from old.final_pdf_sha256
        or new.final_pdf_bytes is distinct from old.final_pdf_bytes
        or new.final_pdf_created_at is distinct from old.final_pdf_created_at
      then
        raise exception 'Issued invoice content is immutable.';
      end if;
    end if;
  end if;

  if new.status = 'draft' then
    if new.issued_at is not null
      or new.paid_at is not null
      or new.voided_at is not null
      or new.final_pdf_bucket is not null
      or new.final_pdf_path is not null
      or new.final_pdf_sha256 is not null
      or new.final_pdf_bytes is not null
      or new.final_pdf_created_at is not null
    then
      raise exception 'Draft invoice lifecycle fields must remain empty.';
    end if;
  end if;

  if new.status = 'issued' then
    if new.final_pdf_bucket <> 'studio-invoices'
      or new.final_pdf_path is null
      or new.final_pdf_sha256 is null
      or new.final_pdf_bytes is null
      or new.final_pdf_created_at is null
    then
      raise exception 'Issued invoices require an immutable final PDF.';
    end if;

    if new.issued_at is null then
      new.issued_at := now();
    end if;
  end if;

  if new.status = 'paid' then
    if new.issued_at is null
      or new.final_pdf_bucket <> 'studio-invoices'
      or new.final_pdf_path is null
      or new.final_pdf_sha256 is null
      or new.final_pdf_bytes is null
      or new.final_pdf_created_at is null
    then
      raise exception 'Paid invoices must already be issued.';
    end if;

    if new.paid_at is null then
      new.paid_at := now();
    end if;
  end if;

  if new.status = 'void' and new.voided_at is null then
    new.voided_at := now();
  end if;

  new.total_cents := greatest(
    0,
    new.subtotal_cents
    - new.discount_cents
    + new.tax_cents
    + new.adjustment_cents
  );

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_invoice_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_invoice_status text;
begin
  v_invoice_id :=
    case
      when tg_op = 'DELETE' then old.invoice_id
      else new.invoice_id
    end;

  select i.status
    into v_invoice_status
  from public.invoices i
  where i.id = v_invoice_id;

  if v_invoice_status is null then
    raise exception 'Invoice not found for item mutation.';
  end if;

  if v_invoice_status <> 'draft' then
    raise exception 'Issued invoice items are immutable.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_invoice_item_mutation
  on public.invoice_items;

create trigger protect_invoice_item_mutation
before insert or update or delete
on public.invoice_items
for each row
execute function public.protect_invoice_item_mutation();

revoke execute on function public.prepare_invoice_write()
  from public, anon, authenticated;

revoke execute on function public.protect_invoice_item_mutation()
  from public, anon, authenticated;

grant execute on function public.prepare_invoice_write()
  to service_role;

grant execute on function public.protect_invoice_item_mutation()
  to service_role;

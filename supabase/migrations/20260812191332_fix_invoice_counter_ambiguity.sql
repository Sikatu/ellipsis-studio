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

    if new.status = 'issued' and new.issued_at is null then
      new.issued_at := now();
    end if;

    if new.status = 'paid' and new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.status = 'void' and new.voided_at is null then
      new.voided_at := now();
    end if;
  else
    if new.created_by <> old.created_by then
      raise exception 'Invoice owner is immutable.';
    end if;

    if new.invoice_number <> old.invoice_number then
      raise exception 'Invoice number is immutable.';
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

revoke execute on function public.prepare_invoice_write()
from public, anon, authenticated;

grant execute on function public.prepare_invoice_write()
to service_role;

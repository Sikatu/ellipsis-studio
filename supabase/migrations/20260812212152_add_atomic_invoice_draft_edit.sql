create or replace function public.replace_invoice_draft(
  p_invoice_id uuid,
  p_created_by uuid,
  p_client_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_currency text,
  p_sender_snapshot jsonb,
  p_client_snapshot jsonb,
  p_payment_instructions_snapshot text,
  p_notes text,
  p_line_items jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $$
declare
  v_status text;
  v_client_owner uuid;
  v_count integer;
  v_index integer := 0;
  v_item jsonb;
  v_description text;
  v_quantity numeric;
  v_unit_label text;
  v_unit_rate_cents bigint;
  v_notes text;
begin
  select i.status
    into v_status
  from public.invoices i
  where i.id = p_invoice_id
    and i.created_by = p_created_by
  for update;

  if v_status is null then
    raise exception 'Invoice not found.';
  end if;

  if v_status <> 'draft' then
    raise exception 'Only draft invoices can be edited.';
  end if;

  select c.created_by
    into v_client_owner
  from public.clients c
  where c.id = p_client_id
    and c.status = 'active';

  if v_client_owner is null or v_client_owner <> p_created_by then
    raise exception 'Client not found.';
  end if;

  if p_invoice_date is null or p_due_date is null or p_due_date < p_invoice_date then
    raise exception 'Choose valid invoice and due dates.';
  end if;

  if p_currency not in ('USD','PHP','AUD','CAD','GBP','EUR') then
    raise exception 'Choose a supported currency.';
  end if;

  if p_sender_snapshot is null or jsonb_typeof(p_sender_snapshot) <> 'object' then
    raise exception 'Sender snapshot is invalid.';
  end if;

  if p_client_snapshot is null or jsonb_typeof(p_client_snapshot) <> 'object' then
    raise exception 'Client snapshot is invalid.';
  end if;

  if length(coalesce(p_payment_instructions_snapshot, '')) > 10000 then
    raise exception 'Payment instructions are too long.';
  end if;

  if length(coalesce(p_notes, '')) > 10000 then
    raise exception 'Invoice note is too long.';
  end if;

  if p_line_items is null or jsonb_typeof(p_line_items) <> 'array' then
    raise exception 'Invoice work items are invalid.';
  end if;

  v_count := jsonb_array_length(p_line_items);

  if v_count < 1 or v_count > 100 then
    raise exception 'Add between 1 and 100 work items.';
  end if;

  -- Validate every replacement item before mutating the invoice.
  for v_item in
    select value
    from jsonb_array_elements(p_line_items)
  loop
    v_description := btrim(coalesce(v_item ->> 'description', ''));
    v_unit_label := btrim(coalesce(v_item ->> 'unit_label', ''));
    v_notes := coalesce(v_item ->> 'notes', '');

    begin
      v_quantity := (v_item ->> 'quantity')::numeric;
      v_unit_rate_cents := (v_item ->> 'unit_rate_cents')::bigint;
    exception
      when others then
        raise exception 'Invoice work item values are invalid.';
    end;

    if v_description = '' or length(v_description) > 1000 then
      raise exception 'Invoice work item description is invalid.';
    end if;

    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then
      raise exception 'Invoice work item quantity is invalid.';
    end if;

    if v_unit_label = '' or length(v_unit_label) > 80 then
      raise exception 'Invoice work item unit is invalid.';
    end if;

    if v_unit_rate_cents is null or v_unit_rate_cents < 0 or v_unit_rate_cents > 100000000000 then
      raise exception 'Invoice work item rate is invalid.';
    end if;

    if length(v_notes) > 5000 then
      raise exception 'Invoice work item note is too long.';
    end if;
  end loop;

  update public.invoices i
  set client_id = p_client_id,
      invoice_date = p_invoice_date,
      due_date = p_due_date,
      currency = p_currency,
      sender_snapshot = p_sender_snapshot,
      client_snapshot = p_client_snapshot,
      payment_instructions_snapshot = coalesce(p_payment_instructions_snapshot, ''),
      notes = coalesce(p_notes, '')
  where i.id = p_invoice_id
    and i.created_by = p_created_by
    and i.status = 'draft';

  if not found then
    raise exception 'Invoice changed before it could be updated.';
  end if;

  delete from public.invoice_items ii
  where ii.invoice_id = p_invoice_id
    and ii.created_by = p_created_by;

  v_index := 0;

  for v_item in
    select value
    from jsonb_array_elements(p_line_items)
  loop
    v_description := btrim(coalesce(v_item ->> 'description', ''));
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_label := btrim(coalesce(v_item ->> 'unit_label', ''));
    v_unit_rate_cents := (v_item ->> 'unit_rate_cents')::bigint;
    v_notes := coalesce(v_item ->> 'notes', '');

    insert into public.invoice_items (
      invoice_id,
      created_by,
      sort_order,
      description,
      quantity,
      unit_label,
      unit_rate_cents,
      amount_cents,
      notes
    )
    values (
      p_invoice_id,
      p_created_by,
      v_index,
      v_description,
      v_quantity,
      v_unit_label,
      v_unit_rate_cents,
      0,
      v_notes
    );

    v_index := v_index + 1;
  end loop;

  return p_invoice_id;
end;
$$;

revoke execute on function public.replace_invoice_draft(
  uuid, uuid, uuid, date, date, text, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.replace_invoice_draft(
  uuid, uuid, uuid, date, date, text, jsonb, jsonb, text, text, jsonb
) to service_role;

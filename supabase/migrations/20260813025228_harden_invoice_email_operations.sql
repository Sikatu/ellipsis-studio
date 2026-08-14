-- Forward-only hardening for the already-applied add_invoice_email_operations migration.
-- Keep the original migration immutable; this migration records the safety changes separately.

alter table public.invoice_email_automations
  drop constraint invoice_email_automations_subject_template_check,
  drop constraint invoice_email_automations_body_template_check;

alter table public.invoice_email_automations
  add constraint invoice_email_automations_subject_template_check check (
    char_length(subject_template) between 1 and 500
    and subject_template !~ E'[\r\n]'
    and position('{{secure_link}}' in subject_template) = 0
  ),
  add constraint invoice_email_automations_body_template_check check (
    char_length(body_template) between 1 and 10000
    and position('{{secure_link}}' in body_template) > 0
  );

create or replace function public.prepare_invoice_email_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
  v_access_invoice uuid;
  v_access_owner uuid;
  v_access_status text;
  v_access_version integer;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.invoice_id is distinct from old.invoice_id
       or new.access_id is distinct from old.access_id
       or new.created_by is distinct from old.created_by
       or new.purpose is distinct from old.purpose
       or new.trigger_type is distinct from old.trigger_type
       or new.recipient_email is distinct from old.recipient_email
       or new.subject is distinct from old.subject
       or new.body_template is distinct from old.body_template
       or new.provider is distinct from old.provider
       or new.idempotency_key is distinct from old.idempotency_key
       or new.token_version is distinct from old.token_version
       or new.attempted_at is distinct from old.attempted_at
       or new.metadata is distinct from old.metadata
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Invoice email delivery request metadata is immutable.';
    end if;

    if old.status <> 'attempting'
       or new.status not in ('sent', 'failed')
    then
      raise exception 'Invoice email delivery result is immutable after finalization.';
    end if;

    new.updated_at := now();
    return new;
  end if;

  select i.created_by, i.status
    into v_owner, v_status
  from public.invoices as i
  where i.id = new.invoice_id;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if new.created_by <> v_owner then
    raise exception 'Invoice email owner mismatch.';
  end if;

  if v_status <> 'issued' then
    raise exception 'Email delivery is allowed only for issued invoices.';
  end if;

  select a.invoice_id, a.created_by, a.status, a.token_version
    into v_access_invoice, v_access_owner, v_access_status, v_access_version
  from public.invoice_delivery_access as a
  where a.id = new.access_id;

  if not found
     or v_access_invoice <> new.invoice_id
     or v_access_owner <> new.created_by
  then
    raise exception 'Invoice email secure access mismatch.';
  end if;

  if v_access_status <> 'active' then
    raise exception 'Invoice email requires active secure access.';
  end if;

  if new.token_version <> v_access_version then
    raise exception 'Invoice email token version mismatch.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_invoice_email_delivery_before_insert
  on public.invoice_email_deliveries;
drop trigger if exists prepare_invoice_email_delivery_before_write
  on public.invoice_email_deliveries;

create trigger prepare_invoice_email_delivery_before_write
before insert or update on public.invoice_email_deliveries
for each row
execute function public.prepare_invoice_email_delivery();

create or replace function public.save_invoice_email_automation(
  p_invoice_id uuid,
  p_created_by uuid,
  p_enabled boolean,
  p_send_at timestamptz,
  p_subject_template text,
  p_body_template text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_subject text := trim(coalesce(p_subject_template, ''));
  v_body text := trim(coalesce(p_body_template, ''));
begin
  select i.status
    into v_status
  from public.invoices as i
  where i.id = p_invoice_id
    and i.created_by = p_created_by
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_status <> 'issued' then
    raise exception 'Automatic reminders can be configured only for issued invoices.';
  end if;

  if char_length(v_subject) < 1
     or char_length(v_subject) > 500
     or v_subject ~ E'[\r\n]'
     or position('{{secure_link}}' in v_subject) > 0
  then
    raise exception 'Reminder subject must be one line and cannot contain the secure link.';
  end if;

  if char_length(v_body) < 1
     or char_length(v_body) > 10000
     or position('{{secure_link}}' in v_body) = 0
  then
    raise exception 'Reminder message must include {{secure_link}} and be between 1 and 10000 characters.';
  end if;

  if p_enabled then
    if p_send_at is null then
      raise exception 'Choose when the automatic reminder should be sent.';
    end if;

    if p_send_at <= now() then
      raise exception 'Automatic reminder time must be in the future.';
    end if;
  end if;

  insert into public.invoice_email_automations (
    invoice_id,
    created_by,
    enabled,
    send_at,
    subject_template,
    body_template
  ) values (
    p_invoice_id,
    p_created_by,
    coalesce(p_enabled, false),
    p_send_at,
    v_subject,
    v_body
  )
  on conflict (invoice_id) do update
    set enabled = excluded.enabled,
        send_at = excluded.send_at,
        subject_template = excluded.subject_template,
        body_template = excluded.body_template;

  return p_invoice_id;
end;
$$;

revoke all on function public.save_invoice_email_automation(uuid, uuid, boolean, timestamptz, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_invoice_email_automation(uuid, uuid, boolean, timestamptz, text, text)
  to service_role;

create table public.invoice_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  access_id uuid not null references public.invoice_delivery_access(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('invoice','payment_reminder')),
  trigger_type text not null check (trigger_type in ('manual','scheduled')),
  recipient_email text not null check (
    char_length(recipient_email) between 3 and 320
    and recipient_email !~ E'[\r\n]'
  ),
  subject text not null check (
    char_length(subject) between 1 and 500
    and subject !~ E'[\r\n]'
  ),
  body_template text not null check (char_length(body_template) between 1 and 10000),
  provider text not null check (char_length(provider) between 1 and 80),
  provider_message_id text,
  status text not null default 'attempting' check (status in ('attempting','sent','failed')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 256),
  token_version integer not null check (token_version > 0),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 160),
  error_message text check (error_message is null or char_length(error_message) <= 5000),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not (metadata ? 'token')
    and not (metadata ? 'secureToken')
    and not (metadata ? 'secureUrl')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_email_delivery_result_state check (
    (status = 'attempting' and provider_message_id is null and sent_at is null)
    or
    (status = 'sent' and provider_message_id is not null and sent_at is not null and error_message is null)
    or
    (status = 'failed' and sent_at is null and error_message is not null)
  )
);

create index invoice_email_deliveries_invoice_time_idx
  on public.invoice_email_deliveries (invoice_id, attempted_at desc);

create index invoice_email_deliveries_owner_status_idx
  on public.invoice_email_deliveries (created_by, status, attempted_at desc);

create index invoice_email_deliveries_provider_message_idx
  on public.invoice_email_deliveries (provider, provider_message_id)
  where provider_message_id is not null;

create table public.invoice_email_automations (
  invoice_id uuid primary key references public.invoices(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  enabled boolean not null default false,
  send_at timestamptz,
  subject_template text not null check (char_length(subject_template) between 1 and 500),
  body_template text not null check (char_length(body_template) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_email_automation_schedule_state check (
    not enabled or send_at is not null
  )
);

create index invoice_email_automations_due_idx
  on public.invoice_email_automations (send_at, invoice_id)
  where enabled = true and send_at is not null;

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

create trigger prepare_invoice_email_delivery_before_insert
before insert on public.invoice_email_deliveries
for each row
execute function public.prepare_invoice_email_delivery();

create or replace function public.prepare_invoice_email_automation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
begin
  select i.created_by, i.status
    into v_owner, v_status
  from public.invoices as i
  where i.id = new.invoice_id;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if new.created_by <> v_owner then
    raise exception 'Invoice email automation owner mismatch.';
  end if;

  if tg_op = 'UPDATE' then
    if new.invoice_id <> old.invoice_id
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at
    then
      raise exception 'Invoice email automation ownership metadata is immutable.';
    end if;
  end if;

  if new.enabled then
    if v_status <> 'issued' then
      raise exception 'Automatic reminders can run only for issued invoices.';
    end if;

    if new.send_at is null then
      raise exception 'Automatic reminder requires a scheduled date.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_invoice_email_automation_before_write
before insert or update on public.invoice_email_automations
for each row
execute function public.prepare_invoice_email_automation();

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

  if char_length(v_subject) < 1 or char_length(v_subject) > 500 then
    raise exception 'Reminder subject must be between 1 and 500 characters.';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'Reminder message must be between 1 and 10000 characters.';
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

create or replace function public.claim_due_invoice_email_automation(
  p_invoice_id uuid,
  p_created_by uuid,
  p_expected_send_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_send_at timestamptz;
  v_status text;
begin
  select a.enabled, a.send_at
    into v_enabled, v_send_at
  from public.invoice_email_automations as a
  where a.invoice_id = p_invoice_id
    and a.created_by = p_created_by
  for update;

  if not found
     or not v_enabled
     or v_send_at is distinct from p_expected_send_at
     or v_send_at is null
     or v_send_at > now()
  then
    return false;
  end if;

  select i.status
    into v_status
  from public.invoices as i
  where i.id = p_invoice_id
    and i.created_by = p_created_by
  for update;

  if not found or v_status <> 'issued' then
    update public.invoice_email_automations
       set enabled = false,
           updated_at = now()
     where invoice_id = p_invoice_id
       and created_by = p_created_by;

    return false;
  end if;

  update public.invoice_email_automations
     set enabled = false,
         updated_at = now()
   where invoice_id = p_invoice_id
     and created_by = p_created_by;

  return true;
end;
$$;

create or replace function public.disable_invoice_email_automation_on_close()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('paid','void') then
    update public.invoice_email_automations
       set enabled = false,
           updated_at = now()
     where invoice_id = new.id
       and enabled = true;
  end if;

  return new;
end;
$$;

create trigger disable_invoice_email_automation_after_close
after update of status on public.invoices
for each row
execute function public.disable_invoice_email_automation_on_close();

alter table public.invoice_email_deliveries enable row level security;
alter table public.invoice_email_automations enable row level security;

revoke all on table public.invoice_email_deliveries from public, anon, authenticated, service_role;
revoke all on table public.invoice_email_automations from public, anon, authenticated, service_role;

grant select, insert, update on table public.invoice_email_deliveries to service_role;
grant select, insert, update on table public.invoice_email_automations to service_role;

revoke all on function public.save_invoice_email_automation(uuid, uuid, boolean, timestamptz, text, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_due_invoice_email_automation(uuid, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.prepare_invoice_email_delivery() from public, anon, authenticated;
revoke all on function public.prepare_invoice_email_automation() from public, anon, authenticated;
revoke all on function public.disable_invoice_email_automation_on_close() from public, anon, authenticated;

grant execute on function public.save_invoice_email_automation(uuid, uuid, boolean, timestamptz, text, text) to service_role;
grant execute on function public.claim_due_invoice_email_automation(uuid, uuid, timestamptz) to service_role;


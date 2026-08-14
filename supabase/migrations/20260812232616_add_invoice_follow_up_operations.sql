create table public.invoice_follow_up_states (
  invoice_id uuid primary key references public.invoices(id) on delete cascade,
  created_by uuid not null,
  reminder_state text not null default 'none' check (reminder_state in ('none','scheduled','sent','resolved')),
  next_follow_up_at timestamptz,
  internal_note text not null default '' check (char_length(internal_note) <= 10000),
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_communication_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  created_by uuid not null,
  event_type text not null check (event_type in ('payment_reminder_sent','client_reply','payment_update','note')),
  channel text not null check (channel in ('email','message','call','other')),
  summary text not null check (char_length(summary) between 1 and 5000),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index invoice_follow_up_states_due_idx
  on public.invoice_follow_up_states (created_by, next_follow_up_at)
  where next_follow_up_at is not null;

create index invoice_communication_events_invoice_time_idx
  on public.invoice_communication_events (invoice_id, occurred_at desc);

create or replace function public.prepare_invoice_follow_up_state()
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
    raise exception 'Invoice follow-up owner mismatch.';
  end if;

  if tg_op = 'UPDATE' then
    if new.invoice_id <> old.invoice_id or new.created_by <> old.created_by then
      raise exception 'Invoice follow-up ownership fields are immutable.';
    end if;
  end if;

  if v_status = 'draft' then
    raise exception 'Issue the invoice before scheduling payment follow-up.';
  end if;

  if v_status in ('paid','void') then
    if new.reminder_state <> 'resolved' or new.next_follow_up_at is not null then
      raise exception 'Closed invoices can only keep resolved follow-up state.';
    end if;
  end if;

  if new.reminder_state = 'scheduled' and new.next_follow_up_at is null then
    raise exception 'Scheduled follow-up requires a date.';
  end if;

  if new.reminder_state in ('none','resolved') and new.next_follow_up_at is not null then
    raise exception 'This follow-up state cannot keep a scheduled date.';
  end if;

  new.internal_note := coalesce(new.internal_note, '');
  new.updated_at := now();

  return new;
end;
$$;

create trigger prepare_invoice_follow_up_state_before_write
before insert or update on public.invoice_follow_up_states
for each row
execute function public.prepare_invoice_follow_up_state();

create or replace function public.save_invoice_follow_up(
  p_invoice_id uuid,
  p_created_by uuid,
  p_next_follow_up_at timestamptz,
  p_internal_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_current_state text;
  v_state text;
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
    raise exception 'Only issued invoices can schedule payment follow-up.';
  end if;

  if char_length(coalesce(p_internal_note, '')) > 10000 then
    raise exception 'Follow-up note is too long.';
  end if;

  select s.reminder_state
    into v_current_state
  from public.invoice_follow_up_states as s
  where s.invoice_id = p_invoice_id;

  if p_next_follow_up_at is not null then
    v_state := 'scheduled';
  elsif v_current_state = 'sent' then
    v_state := 'sent';
  else
    v_state := 'none';
  end if;

  insert into public.invoice_follow_up_states (
    invoice_id,
    created_by,
    reminder_state,
    next_follow_up_at,
    internal_note
  ) values (
    p_invoice_id,
    p_created_by,
    v_state,
    p_next_follow_up_at,
    coalesce(p_internal_note, '')
  )
  on conflict (invoice_id) do update
    set reminder_state = excluded.reminder_state,
        next_follow_up_at = excluded.next_follow_up_at,
        internal_note = excluded.internal_note;

  return p_invoice_id;
end;
$$;

create or replace function public.record_invoice_communication(
  p_invoice_id uuid,
  p_created_by uuid,
  p_event_type text,
  p_channel text,
  p_summary text,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_event_id uuid;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
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

  if v_status = 'draft' then
    raise exception 'Issue the invoice before recording payment communication.';
  end if;

  if p_event_type not in ('payment_reminder_sent','client_reply','payment_update','note') then
    raise exception 'Unsupported communication type.';
  end if;

  if p_channel not in ('email','message','call','other') then
    raise exception 'Unsupported communication channel.';
  end if;

  if char_length(trim(coalesce(p_summary, ''))) < 1 or char_length(trim(coalesce(p_summary, ''))) > 5000 then
    raise exception 'Communication summary must be between 1 and 5000 characters.';
  end if;

  if p_event_type = 'payment_reminder_sent' and v_status <> 'issued' then
    raise exception 'Payment reminders can only be recorded for issued invoices.';
  end if;

  insert into public.invoice_communication_events (
    invoice_id,
    created_by,
    event_type,
    channel,
    summary,
    occurred_at,
    metadata
  ) values (
    p_invoice_id,
    p_created_by,
    p_event_type,
    p_channel,
    trim(p_summary),
    v_occurred_at,
    jsonb_build_object('invoiceStatus', v_status)
  )
  returning id into v_event_id;

  if p_event_type = 'payment_reminder_sent' then
    insert into public.invoice_follow_up_states (
      invoice_id,
      created_by,
      reminder_state,
      next_follow_up_at,
      internal_note,
      last_reminder_sent_at
    ) values (
      p_invoice_id,
      p_created_by,
      'sent',
      null,
      '',
      v_occurred_at
    )
    on conflict (invoice_id) do update
      set reminder_state = 'sent',
          next_follow_up_at = null,
          last_reminder_sent_at = v_occurred_at;
  end if;

  return v_event_id;
end;
$$;

create or replace function public.resolve_invoice_follow_up_on_close()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('paid','void') then
    update public.invoice_follow_up_states
       set reminder_state = 'resolved',
           next_follow_up_at = null
     where invoice_id = new.id;
  end if;

  return new;
end;
$$;

create trigger resolve_invoice_follow_up_after_close
after update of status on public.invoices
for each row
execute function public.resolve_invoice_follow_up_on_close();

alter table public.invoice_follow_up_states enable row level security;
alter table public.invoice_communication_events enable row level security;

revoke all on table public.invoice_follow_up_states from public, anon, authenticated;
revoke all on table public.invoice_communication_events from public, anon, authenticated;
revoke all on function public.save_invoice_follow_up(uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.record_invoice_communication(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;

grant select, insert, update on table public.invoice_follow_up_states to service_role;
grant select, insert on table public.invoice_communication_events to service_role;
grant execute on function public.save_invoice_follow_up(uuid, uuid, timestamptz, text) to service_role;
grant execute on function public.record_invoice_communication(uuid, uuid, text, text, text, timestamptz) to service_role;

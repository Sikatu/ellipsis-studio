-- S11.2: invoice email provider delivery observability.
-- Store only verified invoice-related provider events; do not persist webhook secrets or raw payloads.

create table public.invoice_email_provider_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.invoice_email_deliveries(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null check (
    char_length(provider) between 1 and 80
  ),
  provider_message_id text not null check (
    char_length(provider_message_id) between 1 and 256
  ),
  svix_id text not null unique check (
    char_length(svix_id) between 1 and 256
  ),
  event_type text not null check (
    event_type in (
      'email.sent',
      'email.delivered',
      'email.delivery_delayed',
      'email.bounced',
      'email.failed'
    )
  ),
  event_created_at timestamptz not null,
  detail jsonb not null default '{}'::jsonb check (
    jsonb_typeof(detail) = 'object'
    and not (detail ? 'token')
    and not (detail ? 'secureToken')
    and not (detail ? 'secureUrl')
    and not (detail ? 'authorization')
    and not (detail ? 'signature')
  ),
  received_at timestamptz not null default now()
);

create index invoice_email_provider_events_delivery_time_idx
  on public.invoice_email_provider_events (
    delivery_id,
    event_created_at desc
  );

create index invoice_email_provider_events_invoice_time_idx
  on public.invoice_email_provider_events (
    invoice_id,
    event_created_at desc
  );

create index invoice_email_provider_events_message_time_idx
  on public.invoice_email_provider_events (
    provider,
    provider_message_id,
    event_created_at desc
  );

create or replace function public.prepare_invoice_email_provider_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_provider text;
  v_provider_message_id text;
begin
  select
    d.invoice_id,
    d.provider,
    d.provider_message_id
  into
    v_invoice_id,
    v_provider,
    v_provider_message_id
  from public.invoice_email_deliveries as d
  where d.id = new.delivery_id;

  if not found then
    raise exception 'Invoice email delivery not found.';
  end if;

  if new.invoice_id <> v_invoice_id then
    raise exception 'Invoice email provider event invoice mismatch.';
  end if;

  if new.provider <> v_provider then
    raise exception 'Invoice email provider event provider mismatch.';
  end if;

  if v_provider_message_id is null
     or new.provider_message_id <> v_provider_message_id
  then
    raise exception 'Invoice email provider message mismatch.';
  end if;

  return new;
end;
$$;

create trigger prepare_invoice_email_provider_event_before_insert
before insert on public.invoice_email_provider_events
for each row
execute function public.prepare_invoice_email_provider_event();

alter table public.invoice_email_provider_events enable row level security;

revoke all on table public.invoice_email_provider_events
  from public, anon, authenticated, service_role;

grant select, insert on table public.invoice_email_provider_events
  to service_role;

revoke all on function public.prepare_invoice_email_provider_event()
  from public, anon, authenticated;
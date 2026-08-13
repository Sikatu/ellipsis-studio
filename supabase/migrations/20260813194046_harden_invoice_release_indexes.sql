create index if not exists invoice_delivery_access_rotated_by_idx
  on public.invoice_delivery_access (rotated_by);

create index if not exists invoice_delivery_access_revoked_by_idx
  on public.invoice_delivery_access (revoked_by);

create index if not exists invoice_delivery_events_actor_admin_id_idx
  on public.invoice_delivery_events (actor_admin_id);

create index if not exists invoice_email_automations_created_by_idx
  on public.invoice_email_automations (created_by);

create index if not exists invoice_email_deliveries_access_id_idx
  on public.invoice_email_deliveries (access_id);

create index if not exists invoice_items_created_by_idx
  on public.invoice_items (created_by);
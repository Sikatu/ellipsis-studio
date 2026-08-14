revoke all on table public.invoice_follow_up_states from service_role;
revoke all on table public.invoice_communication_events from service_role;

grant select, insert, update on table public.invoice_follow_up_states to service_role;
grant select, insert on table public.invoice_communication_events to service_role;

revoke all on function public.save_invoice_follow_up(uuid, uuid, timestamptz, text) from service_role;
revoke all on function public.record_invoice_communication(uuid, uuid, text, text, text, timestamptz) from service_role;

grant execute on function public.save_invoice_follow_up(uuid, uuid, timestamptz, text) to service_role;
grant execute on function public.record_invoice_communication(uuid, uuid, text, text, text, timestamptz) to service_role;

revoke all on function public.prepare_invoice_follow_up_state() from public, anon, authenticated;
revoke all on function public.resolve_invoice_follow_up_on_close() from public, anon, authenticated;

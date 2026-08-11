-- Phase 5I: remove default PUBLIC EXECUTE exposure from internal trigger functions.
revoke execute on function public.protect_approved_strategy_versions() from public, anon, authenticated;
revoke execute on function public.protect_client_delivery_access() from public, anon, authenticated;
revoke execute on function public.protect_client_delivery_event() from public, anon, authenticated;
revoke execute on function public.protect_client_delivery_handoff() from public, anon, authenticated;
revoke execute on function public.protect_client_delivery_handoff_event() from public, anon, authenticated;
revoke execute on function public.protect_client_delivery_receipt() from public, anon, authenticated;
revoke execute on function public.protect_strategy_report_file() from public, anon, authenticated;
revoke execute on function public.protect_strategy_reports() from public, anon, authenticated;
revoke execute on function public.require_report_file_before_issue() from public, anon, authenticated;
revoke execute on function public.validate_client_delivery_event_insert() from public, anon, authenticated;
revoke execute on function public.validate_client_delivery_receipt_insert() from public, anon, authenticated;
revoke execute on function public.validate_strategy_report_file_insert() from public, anon, authenticated;

grant execute on function public.protect_approved_strategy_versions() to service_role;
grant execute on function public.protect_client_delivery_access() to service_role;
grant execute on function public.protect_client_delivery_event() to service_role;
grant execute on function public.protect_client_delivery_handoff() to service_role;
grant execute on function public.protect_client_delivery_handoff_event() to service_role;
grant execute on function public.protect_client_delivery_receipt() to service_role;
grant execute on function public.protect_strategy_report_file() to service_role;
grant execute on function public.protect_strategy_reports() to service_role;
grant execute on function public.require_report_file_before_issue() to service_role;
grant execute on function public.validate_client_delivery_event_insert() to service_role;
grant execute on function public.validate_client_delivery_receipt_insert() to service_role;
grant execute on function public.validate_strategy_report_file_insert() to service_role;
-- Phase 5I: least-privilege hardening for exposed database roles.
-- Runtime application roles do not need DDL-adjacent table privileges.
revoke truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Trigger functions are internal database mechanics, not callable application APIs.
revoke execute on function public.protect_approved_strategy_versions() from anon, authenticated;
revoke execute on function public.protect_client_delivery_access() from anon, authenticated;
revoke execute on function public.protect_client_delivery_event() from anon, authenticated;
revoke execute on function public.protect_client_delivery_handoff() from anon, authenticated;
revoke execute on function public.protect_client_delivery_handoff_event() from anon, authenticated;
revoke execute on function public.protect_client_delivery_receipt() from anon, authenticated;
revoke execute on function public.protect_strategy_report_file() from anon, authenticated;
revoke execute on function public.protect_strategy_reports() from anon, authenticated;
revoke execute on function public.require_report_file_before_issue() from anon, authenticated;
revoke execute on function public.validate_client_delivery_event_insert() from anon, authenticated;
revoke execute on function public.validate_client_delivery_receipt_insert() from anon, authenticated;
revoke execute on function public.validate_strategy_report_file_insert() from anon, authenticated;
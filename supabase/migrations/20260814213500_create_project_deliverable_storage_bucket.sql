-- S12.4B.1
-- ELLIPSIS Studio project deliverable private storage bucket.
--
-- Operational project deliverables stay isolated from Brand Discovery
-- deliverables and invoice storage.
--
-- Object access will be issued through controlled server APIs.
-- The bucket itself must never be public.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'studio-project-deliverables',
  'studio-project-deliverables',
  false,
  52428800,
  null
)
on conflict (id)
do update
set
  name =
    excluded.name,
  public =
    false,
  file_size_limit =
    excluded.file_size_limit,
  allowed_mime_types =
    excluded.allowed_mime_types;

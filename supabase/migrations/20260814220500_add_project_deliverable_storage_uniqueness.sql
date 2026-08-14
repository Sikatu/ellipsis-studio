-- S12.4B.2A hardening
-- Prevent a private storage object from being registered as multiple
-- project deliverable records.

create unique index
  studio_project_deliverables_storage_object_unique_idx
on public.studio_project_deliverables (
  storage_bucket,
  storage_path
)
where source_kind = 'file'
  and storage_bucket is not null
  and storage_path is not null;

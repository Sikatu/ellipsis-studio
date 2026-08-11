create index client_delivery_access_created_by_idx
  on public.client_delivery_access (created_by);

create index client_delivery_access_rotated_by_idx
  on public.client_delivery_access (rotated_by)
  where rotated_by is not null;

create index client_delivery_access_revoked_by_idx
  on public.client_delivery_access (revoked_by)
  where revoked_by is not null;
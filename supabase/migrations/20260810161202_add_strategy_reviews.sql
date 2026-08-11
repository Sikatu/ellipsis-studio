create table if not exists public.strategy_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.discovery_projects(id) on delete cascade,
  deliverable_id text not null,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'needs_revision',
        'rejected'
      )
    ),
  notes text not null default '',
  statement_snapshot text not null default '',
  source_fingerprint text not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint strategy_reviews_project_deliverable_key
    unique (project_id, deliverable_id)
);

create index if not exists
  strategy_reviews_project_id_idx
on public.strategy_reviews(project_id);

alter table public.strategy_reviews
enable row level security;

drop policy if exists
  strategy_reviews_select_owned
on public.strategy_reviews;

create policy strategy_reviews_select_owned
on public.strategy_reviews
for select
to authenticated
using (
  reviewed_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_reviews.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_reviews_insert_owned
on public.strategy_reviews;

create policy strategy_reviews_insert_owned
on public.strategy_reviews
for insert
to authenticated
with check (
  reviewed_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_reviews.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_reviews_update_owned
on public.strategy_reviews;

create policy strategy_reviews_update_owned
on public.strategy_reviews
for update
to authenticated
using (
  reviewed_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_reviews.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
)
with check (
  reviewed_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_reviews.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_reviews_delete_owned
on public.strategy_reviews;

create policy strategy_reviews_delete_owned
on public.strategy_reviews
for delete
to authenticated
using (
  reviewed_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_reviews.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

grant
  select,
  insert,
  update,
  delete
on public.strategy_reviews
to authenticated;

revoke all
on public.strategy_reviews
from anon;
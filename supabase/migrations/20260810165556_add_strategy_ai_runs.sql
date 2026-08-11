create table if not exists public.strategy_ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.discovery_projects(id)
    on delete cascade,

  requested_by uuid not null,

  source_fingerprint text not null,

  model text not null,

  prompt_version text not null
    default 'brand_strategist_v1',

  status text not null
    check (
      status in (
        'completed',
        'failed'
      )
    ),

  output jsonb,

  error_message text,

  openai_response_id text,

  input_tokens integer,
  output_tokens integer,
  total_tokens integer,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index if not exists
  strategy_ai_runs_project_created_idx
on public.strategy_ai_runs(
  project_id,
  created_at desc
);

alter table public.strategy_ai_runs
enable row level security;

drop policy if exists
  strategy_ai_runs_select_owned
on public.strategy_ai_runs;

create policy strategy_ai_runs_select_owned
on public.strategy_ai_runs
for select
to authenticated
using (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_ai_runs.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_ai_runs_insert_owned
on public.strategy_ai_runs;

create policy strategy_ai_runs_insert_owned
on public.strategy_ai_runs
for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_ai_runs.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_ai_runs_update_owned
on public.strategy_ai_runs;

create policy strategy_ai_runs_update_owned
on public.strategy_ai_runs
for update
to authenticated
using (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_ai_runs.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
)
with check (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_ai_runs.project_id
      and dp.created_by = (select auth.uid())
  )
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

drop policy if exists
  strategy_ai_runs_delete_owned
on public.strategy_ai_runs;

create policy strategy_ai_runs_delete_owned
on public.strategy_ai_runs
for delete
to authenticated
using (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.discovery_projects dp
    where dp.id = strategy_ai_runs.project_id
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
on public.strategy_ai_runs
to authenticated;

revoke all
on public.strategy_ai_runs
from anon;
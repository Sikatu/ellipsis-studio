create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null
    references public.clients(id)
    on delete restrict,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,
  project_type text not null default 'general',
  description text not null default '',

  status text not null default 'planned',
  priority text not null default 'normal',

  start_date date,
  target_date date,
  completed_at timestamptz,

  progress smallint not null default 0,

  budget_cents bigint,
  currency text not null default 'USD',

  internal_notes text not null default '',
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint studio_projects_title_check
    check (
      char_length(btrim(title)) >= 1
      and char_length(title) <= 240
    ),

  constraint studio_projects_project_type_check
    check (
      char_length(btrim(project_type)) >= 1
      and char_length(project_type) <= 80
    ),

  constraint studio_projects_description_check
    check (char_length(description) <= 20000),

  constraint studio_projects_internal_notes_check
    check (char_length(internal_notes) <= 20000),

  constraint studio_projects_status_check
    check (
      status = any (
        array[
          'planned'::text,
          'active'::text,
          'on_hold'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    ),

  constraint studio_projects_priority_check
    check (
      priority = any (
        array[
          'low'::text,
          'normal'::text,
          'high'::text,
          'urgent'::text
        ]
      )
    ),

  constraint studio_projects_progress_check
    check (
      progress >= 0
      and progress <= 100
    ),

  constraint studio_projects_budget_cents_check
    check (
      budget_cents is null
      or budget_cents >= 0
    ),

  constraint studio_projects_currency_check
    check (
      currency = any (
        array[
          'USD'::text,
          'PHP'::text,
          'AUD'::text,
          'CAD'::text,
          'GBP'::text,
          'EUR'::text
        ]
      )
    ),

  constraint studio_projects_dates_check
    check (
      start_date is null
      or target_date is null
      or target_date >= start_date
    )
);

create index studio_projects_client_id_created_at_idx
  on public.studio_projects (
    client_id,
    created_at desc
  );

create index studio_projects_created_by_updated_at_idx
  on public.studio_projects (
    created_by,
    updated_at desc
  );

create index studio_projects_active_schedule_idx
  on public.studio_projects (
    created_by,
    status,
    target_date
  )
  where archived_at is null;

create or replace function private.validate_studio_project_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_owner uuid;
begin
  select c.created_by
    into client_owner
  from public.clients c
  where c.id = new.client_id;

  if client_owner is null
     or client_owner <> new.created_by then
    raise exception
      'Studio project owner must match client owner.';
  end if;

  if tg_op = 'UPDATE'
     and new.created_by is distinct from old.created_by then
    raise exception
      'Studio project owner is immutable.';
  end if;

  return new;
end;
$$;

create trigger studio_projects_validate_write
before insert or update on public.studio_projects
for each row
execute function private.validate_studio_project_write();

create trigger studio_projects_set_updated_at
before update on public.studio_projects
for each row
execute function private.set_updated_at();

alter table public.studio_projects
  enable row level security;

create policy studio_projects_select_owned
on public.studio_projects
for select
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

create policy studio_projects_insert_owned
on public.studio_projects
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

create policy studio_projects_update_owned
on public.studio_projects
for update
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

create policy studio_projects_delete_owned
on public.studio_projects
for delete
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  )
);

revoke all on table public.studio_projects from anon;

grant select, insert, update, delete
  on table public.studio_projects
  to authenticated;

grant all
  on table public.studio_projects
  to service_role;
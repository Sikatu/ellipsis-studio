create table public.studio_project_owner_details (
  project_id uuid primary key
    references public.studio_projects(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  budget_cents bigint,
  currency text not null default 'USD',
  internal_notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint studio_project_owner_details_budget_cents_check
    check (
      budget_cents is null
      or budget_cents >= 0
    ),

  constraint studio_project_owner_details_currency_check
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

  constraint studio_project_owner_details_internal_notes_check
    check (
      char_length(internal_notes) <= 20000
    )
);

create index studio_project_owner_details_created_by_idx
  on public.studio_project_owner_details (
    created_by,
    updated_at desc
  );

create or replace function private.validate_studio_project_owner_details_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  select p.created_by
    into project_owner
  from public.studio_projects p
  where p.id = new.project_id;

  if project_owner is null
     or project_owner <> new.created_by then
    raise exception
      'Studio project owner details must match project owner.';
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception
        'Studio project owner details project is immutable.';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception
        'Studio project owner details owner is immutable.';
    end if;
  end if;

  return new;
end;
$$;

create trigger studio_project_owner_details_validate_write
before insert or update
on public.studio_project_owner_details
for each row
execute function private.validate_studio_project_owner_details_write();

create trigger studio_project_owner_details_set_updated_at
before update
on public.studio_project_owner_details
for each row
execute function private.set_updated_at();

insert into public.studio_project_owner_details (
  project_id,
  created_by,
  budget_cents,
  currency,
  internal_notes,
  created_at,
  updated_at
)
select
  id,
  created_by,
  budget_cents,
  currency,
  internal_notes,
  created_at,
  updated_at
from public.studio_projects
on conflict (project_id) do nothing;

alter table public.studio_projects
  drop column budget_cents,
  drop column currency,
  drop column internal_notes;

alter table public.studio_project_owner_details
  enable row level security;

create policy studio_project_owner_details_select_owned
on public.studio_project_owner_details
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

revoke all
  on table public.studio_project_owner_details
  from anon, authenticated;

grant select
  on table public.studio_project_owner_details
  to authenticated;

grant all
  on table public.studio_project_owner_details
  to service_role;

revoke execute
  on function private.validate_studio_project_owner_details_write()
  from public, anon, authenticated;

grant execute
  on function private.validate_studio_project_owner_details_write()
  to service_role;
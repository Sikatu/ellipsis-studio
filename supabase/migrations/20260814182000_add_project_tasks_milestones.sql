-- S12.3
-- ELLIPSIS Studio Tasks and Milestones foundation.
--
-- This migration creates the operational work layer beneath studio_projects.
--
-- Ownership:
--   created_by remains the canonical project Owner auth identity.
--
-- Assignment:
--   tasks may optionally reference workspace_members.
--   This prepares the schema for future VA assignment without granting
--   VA task access during S12.3.
--
-- Browser mutations remain disabled. Controlled server APIs will use
-- the service role for writes.

-- ============================================================
-- PROJECT MILESTONES
-- ============================================================

create table public.studio_project_milestones (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.studio_projects(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,

  description text not null
    default '',

  due_date date,

  completed_at timestamptz,

  sort_order integer not null
    default 0,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint studio_project_milestones_title_check
    check (
      char_length(
        btrim(title)
      ) between 1 and 240
    ),

  constraint studio_project_milestones_description_check
    check (
      char_length(description)
      <= 10000
    ),

  constraint studio_project_milestones_sort_order_check
    check (
      sort_order >= 0
    )
);


create index
  studio_project_milestones_project_order_idx
on public.studio_project_milestones (
  project_id,
  sort_order,
  created_at
);


create index
  studio_project_milestones_open_due_idx
on public.studio_project_milestones (
  project_id,
  due_date
)
where completed_at is null;


-- ============================================================
-- PROJECT TASKS
-- ============================================================

create table public.studio_project_tasks (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.studio_projects(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  milestone_id uuid
    references public.studio_project_milestones(id)
    on delete set null,

  assignee_member_id uuid
    references public.workspace_members(id)
    on delete set null,

  title text not null,

  description text not null
    default '',

  status text not null
    default 'assigned',

  priority text not null
    default 'normal',

  due_date date,

  sort_order integer not null
    default 0,

  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint studio_project_tasks_title_check
    check (
      char_length(
        btrim(title)
      ) between 1 and 240
    ),

  constraint studio_project_tasks_description_check
    check (
      char_length(description)
      <= 20000
    ),

  constraint studio_project_tasks_status_check
    check (
      status in (
        'assigned',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  constraint studio_project_tasks_priority_check
    check (
      priority in (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  constraint studio_project_tasks_sort_order_check
    check (
      sort_order >= 0
    ),

  constraint studio_project_tasks_completion_check
    check (
      (
        status = 'completed'
        and completed_at is not null
      )
      or
      (
        status <> 'completed'
        and completed_at is null
      )
    )
);


create index
  studio_project_tasks_project_order_idx
on public.studio_project_tasks (
  project_id,
  sort_order,
  created_at
);


create index
  studio_project_tasks_project_status_idx
on public.studio_project_tasks (
  project_id,
  status,
  sort_order
);


create index
  studio_project_tasks_open_due_idx
on public.studio_project_tasks (
  project_id,
  due_date
)
where status not in (
  'completed',
  'cancelled'
);


create index
  studio_project_tasks_assignee_status_idx
on public.studio_project_tasks (
  assignee_member_id,
  status,
  due_date
)
where assignee_member_id is not null;


create index
  studio_project_tasks_milestone_idx
on public.studio_project_tasks (
  milestone_id,
  sort_order
)
where milestone_id is not null;


-- ============================================================
-- MILESTONE WRITE VALIDATION
-- ============================================================

create or replace function
  private.validate_studio_project_milestone_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  select
    sp.created_by
  into
    project_owner
  from public.studio_projects sp
  where sp.id =
    new.project_id;

  if project_owner is null then
    raise exception
      'Milestone project does not exist.';
  end if;

  if project_owner <>
     new.created_by then
    raise exception
      'Milestone owner must match project owner.';
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from
       old.project_id then
      raise exception
        'Milestone project is immutable.';
    end if;

    if new.created_by is distinct from
       old.created_by then
      raise exception
        'Milestone owner is immutable.';
    end if;
  end if;

  return new;
end;
$$;


create trigger
  studio_project_milestones_validate_write
before insert or update
on public.studio_project_milestones
for each row
execute function
  private.validate_studio_project_milestone_write();


create trigger
  studio_project_milestones_set_updated_at
before update
on public.studio_project_milestones
for each row
execute function
  private.set_updated_at();


-- ============================================================
-- TASK WRITE VALIDATION
-- ============================================================

create or replace function
  private.validate_studio_project_task_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_owner uuid;
  milestone_project_id uuid;
  assignee_status text;
  should_validate_assignee boolean := false;
begin
  select
    sp.created_by
  into
    project_owner
  from public.studio_projects sp
  where sp.id =
    new.project_id;

  if project_owner is null then
    raise exception
      'Task project does not exist.';
  end if;

  if project_owner <>
     new.created_by then
    raise exception
      'Task owner must match project owner.';
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from
       old.project_id then
      raise exception
        'Task project is immutable.';
    end if;

    if new.created_by is distinct from
       old.created_by then
      raise exception
        'Task owner is immutable.';
    end if;
  end if;

  if new.milestone_id is not null then
    select
      m.project_id
    into
      milestone_project_id
    from public.studio_project_milestones m
    where m.id =
      new.milestone_id;

    if milestone_project_id is null then
      raise exception
        'Task milestone does not exist.';
    end if;

    if milestone_project_id <>
       new.project_id then
      raise exception
        'Task milestone must belong to the same project.';
    end if;
  end if;

  if new.assignee_member_id is not null then
    if tg_op = 'INSERT' then
      should_validate_assignee =
        true;
    elsif new.assignee_member_id is distinct from
          old.assignee_member_id then
      should_validate_assignee =
        true;
    end if;
  end if;

  if should_validate_assignee then
    select
      wm.status
    into
      assignee_status
    from public.workspace_members wm
    where wm.id =
      new.assignee_member_id;

    if assignee_status is null then
      raise exception
        'Task assignee does not exist.';
    end if;

    if assignee_status <>
       'active' then
      raise exception
        'Task assignee must be an active workspace member.';
    end if;
  end if;

  if new.status = 'completed' then
    if new.completed_at is null then
      new.completed_at =
        now();
    end if;
  else
    new.completed_at =
      null;
  end if;

  return new;
end;
$$;


create trigger
  studio_project_tasks_validate_write
before insert or update
on public.studio_project_tasks
for each row
execute function
  private.validate_studio_project_task_write();


create trigger
  studio_project_tasks_set_updated_at
before update
on public.studio_project_tasks
for each row
execute function
  private.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
  public.studio_project_milestones
enable row level security;


alter table
  public.studio_project_tasks
enable row level security;


-- S12.3 remains Owner-controlled.
--
-- Future VA policies will be introduced with the Assignment Engine rather
-- than granting premature access here.

create policy
  studio_project_milestones_select_owner
on public.studio_project_milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.studio_projects sp
    join public.admin_profiles ap
      on ap.user_id =
         (
           select auth.uid()
         )
    where sp.id =
      studio_project_milestones.project_id
      and sp.created_by =
        (
          select auth.uid()
        )
      and ap.role =
        'owner'
  )
);


create policy
  studio_project_tasks_select_owner
on public.studio_project_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.studio_projects sp
    join public.admin_profiles ap
      on ap.user_id =
         (
           select auth.uid()
         )
    where sp.id =
      studio_project_tasks.project_id
      and sp.created_by =
        (
          select auth.uid()
        )
      and ap.role =
        'owner'
  )
);


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
  on table public.studio_project_milestones
  from public, anon, authenticated;


revoke all
  on table public.studio_project_tasks
  from public, anon, authenticated;


grant select
  on table public.studio_project_milestones
  to authenticated;


grant select
  on table public.studio_project_tasks
  to authenticated;


grant all
  on table public.studio_project_milestones
  to service_role;


grant all
  on table public.studio_project_tasks
  to service_role;


-- Validation functions are internal implementation details.

revoke execute
  on function private.validate_studio_project_milestone_write()
  from public, anon, authenticated;


revoke execute
  on function private.validate_studio_project_task_write()
  from public, anon, authenticated;


grant execute
  on function private.validate_studio_project_milestone_write()
  to service_role;


grant execute
  on function private.validate_studio_project_task_write()
  to service_role;
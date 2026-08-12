alter table public.strategy_ai_runs
  add column if not exists provider text;

update public.strategy_ai_runs
set provider = 'openai'
where provider is null;

alter table public.strategy_ai_runs
  alter column provider
  set default 'openai';

alter table public.strategy_ai_runs
  alter column provider
  set not null;

alter table public.strategy_ai_runs
  add column if not exists provider_request_id text;

update public.strategy_ai_runs
set provider_request_id = openai_response_id
where provider_request_id is null
  and openai_response_id is not null;

alter table public.strategy_ai_runs
  add column if not exists provider_attempts jsonb
  not null
  default '[]'::jsonb;

alter table public.strategy_ai_runs
  add column if not exists privacy_mode text
  not null
  default 'strict';

alter table public.strategy_ai_runs
  add column if not exists latency_ms integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'strategy_ai_runs_privacy_mode_check'
      and conrelid =
        'public.strategy_ai_runs'::regclass
  ) then
    alter table public.strategy_ai_runs
      add constraint
        strategy_ai_runs_privacy_mode_check
      check (
        privacy_mode in (
          'strict',
          'maximum_availability'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'strategy_ai_runs_latency_ms_check'
      and conrelid =
        'public.strategy_ai_runs'::regclass
  ) then
    alter table public.strategy_ai_runs
      add constraint
        strategy_ai_runs_latency_ms_check
      check (
        latency_ms is null
        or latency_ms >= 0
      );
  end if;
end
$$;

create index if not exists
  strategy_ai_runs_project_provider_created_idx
on public.strategy_ai_runs(
  project_id,
  provider,
  created_at desc
);

comment on column
  public.strategy_ai_runs.openai_response_id
is
  'Legacy OpenAI-specific request identifier. New provider-neutral integrations should use provider_request_id.';

comment on column
  public.strategy_ai_runs.provider_attempts
is
  'Ordered provider failover attempts for this strategist run. Must never contain API keys or raw client prompts.';

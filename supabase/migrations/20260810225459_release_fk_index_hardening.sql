create index if not exists strategy_reports_source_strategy_version_idx
  on public.strategy_reports (source_strategy_version_id);

create index if not exists strategy_versions_source_ai_run_idx
  on public.strategy_versions (source_ai_run_id)
  where source_ai_run_id is not null;
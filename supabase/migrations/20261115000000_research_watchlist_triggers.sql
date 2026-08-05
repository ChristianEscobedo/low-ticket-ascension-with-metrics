-- Metric triggers on watchlists (roadmap Phase 2)
--
-- A watchlist can now carry a THRESHOLD ("when 30-day clicks drop below
-- 100, run the sweep") in addition to its weekly cadence. The digest
-- (the cron pass on the jobs route) evaluates active triggers against the
-- click/attribution rollups and queues a run when one trips.
--
--   metric_trigger     — { metric, op, value, cooldownHours? } — NULL = a
--                        plain weekly watch (every pre-existing row).
--   last_triggered_at  — the cooldown clock: a tripped trigger stamps it,
--                        and the same trigger can't fire again inside its
--                        cooldown window (default 24h). Firing a run costs
--                        money; the cooldown is the spending guard.
--
-- `metric_trigger` rather than `trigger`: TRIGGER is a SQL keyword, and a
-- column that needs quoting everywhere is a bug farm.
--
-- No anon RLS policies: service-role only, like every research table.

alter table public.mothermode_research_watchlists
  add column if not exists metric_trigger jsonb,
  add column if not exists last_triggered_at timestamptz;

create index if not exists mothermode_research_watchlists_trigger_idx
  on public.mothermode_research_watchlists (status, last_triggered_at)
  where metric_trigger is not null;

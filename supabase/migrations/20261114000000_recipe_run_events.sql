-- Recipe run events (the trust spine, part 1).
--
-- An append-only log of everything a recipe run DID, in order: step
-- started, artifact landed, gated, handoff initiated/completed/failed,
-- canceled, budget-stopped, done, failed. This is the single table behind
-- the run-row timeline, the future run detail page, expert scorecards,
-- and eval diffs.

create table if not exists public.mothermode_recipe_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  kind text not null,
  step_index integer,
  text text not null default '',
  created_at timestamptz not null default now()
);

-- "Every event of one run, in order" (the timeline read).
create index if not exists mothermode_recipe_run_events_run_idx
  on public.mothermode_recipe_run_events (run_id, created_at, id);

alter table public.mothermode_recipe_run_events enable row level security;

-- Admin-only tool: no anon/authenticated policies; the service role bypasses
-- RLS exactly like the other research tables.
comment on table public.mothermode_recipe_run_events is
  'Append-only recipe run event log (trust spine: what a run did, in order). Service role only.';

-- The background job lane (roadmap task 4.1)
--
-- Long agent work (recipe runs today, watchlist digests tomorrow) queues as
-- a job row instead of holding an HTTP request open. A tick worker (the
-- /api/admin/mothermode-jobs route, driven by the mission UI's poll or a
-- cron) claims queued jobs one at a time and runs them, stamping progress
-- as it goes.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  -- What to run: 'recipe-run' today (ref_id = the recipe run id).
  kind text not null default 'recipe-run',
  ref_id uuid not null,
  status text not null default 'queued',
  -- {step, total, note} — the human-readable "where is it" line.
  progress jsonb not null default '{}'::jsonb,
  error text not null default '',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists mothermode_agent_jobs_status_idx
  on public.mothermode_agent_jobs (status, created_at asc);

alter table public.mothermode_agent_jobs enable row level security;

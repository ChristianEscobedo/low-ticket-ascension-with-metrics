-- Research Lab agent call telemetry (roadmap task 0.3)
--
-- One row per tool call the research agent runs: tool, summaries, status,
-- latency, cache hit, and the ESTIMATED cost in cents. This is the raw
-- material for the spend meter, per-session/day budgets (task 2.4), and the
-- provider health dashboard.
--
-- No anon RLS policies: like the other research tables, all access is via
-- the service-role client in src/lib/mothermode/research/store.ts.

create table if not exists public.mothermode_research_call_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mothermode_research_sessions (id) on delete cascade,
  tool text not null,
  input_summary text not null default '',
  status text not null default 'ok',
  result_summary text not null default '',
  ms integer not null default 0,
  cached boolean not null default false,
  est_cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_call_log_session_idx
  on public.mothermode_research_call_log (session_id, created_at desc);

create index if not exists mothermode_research_call_log_created_idx
  on public.mothermode_research_call_log (created_at desc);

alter table public.mothermode_research_call_log enable row level security;

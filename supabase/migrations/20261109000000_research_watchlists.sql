-- Watchlists (roadmap task 4.2)
--
-- A watchlist says: run this recipe in this session on this cadence. The
-- digest action (on the jobs route, driven by cron) finds DUE watchlists,
-- queues a background run for each, and stamps last_run_at. The Niche
-- Watch recipe is the default play: a weekly sweep that lands as a
-- research-brief artifact in the watched session.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_research_watchlists (
  id uuid primary key default gen_random_uuid(),
  -- The session the digest lands in (its artifacts + phrase bank compound).
  session_id uuid not null references public.mothermode_research_sessions (id) on delete cascade,
  recipe_slug text not null default 'niche-watch',
  cadence text not null default 'weekly',
  last_run_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_watchlists_due_idx
  on public.mothermode_research_watchlists (status, cadence, last_run_at);

alter table public.mothermode_research_watchlists enable row level security;

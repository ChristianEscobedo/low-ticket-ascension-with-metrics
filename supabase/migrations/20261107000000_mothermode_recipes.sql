-- Agent Recipes (roadmap task 3.1)
--
-- Declarative multi-expert workflows: a recipe is a step list
-- ({expert, instruction, inputFrom, outputArtifact, gate}) run by ONE
-- sequential interpreter with human gates and a per-run budget. Steps pass
-- typed artifact envelopes between experts (the 1.4 lineage columns stamp
-- parent ids, so "how was this made" is a real tree).
--
-- (Name note: prompt-bank recipes already exist — these are AGENT recipes,
-- a different table and a different UI.)
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null default '',
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  -- Per-run budget in estimated cents; a run that spends past it stops.
  budget_est_cents integer not null default 150,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mothermode_recipe_runs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.mothermode_recipes (id) on delete cascade,
  -- The research session the run works in (its artifacts land here).
  session_id uuid references public.mothermode_research_sessions (id) on delete set null,
  status text not null default 'running',
  current_step integer not null default 0,
  -- Per-step state: [{status, artifactId, note, at}] — the run's own trace.
  steps_state jsonb not null default '[]'::jsonb,
  est_cost_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mothermode_recipe_runs_recipe_idx
  on public.mothermode_recipe_runs (recipe_id, created_at desc);

create index if not exists mothermode_recipe_runs_session_idx
  on public.mothermode_recipe_runs (session_id, created_at desc);

alter table public.mothermode_recipes enable row level security;
alter table public.mothermode_recipe_runs enable row level security;

-- Declarative skills (roadmap Phase 3, kickoff)
--
-- A skill is a ROW, never eval'd code: a validated HTTP request template
-- plus dotted-path extraction over the JSON response. The agent (and the
-- test bench) run it through the same audited runner: domain allowlist,
-- scoped secrets, per-day rate limit, and a circuit breaker that pauses
-- the skill after repeated failures.
--
--   input_keys        — the declared {{input.*}} template vars.
--   allowed_hosts     — the urlTemplate's host must be one of these
--                       (bare hostnames; enforced at validate time AND at
--                       run time).
--   executor          — { kind:'http', method, urlTemplate, headers,
--                         bodyTemplate?, extract:[{name,path}] }.
--                       Header VALUES may reference {{secret:name}}; only
--                       SKILL_SECRET_<NAME> env vars ever resolve — a
--                       skill can never name an arbitrary secret, and
--                       secrets are refused in URLs and bodies.
--   consecutive_failures + the breaker (5) — a failing skill pauses
--   itself instead of burning money against a dead endpoint.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_research_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null default '',
  description text not null default '',
  input_keys text[] not null default '{}',
  allowed_hosts text[] not null default '{}',
  executor jsonb not null default '{}',
  cost_est_cents integer not null default 1,
  max_calls_per_day integer not null default 100,
  status text not null default 'draft',
  consecutive_failures integer not null default 0,
  last_called_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mothermode_research_skills_status_idx
  on public.mothermode_research_skills (status, slug);

alter table public.mothermode_research_skills enable row level security;

-- MotherMode Experts (roadmap task 1.1)
--
-- Config-driven agents: a persona prompt, a model preference, a tool policy
-- (allowlist from the shared registry), context pack refs (brand, writing
-- examples, style cards), an artifact contract (what it may create), and
-- handoff manners (what it accepts in / emits out). ONE generalized loop
-- runs them all — the research agent is expert #1 and lives as the code-
-- level DEFAULT_RESEARCH_EXPERT, so the table can be empty and nothing
-- changes.
--
-- No anon RLS policies: admin-only, service-role only, like every
-- mothermode table.

create table if not exists public.mothermode_experts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null default '',
  tagline text not null default '',
  glyph text not null default 'flask',
  -- The persona system prompt. '' = the built-in research persona (expert #1).
  persona text not null default '',
  -- Picker model id. '' = Auto.
  model text not null default '',
  -- Tool allowlist from the shared registry. '{}' = the full lane.
  tools text[] not null default '{}',
  -- Standing context packs (brand bible, writing examples, style cards).
  context_refs jsonb not null default '[]'::jsonb,
  -- Artifact contract: types this expert may create. '{}' = all types.
  artifact_types text[] not null default '{}',
  -- Handoff manners: artifact types accepted in / emitted out (advisory).
  accepts text[] not null default '{}',
  emits text[] not null default '{}',
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mothermode_experts_status_idx
  on public.mothermode_experts (status, sort_order);

alter table public.mothermode_experts enable row level security;

-- Cross-session memory (roadmap task 4.4)
--
-- Distilled learnings: 3-5 one-liners per offer (or house-wide when the
-- session has no offer scope), written by the distiller after a research
-- run and injected into every later session's system prompt as the
-- CROSS-SESSION MEMORY block. The agent starts each session knowing what
-- past research already proved, instead of re-learning it.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_research_learnings (
  id uuid primary key default gen_random_uuid(),
  -- '' = house-wide (the session had no offer scope).
  offer_slug text not null default '',
  body text not null,
  -- The session the learning was distilled from (provenance).
  source_session_id uuid references public.mothermode_research_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_learnings_offer_idx
  on public.mothermode_research_learnings (offer_slug, created_at desc);

alter table public.mothermode_research_learnings enable row level security;

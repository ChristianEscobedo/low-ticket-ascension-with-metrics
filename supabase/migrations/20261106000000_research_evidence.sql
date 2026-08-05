-- Research evidence base (roadmap task 2.1)
--
-- The compounding asset: every pinned quote, phrase, metric, or note,
-- persisted with provenance (source URL, the tool that produced it, the
-- expert/session it came from). The phrase bank, personas, re-verify, and
-- semantic search are all read-models over this table.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.mothermode_research_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mothermode_research_sessions (id) on delete cascade,
  artifact_id uuid references public.mothermode_research_artifacts (id) on delete set null,
  offer_slug text not null default '',
  kind text not null default 'quote',
  body text not null default '',
  source_url text not null default '',
  source_tool text not null default '',
  expert text not null default '',
  created_by text not null default 'agent',
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_evidence_session_idx
  on public.mothermode_research_evidence (session_id, created_at desc);

create index if not exists mothermode_research_evidence_offer_idx
  on public.mothermode_research_evidence (offer_slug, created_at desc);

alter table public.mothermode_research_evidence enable row level security;

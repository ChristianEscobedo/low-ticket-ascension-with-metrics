-- Research artifact envelopes v2 (roadmap task 1.4)
--
-- Lineage + provenance + append-only versions:
--   version     every content-changing upsert bumps it
--   parent_id   the artifact this one was derived from (recipes stamp it)
--   created_by  the expert slug that created it ('research' today), or
--               'owner' for hand edits in the artifact drawer
--   mothermode_research_artifact_versions  append-only snapshots, so "how
--               was this made / what changed" is a real query instead of a
--               lost edit. The live row keeps its stable id — handoffs and
--               lineage links never move.
--
-- No anon RLS policies: service-role only, like every research table.

alter table public.mothermode_research_artifacts
  add column if not exists version integer not null default 1,
  add column if not exists parent_id uuid references public.mothermode_research_artifacts (id) on delete set null,
  add column if not exists created_by text not null default 'agent';

create table if not exists public.mothermode_research_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.mothermode_research_artifacts (id) on delete cascade,
  version integer not null,
  type text not null default 'research-brief',
  title text not null default '',
  markdown text not null default '',
  structured jsonb not null default '{}'::jsonb,
  created_by text not null default 'agent',
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_artifact_versions_artifact_idx
  on public.mothermode_research_artifact_versions (artifact_id, version desc);

alter table public.mothermode_research_artifact_versions enable row level security;

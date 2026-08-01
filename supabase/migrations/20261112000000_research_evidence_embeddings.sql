-- Semantic evidence search (roadmap task 4.7)
--
-- One embedding per evidence row (OpenAI text-embedding-3-small, 1536
-- dims). Written best-effort on pin and backfillable via the route — a
-- dead embedding lane never blocks a pin, and evidence without an
-- embedding simply doesn't rank until backfilled. Scoring runs JS-side
-- (cosine) because a session's evidence corpus is dozens of rows; the
-- pgvector extension is enabled for when the corpus outgrows that.
--
-- No anon RLS policies: service-role only, like every research table.

create extension if not exists vector with schema extensions;

create table if not exists public.mothermode_research_evidence_embeddings (
  evidence_id uuid primary key references public.mothermode_research_evidence (id) on delete cascade,
  embedding extensions.vector(1536) not null,
  model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);

alter table public.mothermode_research_evidence_embeddings enable row level security;

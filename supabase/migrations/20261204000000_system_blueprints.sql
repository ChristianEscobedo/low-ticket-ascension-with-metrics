-- The System Blueprint Creator (the System Map's agentic build layer)
--
-- A blueprint is a PENDING SUBGRAPH: the connected set of nodes (the funnel's
-- pages, the email sequence, the tracked links, the content) a blueprint run
-- proposes to materialize on the System Map. It is the gated pattern made
-- concrete — the agent drafts the subgraph, a human approves it, and only then
-- do the skills write the real records (funnels, email kits, utm links,
-- planner cards). Nothing here touches a source table before approval; this
-- table only ever holds the PROPOSAL and its lifecycle.
--
--   mode          — 'research' (an artifact becomes the blueprint),
--                   'optimization' (the leak detector's output becomes the
--                   fix), or 'clone' (a winning funnel clones into a variant).
--   source        — { summary, artifactId?, leakEdgeId?, parentFunnelId? }:
--                   what the blueprint was drafted FROM.
--   nodes         — the proposed subgraph: [{ key, kind, label, sub, metrics,
--                   skill: { name, input } | null, linksTo: [key] }]. Each
--                   node's skill is the materialization instruction the approve
--                   path runs; a null skill is informational (a page node
--                   materialized by its funnel).
--   status        — 'proposed' (the pending overlay) → 'approved' →
--                   'materialized' (the skills wrote the records), or
--                   'rejected'. The map reads the proposed ones as the overlay.
--   recipe_run_id — the recipe run that drafted it, when one did.
--
-- No anon RLS policies: service-role only, like every research table.

create table if not exists public.system_blueprints (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  mode text not null default 'research',
  source jsonb not null default '{}',
  nodes jsonb not null default '[]',
  status text not null default 'proposed',
  recipe_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_blueprints_status_idx
  on public.system_blueprints (status, created_at desc);

alter table public.system_blueprints enable row level security;

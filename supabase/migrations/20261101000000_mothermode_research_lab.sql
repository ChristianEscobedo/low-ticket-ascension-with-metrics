-- MotherMode Research Lab
-- Admin-only offer planning + research workspace: chat sessions with an agent
-- that can pull outside data (social scraping via Monid, Amazon reviews via
-- RapidAPI, model-native web search), internal metrics (tracked links, leads,
-- attributed revenue), and Context Bridge packs, then emit persistent ARTIFACTS
-- (research briefs, offer briefs, content plans, lead-magnet concepts, ad
-- angles, email outlines) that hand off to the planner and the kit builders.
--
-- Four tables:
--   mothermode_research_sessions   one conversation / investigation
--   mothermode_research_messages   chat turns, incl. the tool-call trace
--   mothermode_research_artifacts  the durable outputs, handoff-aware
--   mothermode_research_cache      paid-scraper result cache so Monid/RapidAPI
--                                  spend stays flat (never re-pay for the same
--                                  query inside the TTL window)
--
-- No anon RLS policies: like the other admin tables, all access is via the
-- service-role client in src/lib/mothermode/research/store.ts, which bypasses
-- RLS. There is no buyer-facing path to any of this.

create table if not exists public.mothermode_research_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New research',
  offer_slug text not null default '',
  context_refs jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists mothermode_research_sessions_updated_at_idx
  on public.mothermode_research_sessions (updated_at desc);

create table if not exists public.mothermode_research_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mothermode_research_sessions (id) on delete cascade,
  role text not null default 'user',
  content text not null default '',
  tool_calls jsonb not null default '[]'::jsonb,
  model text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists mothermode_research_messages_session_idx
  on public.mothermode_research_messages (session_id, created_at);

create table if not exists public.mothermode_research_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mothermode_research_sessions (id) on delete cascade,
  type text not null default 'research-brief',
  title text not null default '',
  markdown text not null default '',
  structured jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  handed_off_to jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mothermode_research_artifacts_session_idx
  on public.mothermode_research_artifacts (session_id, updated_at desc);

create table if not exists public.mothermode_research_cache (
  cache_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists mothermode_research_cache_expires_idx
  on public.mothermode_research_cache (expires_at);

-- Enable RLS with no policies: only the service role (which bypasses RLS) can
-- read or write. There is no buyer-facing / anon path to these tables.
alter table public.mothermode_research_sessions enable row level security;
alter table public.mothermode_research_messages enable row level security;
alter table public.mothermode_research_artifacts enable row level security;
alter table public.mothermode_research_cache enable row level security;

comment on table public.mothermode_research_sessions is
  'Admin-only Research Lab sessions (agent chat investigations). Service role only.';
comment on table public.mothermode_research_messages is
  'Research Lab chat turns with the tool-call trace. Service role only.';
comment on table public.mothermode_research_artifacts is
  'Research Lab durable outputs (briefs, plans, concepts) with handoff state. Service role only.';
comment on table public.mothermode_research_cache is
  'Research Lab paid-scraper result cache (TTL). Service role only.';

-- Shared run recaps (roadmap Phase 3, "Share Run recap").
--
-- The first UNAUTHENTICATED read surface against admin-guarded data, so the
-- model is deliberate:
--
--   * One row = one revocable capability. The token is `shr_` + 24 random
--     bytes (base64url, ~144 bits) — unguessable, never sequential. It is
--     stored plaintext (same posture as the /go short-link codes): the row
--     IS the capability, revocation is deletion, and the admin UI can
--     always re-display the live link.
--   * ONE live link per run (unique run_id): re-sharing returns the same
--     link instead of minting a trail of half-forgotten tokens; revoking
--     kills it instantly (the public route reads with no-store).
--   * The token buys EXACTLY ONE payload shape — the composed run recap
--     (transcript + funnel map + money map), sanitized at composition
--     time. No id in the recap joins to anything else, so a token never
--     becomes an enumeration handle against the admin routes.
--
-- No anon/authenticated RLS policies: the service role reads it on behalf
-- of the public route, exactly like the other research tables.

create table if not exists public.mothermode_recipe_run_shares (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  token text not null,
  created_at timestamptz not null default now()
);

-- "Which recap does this token open" (the public read).
create unique index if not exists mothermode_recipe_run_shares_token_idx
  on public.mothermode_recipe_run_shares (token);

-- ONE live link per run (share is idempotent; revoke deletes).
create unique index if not exists mothermode_recipe_run_shares_run_idx
  on public.mothermode_recipe_run_shares (run_id);

alter table public.mothermode_recipe_run_shares enable row level security;

comment on table public.mothermode_recipe_run_shares is
  'Revocable public recap links for recipe runs (Phase 3). One live link per run; service role only.';

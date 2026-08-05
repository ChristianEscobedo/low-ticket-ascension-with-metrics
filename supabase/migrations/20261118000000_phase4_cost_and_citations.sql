-- Phase 4: measured per-expert cost + citation enforcement v2.
--
-- 1. The agent call log (mothermode_research_call_log, created by
--    20261103000000 — note the name is NOT research_AGENT_call_log; that
--    was this migration's original bug, corrected) gains expert
--    provenance: WHO made the call and WHICH recipe run it belonged to.
--    Nullable, no backfill — rows written before this migration simply
--    carry NULL (the scorecard falls back to its step-share allocation
--    when a run has no stamped rows).
--
-- 2. Recipes gain `citation_mode`: NULL/'flag' = the v1 behavior (nudge
--    once, land with the honest receipts note); 'enforce' = a sweep below
--    the citation floor FAILS the step (and the run) instead of shipping
--    thin research downstream. Opt-in per play — the default never
--    changes.

alter table public.mothermode_research_call_log
  add column if not exists expert_slug text,
  add column if not exists recipe_run_id uuid;

create index if not exists research_call_log_run_idx
  on public.mothermode_research_call_log (recipe_run_id)
  where recipe_run_id is not null;

create index if not exists research_call_log_expert_idx
  on public.mothermode_research_call_log (expert_slug)
  where expert_slug is not null;

alter table public.mothermode_recipes
  add column if not exists citation_mode text;

comment on column public.mothermode_recipes.citation_mode is
  'NULL or ''flag'' = receipts are nudged + noted (v1); ''enforce'' = a sweep below the citation floor fails the step.';

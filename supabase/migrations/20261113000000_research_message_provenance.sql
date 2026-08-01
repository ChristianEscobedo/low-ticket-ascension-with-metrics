-- Research message provenance (recipes visibility pass).
--
-- Chat turns already persist role/content/tool_calls/model — but nothing
-- says WHO spoke (which expert) or WHY (which recipe run + step produced
-- the turn). Recipe runs write their expert turns into the session
-- transcript through the same loop, so the transcript is the natural place
-- to watch a run step by step; it just needs the stamps.
--
--   expert_slug        the expert config that ran the turn ('' / null =
--                      the owner typing, or a pre-migration row)
--   recipe_run_id      the recipe run this turn belongs to (null = chat)
--   recipe_step_index  the run's step index (0-based) that produced it
--
-- All nullable: existing rows and plain chat turns need no backfill.

alter table public.mothermode_research_messages
  add column if not exists expert_slug text,
  add column if not exists recipe_run_id uuid,
  add column if not exists recipe_step_index integer;

-- "Every turn of one run" (the step-by-step run view) and "jump to step N".
create index if not exists mothermode_research_messages_run_idx
  on public.mothermode_research_messages (recipe_run_id, recipe_step_index, created_at);

comment on column public.mothermode_research_messages.expert_slug is
  'The expert config that produced this turn (research/strategist/copy/...). Null = the owner typing or a pre-provenance row.';
comment on column public.mothermode_research_messages.recipe_run_id is
  'The recipe run this turn belongs to. Null = an ordinary chat turn.';
comment on column public.mothermode_research_messages.recipe_step_index is
  'The 0-based recipe step that produced this turn. Null = not a recipe turn.';

-- Content plan: what was actually sent to the scheduler, and where.
--
-- WHY THIS IS NOT `stage`
-- ----------------------
-- `stage` is the human workflow column, and columns are user-editable: an admin
-- can rename "Published" to "Shipped", or delete it entirely, at which point
-- `coerceStage` drops its cards into the first column. That is correct for a
-- workflow and catastrophic for a fact. "This post was sent to GoHighLevel as a
-- draft for Tuesday" must survive someone reorganising their board.
--
-- So the machine fact gets its own column, with a fixed vocabulary:
--
--   ''         -- planned here only; nothing was ever sent to a scheduler
--   'draft'    -- sent as a draft (optionally dated). Will NOT go out by itself.
--   'scheduled'-- sent with a date and will publish itself at that time
--   'published'-- already out
--
-- The distinction between 'draft' and 'scheduled' is the entire point of this
-- migration: before it, a dated post and a dated draft were indistinguishable on
-- the planner, so a calendar full of drafts read as a calendar full of posts
-- that were going to publish themselves. That is the most expensive way for a
-- planner to be wrong -- it is wrong in the direction of "you already did the
-- work", so nobody goes looking.

ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS publish_state TEXT NOT NULL DEFAULT '';

-- Which scheduler holds it: 'ghl' or '' for planner-only. Deliberately open
-- text rather than an enum -- a second integration should be a save, not a
-- migration, exactly like the planner's columns.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS publish_target TEXT NOT NULL DEFAULT '';

-- The scheduler's own id for the post, so a card can be traced to the thing it
-- created. Without it, a re-send makes a duplicate post and nothing here can
-- tell.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS publish_ref TEXT;

-- [{ id, platform, name }] -- the social accounts it went to.
--
-- Stored on the card rather than looked up live because the planner has to draw
-- these logos for a post from six months ago, when the account may have been
-- disconnected. A live lookup would silently blank the history.
ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS publish_accounts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE mothermode_content_plan
  ADD COLUMN IF NOT EXISTS publish_synced_at TIMESTAMPTZ;

-- The calendar filters on this to tint drafts differently from live schedules.
CREATE INDEX IF NOT EXISTS idx_mm_content_plan_publish_state
  ON mothermode_content_plan(publish_state);

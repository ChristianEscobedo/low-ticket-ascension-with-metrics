-- Split knowledge base articles by audience.
--
-- The 33 seeded guides are ADMIN docs (how to run the app). Buyer-facing help
-- docs (how to access a purchase, use a deliverable) are a different set that
-- customers see at /mothermode/help. One table, one new column:
--
--   audience  'admin' | 'buyer'   default 'admin' (existing rows stay admin)
--
-- RLS: the public (anon) read must now only ever see BUYER articles that are
-- published. Admin docs are read through the service role only, which bypasses
-- RLS, so admin docs are never publicly readable even when published.

ALTER TABLE mothermode_kb_articles
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'admin';

-- Backfill safety: any existing row is admin content.
UPDATE mothermode_kb_articles SET audience = 'admin' WHERE audience IS NULL;

-- Index for the buyer-facing published query.
CREATE INDEX IF NOT EXISTS idx_kb_articles_buyer_pub
  ON mothermode_kb_articles (audience, published, category, sort_order);

-- Replace the public read policy so anon can read only published BUYER rows.
DROP POLICY IF EXISTS "Public read published mothermode_kb_articles" ON mothermode_kb_articles;
CREATE POLICY "Public read published buyer kb_articles" ON mothermode_kb_articles
  FOR SELECT USING (published = true AND audience = 'buyer');

-- Service role keeps full access (reads drafts + all writes, bypasses RLS).
-- (The existing service_role policy is unchanged.)

-- MotherMode AI-generated content. One row per generated piece, produced in
-- batches by the content hub's Generate panel and grounded in a specific offer.
-- The full ContentPiece lives in `piece` JSONB so the hub renders it exactly
-- like a static catalog piece. Written and read only by the service role
-- through the admin-gated /api/mothermode/content/generated route.

-- ============================================
-- MOTHERMODE GENERATED CONTENT
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_generated_content (
  -- Stable piece id, e.g. 'gen_<batch>_<n>'. Doubles as the ContentPiece id.
  id TEXT PRIMARY KEY,
  -- Groups the pieces produced in one Generate run.
  batch_id TEXT NOT NULL,
  -- The offer this batch was written for (CTAs route to its sales page).
  offer_slug TEXT,
  -- For variations: the piece id the run riffed on. Null for fresh batches.
  source_piece_id TEXT,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  kind TEXT NOT NULL,
  tone TEXT NOT NULL,
  theme TEXT,
  title TEXT,
  -- The complete ContentPiece, voice-checked and ready to render.
  piece JSONB NOT NULL,
  -- The prompt guides the admin steered the run with.
  guides TEXT,
  model_used TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_generated_batch
  ON mothermode_generated_content(batch_id);
CREATE INDEX IF NOT EXISTS idx_mm_generated_offer
  ON mothermode_generated_content(offer_slug);
CREATE INDEX IF NOT EXISTS idx_mm_generated_created
  ON mothermode_generated_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_generated_status
  ON mothermode_generated_content(status);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mothermode_generated_content ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS but the explicit policy is kept for clarity. There
-- is no public policy: generated drafts are internal until an admin ships them.
CREATE POLICY "Service role full access mothermode_generated_content"
  ON mothermode_generated_content FOR ALL TO service_role
  USING (true) WITH CHECK (true);

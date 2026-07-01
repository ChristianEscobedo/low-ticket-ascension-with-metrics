-- MotherMode per-piece review state. One row per (offer, piece): the copy edits,
-- reviewer notes, captured metrics, and replacement images a team applies to a
-- content piece. Replaces the old browser-local (localStorage) store so the
-- whole team sees the same edits and the metrics are durable and reportable.
-- The full PieceReview lives in `review` JSONB so the client renders it exactly
-- as before. Keyed by (offer_slug, piece_id) so it covers both static catalog
-- pieces and AI-generated ones (the piece itself need not exist as a row).
-- Written and read only by the service role through the admin-gated
-- /api/mothermode/content/review route.

-- ============================================
-- MOTHERMODE CONTENT REVIEW
-- ============================================
CREATE TABLE IF NOT EXISTS mothermode_content_review (
  -- The offer this review is scoped to (the hub is opened per offer).
  offer_slug TEXT NOT NULL,
  -- The ContentPiece id the review attaches to (static or generated).
  piece_id TEXT NOT NULL,
  -- The complete PieceReview: image/images/imageIndex, notes, edits, metrics.
  review JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Email of the last admin who wrote this review, for light attribution.
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_slug, piece_id)
);

CREATE INDEX IF NOT EXISTS idx_mm_review_offer
  ON mothermode_content_review(offer_slug);
CREATE INDEX IF NOT EXISTS idx_mm_review_updated
  ON mothermode_content_review(updated_at DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE mothermode_content_review ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS but the explicit policy is kept for clarity. There
-- is no public policy: review state is internal admin tooling only.
CREATE POLICY "Service role full access mothermode_content_review"
  ON mothermode_content_review FOR ALL TO service_role
  USING (true) WITH CHECK (true);

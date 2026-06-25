-- Click-tracking for the in-video CTA overlays. Each row represents
-- a single CTA button click by a viewer. Authenticated user_id is
-- captured when present; anonymous clicks are still recorded.

CREATE TABLE IF NOT EXISTS cta_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  cta_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cta_click_events_lesson ON cta_click_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_cta_click_events_lesson_cta ON cta_click_events(lesson_id, cta_id);
CREATE INDEX IF NOT EXISTS idx_cta_click_events_created ON cta_click_events(created_at DESC);

ALTER TABLE cta_click_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS but explicit policies kept for clarity.
CREATE POLICY "Service role full access cta_click_events"
  ON cta_click_events FOR ALL TO service_role USING (true) WITH CHECK (true);

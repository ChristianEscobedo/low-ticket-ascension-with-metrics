-- View-tracking for the in-video CTA overlays. Each row represents the
-- first time a viewer's session saw a given CTA become visible. Paired
-- with cta_click_events so the admin rollup can compute click-through
-- rate per overlay. Anonymous views are still recorded (user_id null).

CREATE TABLE IF NOT EXISTS cta_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  cta_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cta_view_events_lesson ON cta_view_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_cta_view_events_lesson_cta ON cta_view_events(lesson_id, cta_id);
CREATE INDEX IF NOT EXISTS idx_cta_view_events_created ON cta_view_events(created_at DESC);

ALTER TABLE cta_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access cta_view_events"
  ON cta_view_events FOR ALL TO service_role USING (true) WITH CHECK (true);

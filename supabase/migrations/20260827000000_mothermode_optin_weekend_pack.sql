-- Optin funnel weekend pack:
-- 1) email_kit_id — auto-enroll on capture into an Email Marketing kit
-- 2) oto_yes_count / oto_no_count — simple OTO stats
-- 3) mothermode_optin_events — thin event stream for stats strip

ALTER TABLE mothermode_optin_funnels
  ADD COLUMN IF NOT EXISTS email_kit_id UUID,
  ADD COLUMN IF NOT EXISTS oto_yes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oto_no_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mothermode_optin_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id  UUID NOT NULL REFERENCES mothermode_optin_funnels(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- view | submit | oto_yes | oto_no
  lead_id    UUID REFERENCES mothermode_optin_leads(id) ON DELETE SET NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mothermode_optin_events_funnel
  ON mothermode_optin_events (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mothermode_optin_events_type
  ON mothermode_optin_events (funnel_id, event_type);

ALTER TABLE mothermode_optin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_optin_events"
  ON mothermode_optin_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

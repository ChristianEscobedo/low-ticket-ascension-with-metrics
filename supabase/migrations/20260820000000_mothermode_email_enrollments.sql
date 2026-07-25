-- Email sequence enrollment + event stream (Phase 5 expansion).
--
-- Phase 4 added per-email aggregate stats (mothermode_email_stats). This
-- migration adds subscriber-level tracking so the flow canvas and analytics
-- dashboard can show:
--   * How many people are enrolled and where they are in the sequence.
--   * Step-by-step funnel conversion (enrolled → delivered → opened → …).
--   * Per-email drop-off rates.
--   * Cohort retention over time.
--   * Individual subscriber journeys.
--
-- Like mothermode_email_stats, these tables are populated by an ESP webhook
-- (not the kit tool itself). They start empty and degrade to clean empty
-- states in the UI until a provider is connected.

-- ────────────────────────────────────────────────────────────────────────────
-- Enrollments: one row per subscriber per kit (their current position + status)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE mothermode_email_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  -- ESP contact id or hashed email. Never raw PII.
  subscriber_id TEXT NOT NULL,
  -- The email the subscriber is currently on (EmailMessage.id inside the
  -- sequence JSON). Empty string = enrolled but not yet sent to.
  email_id      TEXT NOT NULL DEFAULT '',
  -- enrolled | sent | opened | clicked | completed | dropped | unsubscribed
  status        TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Tags, source, UTM params, device, geo — provider-specific context.
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (kit_id, subscriber_id)
);

CREATE INDEX idx_enrollments_kit_status ON mothermode_email_enrollments (kit_id, status);
CREATE INDEX idx_enrollments_kit_email ON mothermode_email_enrollments (kit_id, email_id);
CREATE INDEX idx_enrollments_enrolled_at ON mothermode_email_enrollments (enrolled_at);

-- ────────────────────────────────────────────────────────────────────────────
-- Events: append-only stream of subscriber touchpoints (journey timeline)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE mothermode_email_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,
  -- Which email this event pertains to (empty for 'enrolled' which is
  -- sequence-level, not email-level).
  email_id      TEXT NOT NULL DEFAULT '',
  -- enrolled | sent | delivered | opened | clicked | unsubscribed | bounced |
  -- purchased | dropped
  event_type    TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Link clicked, device, geo, UTM, etc.
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_events_kit_subscriber ON mothermode_email_events (kit_id, subscriber_id);
CREATE INDEX idx_events_kit_email ON mothermode_email_events (kit_id, email_id);
CREATE INDEX idx_events_kit_type ON mothermode_email_events (kit_id, event_type);
CREATE INDEX idx_events_occurred_at ON mothermode_email_events (occurred_at);

-- RLS posture matches the other mothermode tables: service role only.
-- All reads/writes go through the admin API / ingestion route.
ALTER TABLE mothermode_email_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_email_events ENABLE ROW LEVEL SECURITY;
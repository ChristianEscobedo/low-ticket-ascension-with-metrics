-- MotherMode email sequence analytics (Phase 4).
--
-- The email kit tool generates/exports copy today; it does NOT send mail or
-- ingest opens/clicks yet. This table is the *storage shape* for per-email
-- engagement counters so the flow canvas can overlay open%/CTR the instant an
-- ESP webhook (SendGrid/Postmark/Resend/GHL) begins upserting rows.
--
-- RLS posture mirrors mothermode_email_kits / mothermode_custom_tokens: all
-- reads/writes go through the admin API or the ingestion route with the service
-- role, which bypasses RLS. No anon policies.

CREATE TABLE IF NOT EXISTS mothermode_email_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id       UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  email_id     TEXT NOT NULL,                       -- EmailMessage.id (or A/B variant id) inside the sequence JSON
  period       TEXT NOT NULL DEFAULT 'all',          -- 'all' roll-up or a 'YYYY-MM' bucket
  sent         INTEGER NOT NULL DEFAULT 0,
  delivered    INTEGER NOT NULL DEFAULT 0,
  opened       INTEGER NOT NULL DEFAULT 0,
  clicked      INTEGER NOT NULL DEFAULT 0,
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  bounced      INTEGER NOT NULL DEFAULT 0,
  revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kit_id, email_id, period)
);

CREATE INDEX IF NOT EXISTS idx_email_stats_kit
  ON mothermode_email_stats (kit_id, period);

-- ---------------------------------------------------------------------------
-- RLS: service role does everything; no anon policies (admin API / webhook only).
-- ---------------------------------------------------------------------------
ALTER TABLE mothermode_email_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access mothermode_email_stats" ON mothermode_email_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

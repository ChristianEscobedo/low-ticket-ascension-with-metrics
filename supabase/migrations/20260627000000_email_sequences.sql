-- Re-engagement and deadline-driven email sequences.
--
-- `email_sequence_enrollments` holds one row per (sequence, buyer). The cron
-- engine (/api/cron/email-sequences) walks active rows whose next_send_at is
-- due, sends the next step, advances current_step, and exits the row when the
-- buyer purchases the sequence's target_product_id (status='converted') or the
-- steps run out (status='completed'). Deadline sequences (e.g. the $997
-- coaching "I need more time" window) also exit once deadline_at passes.
--
-- `email_sequence_sends` is an append-only per-step audit + idempotency guard:
-- the UNIQUE (enrollment_id, step_index) stops a step from going out twice if
-- two cron invocations overlap.
--
-- Both tables are locked to the service role only (the webhook, the extension
-- API, and the cron engine all use @/utils/supabase service-role clients),
-- matching the funnel_purchases posture.

-- ============================================
-- ENROLLMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sequence definition key, e.g. 'upsell_os' / 'coaching_extension'.
  sequence_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  -- Buying this product exits the enrollment as 'converted'.
  target_product_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'converted', 'cancelled')),
  -- Index of the next step to send from the code-defined sequence.
  current_step INTEGER NOT NULL DEFAULT 0,
  -- Extra render context (offerUrl, deadline label, fe product, etc.).
  context JSONB,
  -- When the current_step becomes due. NULL once the row is no longer active.
  next_send_at TIMESTAMPTZ,
  -- Hard stop for deadline-driven sequences (coaching window). NULL otherwise.
  deadline_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One live enrollment per buyer per sequence; re-enrolling upserts this row.
  UNIQUE (sequence_id, customer_email)
);

CREATE INDEX IF NOT EXISTS idx_email_seq_enroll_due
  ON email_sequence_enrollments (status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_email_seq_enroll_email
  ON email_sequence_enrollments (customer_email);

-- ============================================
-- PER-STEP SEND LOG
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL
    REFERENCES email_sequence_enrollments(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  customer_email TEXT,
  provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A given step goes out at most once per enrollment.
  UNIQUE (enrollment_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_email_seq_sends_enrollment
  ON email_sequence_sends (enrollment_id);

-- ============================================
-- RLS (service role only)
-- ============================================
ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access email_sequence_enrollments"
  ON email_sequence_enrollments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access email_sequence_sends"
  ON email_sequence_sends FOR ALL TO service_role
  USING (true) WITH CHECK (true);

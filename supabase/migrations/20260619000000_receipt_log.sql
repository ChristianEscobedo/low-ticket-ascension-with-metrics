-- Append-only audit log for every sendPurchaseReceipt() attempt. Captures
-- whether a receipt was sent / skipped / failed, the provider used, the
-- provider's message id (when available), and a snapshot of the relevant
-- purchase fields so support can answer "did this buyer get their receipt?"
-- without cross-referencing Stripe + the email provider dashboard.

CREATE TABLE IF NOT EXISTS receipt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT,
  payment_intent_id TEXT,
  product_id TEXT,
  customer_email TEXT,
  amount_cents INTEGER,
  currency TEXT,
  provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  http_status INTEGER,
  message_id TEXT,
  error TEXT,
  skipped_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_log_created ON receipt_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_log_email ON receipt_log(customer_email);
CREATE INDEX IF NOT EXISTS idx_receipt_log_status ON receipt_log(status);
CREATE INDEX IF NOT EXISTS idx_receipt_log_payment_intent ON receipt_log(payment_intent_id);

ALTER TABLE receipt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access receipt_log"
  ON receipt_log FOR ALL TO service_role USING (true) WITH CHECK (true);

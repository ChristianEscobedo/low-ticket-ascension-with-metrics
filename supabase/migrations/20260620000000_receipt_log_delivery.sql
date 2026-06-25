-- Extend receipt_log with delivery telemetry patched by inbound Resend
-- webhooks (delivered / bounced / complained / opened / clicked). Lets the
-- /admin/receipt-log view answer "did the inbox actually accept it?" rather
-- than just "did we hand it to the provider?".

ALTER TABLE receipt_log
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_type TEXT,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_receipt_log_message ON receipt_log(message_id);
CREATE INDEX IF NOT EXISTS idx_receipt_log_delivery_status
  ON receipt_log(delivery_status);

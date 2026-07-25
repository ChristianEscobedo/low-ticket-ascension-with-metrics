-- Multi-event email kit bindings for sales funnels.
-- Each funnel can enroll leads into different Email Marketing kits on
-- optin / checkout_start / purchase / upsell_purchase / abandon.
-- email_kit_id remains the legacy single-kit (optin) field for back-compat.

ALTER TABLE mothermode_sales_funnels
  ADD COLUMN IF NOT EXISTS email_kits JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN mothermode_sales_funnels.email_kits IS
  'Array of { event, kitId } bindings. event matches EmailTriggerEvent funnel values.';

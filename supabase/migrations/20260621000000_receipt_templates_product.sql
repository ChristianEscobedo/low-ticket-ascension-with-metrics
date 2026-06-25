-- Adds an optional product_id to receipt_templates so admins can override the
-- default receipt copy per Stripe product. Lookup precedence in
-- src/utils/email/templates.ts: product-specific row > default row > hardcoded.

ALTER TABLE receipt_templates
  ADD COLUMN IF NOT EXISTS product_id TEXT
    REFERENCES products(id) ON DELETE CASCADE;

-- At most one stored template per product. The global default lives in the
-- row with id = 'default' and product_id IS NULL, which is unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS receipt_templates_product_id_uniq
  ON receipt_templates (product_id)
  WHERE product_id IS NOT NULL;

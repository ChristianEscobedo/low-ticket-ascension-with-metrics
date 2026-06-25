import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';
import {
  RECEIPT_TOKEN_KEYS,
  type ReceiptTokenKey,
  renderTemplate
} from '@/utils/email/render';

export interface ReceiptTemplate {
  id: string;
  subject: string;
  body_html: string;
  body_text: string;
  product_id?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export const RECEIPT_TEMPLATE_ID = 'default';

const SELECT_COLS =
  'id, subject, body_html, body_text, product_id, updated_at, updated_by';

// Re-exported for backwards compatibility — the pure primitives live in
// ./render so client components can import them without supabase.
export { RECEIPT_TOKEN_KEYS, renderTemplate };
export type { ReceiptTokenKey };

const formatAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);

/** Centralized token bag fed to {@link renderTemplate} for receipt emails. */
export function buildReceiptTokens(
  payload: PurchaseEvent,
  opts: { brandName: string | null }
): Record<ReceiptTokenKey, string> {
  const firstName = payload.customer_name
    ? payload.customer_name.split(/\s+/)[0]
    : 'there';
  const brand = opts.brandName ?? '';
  return {
    brand,
    amount: formatAmount(payload.amount_cents, payload.currency),
    currency: (payload.currency || 'usd').toUpperCase(),
    product: payload.product_id ?? '—',
    name: firstName,
    email: payload.customer_email ?? '',
    ref:
      payload.payment_intent_id ||
      payload.checkout_session_id ||
      payload.stripe_event_id,
    signoff: brand
      ? `— The ${brand} team`
      : 'If anything looks off, just reply to this email.'
  };
}

// Service-role client — lazy so the module never throws on missing env.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

/**
 * Fetch the template best matching the given product. Precedence:
 *   1. row with product_id = productId (product-specific override)
 *   2. row with id = 'default' (global override)
 *   3. null — caller falls back to hardcoded copy
 * Returns null when env is unconfigured.
 */
export async function getReceiptTemplate(
  productId?: string | null
): Promise<ReceiptTemplate | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  try {
    if (productId) {
      const { data, error } = await (getSupabase() as any)
        .from('receipt_templates')
        .select(SELECT_COLS)
        .eq('product_id', productId)
        .maybeSingle();
      if (error) {
        console.error('getReceiptTemplate (product) failed:', error);
      } else if (data) {
        return data as ReceiptTemplate;
      }
    }
    const { data, error } = await (getSupabase() as any)
      .from('receipt_templates')
      .select(SELECT_COLS)
      .eq('id', RECEIPT_TEMPLATE_ID)
      .maybeSingle();
    if (error) {
      console.error('getReceiptTemplate failed:', error);
      return null;
    }
    return (data as ReceiptTemplate | null) ?? null;
  } catch (err) {
    console.error('getReceiptTemplate threw:', err);
    return null;
  }
}

/** Lists every stored template (default + per-product). */
export async function listReceiptTemplates(): Promise<ReceiptTemplate[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  try {
    const { data, error } = await (getSupabase() as any)
      .from('receipt_templates')
      .select(SELECT_COLS);
    if (error) {
      console.error('listReceiptTemplates failed:', error);
      return [];
    }
    return (data ?? []) as ReceiptTemplate[];
  } catch (err) {
    console.error('listReceiptTemplates threw:', err);
    return [];
  }
}

export interface UpsertReceiptTemplateInput {
  subject: string;
  body_html: string;
  body_text: string;
  product_id?: string | null;
  updated_by?: string | null;
}

export async function upsertReceiptTemplate(
  input: UpsertReceiptTemplateInput
): Promise<void> {
  const productId = input.product_id?.trim() || null;
  // Product-specific rows are keyed `product:<id>` so the default row at
  // id='default' is never overwritten.
  const id = productId ? `product:${productId}` : RECEIPT_TEMPLATE_ID;
  const row = {
    id,
    subject: input.subject,
    body_html: input.body_html,
    body_text: input.body_text,
    product_id: productId,
    updated_at: new Date().toISOString(),
    updated_by: input.updated_by ?? null
  };
  const { error } = await (getSupabase() as any)
    .from('receipt_templates')
    .upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`upsertReceiptTemplate failed: ${error.message}`);
  }
}

/**
 * Remove a stored template. Pass a product id to delete a product-specific
 * override (falling back to the default), or null/omit to delete the global
 * default (falling back to the hardcoded copy).
 */
export async function deleteReceiptTemplate(
  productId?: string | null
): Promise<void> {
  const pid = productId?.trim() || null;
  const id = pid ? `product:${pid}` : RECEIPT_TEMPLATE_ID;
  const { error } = await (getSupabase() as any)
    .from('receipt_templates')
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`deleteReceiptTemplate failed: ${error.message}`);
  }
}

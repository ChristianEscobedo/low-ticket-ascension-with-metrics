/**
 * Server-side price resolution for funnel charges.
 *
 * The browser says WHICH thing is being bought (price_id, or funnel slug +
 * step); the server decides HOW MUCH by reading the Stripe-synced `prices`
 * table. Amounts posted from the client are only a fallback, so a tampered
 * request cannot reprice a checkout.
 *
 * Resolution order for a charge:
 *   1. explicit price_id (from the funnel step content / assignment)
 *   2. main product_funnel_assignments row for (funnel_slug, step)
 *   3. caller-supplied fallback amount (legacy behaviour)
 */
import { createClient } from '@supabase/supabase-js';
import {
  getMainAssignmentForStep,
  type AssignmentStep,
} from './productAssignments';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

export interface ResolvedPrice {
  priceId: string;
  productId: string | null;
  unitAmountCents: number;
  currency: string;
  /** 'month' | 'year' | ... for recurring prices, null for one-time. */
  interval: string | null;
  active: boolean;
}

interface PriceRow {
  id: string;
  product_id: string | null;
  unit_amount: number | null;
  currency: string;
  interval: string | null;
  type: string | null;
  active: boolean;
}

function rowToResolved(row: PriceRow): ResolvedPrice | null {
  if (typeof row.unit_amount !== 'number' || row.unit_amount <= 0) return null;
  return {
    priceId: row.id,
    productId: row.product_id ?? null,
    unitAmountCents: row.unit_amount,
    currency: row.currency || 'usd',
    interval: row.type === 'recurring' ? row.interval : null,
    active: row.active !== false,
  };
}

/** Look up a synced Stripe price by id. Null when unknown or unusable. */
export async function resolvePriceById(priceId: string): Promise<ResolvedPrice | null> {
  if (!priceId) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from('prices')
      .select('id, product_id, unit_amount, currency, interval, type, active')
      .eq('id', priceId)
      .maybeSingle();
    if (error || !data) return null;
    const resolved = rowToResolved(data as PriceRow);
    if (!resolved || !resolved.active) return null;
    return resolved;
  } catch {
    return null;
  }
}

/** First active price for a product (preference: recurring match, then any). */
export async function resolveFirstPriceForProduct(
  productId: string,
): Promise<ResolvedPrice | null> {
  if (!productId) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from('prices')
      .select('id, product_id, unit_amount, currency, interval, type, active')
      .eq('product_id', productId)
      .eq('active', true)
      .order('created', { ascending: false });
    if (error || !data || (data as PriceRow[]).length === 0) return null;
    for (const row of data as PriceRow[]) {
      const resolved = rowToResolved(row);
      if (resolved) return resolved;
    }
    return null;
  } catch {
    return null;
  }
}

export interface StepCharge {
  amountCents: number;
  currency: string;
  priceId: string | null;
  productId: string | null;
  interval: string | null;
  /** Where the amount came from — surfaced in logs/metadata for auditing. */
  source: 'price_id' | 'assignment' | 'product' | 'fallback';
}

export interface StepChargeInput {
  priceId?: string | null;
  funnelSlug?: string | null;
  step?: AssignmentStep | null;
  productId?: string | null;
  fallbackAmountCents?: number | null;
}

/**
 * Resolve the authoritative charge for a funnel step. Never throws — a
 * resolution miss returns the fallback amount so legacy amount-based posts
 * keep working.
 */
export async function resolveStepCharge(input: StepChargeInput): Promise<StepCharge> {
  // 1. Explicit price id from step content.
  if (input.priceId) {
    const price = await resolvePriceById(input.priceId);
    if (price) {
      return {
        amountCents: price.unitAmountCents,
        currency: price.currency,
        priceId: price.priceId,
        productId: input.productId || price.productId,
        interval: price.interval,
        source: 'price_id',
      };
    }
  }

  // 2. Assignment for (funnel, step) — the builder's product picker writes these.
  if (input.funnelSlug && input.step) {
    const assignment = await getMainAssignmentForStep(input.funnelSlug, input.step);
    if (assignment) {
      const price = assignment.priceId
        ? await resolvePriceById(assignment.priceId)
        : await resolveFirstPriceForProduct(assignment.productId);
      if (price) {
        return {
          amountCents: price.unitAmountCents,
          currency: price.currency,
          priceId: price.priceId,
          productId: assignment.productId || price.productId,
          interval: price.interval,
          source: 'assignment',
        };
      }
    }
  }

  // 3. Product's first active price.
  if (input.productId) {
    const price = await resolveFirstPriceForProduct(input.productId);
    if (price) {
      return {
        amountCents: price.unitAmountCents,
        currency: price.currency,
        priceId: price.priceId,
        productId: input.productId,
        interval: price.interval,
        source: 'product',
      };
    }
  }

  // 4. Legacy: trust the posted amount (existing funnels without price ids).
  const fallback = Math.round(Number(input.fallbackAmountCents ?? 0));
  return {
    amountCents: Number.isFinite(fallback) ? fallback : 0,
    currency: 'usd',
    priceId: input.priceId || null,
    productId: input.productId || null,
    interval: null,
    source: 'fallback',
  };
}

/** Map a funnel step to the page_type tag used across stats + integrations. */
export function pageTypeForStep(step: string | null | undefined): string {
  switch (step) {
    case 'upsell1':
      return 'oto1';
    case 'upsell2':
      return 'oto2';
    case 'upsell3':
      return 'oto3';
    case 'upsell4':
      return 'oto4';
    default:
      return 'fe';
  }
}

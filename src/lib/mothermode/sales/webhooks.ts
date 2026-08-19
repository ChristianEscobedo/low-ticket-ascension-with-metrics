/**
 * Outbound webhooks — a funnel carries a list of webhook URLs. On a purchase
 * (the main product or a bump), POST the purchase data to each URL: the main
 * app, GHL, Zapier, anything that takes a JSON POST. Fire-and-forget — a dead
 * webhook never blocks the purchase.
 */
import type { SalesFunnelRecord } from './types';

export interface FunnelPurchasePayload {
  event: 'purchase';
  funnelSlug: string;
  funnelName: string;
  email: string | null;
  firstName?: string | null;
  productName?: string | null;
  productId?: string | null;
  amountCents: number;
  currency?: string;
  step?: string | null;
  /** True when this is an order bump / upsell, not the main product. */
  isBump?: boolean;
  purchasedAt: string;
}

export async function fireFunnelWebhooks(
  funnel: Pick<SalesFunnelRecord, 'slug' | 'name' | 'webhooks'>,
  purchase: Omit<
    FunnelPurchasePayload,
    'event' | 'funnelSlug' | 'funnelName' | 'purchasedAt'
  >,
  // Per-page webhooks ride along: the page the purchase happened on (the
  // checkout, an upsell) carries its own webhooks, fired in addition to the
  // funnel-level ones.
  extraUrls: string[] = [],
): Promise<void> {
  const urls = [...(funnel.webhooks ?? []), ...extraUrls].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0,
  );
  if (urls.length === 0) return;
  const payload: FunnelPurchasePayload = {
    event: 'purchase',
    funnelSlug: funnel.slug,
    funnelName: funnel.name,
    purchasedAt: new Date().toISOString(),
    ...purchase,
  };
  // Fire-and-forget, in parallel. A dead webhook never blocks the purchase.
  await Promise.allSettled(
    urls.map((url) =>
      fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.error(`[funnel-webhook] ${url} failed:`, err)),
    ),
  );
}

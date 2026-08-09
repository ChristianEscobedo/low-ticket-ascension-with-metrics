import crypto from 'node:crypto';
import { listIntegrations } from '@/utils/integrations/store';
import type {
  GenericWebhookConfig,
  GhlConfig,
  IntegrationRow,
  MainAppConfig
} from '@/utils/integrations/types';
import {
  listAssignmentsForFunnel,
  type ProductFunnelAssignment
} from '@/lib/mothermode/sales/productAssignments';

// ---------------------------------------------------------------------------
// Event model
// ---------------------------------------------------------------------------

/**
 * Lifecycle events the dispatcher fans out. `purchase` is the classic one;
 * the rest exist so the main app can provision AND deprovision (refund,
 * cancel) and mirror manual comps.
 */
export type DispatchEventType =
  | 'purchase'
  | 'refund'
  | 'comp.granted'
  | 'comp.revoked'
  | 'subscription.created'
  | 'subscription.canceled'
  | 'test';

export interface PurchaseEvent {
  stripe_event_id: string;
  checkout_session_id?: string | null;
  payment_intent_id?: string | null;
  product_id?: string | null;
  page_type?: string | null;
  amount_cents: number;
  currency: string;
  customer_email?: string | null;
  customer_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** One deliverable line in a main-app payload, built from a product assignment. */
export interface MainAppItem {
  product_id: string;
  price_id: string | null;
  role: 'main' | 'bump' | 'bonus';
  step: string;
  delivery: {
    type: 'course' | 'deliverable' | 'url' | 'main_app';
    product_key?: string;
    license?: boolean;
    seats?: number;
    course_ids?: string[];
    deliverable_slug?: string;
    deliverable_key?: string;
    links?: { label: string; href: string; description: string }[];
  };
}

/** The signed envelope POSTed to the main app. Documented in
 *  docs/MAIN_APP_WEBHOOK_INTEGRATION.md — keep the shapes in sync. */
export interface MainAppEnvelope {
  id: string;
  event: DispatchEventType;
  created_at: string;
  data: {
    customer: { email: string | null; name: string | null };
    funnel: { slug: string | null; step: string | null; page_type: string | null };
    order: {
      product_id: string | null;
      price_id: string | null;
      amount_cents: number;
      currency: string;
      payment_intent_id: string | null;
      checkout_session_id: string | null;
      subscription_id: string | null;
    };
    items: MainAppItem[];
    /** Convenience: first item asking the main app to issue a license. */
    license_request: { product_key: string; seats: number } | null;
    refund?: {
      refund_id: string | null;
      amount_cents: number | null;
      refunded_at: string;
    };
    comp?: {
      product_id: string | null;
      price_id: string | null;
      product_name: string | null;
      note: string | null;
    };
    metadata: Record<string, unknown> | null;
  };
}

// ---------------------------------------------------------------------------
// Envelope builder (pure — unit tested)
// ---------------------------------------------------------------------------

export function assignmentToMainAppItem(a: ProductFunnelAssignment): MainAppItem {
  return {
    product_id: a.productId,
    price_id: a.priceId,
    role: a.role,
    step: a.step,
    delivery: {
      type: a.deliveryType,
      ...(a.delivery.productKey ? { product_key: a.delivery.productKey } : {}),
      ...(a.delivery.license ? { license: true } : {}),
      ...(a.delivery.seats > 1 ? { seats: a.delivery.seats } : {}),
      ...(a.delivery.courseIds.length > 0 ? { course_ids: a.delivery.courseIds } : {}),
      ...(a.delivery.deliverableSlug
        ? { deliverable_slug: a.delivery.deliverableSlug }
        : {}),
      ...(a.delivery.deliverableKey
        ? { deliverable_key: a.delivery.deliverableKey }
        : {}),
      ...(a.delivery.links.length > 0 ? { links: a.delivery.links } : {})
    }
  };
}

export function buildMainAppEnvelope(input: {
  id: string;
  event: DispatchEventType;
  purchase?: PurchaseEvent | null;
  items?: MainAppItem[];
  refund?: MainAppEnvelope['data']['refund'];
  comp?: MainAppEnvelope['data']['comp'];
  subscriptionId?: string | null;
  now?: Date;
}): MainAppEnvelope {
  const p = input.purchase ?? null;
  const meta = (p?.metadata ?? null) as Record<string, unknown> | null;
  const funnelSlug =
    (typeof meta?.funnel_slug === 'string' ? meta.funnel_slug : null) ?? null;
  const step = (typeof meta?.step === 'string' ? meta.step : null) ?? null;
  const items = input.items ?? [];
  const licenseItem = items.find((i) => i.delivery.type === 'main_app' && i.delivery.license);

  return {
    id: input.id,
    event: input.event,
    created_at: (input.now ?? new Date()).toISOString(),
    data: {
      customer: {
        email: p?.customer_email ?? null,
        name: p?.customer_name ?? null
      },
      funnel: {
        slug: funnelSlug,
        step,
        page_type: p?.page_type ?? null
      },
      order: {
        product_id: p?.product_id ?? null,
        price_id:
          (typeof meta?.price_id === 'string' ? meta.price_id : null) ?? null,
        amount_cents: p?.amount_cents ?? 0,
        currency: p?.currency ?? 'usd',
        payment_intent_id: p?.payment_intent_id ?? null,
        checkout_session_id: p?.checkout_session_id ?? null,
        subscription_id: input.subscriptionId ?? null
      },
      items,
      license_request: licenseItem
        ? {
            product_key: licenseItem.delivery.product_key || licenseItem.product_id,
            seats: licenseItem.delivery.seats ?? 1
          }
        : null,
      ...(input.refund ? { refund: input.refund } : {}),
      ...(input.comp ? { comp: input.comp } : {}),
      metadata: meta
    }
  };
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const matchesEventFilter = (row: IntegrationRow, page_type?: string | null) => {
  if (!row.events || row.events.length === 0) return true;
  if (!page_type) return false;
  return row.events.includes(page_type);
};

const fireGenericWebhook = async (
  cfg: GenericWebhookConfig,
  payload: PurchaseEvent
) => {
  if (!cfg.url) return;
  const body = JSON.stringify({ event: 'funnel_purchase', payload });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.secret) {
    const sig = crypto.createHmac('sha256', cfg.secret).update(body).digest('hex');
    headers['x-mindshift-signature'] = `sha256=${sig}`;
  }
  await fetch(cfg.url, { method: 'POST', headers, body });
};

const fireGhl = async (cfg: GhlConfig, payload: PurchaseEvent) => {
  if (!cfg.api_key || !cfg.location_id || !payload.customer_email) return;
  const [firstName, ...rest] = (payload.customer_name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ') || undefined;
  const tagPrefix = cfg.tag_prefix?.trim() || 'mindshift';
  const tag = payload.page_type
    ? `${tagPrefix}:${payload.page_type}`
    : tagPrefix;
  await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.api_key}`,
      version: '2021-07-28',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      locationId: cfg.location_id,
      email: payload.customer_email,
      firstName: firstName || undefined,
      lastName,
      tags: [tag],
      source: 'MotherMode'
    })
  });
};

/**
 * The main app channel. Signs the envelope with HMAC-SHA256 in the
 * `x-mothermode-signature` header (`sha256=<hex>` over the raw body).
 */
const fireMainApp = async (cfg: MainAppConfig, envelope: MainAppEnvelope) => {
  if (!cfg.url) return;
  const body = JSON.stringify(envelope);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.secret) {
    const sig = crypto.createHmac('sha256', cfg.secret).update(body).digest('hex');
    headers['x-mothermode-signature'] = `sha256=${sig}`;
  }
  const res = await fetch(cfg.url, { method: 'POST', headers, body });
  if (!res.ok) {
    throw new Error(`main_app responded ${res.status}`);
  }
};

// ---------------------------------------------------------------------------
// Fan-out
// ---------------------------------------------------------------------------

async function loadDeliveryItems(purchase: PurchaseEvent): Promise<MainAppItem[]> {
  const slug =
    typeof purchase.metadata?.funnel_slug === 'string'
      ? (purchase.metadata.funnel_slug as string)
      : null;
  if (!slug) return [];
  const step = typeof purchase.metadata?.step === 'string' ? purchase.metadata.step : null;
  try {
    const assignments = await listAssignmentsForFunnel(slug);
    // Deliver the purchased step's main product + its bumps/bonuses, plus any
    // funnel-wide bonuses bound to earlier steps (bonuses stack down the ladder).
    const relevant = assignments.filter((a) => {
      if (a.role === 'bonus') return true;
      if (!step) return a.role === 'main' && a.step === 'checkout';
      return a.step === step;
    });
    return relevant.map(assignmentToMainAppItem);
  } catch (err) {
    console.error('[dispatch] assignment lookup failed', err);
    return [];
  }
}

/**
 * Best-effort fan-out of a purchase. Never throws (Stripe still gets a 200
 * ack); errors are logged. Caller awaits to keep the route alive.
 */
export async function dispatchPurchase(payload: PurchaseEvent): Promise<void> {
  let integrations: IntegrationRow[];
  try {
    integrations = await listIntegrations();
  } catch (err) {
    console.error('dispatchPurchase: listIntegrations failed', err);
    return;
  }

  // Resolve delivery items once per purchase for the main app channel.
  let items: MainAppItem[] = [];
  const wantsMainApp = integrations.some((r) => r.provider === 'main_app' && r.enabled);
  if (wantsMainApp) {
    items = await loadDeliveryItems(payload);
  }

  const tasks = integrations
    .filter((row) => row.enabled && matchesEventFilter(row, payload.page_type))
    .map(async (row) => {
      try {
        switch (row.provider) {
          case 'generic_webhook':
            await fireGenericWebhook(row.config as GenericWebhookConfig, payload);
            break;
          case 'ghl':
            await fireGhl(row.config as GhlConfig, payload);
            break;
          case 'main_app':
            await fireMainApp(
              row.config as MainAppConfig,
              buildMainAppEnvelope({
                id: payload.stripe_event_id,
                event: 'purchase',
                purchase: payload,
                items,
                subscriptionId:
                  typeof payload.metadata?.subscription_id === 'string'
                    ? payload.metadata.subscription_id
                    : null
              })
            );
            break;
          case 'mass':
            // Scaffold: dispatch wired once the mass.new ingest API is live.
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`dispatchPurchase[${row.provider}] failed`, err);
      }
    });
  await Promise.all(tasks);
}

/**
 * Non-purchase lifecycle events (refund, comp grant/revoke, subscription
 * created/canceled). These go to the main app only — generic webhooks and GHL
 * stay purchase-shaped.
 */
export async function dispatchLifecycleEvent(input: {
  id: string;
  event: DispatchEventType;
  purchase?: PurchaseEvent | null;
  refund?: MainAppEnvelope['data']['refund'];
  comp?: MainAppEnvelope['data']['comp'];
  subscriptionId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<void> {
  let integrations: IntegrationRow[];
  try {
    integrations = await listIntegrations();
  } catch (err) {
    console.error('dispatchLifecycleEvent: listIntegrations failed', err);
    return;
  }
  const rows = integrations.filter((r) => r.provider === 'main_app' && r.enabled);
  if (rows.length === 0) return;

  let items: MainAppItem[] = [];
  if (input.purchase) {
    items = await loadDeliveryItems(input.purchase);
  }
  const envelope = buildMainAppEnvelope({
    id: input.id,
    event: input.event,
    purchase:
      input.purchase ??
      ({
        stripe_event_id: input.id,
        amount_cents: 0,
        currency: 'usd',
        customer_email: input.customerEmail ?? null,
        customer_name: input.customerName ?? null
      } as PurchaseEvent),
    items,
    refund: input.refund,
    comp: input.comp,
    subscriptionId: input.subscriptionId
  });

  await Promise.all(
    rows.map(async (row) => {
      try {
        await fireMainApp(row.config as MainAppConfig, envelope);
      } catch (err) {
        console.error('dispatchLifecycleEvent[main_app] failed', err);
      }
    })
  );
}

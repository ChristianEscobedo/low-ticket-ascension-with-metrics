import crypto from 'node:crypto';
import { listIntegrations } from '@/utils/integrations/store';
import type {
  GenericWebhookConfig,
  GhlConfig,
  IntegrationRow
} from '@/utils/integrations/types';

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
      source: 'Millionaire Mindshift'
    })
  });
};

// Best-effort fan-out. Never throws (so Stripe still gets a 200 ack), errors
// are logged. Caller awaits to keep the route alive during dispatch.
export async function dispatchPurchase(payload: PurchaseEvent): Promise<void> {
  let integrations: IntegrationRow[];
  try {
    integrations = await listIntegrations();
  } catch (err) {
    console.error('dispatchPurchase: listIntegrations failed', err);
    return;
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

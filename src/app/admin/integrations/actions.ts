'use server';

import { revalidatePath } from 'next/cache';
import { upsertIntegration, getIntegration } from '@/utils/integrations/store';
import { dispatchPurchase } from '@/utils/integrations/dispatch';
import { assertAdmin } from '@/app/admin/_shared/assertAdmin';
import type { IntegrationProvider } from '@/utils/integrations/types';

const VALID_PROVIDERS: IntegrationProvider[] = [
  'generic_webhook',
  'ghl',
  'mass',
  'stripe'
];

function readEvents(formData: FormData): string[] {
  // Each checkbox is named `events` with a page_type value; collect all set.
  return formData
    .getAll('events')
    .map((v) => String(v))
    .filter(Boolean);
}

function readConfig(formData: FormData, keys: readonly string[]) {
  const cfg: Record<string, string> = {};
  for (const k of keys) {
    const v = formData.get(`config.${k}`);
    if (typeof v === 'string' && v.length > 0) cfg[k] = v;
  }
  return cfg;
}

const CONFIG_KEYS: Record<IntegrationProvider, readonly string[]> = {
  generic_webhook: ['url', 'secret'],
  ghl: ['api_key', 'location_id', 'tag_prefix', 'workflow_id'],
  mass: ['api_key', 'workspace_id'],
  stripe: ['publishable_key', 'secret_key', 'webhook_secret']
};

export async function saveIntegrationAction(formData: FormData) {
  await assertAdmin();
  const provider = String(formData.get('provider') ?? '') as IntegrationProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  const enabled = formData.get('enabled') === 'on';
  const events = readEvents(formData);
  const config = readConfig(formData, CONFIG_KEYS[provider]);
  await upsertIntegration(provider, { enabled, events, config });
  revalidatePath('/admin/integrations');
  if (provider === 'stripe') revalidatePath('/admin/stripe');
}

export async function sendTestEventAction(
  provider: IntegrationProvider
): Promise<{ ok: boolean; message: string }> {
  await assertAdmin();
  const row = await getIntegration(provider);
  if (!row || !row.enabled) {
    return { ok: false, message: 'Integration is not enabled.' };
  }
  try {
    await dispatchPurchase({
      stripe_event_id: `test_${Date.now()}`,
      product_id: 'millionaire_mindshift',
      page_type: 'fe',
      amount_cents: 2700,
      currency: 'usd',
      customer_email: 'test@example.com',
      customer_name: 'Admin Test',
      metadata: { test: true }
    });
    return { ok: true, message: 'Test event dispatched.' };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? 'Dispatch failed.' };
  }
}

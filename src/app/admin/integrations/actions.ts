'use server';

import { revalidatePath } from 'next/cache';
import { upsertIntegration, getIntegration } from '@/utils/integrations/store';
import { invalidateRuntimeConfig } from '@/utils/integrations/runtime-config';
import { dispatchPurchase } from '@/utils/integrations/dispatch';
import { assertAdmin } from '@/app/admin/_shared/assertAdmin';
import type { IntegrationProvider } from '@/utils/integrations/types';

const VALID_PROVIDERS: IntegrationProvider[] = [
  'generic_webhook',
  'ghl',
  'mass',
  'stripe',
  'openai',
  'anthropic',
  'email'
];

// Secret-bearing config keys are write-only: a blank submission preserves the
// stored value rather than wiping it, so the UI never has to echo the secret
// back to the browser. Non-secret keys can be cleared by submitting blank.
const SECRET_KEYS = new Set([
  'secret',
  'secret_key',
  'webhook_secret',
  'api_key',
  'resend_api_key',
  'postmark_api_token'
]);

function readEvents(formData: FormData): string[] {
  // Each checkbox is named `events` with a page_type value; collect all set.
  return formData
    .getAll('events')
    .map((v) => String(v))
    .filter(Boolean);
}

/**
 * Merge the submitted fields onto the existing config. Secret fields are kept
 * when left blank (write-only); non-secret fields are overwritten or cleared.
 */
function mergeConfig(
  formData: FormData,
  keys: readonly string[],
  existing: Record<string, unknown>
) {
  const cfg: Record<string, unknown> = { ...existing };
  for (const k of keys) {
    const raw = formData.get(`config.${k}`);
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (SECRET_KEYS.has(k)) {
      if (v.length > 0) cfg[k] = v;
    } else if (v.length > 0) {
      cfg[k] = v;
    } else {
      delete cfg[k];
    }
  }
  return cfg;
}

const CONFIG_KEYS: Record<IntegrationProvider, readonly string[]> = {
  generic_webhook: ['url', 'secret'],
  ghl: ['api_key', 'location_id', 'tag_prefix', 'workflow_id'],
  mass: ['api_key', 'workspace_id'],
  stripe: ['publishable_key', 'secret_key', 'webhook_secret'],
  openai: ['api_key', 'image_model', 'text_model', 'text_provider'],
  anthropic: ['api_key', 'text_model'],
  email: [
    'provider',
    'resend_api_key',
    'postmark_api_token',
    'postmark_stream',
    'from_email',
    'from_name',
    'reply_to',
    'subject_prefix',
    'bcc'
  ]
};

export async function saveIntegrationAction(formData: FormData) {
  await assertAdmin();
  const provider = String(formData.get('provider') ?? '') as IntegrationProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  const enabled = formData.get('enabled') === 'on';
  const events = readEvents(formData);
  const existing = await getIntegration(provider);
  const config = mergeConfig(
    formData,
    CONFIG_KEYS[provider],
    (existing?.config as Record<string, unknown>) ?? {}
  );
  await upsertIntegration(provider, { enabled, events, config });
  invalidateRuntimeConfig();
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
      product_id: 'mothermode',
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

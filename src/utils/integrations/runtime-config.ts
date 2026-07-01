/**
 * Runtime resolver for integration credentials. Server-only: reads the
 * `integrations` table through the service role (cached briefly) and falls
 * back to environment variables. An admin can therefore configure AI, email,
 * and Stripe keys in the dashboard, while existing env-based deployments keep
 * working unchanged.
 *
 * Only ENABLED rows act as runtime overrides; a stored-but-disabled row is a
 * reference copy (matching the existing "Enabled" toggle semantics). Never
 * import this from a browser bundle — it uses the service role.
 */
import { listIntegrations } from './store';
import type { IntegrationProvider } from './types';

type ConfigMap = Record<string, Record<string, unknown>>;

const TTL_MS = 30_000;
let cache: { at: number; data: ConfigMap } | null = null;

async function loadAll(): Promise<ConfigMap> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const map: ConfigMap = {};
  try {
    const rows = await listIntegrations();
    for (const r of rows) {
      if (r.enabled) map[r.provider] = (r.config as Record<string, unknown>) ?? {};
    }
  } catch (err) {
    console.error('runtime-config.loadAll failed:', err);
  }
  cache = { at: now, data: map };
  return map;
}

/** Drop the cache so the next read reflects a just-saved change. */
export function invalidateRuntimeConfig(): void {
  cache = null;
}

/** A trimmed string from an enabled integration row, or undefined. */
async function stored(
  provider: IntegrationProvider,
  key: string,
): Promise<string | undefined> {
  const map = await loadAll();
  const v = map[provider]?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function envClean(v?: string): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** DB-first, env-fallback string resolver. */
async function resolve(
  provider: IntegrationProvider,
  key: string,
  envFallback?: string,
): Promise<string | undefined> {
  return (await stored(provider, key)) ?? envClean(envFallback);
}

// ----------------------------------------------------------------------------
// AI
// ----------------------------------------------------------------------------
export async function getOpenAiKey(): Promise<string | null> {
  return (await resolve('openai', 'api_key', process.env.OPENAI_API_KEY)) ?? null;
}

export async function getAnthropicKey(): Promise<string | null> {
  return (
    (await resolve('anthropic', 'api_key', process.env.ANTHROPIC_API_KEY)) ?? null
  );
}

export async function getImageModelOverride(): Promise<string | undefined> {
  return resolve('openai', 'image_model', process.env.MOTHERMODE_AI_IMAGE_MODEL);
}

/** Google (Gemini) key for the Nano Banana image model. Env-only: there is no
 *  `google` integration row, so it reads GEMINI_API_KEY, then GOOGLE_API_KEY. */
export async function getGoogleKey(): Promise<string | null> {
  return (
    envClean(process.env.GEMINI_API_KEY) ??
    envClean(process.env.GOOGLE_API_KEY) ??
    null
  );
}

export async function getTextModelOverride(): Promise<string | undefined> {
  return (
    (await stored('anthropic', 'text_model')) ??
    (await stored('openai', 'text_model')) ??
    envClean(process.env.MOTHERMODE_AI_TEXT_MODEL)
  );
}

export async function getTextProviderOverride(): Promise<string | undefined> {
  return (
    (await stored('openai', 'text_provider')) ??
    envClean(process.env.MOTHERMODE_AI_TEXT_PROVIDER)
  );
}

// ----------------------------------------------------------------------------
// Email
// ----------------------------------------------------------------------------
export interface EmailDelivery {
  from: string | null;
  replyTo: string | null;
  subjectPrefix: string | null;
  bcc: string[];
}

export async function getEmailDelivery(): Promise<EmailDelivery> {
  const fromEmail = await resolve('email', 'from_email', process.env.RECEIPT_FROM_EMAIL);
  const fromName = await stored('email', 'from_name');
  const from = fromEmail
    ? fromName
      ? `${fromName} <${fromEmail}>`
      : fromEmail
    : null;
  const replyTo = (await resolve('email', 'reply_to', process.env.RECEIPT_REPLY_TO)) ?? null;
  const subjectPrefix =
    (await resolve('email', 'subject_prefix', process.env.RECEIPT_SUBJECT_PREFIX)) ?? null;
  const bccRaw = (await resolve('email', 'bcc', process.env.RECEIPT_BCC)) ?? '';
  const bcc = bccRaw.split(',').map((s) => s.trim()).filter(Boolean);
  return { from, replyTo, subjectPrefix, bcc };
}

export async function getEmailProviderConfig(): Promise<{
  choice: string;
  resendKey?: string;
  postmarkToken?: string;
  postmarkStream: string;
}> {
  const choice = (
    (await resolve('email', 'provider', process.env.RECEIPT_PROVIDER)) ?? 'resend'
  ).toLowerCase();
  return {
    choice,
    resendKey: await resolve('email', 'resend_api_key', process.env.RESEND_API_KEY),
    postmarkToken: await resolve('email', 'postmark_api_token', process.env.POSTMARK_API_TOKEN),
    postmarkStream:
      (await resolve('email', 'postmark_stream', process.env.RECEIPT_POSTMARK_STREAM)) ||
      'outbound',
  };
}

// ----------------------------------------------------------------------------
// Stripe
// ----------------------------------------------------------------------------
export async function getStripeSecretKey(): Promise<string> {
  return (
    (await resolve(
      'stripe',
      'secret_key',
      process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY,
    )) ?? ''
  );
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return (
    (await resolve('stripe', 'webhook_secret', process.env.STRIPE_WEBHOOK_SECRET)) ?? null
  );
}

export async function getStripePublishableKey(): Promise<string | null> {
  return (
    (await resolve(
      'stripe',
      'publishable_key',
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    )) ?? null
  );
}

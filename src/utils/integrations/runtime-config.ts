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

/**
 * Credential-only providers: the key's presence IS the config. They have no
 * event fan-out, so the "Enabled" toggle (built for webhook dispatch) should
 * never gate whether their key is read — a saved-but-unchecked row silently
 * "not persisting" is exactly the bug this rule answers.
 *
 * Stripe belongs here: its webhook is INBOUND (Stripe → the app), not an
 * outbound fan-out the toggle gates, so the secret/publishable/webhook keys
 * are pure credentials. A saved Stripe key left "disabled" was silently
 * ignored — the checkout fell back to the env var and reported "not
 * configured" even though the key was right there in /admin/stripe.
 */
const ALWAYS_ON_PROVIDERS = new Set(['monid', 'rapidapi', 'apify', 'assemblyai', 'elevenlabs', 'stripe']);

async function loadAll(): Promise<ConfigMap> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const map: ConfigMap = {};
  try {
    const rows = await listIntegrations();
    for (const r of rows) {
      if (r.enabled || ALWAYS_ON_PROVIDERS.has(r.provider)) {
        map[r.provider] = (r.config as Record<string, unknown>) ?? {};
      }
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

/** AssemblyAI key — the DEFAULT karaoke-caption transcriber. Resolved through
 *  the integrations table first (so /admin/integrations works) and only then
 *  from env. Reading env directly here is what made a dashboard-saved key
 *  invisible and silently demoted every transcription to Whisper's 25MB cap. */
export async function getAssemblyAiKey(): Promise<string | null> {
  return (await resolve('assemblyai', 'api_key', process.env.ASSEMBLYAI_API_KEY)) ?? null;
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

/** Moonshot key for the Kimi text models. Env-only (same pattern as the
 *  Google image key): reads MOONSHOT_API_KEY, then KIMI_API_KEY. Kimi speaks
 *  the OpenAI-compatible chat API, so the generators reuse that call shape
 *  against the Moonshot base URL with this key. */
export async function getMoonshotKey(): Promise<string | null> {
  return (
    envClean(process.env.MOONSHOT_API_KEY) ??
    envClean(process.env.KIMI_API_KEY) ??
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
// Research data (Monid social scraping + RapidAPI Amazon)
// ----------------------------------------------------------------------------
export async function getMonidKey(): Promise<string | null> {
  return (await resolve('monid', 'api_key', process.env.MONID_API_KEY)) ?? null;
}

export async function getMonidBaseUrl(): Promise<string> {
  return (
    (await resolve('monid', 'base_url', process.env.MONID_BASE_URL)) ??
    'https://api.monid.ai'
  );
}

/**
 * Optional per-platform endpoint pins (x, tiktok, instagram, reddit, youtube),
 * stored as flat `endpoint_<platform>` config keys on the monid row.
 */
export async function getMonidEndpoints(): Promise<Record<string, string>> {
  const map = await loadAll();
  const cfg = map['monid'] ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (!k.startsWith('endpoint_')) continue;
    if (typeof v === 'string' && v.trim()) {
      out[k.slice('endpoint_'.length).toLowerCase()] = v.trim();
    }
  }
  return out;
}

export async function getRapidApiKey(): Promise<string | null> {
  return (
    (await resolve('rapidapi', 'api_key', process.env.RAPIDAPI_KEY)) ?? null
  );
}

export async function getRapidApiAmazonHost(): Promise<string> {
  return (
    (await resolve(
      'rapidapi',
      'amazon_host',
      process.env.RAPIDAPI_AMAZON_HOST,
    )) ?? 'real-time-amazon-data.p.rapidapi.com'
  );
}

/** Apify token — the fallback engine for Amazon review mining. */
export async function getApifyToken(): Promise<string | null> {
  return (
    (await resolve('apify', 'api_token', process.env.APIFY_API_TOKEN)) ?? null
  );
}

/** ElevenLabs key — the clone/twin voice engine. DB-first, env-fallback. */
export async function getElevenLabsKey(): Promise<string | null> {
  return (await resolve('elevenlabs', 'api_key', process.env.ELEVENLABS_API_KEY)) ?? null;
}

/** Apify reviews actor id (swappable in /admin/integrations if the default 404s). */
export async function getApifyReviewsActor(): Promise<string> {
  return (
    (await resolve(
      'apify',
      'reviews_actor',
      process.env.APIFY_REVIEWS_ACTOR,
    )) ?? 'apify/amazon-reviews-scraper'
  );
}

/**
 * Amazon engine preference: 'rapidapi' (default, RapidAPI-first with Apify
 * fallback) or 'apify' (skip RapidAPI for reviews entirely — query searches
 * still need RapidAPI /search to resolve the ASIN).
 */
export async function getAmazonEngine(): Promise<'rapidapi' | 'apify'> {
  const v = (
    (await resolve('rapidapi', 'engine', process.env.AMAZON_ENGINE)) ?? ''
  ).toLowerCase();
  return v === 'apify' ? 'apify' : 'rapidapi';
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

/**
 * The Stripe secret key for a funnel's mode. 'test' reads the test key
 * (`secret_key_test`, then the STRIPE_SECRET_KEY_TEST env); 'live' (the
 * default) reads the live key. A test-mode funnel with no test key saved
 * falls back to the live resolver — better to charge for real than to
 * silently not charge, and /admin/stripe flags the missing test key.
 */
export async function getStripeSecretKeyForMode(
  mode: 'test' | 'live',
): Promise<string> {
  if (mode === 'test') {
    // A test-mode funnel must NEVER charge the live key — the whole point is
    // the 4242 card. No test key saved = empty (the checkout says "save the
    // test key"), never the live fallback. Charging live when you meant test
    // is the dangerous surprise.
    return (
      (await resolve(
        'stripe',
        'secret_key_test',
        process.env.STRIPE_SECRET_KEY_TEST,
      )) ?? ''
    );
  }
  return getStripeSecretKey();
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

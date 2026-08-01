/**
 * Signed personalization tokens (the `?pp=` query value). Server-only.
 *
 * Format: `<base64url(JSON)>.<base64url(HMAC-SHA256)>`
 *
 * Why self-contained tokens instead of a random id: the token is a pure
 * function of (funnel, email, secret), so the same lead always mints the same
 * value. That is what lets an admin precompute tokens, upload them to the ESP
 * as a custom field (`{{contact.pp_token}}`), and have every email CTA carry a
 * per-recipient signed link without a lookup table.
 *
 * Security notes:
 *   - HMAC-SHA256 over the payload, compared timing-safe. A flipped byte
 *     anywhere in the payload or signature fails verification.
 *   - The token names an email + funnel id. It grants NO data access — it only
 *     selects which cached payload the page merges. Still, never log it raw in
 *     analytics payloads.
 *   - Optional `exp` (unix seconds) is enforced at verify time.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import {
  toTokenPayload,
  type PersonalizationTokenPayload,
} from './types';

/** Hard cap so a crafted query string can never bloat a request. */
export const MAX_TOKEN_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Secret
// ---------------------------------------------------------------------------

/**
 * Dedicated secret first, then the service-role key (already server-only), so
 * an existing deployment works with zero new env while remaining rotatable.
 */
export function personalizeSecret(): string {
  return (
    process.env.PERSONALIZE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.OPTIN_IP_SALT?.trim() ||
    'mothermode-personalize'
  );
}

// ---------------------------------------------------------------------------
// base64url helpers (node)
// ---------------------------------------------------------------------------

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(input: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  try {
    return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
  } catch {
    return null;
  }
}

function hmac(value: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(value).digest();
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

export function signPersonalizationToken(
  payload: PersonalizationTokenPayload,
  secret: string = personalizeSecret(),
): string {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(hmac(body, secret));
  return `${body}.${sig}`;
}

/**
 * Verify + parse a token. Returns the normalized payload, or null for ANY
 * failure (malformed, bad signature, expired, wrong shape). Callers treat
 * null as "no personalization" — never as an error worth a 500.
 */
export function verifyPersonalizationToken(
  token: string | null | undefined,
  secret: string = personalizeSecret(),
): PersonalizationTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) return null;

  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const body = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);

  const expected = hmac(body, secret);
  const given = b64urlDecode(sig);
  if (!given || given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  const raw = b64urlDecode(body);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }

  const payload = toTokenPayload(parsed);
  if (!payload) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Append a signed token to a funnel URL. Existing query params are preserved;
 * any previous `pp` is replaced. Returns the input unchanged when the URL is
 * unparseable (callers pass absolute or root-relative URLs).
 */
export function buildPersonalizedUrl(
  baseUrl: string,
  payload: PersonalizationTokenPayload,
  secret: string = personalizeSecret(),
): string {
  const token = signPersonalizationToken(payload, secret);
  try {
    const url = new URL(baseUrl, 'https://personalize.local');
    url.searchParams.set('pp', token);
    // Root-relative input stays root-relative.
    if (!/^https?:\/\//i.test(baseUrl)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

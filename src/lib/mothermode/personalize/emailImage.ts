/**
 * Dynamic email image — pure helpers for the signed PNG endpoint.
 *
 * The endpoint renders a branded 1200x630 PNG with per-recipient text (their
 * first name burned into the image, Hyperise-style) at REQUEST time, so an
 * ESP fills the merge field in the URL and every opener sees their own name:
 *
 *   /api/personalize/email-image?c=sales:<fid>&tpl=name-card&name={{contact.first_name}}&sig=…
 *
 * Abuse model: the signature covers the campaign + template ONLY — never the
 * dynamic text, which the ESP supplies at send time. So a valid sig proves
 * "an admin minted a URL for this funnel + template" while the text stays
 * per-recipient. The worst an attacker can do is render our brand card with
 * custom text inside length caps, rate-limited per IP. Acceptable.
 *
 * This module is pure + dependency-free EXCEPT the HMAC helpers, which use
 * node crypto and are only imported by server code (admin API + the route).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { personalizeSecret } from './token';
import type { FunnelKind } from './types';

export const EMAIL_IMAGE_TEMPLATES = ['name-card', 'note-card'] as const;
export type EmailImageTemplate = (typeof EMAIL_IMAGE_TEMPLATES)[number];

export const EMAIL_IMAGE_WIDTH = 1200;
export const EMAIL_IMAGE_HEIGHT = 630;

export const MAX_NAME_LEN = 40;
export const MAX_HEADLINE_LEN = 90;
export const MAX_SUB_LEN = 120;

/** Campaign key: '<kind>:<funnelId>'. */
export function emailImageCampaignKey(kind: FunnelKind, funnelId: string): string {
  return `${kind}:${funnelId}`;
}

export function parseCampaignKey(raw: string | null): { kind: FunnelKind; funnelId: string } | null {
  if (!raw) return null;
  const i = raw.indexOf(':');
  if (i <= 0) return null;
  const kind = raw.slice(0, i);
  const funnelId = raw.slice(i + 1).trim();
  if ((kind !== 'sales' && kind !== 'optin') || !funnelId) return null;
  return { kind, funnelId };
}

export function toEmailImageTemplate(value: unknown): EmailImageTemplate | null {
  return (EMAIL_IMAGE_TEMPLATES as readonly string[]).includes(value as string)
    ? (value as EmailImageTemplate)
    : null;
}

/**
 * Strip control chars + markup brackets, collapse whitespace, cap length.
 * The renderer (next/og) only ever draws the value as text — this is belt
 * and braces so odd ESP merge output can't break layout.
 */
export function sanitizeImageText(value: string | null, max: number): string {
  if (!value) return '';
  // An ESP merge marker that arrived unfilled ({{contact.first_name}}) must
  // fall back to empty, never render as literal field-name text on the image.
  if (/\{\{|\}\}/.test(value)) return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = value
    .replace(/[\x00-\x1f<>{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, max);
}


// ---------------------------------------------------------------------------
// Signature (covers campaign + template only — see module docstring)
// ---------------------------------------------------------------------------

export function emailImageSignature(
  campaignKey: string,
  template: EmailImageTemplate,
  secret: string = personalizeSecret(),
): string {
  return createHmac('sha256', secret)
    .update(`email-image|${campaignKey}|${template}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyEmailImageSignature(
  campaignKey: string,
  template: EmailImageTemplate,
  sig: string | null,
  secret: string = personalizeSecret(),
): boolean {
  if (!sig || !/^[a-f0-9]{32}$/i.test(sig)) return false;
  const expected = emailImageSignature(campaignKey, template, secret);
  const a = Buffer.from(sig.toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// URL builder (admin-side; ESP merge fields stay literal in the output)
// ---------------------------------------------------------------------------

export interface EmailImageUrlOptions {
  campaignKey: string;
  template: EmailImageTemplate;
  /** Literal value or an ESP merge marker like '{{contact.first_name}}'. */
  name?: string;
  headline?: string;
  sub?: string;
}

/** Build a signed endpoint path. `name` may be a merge marker, left intact. */
export function buildEmailImagePath(
  opts: EmailImageUrlOptions,
  secret: string = personalizeSecret(),
): string {
  const sig = emailImageSignature(opts.campaignKey, opts.template, secret);
  const params = new URLSearchParams();
  params.set('c', opts.campaignKey);
  params.set('tpl', opts.template);
  if (opts.name) params.set('name', opts.name);
  if (opts.headline) params.set('hl', opts.headline);
  if (opts.sub) params.set('sub', opts.sub);
  params.set('sig', sig);
  return `/api/personalize/email-image?${params.toString()}`;
}

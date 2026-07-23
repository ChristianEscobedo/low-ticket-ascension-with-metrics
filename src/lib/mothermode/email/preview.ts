/**
 * Email inbox-preview derivation (pure, unit-testable, zero server deps).
 *
 * Phase 3 of the Email Flow / Testing / Analytics plan: the "inbox preview (no
 * infra)" surface. Given a stored `EmailMessage` and a map of token values, this
 * module produces the branded HTML (through the SAME renderer the export/copy
 * buttons use) plus the token-resolved subject and preheader, and reports which
 * `{{tokens}}` the email references and which are still unfilled.
 *
 * Purity is deliberate: the modal (`EmailPreviewModal`) is a thin presentational
 * layer, and this behavior is testable without a DOM. It composes two existing
 * pure helpers — `renderEmailHtml` (brand shell + inline CSS, tokens embedded)
 * and `applyEmailTokens` (substitute / preserve tokens).
 *
 * IMPORTANT: sample values here are for PREVIEW ONLY. The export/copy paths still
 * preserve `{{tokens}}` so a downstream ESP fills them per-recipient at send time.
 */
import type { EmailMessage, EmailSequence } from './types';
import { renderEmailHtml } from './export';
import { applyEmailTokens, extractUsedTokens } from './tokens';

// ---------------------------------------------------------------------------
// Device widths
// ---------------------------------------------------------------------------

export type PreviewDevice = 'desktop' | 'mobile';

/** iframe render widths per device (px). Desktop matches the 600px email table. */
export const PREVIEW_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 640,
  mobile: 390,
};

// ---------------------------------------------------------------------------
// Sample token values
// ---------------------------------------------------------------------------

/**
 * Sample values so the preview reads like a real send. Mirrors the static
 * {@link EMAIL_MERGE_TOKENS} catalog keys. Used ONLY for preview; never for
 * export/copy (those preserve tokens for the ESP).
 */
export const SAMPLE_TOKEN_VALUES: Record<string, string> = {
  first_name: 'Jordan',
  name: 'Jordan Rivera',
  email: 'jordan@example.com',
  sender_name: 'The MotherMode Team',
  brand: 'MotherMode',
  offer_name: 'The Starter Offer',
  cta_url: 'https://example.com/go',
  unsubscribe: '#unsubscribe',
  signoff: 'Talk soon,',
  amount: '$27.00',
  currency: 'USD',
  product: 'starter-offer',
  ref: 'PREVIEW-REF',
};

/**
 * The sample base merged with (and overridden by) caller-supplied values. Later
 * keys win, so pass custom-token defaults / admin edits to override the samples.
 */
export function sampleTokenValues(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return { ...SAMPLE_TOKEN_VALUES, ...overrides };
}

// ---------------------------------------------------------------------------
// Token collection
// ---------------------------------------------------------------------------

/** Distinct token keys referenced by one email (subject / preview / body / CTA). */
export function collectEmailTokens(email: EmailMessage): string[] {
  const parts = [
    email.subject,
    email.preview,
    email.bodyText,
    email.cta?.label ?? '',
    email.cta?.url ?? '',
  ];
  const found = new Set<string>();
  for (const part of parts) {
    for (const key of extractUsedTokens(part || '')) found.add(key);
  }
  return Array.from(found);
}

/** Union of tokens referenced across every email in a sequence. */
export function collectSequenceTokens(
  sequence: EmailSequence | null | undefined,
): string[] {
  const emails = Array.isArray(sequence?.emails) ? sequence!.emails : [];
  const found = new Set<string>();
  for (const email of emails) {
    for (const key of collectEmailTokens(email)) found.add(key);
  }
  return Array.from(found);
}

// ---------------------------------------------------------------------------
// Preview render
// ---------------------------------------------------------------------------

export interface EmailPreviewResult {
  /** Token-resolved subject line (for the inbox chrome). */
  subject: string;
  /** Token-resolved preheader / preview line (for the inbox chrome). */
  preview: string;
  /** Full brand-styled HTML document with tokens resolved (HTML-escaped values). */
  html: string;
  /** Distinct tokens this email references. */
  usedTokens: string[];
  /** Referenced tokens that have no value in `values` (still literal markers). */
  unresolvedTokens: string[];
}

export interface RenderPreviewOptions {
  /**
   * Keep unfilled tokens as literal {{markers}} (default true — matches export
   * behavior so the admin can see which tokens are still unfilled). Pass false to
   * collapse unknown tokens to empty (closer to a fully-resolved transactional
   * send).
   */
  preserveUnknown?: boolean;
}

/**
 * Render one email to inbox-preview HTML plus its token-resolved subject and
 * preheader. Pure: same inputs always yield the same result.
 */
export function renderEmailPreview(
  email: EmailMessage,
  values: Record<string, string> = {},
  opts: RenderPreviewOptions = {},
): EmailPreviewResult {
  const preserveUnknown = opts.preserveUnknown ?? true;

  const rendered = renderEmailHtml(email);
  const html = applyEmailTokens(rendered, values, {
    escapeHtml: true,
    preserveUnknown,
  });
  const subject = applyEmailTokens(email.subject || '', values, { preserveUnknown });
  const preview = applyEmailTokens(email.preview || '', values, { preserveUnknown });

  const usedTokens = collectEmailTokens(email);
  const unresolvedTokens = usedTokens.filter((key) => {
    const v = values[key];
    return v === undefined || v === null || v === '';
  });

  return { subject, preview, html, usedTokens, unresolvedTokens };
}

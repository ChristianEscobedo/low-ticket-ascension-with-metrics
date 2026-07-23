/**
 * Merge-token catalog for email sequences.
 *
 * Marketing emails carry `{{token}}` markers that a downstream ESP (or our own
 * transactional sender) fills at send time with per-recipient values. The kit
 * editor surfaces this catalog as an "Available tokens" reference so an admin
 * can drop the right marker into a subject or body, and the render pipeline
 * uses {@link applyEmailTokens} to substitute (or deliberately preserve) them.
 *
 * Pure and dependency-free so the editor, the export renderers, and the tests
 * share one definition. The token syntax matches the transactional receipt
 * pipeline (`src/utils/email/render.ts`) so a sequence and a receipt speak the
 * same language.
 */

export interface EmailMergeToken {
  /** The full marker as it appears in copy, e.g. '{{first_name}}'. */
  token: string;
  /** The bare key used for lookup, e.g. 'first_name'. */
  key: string;
  /** Short human label for the picker. */
  label: string;
  /** What the token resolves to at send time. */
  description: string;
}

/**
 * The tokens a marketing sequence may use. Kept ESP-agnostic: these are the
 * stable names we render into, and the ones the editor advertises. The receipt
 * pipeline (brand/amount/currency/product/name/email/ref/signoff) is a superset
 * available on transactional sends; the marketing-first tokens come first.
 */
export const EMAIL_MERGE_TOKENS: EmailMergeToken[] = [
  {
    token: '{{first_name}}',
    key: 'first_name',
    label: 'First name',
    description: 'Recipient first name (falls back to a friendly default).',
  },
  {
    token: '{{name}}',
    key: 'name',
    label: 'Full name',
    description: 'Recipient full name.',
  },
  {
    token: '{{email}}',
    key: 'email',
    label: 'Email',
    description: 'Recipient email address.',
  },
  {
    token: '{{sender_name}}',
    key: 'sender_name',
    label: 'Sender name',
    description: 'The from-name for this sequence (intake sender, else founder).',
  },
  {
    token: '{{brand}}',
    key: 'brand',
    label: 'Brand',
    description: 'Brand name (RECEIPT_BRAND_NAME / MotherMode).',
  },
  {
    token: '{{offer_name}}',
    key: 'offer_name',
    label: 'Offer name',
    description: 'Name of the attached offer / product being promoted.',
  },
  {
    token: '{{cta_url}}',
    key: 'cta_url',
    label: 'CTA link',
    description: "This email's primary call-to-action URL.",
  },
  {
    token: '{{unsubscribe}}',
    key: 'unsubscribe',
    label: 'Unsubscribe',
    description: 'One-click unsubscribe link (required for broadcast sends).',
  },
  {
    token: '{{signoff}}',
    key: 'signoff',
    label: 'Sign-off',
    description: 'Auto-generated closing line above the sender name.',
  },
  {
    token: '{{amount}}',
    key: 'amount',
    label: 'Amount',
    description: 'Purchase amount, formatted as currency (e.g. $27.00).',
  },
  {
    token: '{{currency}}',
    key: 'currency',
    label: 'Currency',
    description: 'Uppercased currency code (e.g. USD).',
  },
  {
    token: '{{product}}',
    key: 'product',
    label: 'Product',
    description: 'Product identifier from the purchase.',
  },
  {
    token: '{{ref}}',
    key: 'ref',
    label: 'Reference',
    description: 'Payment intent / checkout session reference.',
  },
];

/** Fast lookup by bare key. */
export const EMAIL_MERGE_TOKEN_KEYS = EMAIL_MERGE_TOKENS.map((t) => t.key);

const TOKEN_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ApplyTokenOptions {
  /** HTML-escape each substituted value (use when rendering into HTML). */
  escapeHtml?: boolean;
  /**
   * When true (the default for marketing exports), tokens with no provided
   * value are left intact so a downstream ESP can fill them. When false,
   * unknown/absent tokens collapse to an empty string (transactional behavior).
   */
  preserveUnknown?: boolean;
}

/**
 * Substitute `{{token}}` markers in `text` from `values`. By default any token
 * without a value is PRESERVED (marketing export → the ESP fills it); pass
 * `preserveUnknown: false` for a fully-resolved transactional render.
 */
export function applyEmailTokens(
  text: string,
  values: Record<string, string>,
  opts: ApplyTokenOptions = {},
): string {
  const { escapeHtml: doEscape = false, preserveUnknown = true } = opts;
  return text.replace(TOKEN_RE, (match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const raw = values[key];
    if (raw === undefined || raw === null || raw === '') {
      return preserveUnknown ? match : '';
    }
    return doEscape ? escapeHtml(String(raw)) : String(raw);
  });
}

/** List the distinct tokens actually referenced by a piece of copy. */
export function extractUsedTokens(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return Array.from(found);
}

// Pure template-render primitives. Kept free of supabase / server-only
// imports so client components (the receipt template editor preview) can
// share the exact same substitution semantics as the server-side sender.

export const RECEIPT_TOKEN_KEYS = [
  'brand',
  'amount',
  'currency',
  'product',
  'name',
  'email',
  'ref',
  'signoff'
] as const;
export type ReceiptTokenKey = (typeof RECEIPT_TOKEN_KEYS)[number];

const TOKEN_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Substitute `{{token}}` markers inside `template` using values from `tokens`.
 * Unknown tokens are replaced with an empty string. When `escapeHtml` is true
 * (HTML body rendering) each substituted value is HTML-escaped so that values
 * coming from the buyer (name, product) cannot inject markup.
 */
export function renderTemplate(
  template: string,
  tokens: Record<string, string>,
  opts: { escapeHtml?: boolean } = {}
): string {
  return template.replace(TOKEN_RE, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const raw = tokens[key];
    if (raw === undefined || raw === null) return '';
    return opts.escapeHtml ? escapeHtml(String(raw)) : String(raw);
  });
}

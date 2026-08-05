/**
 * The ONE secret-redaction vocabulary for the research surface.
 *
 * Lives here (not in recipes/recap.ts) because it now guards TWO
 * boundaries with the same rules:
 *
 *   1. THE PUBLIC READ — the share-run recap masks every free-text field
 *      before a stranger can see it (recipes/recap.ts re-exports from
 *      here, so the posture can never drift into two vocabularies).
 *   2. THE ARTIFACT WRITE — `upsertArtifact` runs `redactSecrets` over
 *      title/markdown and `redactSecretsDeep` over the structured
 *      payload, so a persona (or an owner pasting into the editor) can
 *      never store a credential in the first place. Masked ON THE WAY IN
 *      means every downstream surface — the drawer, the handoffs, the
 *      recap — reads clean data without re-masking.
 *
 * Lossy ON PURPOSE: a credential shape is never worth preserving
 * verbatim. Ordinary research prose survives intact because the patterns
 * mask credential SHAPES, not words.
 */

const REDACTED = '[redacted]';

/**
 * The patterns, in replacement order. Each is deliberately narrow about
 * WHAT it masks (a credential shape, not a word) so ordinary research
 * prose survives intact.
 */
const SECRET_PATTERNS: RegExp[] = [
  // PEM private key blocks (multi-line, so first).
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  // Slack / Stripe webhook endpoints (the URL IS the secret).
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
  /https:\/\/hooks\.stripe\.com\/[A-Za-z0-9/_-]+/g,
  // Authorization header values.
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // AWS access key ids.
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
  // OpenAI / Anthropic / Google / Stripe / Slack / GitHub token shapes.
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
  // Credential-looking URL params (?key=..., &token=...).
  /([?&](?:api[-_]?key|key|token|secret|password|passwd|access[-_]?token)=)[^\s&]+/gi,
  // key:value credential pairs ("api_key: ...", 'token = "..."').
  /\b(api[-_]?key|secret|token|password|passwd|access[-_]?token)(\s*[:=]\s*)("([^"]{8,})"|'([^']{8,})'|[A-Za-z0-9._~+/=-]{12,})/gi,
];

/** Group 1 IS a credential field name (the key:value pattern captured it). */
const CREDENTIAL_NAME = /^(api[-_]?key|secret|token|password|passwd|access[-_]?token)$/i;

/**
 * Mask credential shapes out of a free-text field. Returns the text with
 * every match replaced by `[redacted]` — never throws, never truncates
 * ordinary prose. Field-name captures survive (`api_key: [redacted]` still
 * reads as a field); everything else masks whole.
 */
export function redactSecrets(text: string): string {
  if (!text) return '';
  let out = String(text);
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, ...args) => {
      const g1 = args[0];
      const g2 = args[1];
      // URL params: keep the "?key=" prefix.
      if (typeof g1 === 'string' && /^[?&]/.test(g1)) {
        return `${g1}${REDACTED}`;
      }
      // key:value pairs: keep "api_key: " (quotes dropped).
      if (
        typeof g1 === 'string' &&
        CREDENTIAL_NAME.test(g1) &&
        typeof g2 === 'string'
      ) {
        return `${g1}${g2.replace(/["']/g, '')}${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return out;
}

/** True when a free-text field carries a credential shape. */
export function containsSecrets(text: string): boolean {
  if (!text) return false;
  return redactSecrets(text) !== String(text);
}

/**
 * The artifact-write deep pass: walk a structured payload and redact every
 * STRING value (nested objects and arrays included); non-strings pass
 * through untouched. Never mutates the input — a masked payload is a NEW
 * object, so the caller's in-memory copy stays whatever it was (the store
 * writes the masked one).
 */
export function redactSecretsDeep(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactSecretsDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSecretsDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * The artifact write boundary as one pure pass (store.ts calls it; tests
 * pin it without booting supabase). Title and markdown mask whole strings;
 * structured masks deeply.
 */
export function sanitizeArtifactFields<T extends {
  title?: string;
  markdown?: string;
  structured?: Record<string, unknown>;
}>(input: T): T {
  return {
    ...input,
    title: input.title !== undefined ? redactSecrets(input.title) : undefined,
    markdown:
      input.markdown !== undefined ? redactSecrets(input.markdown) : undefined,
    structured:
      input.structured !== undefined
        ? (redactSecretsDeep(input.structured) as Record<string, unknown>)
        : undefined,
  };
}

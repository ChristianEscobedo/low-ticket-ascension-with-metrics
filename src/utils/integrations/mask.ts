/**
 * Helpers for rendering integration config in the admin UI without leaking
 * secrets to the browser. `IntegrationCard` is a client component, so anything
 * passed to it is serialised to the client — never hand it raw secret values.
 */

export interface SecretStatus {
  configured: boolean;
  last4?: string;
}

/** Last 4 visible characters of a secret, for a non-reversible "saved" hint. */
function tail(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length >= 4 ? s.slice(-4) : s.length > 0 ? '••' : undefined;
}

/**
 * Split a stored config into a browser-safe copy (secret keys removed) plus a
 * per-key status map (configured + last4) for the secret fields.
 */
export function maskConfig(
  config: Record<string, unknown> | undefined,
  secretKeys: readonly string[]
): { safeConfig: Record<string, unknown>; secretStatus: Record<string, SecretStatus> } {
  const src = config ?? {};
  const secrets = new Set(secretKeys);
  const safeConfig: Record<string, unknown> = {};
  const secretStatus: Record<string, SecretStatus> = {};
  for (const [k, v] of Object.entries(src)) {
    if (secrets.has(k)) {
      const present = typeof v === 'string' && v.trim().length > 0;
      secretStatus[k] = { configured: present, last4: present ? tail(v) : undefined };
    } else {
      safeConfig[k] = v;
    }
  }
  // Ensure a status entry exists for declared secret keys even when unset.
  for (const k of secretKeys) {
    if (!(k in secretStatus)) secretStatus[k] = { configured: false };
  }
  return { safeConfig, secretStatus };
}

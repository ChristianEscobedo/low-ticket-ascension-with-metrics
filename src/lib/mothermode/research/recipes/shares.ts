/**
 * Run share links (roadmap Phase 3, "Share Run recap"): the revocable
 * capability rows behind the public recap surface.
 *
 * THE MODEL
 * ---------
 * One row = one live public link to one run's recap. The token is `shr_` +
 * 24 random bytes (base64url) — an unguessable capability, stored PLAINTEXT
 * (the same posture as the /go short-link codes): the row IS the secret,
 * revocation is deletion, and the admin UI can always re-display the live
 * link. One live link per run (UNIQUE(run_id)): sharing twice returns the
 * same link instead of leaving a trail of half-forgotten tokens.
 *
 * The token buys exactly ONE payload shape — the composed recap (see
 * ./recap.ts), served by the unauthenticated route with no-store caching,
 * so revocation takes effect on the very next request.
 *
 * Admin-only service-role access, like every research store. Reads DEGRADE
 * (null) so a checkout running ahead of the migration never breaks the run
 * page; writes throw.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SHARES = 'mothermode_recipe_run_shares';
const SHARE_COLUMNS = 'id, run_id, token, created_at';

export interface RunShare {
  id: string;
  runId: string;
  token: string;
  createdAt: string | null;
}

export interface RunShareRow {
  id: string;
  run_id: string | null;
  token: string | null;
  created_at: string | null;
}

/** Defensive row -> share. */
export function rowToRunShare(row: RunShareRow): RunShare {
  return {
    id: row.id,
    runId: (row.run_id || '').trim(),
    token: (row.token || '').trim(),
    createdAt: row.created_at,
  };
}

/**
 * A fresh share token: `shr_` + 24 random bytes, base64url (32 chars,
 * ~144 bits). The prefix makes the capability recognizable in a clipboard
 * or a log line; the alphabet is URL-safe by construction.
 */
export function generateShareToken(): string {
  return `shr_${randomBytes(24).toString('base64url')}`;
}

/** The public recap path for a token (the admin UI prefixes its origin). */
export function shareRunUrl(token: string): string {
  return `/share/run/${(token || '').trim()}`;
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: the run's live share, or null (never shared / revoked /
 *  pre-migration checkout — the run page just shows the Share button). */
export async function getRunShare(runId: string): Promise<RunShare | null> {
  const clean = (runId || '').trim();
  if (!clean) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(SHARES)
      .select(SHARE_COLUMNS)
      .eq('run_id', clean)
      .maybeSingle();
    if (error || !data) return null;
    const share = rowToRunShare(data as RunShareRow);
    return share.token ? share : null;
  } catch {
    return null;
  }
}

/** Public read (via the recap route): which run does this token open.
 *  Null for unknown/malformed tokens AND on a failed read — a store hiccup
 *  404s the public surface, it never guesses. */
export async function getRunShareByToken(
  token: string,
): Promise<RunShare | null> {
  const clean = (token || '').trim();
  // The format gate: only plausible tokens ever hit the table (a random
  // URL slug is a cheap 404, not a query).
  if (!/^shr_[A-Za-z0-9_-]{20,64}$/.test(clean)) return null;
  try {
    const { data, error } = await (serviceClient() as any)
      .from(SHARES)
      .select(SHARE_COLUMNS)
      .eq('token', clean)
      .maybeSingle();
    if (error || !data) return null;
    const share = rowToRunShare(data as RunShareRow);
    return share.runId ? share : null;
  } catch {
    return null;
  }
}

/**
 * Share a run (admin action). IDEMPOTENT: the run's existing live link is
 * returned as-is — "Share" pressed twice never mints a second URL, and the
 * owner always sees the same link they already pasted. A UNIQUE race with
 * a concurrent share resolves to the row that landed first.
 */
export async function createRunShare(runId: string): Promise<RunShare> {
  const clean = (runId || '').trim();
  if (!clean) throw new Error('runId is required');
  const existing = await getRunShare(clean);
  if (existing) return existing;
  const { data, error } = await (serviceClient() as any)
    .from(SHARES)
    .insert({ run_id: clean, token: generateShareToken() })
    .select(SHARE_COLUMNS)
    .single();
  if (error) {
    // Lost the race with a parallel share — the winner's row is the link.
    const won = await getRunShare(clean).catch(() => null);
    if (won) return won;
    throw new Error(error.message);
  }
  return rowToRunShare(data as RunShareRow);
}

/** Revoke a run's public link (admin action): the row goes, the token 404s
 *  on its very next read (the public route serves no-store). Revoking a
 *  run that was never shared is a no-op. */
export async function revokeRunShare(runId: string): Promise<void> {
  const clean = (runId || '').trim();
  if (!clean) throw new Error('runId is required');
  const { error } = await (serviceClient() as any)
    .from(SHARES)
    .delete()
    .eq('run_id', clean);
  if (error) throw new Error(error.message);
}

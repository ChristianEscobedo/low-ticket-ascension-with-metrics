/**
 * The public recap read (server-only): token -> share row -> the admin run
 * detail -> the SANITIZED recap. This is the single composition behind the
 * unauthenticated route; everything it returns has already passed through
 * recap.ts's PII/secret posture, so the route can serialize it blindly.
 *
 * Failure discipline: unknown/revoked/malformed tokens AND a gone run all
 * return null — the route 404s. There is no "empty recap" state to guess
 * at, and a failed share read never guesses either (shares.ts degrades to
 * null, which 404s honestly rather than serving or erroring informatively).
 */
import { getRunShareByToken } from './shares';
import { getRunDetail } from './runDetail';
import { listExperts } from '../experts/store';
import { buildRunRecap, type RunRecap } from './recap';

export async function getSharedRunRecap(
  token: string,
): Promise<RunRecap | null> {
  const clean = (token || '').trim();
  if (!clean) return null;
  const share = await getRunShareByToken(clean);
  if (!share) return null;
  const [detail, experts] = await Promise.all([
    getRunDetail(share.runId),
    listExperts(),
  ]);
  // The run (or its session) was deleted after the link was minted — the
  // recap is gone with it.
  if (!detail) return null;
  return buildRunRecap({ detail, experts, sharedAt: share.createdAt });
}

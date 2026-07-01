/**
 * Browser-side wrappers for the composed-version endpoint
 * (/api/mothermode/content/versions). List a piece's saved versions, save (or
 * update) one, and delete one. Each throws a readable Error on failure so the
 * composer can surface it inline. The route is admin-gated, so these only
 * succeed for admins.
 */
import type { SavedVersion } from '@/lib/mothermode/content/versions';

const ENDPOINT = '/api/mothermode/content/versions';

async function parse(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    const msg =
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/** Every saved version for a piece within an offer. */
export async function listVersions(
  offerSlug: string,
  pieceId: string,
): Promise<SavedVersion[]> {
  const res = await fetch(
    `${ENDPOINT}?offer=${encodeURIComponent(offerSlug)}&piece=${encodeURIComponent(pieceId)}`,
  );
  const json = await parse(res);
  return Array.isArray(json.versions) ? (json.versions as SavedVersion[]) : [];
}

/** Save or update one composed version. */
export async function saveVersion(
  offerSlug: string,
  pieceId: string,
  version: SavedVersion,
): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offer: offerSlug, pieceId, version }),
  });
  await parse(res);
}

/** Delete one saved version by id. */
export async function deleteVersion(id: string): Promise<void> {
  const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parse(res);
}

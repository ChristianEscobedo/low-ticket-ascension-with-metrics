/**
 * LottieFiles public animation search — the same unauthenticated GraphQL
 * query their own site runs (searchPublicAnimations). Server-side only (the
 * /api/admin/reel-lottie route calls this); if the endpoint shifts, the route
 * degrades to an error and the UI's upload/paste paths still work.
 */

export type LottieFileResult = {
  id: string;
  name: string;
  /** The .json animation URL — attach this as the cue src. */
  jsonUrl: string;
  /** A static preview image for the picker grid (may be ''). */
  imageUrl: string;
};

const ENDPOINT = 'https://graphql.lottiefiles.com/2022-08';

/** Normalize one search edge — null when there's nothing playable. */
export function normalizeLottieFile(node: unknown): LottieFileResult | null {
  const n = node as { id?: unknown; name?: unknown; jsonUrl?: unknown; imageUrl?: unknown } | null;
  if (!n || typeof n.id !== 'string' || typeof n.jsonUrl !== 'string' || !n.jsonUrl) return null;
  return {
    id: n.id,
    name: typeof n.name === 'string' && n.name ? n.name : 'Lottie',
    jsonUrl: n.jsonUrl,
    imageUrl: typeof n.imageUrl === 'string' && n.imageUrl ? n.imageUrl : '',
  };
}

export async function searchLottieFiles(query: string, first = 16): Promise<LottieFileResult[]> {
  const limit = Math.min(24, Math.max(1, Math.round(first)));
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query { searchPublicAnimations(query: ${JSON.stringify(query)}, first: ${limit}) { edges { node { id name jsonUrl imageUrl } } } }`,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`LottieFiles search failed (${res.status})`);
  const json = (await res.json()) as {
    data?: { searchPublicAnimations?: { edges?: { node?: unknown }[] } };
  };
  const edges = json.data?.searchPublicAnimations?.edges ?? [];
  return edges.map((e) => normalizeLottieFile(e?.node)).filter((r): r is LottieFileResult => r != null);
}

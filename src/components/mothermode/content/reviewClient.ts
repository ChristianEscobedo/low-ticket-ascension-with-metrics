/**
 * Browser-side store for per-piece review state, backed by Supabase through the
 * admin-gated /api/mothermode/content/review endpoint. Reviews are loaded once
 * per offer into an in-memory cache so getReview() stays synchronous (the
 * preview reads it without a flicker), while writes update the cache optimistically
 * and persist in the background. This replaces the old localStorage module; the
 * pure merge/empty helpers are reused from the lib so behavior matches exactly.
 */
import {
  isEmptyReview,
  mergeReview,
  withImages,
  withoutImages,
  type PieceReview,
} from '@/lib/mothermode/content/review';

const ENDPOINT = '/api/mothermode/content/review';

/** offerSlug -> (pieceId -> review). Hydrated by loadReviews. */
const cache = new Map<string, Record<string, PieceReview>>();
/** In-flight/settled loads, so many cards share one network round-trip. */
const loads = new Map<string, Promise<void>>();

function bucket(offerSlug: string): Record<string, PieceReview> {
  let b = cache.get(offerSlug);
  if (!b) {
    b = {};
    cache.set(offerSlug, b);
  }
  return b;
}

/** Fetch every review for an offer into the cache. Deduped per offer; pass
 *  force to refetch (e.g. to pick up a teammate's edits). */
export function loadReviews(offerSlug: string, force = false): Promise<void> {
  if (!offerSlug) return Promise.resolve();
  const existing = loads.get(offerSlug);
  if (existing && !force) return existing;
  const p = (async () => {
    try {
      const res = await fetch(
        `${ENDPOINT}?offer=${encodeURIComponent(offerSlug)}`,
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reviews?: Record<string, PieceReview>;
      };
      if (res.ok && json.ok && json.reviews) cache.set(offerSlug, json.reviews);
      else if (!cache.has(offerSlug)) cache.set(offerSlug, {});
    } catch {
      if (!cache.has(offerSlug)) cache.set(offerSlug, {});
    }
  })();
  loads.set(offerSlug, p);
  return p;
}

/** The cached review for a piece, or an empty object. Synchronous: call
 *  loadReviews(offerSlug) first so the cache is warm. */
export function getReview(offerSlug: string, id: string): PieceReview {
  return cache.get(offerSlug)?.[id] ?? {};
}

/** Persist a piece's merged review, upserting or deleting when it empties out.
 *  Best-effort: failures are logged, never thrown, mirroring the old store. */
function persist(offerSlug: string, id: string, next: PieceReview): void {
  const b = bucket(offerSlug);
  if (isEmptyReview(next)) {
    delete b[id];
    void fetch(
      `${ENDPOINT}?offer=${encodeURIComponent(offerSlug)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ).catch((err) => console.error('[reviewClient] delete failed', err));
  } else {
    b[id] = next;
    void fetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offer: offerSlug, pieceId: id, review: next }),
    }).catch((err) => console.error('[reviewClient] save failed', err));
  }
}

/** Merge a patch into a piece's review, update the cache, and persist. Returns
 *  the new review so the caller can reflect it immediately. */
export function saveReview(
  offerSlug: string,
  id: string,
  patch: Partial<PieceReview>,
): PieceReview {
  const next = mergeReview(getReview(offerSlug, id), patch);
  persist(offerSlug, id, next);
  return next;
}

/** Replace the image gallery and active index for a piece. Returns the new
 *  review. */
export function setReviewImages(
  offerSlug: string,
  id: string,
  images: string[],
  imageIndex: number,
): PieceReview {
  const next = withImages(getReview(offerSlug, id), images, imageIndex);
  persist(offerSlug, id, next);
  return next;
}

/** Drop every image from a piece's review, keeping notes/edits/metrics. Returns
 *  the new review. */
export function clearReviewImage(offerSlug: string, id: string): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.image && !prev.images) return prev;
  const next = withoutImages(prev);
  persist(offerSlug, id, next);
  return next;
}

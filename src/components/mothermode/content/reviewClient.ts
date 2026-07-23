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
  withVideo,
  withoutVideo,
  withVideoScript,
  withoutVideoScript,
  withVoiceover,
  withoutVoiceover,
  withStoryboard,

  withoutStoryboard,
  withStoryboardBoard,
  withFramePack,
  withoutFramePack,
  withYouTubeKit,
  patchYouTubeKit,
  withoutYouTubeKit,
  type PieceReview,
  type VideoScript,
  type VideoScriptVoiceover,
  type StoryboardPack,
  type StoryboardBoard,

  type YouTubeKit,
} from '@/lib/mothermode/content/review';
import type { FramePack } from '@/lib/mothermode/content/framePack';



const ENDPOINT = '/api/mothermode/content/review';

/** offerSlug -> (pieceId -> review). Hydrated by loadReviews. */
const cache = new Map<string, Record<string, PieceReview>>();
/** In-flight/settled loads, so many cards share one network round-trip. */
const loads = new Map<string, Promise<void>>();

/** Live listeners so cards/sheets update when gallery/primary changes. */
type ReviewListener = (
  offerSlug: string,
  pieceId: string,
  review: PieceReview,
) => void;
const listeners = new Set<ReviewListener>();

/** Subscribe to review cache writes. Returns unsubscribe. */
export function subscribeReviews(fn: ReviewListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(offerSlug: string, id: string, next: PieceReview): void {
  listeners.forEach((fn) => {
    try {
      fn(offerSlug, id, next);
    } catch (err) {
      console.error('[reviewClient] listener failed', err);
    }
  });
}


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

/** Snapshot of every cached review for an offer (for bulk export). */
export function getAllReviews(offerSlug: string): Record<string, PieceReview> {
  return { ...(cache.get(offerSlug) ?? {}) };
}


/** Persist a piece's merged review, upserting or deleting when it empties out.
 *  Best-effort: failures are logged, never thrown, mirroring the old store. */
function persist(offerSlug: string, id: string, next: PieceReview): void {
  const b = bucket(offerSlug);
  if (isEmptyReview(next)) {
    delete b[id];
    notify(offerSlug, id, {});
    void fetch(
      `${ENDPOINT}?offer=${encodeURIComponent(offerSlug)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ).catch((err) => console.error('[reviewClient] delete failed', err));
  } else {
    b[id] = next;
    notify(offerSlug, id, next);
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
  const prev = getReview(offerSlug, id);
  let next = mergeReview(prev, patch);
  // Keep legacy `image` mirrored when only imageIndex changes so cards update.
  if (
    typeof patch.imageIndex === 'number' &&
    patch.image === undefined &&
    patch.images === undefined
  ) {
    const gallery = Array.isArray(next.images) ? next.images : [];
    if (gallery.length > 0) {
      const idx =
        patch.imageIndex >= 0 && patch.imageIndex < gallery.length
          ? Math.floor(patch.imageIndex)
          : 0;
      next = { ...next, imageIndex: idx, image: gallery[idx] };
    }
  }
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

/** Set the piece's uploaded final-cut video URL. Returns the new review. */
export function setReviewVideo(
  offerSlug: string,
  id: string,
  url: string,
): PieceReview {
  const next = withVideo(getReview(offerSlug, id), url);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the uploaded video, keeping everything else. Returns the new review. */
export function clearReviewVideo(offerSlug: string, id: string): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.video) return prev;
  const next = withoutVideo(prev);
  persist(offerSlug, id, next);
  return next;
}

/** Set the piece's second-by-second production script. Returns the new review. */
export function setReviewVideoScript(
  offerSlug: string,
  id: string,
  script: VideoScript,
): PieceReview {
  const next = withVideoScript(getReview(offerSlug, id), script);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the production script, keeping everything else. Returns the new review. */
export function clearReviewVideoScript(offerSlug: string, id: string): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.videoScript) return prev;
  const next = withoutVideoScript(prev);
  persist(offerSlug, id, next);
  return next;
}

/** Attach a combined-track voiceover to the piece's script. Returns the new
 *  review (unchanged when there is no script yet). */
export function setReviewVoiceover(
  offerSlug: string,
  id: string,
  voiceover: VideoScriptVoiceover,
): PieceReview {
  const next = withVoiceover(getReview(offerSlug, id), voiceover);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the combined-track voiceover, leaving per-beat clips intact. Returns the
 *  new review. */
export function clearReviewVoiceover(offerSlug: string, id: string): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.videoScript?.voiceover) return prev;
  const next = withoutVoiceover(prev);
  persist(offerSlug, id, next);
  return next;
}


/** Set the piece's connected storyboard pack. Returns the new review. */
export function setReviewStoryboard(
  offerSlug: string,
  id: string,
  pack: StoryboardPack,
): PieceReview {
  const next = withStoryboard(getReview(offerSlug, id), pack);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the storyboard pack, keeping everything else. Returns the new review. */
export function clearReviewStoryboard(
  offerSlug: string,
  id: string,
): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.storyboard) return prev;
  const next = withoutStoryboard(prev);
  persist(offerSlug, id, next);
  return next;
}

/** Patch one board in the pack (e.g. after rendering). Returns the new review. */
export function patchReviewStoryboardBoard(
  offerSlug: string,
  id: string,
  boardIndex: number,
  patch: Partial<StoryboardBoard>,
): PieceReview {
  const next = withStoryboardBoard(
    getReview(offerSlug, id),
    boardIndex,
    patch,
  );
  persist(offerSlug, id, next);
  return next;
}

/** Set the piece's multi-frame pack. Returns the new review. */
export function setReviewFramePack(
  offerSlug: string,
  id: string,
  pack: FramePack,
): PieceReview {
  const next = withFramePack(getReview(offerSlug, id), pack);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the frame pack, keeping everything else. Returns the new review. */
export function clearReviewFramePack(
  offerSlug: string,
  id: string,
): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.framePack) return prev;
  const next = withoutFramePack(prev);
  persist(offerSlug, id, next);
  return next;
}

/** Set the piece's YouTube publishing kit. Returns the new review. */
export function setReviewYouTubeKit(
  offerSlug: string,
  id: string,
  kit: YouTubeKit,
): PieceReview {
  const next = withYouTubeKit(getReview(offerSlug, id), kit);
  persist(offerSlug, id, next);
  return next;
}

/** Merge a patch into the piece's YouTube kit (e.g. edited copy or a rendered
 *  thumbnail). Returns the new review. */
export function patchReviewYouTubeKit(
  offerSlug: string,
  id: string,
  patch: Partial<YouTubeKit>,
): PieceReview {
  const next = patchYouTubeKit(getReview(offerSlug, id), patch);
  persist(offerSlug, id, next);
  return next;
}

/** Drop the YouTube kit, keeping everything else. Returns the new review. */
export function clearReviewYouTubeKit(
  offerSlug: string,
  id: string,
): PieceReview {
  const prev = getReview(offerSlug, id);
  if (!prev.youtube) return prev;
  const next = withoutYouTubeKit(prev);
  persist(offerSlug, id, next);
  return next;
}




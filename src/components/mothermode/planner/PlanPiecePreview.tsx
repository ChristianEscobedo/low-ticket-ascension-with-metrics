'use client';

/**
 * The platform preview for a planner card, rendered inside the card detail
 * drawer.
 *
 * WHY THIS IS NOT JUST `<PlatformPreview card={card} />`
 * -----------------------------------------------------
 * A planner card stores what a post *is* — title, platform, format, schedule,
 * publish state, where it points — but **not a word of its content.** There is
 * no hook, body, caption or image on `ContentPlanRecord`. So the preview cannot
 * be drawn from the card; the piece has to be resolved:
 *
 *   - the copy comes from the static catalog via `getPiece(pieceId)`;
 *   - the edits, the replacement images and the final-cut video come from the
 *     review store, because the catalog copy is the *original* and almost every
 *     piece is edited before it ships.
 *
 * Both halves are required for the preview to be true. Rendering the catalog
 * copy alone would show a post that was never sent, which is worse than showing
 * nothing — so when the review can't be loaded, that is said out loud rather
 * than quietly presented as the finished post.
 *
 * The review comes through `reviewClient` — the same cache the Content Hub's
 * sheet and cards use — not a bare `fetch`. That matters for images: the Hub
 * writes an uploaded image into this cache, and a second independent fetch here
 * would show a stale or empty frame next to a Hub that shows the new one. The
 * subscription keeps the drawer honest while it is open.
 *
 * Generated pieces (`gen_<batch>_<n>`) are not in the catalog at all: their copy
 * lives with the batch that produced them. Those get an explicit "nothing to
 * preview" state instead of an empty frame.
 */
import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getPiece } from '@/lib/mothermode/content';
import type { PieceReview } from '@/lib/mothermode/content/review';
import {
  loadReviews,
  getReview,
  subscribeReviews,
} from '@/components/mothermode/content/reviewClient';
import { PlatformPreview } from '@/components/mothermode/content/previews/PlatformPreview';

type LoadState = 'loading' | 'ready' | 'failed';

export const PlanPiecePreview: React.FC<{
  pieceId: string;
  offerSlug: string;
}> = ({ pieceId, offerSlug }) => {
  // Synchronous: the catalog is bundled, so there is no loading state for the
  // copy itself — only for the edits layered on top of it.
  const piece = getPiece(pieceId);

  const [review, setReview] = useState<PieceReview>({});
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!piece) return;
    // No offer means no review lookup is possible. Returning early here would
    // leave the spinner running forever, so it resolves to the same honest
    // state as a failed load: the copy shown is the unedited original.
    if (!offerSlug) {
      setState('failed');
      return;
    }
    let alive = true;
    setState('loading');
    loadReviews(offerSlug)
      .then(() => {
        if (!alive) return;
        setReview(getReview(offerSlug, pieceId));
        setState('ready');
      })
      .catch(() => {
        if (alive) setState('failed');
      });
    // Edits saved elsewhere (another tab, the Hub behind this drawer) land here
    // instead of going stale.
    const unsub = subscribeReviews((slug, id, next) => {
      if (alive && slug === offerSlug && id === pieceId) setReview(next);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [piece, offerSlug, pieceId]);

  if (!piece) {
    return (
      <section className="mb-5 border-t border-bone/10 pt-4">
        <h3 className="text-xs uppercase text-bone/40">Preview</h3>
        <p className="mt-2 text-xs text-bone/45">
          This piece isn&apos;t in the content catalog, so there is no copy to
          preview. Generated pieces keep their content in the batch that made
          them — open it in the Content Hub to see the post itself.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-5 border-t border-bone/10 pt-4">
      <h3 className="text-xs uppercase text-bone/40">Preview</h3>

      {state === 'loading' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-bone/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the edited
          copy...
        </div>
      )}

      {state === 'failed' && (
        <div className="mt-2 flex items-start gap-2 text-xs text-brass">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {offerSlug
              ? "Could not load this piece's edits, so the preview below is the original catalog copy — not necessarily what went out."
              : 'This card was saved without an offer, so its edits and uploaded image cannot be found. The preview below is the original catalog copy.'}
          </p>
        </div>
      )}

      {/* Rendered for 'ready' and 'failed' alike: the original copy is still
          worth seeing, as long as the line above says that's what it is. */}
      {state !== 'loading' && (
        <>
          <div className="mt-3 flex justify-center overflow-x-auto rounded-lg border border-bone/10 bg-bone/5 p-3">
            <PlatformPreview piece={piece} review={review} />
          </div>

          {/*
            The video, playable, under the frame rather than inside it.
            `PlatformPreview` paints the still image — for a reel that still is a
            thumbnail, and approving a reel from a thumbnail is approving
            something you haven't watched. Native controls only: this is a review
            surface, not a player, and autoplay in a drawer is hostile.
          */}
          {review.video && (
            <div className="mt-2">
              <video
                src={review.video}
                controls
                playsInline
                preload="metadata"
                className="max-h-[420px] w-full rounded-lg border border-bone/10 bg-black"
              />
              <p className="mt-1 text-[11px] text-bone/40">
                The final cut attached to this piece. The frame above shows the
                still image, not this video.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

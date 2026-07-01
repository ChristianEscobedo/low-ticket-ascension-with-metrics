/**
 * Server-only data access for per-piece review state (mothermode_content_review).
 * Lists every review for an offer (one round-trip to hydrate the hub), upserts a
 * piece's merged review, and removes one. The full PieceReview lives in the
 * `review` JSONB column so the client renders it exactly as before. Uses the
 * service role, so this must never be imported from a browser bundle.
 */
import { createClient } from '@supabase/supabase-js';
import type { PieceReview } from '@/lib/mothermode/content/review';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const TABLE = 'mothermode_content_review';

/** Every review for an offer, keyed by piece id, for hub hydration. */
export async function listReviews(
  offerSlug: string,
): Promise<Record<string, PieceReview>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('piece_id, review')
    .eq('offer_slug', offerSlug);
  if (error) throw new Error(error.message);
  const out: Record<string, PieceReview> = {};
  for (const row of data ?? []) {
    const r = row as { piece_id: string; review: PieceReview | null };
    if (r.piece_id && r.review) out[r.piece_id] = r.review;
  }
  return out;
}

/** Upsert a piece's full merged review. The client sends the merged object so
 *  the row mirrors exactly what the preview shows. */
export async function upsertReview(
  offerSlug: string,
  pieceId: string,
  review: PieceReview,
  updatedBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      offer_slug: offerSlug,
      piece_id: pieceId,
      review,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'offer_slug,piece_id' },
  );
  if (error) throw new Error(error.message);
}

/** Remove a piece's review entirely (used when it becomes empty). */
export async function deleteReview(
  offerSlug: string,
  pieceId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('offer_slug', offerSlug)
    .eq('piece_id', pieceId);
  if (error) throw new Error(error.message);
}

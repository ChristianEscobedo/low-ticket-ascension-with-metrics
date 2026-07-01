/**
 * Server-only data access for AI-generated content (mothermode_generated_content).
 * Persists a batch of ContentPieces, lists them back for the hub, and removes a
 * single piece or a whole batch. The full ContentPiece is stored in the `piece`
 * JSONB column so the hub renders it exactly like a static catalog piece. Uses
 * the service role, so this must never be imported from a browser bundle.
 */
import { createClient } from '@supabase/supabase-js';
import type { ContentPiece } from '@/lib/mothermode/content/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const TABLE = 'mothermode_generated_content';

/** Where a generated batch came from, recorded alongside each piece. */
export interface BatchMeta {
  batchId: string;
  offerSlug?: string | null;
  sourcePieceId?: string | null;
  guides?: string | null;
  model?: string | null;
  createdBy?: string | null;
}

/** Insert every piece of a batch as draft rows. No-op for an empty batch. */
export async function insertGeneratedBatch(
  pieces: ContentPiece[],
  meta: BatchMeta,
): Promise<void> {
  if (pieces.length === 0) return;
  const rows = pieces.map((p) => ({
    id: p.id,
    batch_id: meta.batchId,
    offer_slug: meta.offerSlug ?? null,
    source_piece_id: meta.sourcePieceId ?? null,
    platform: p.platform,
    format: p.format,
    kind: p.kind,
    tone: p.tone,
    theme: p.theme ?? null,
    title: p.title ?? null,
    piece: p,
    guides: meta.guides ?? null,
    model_used: meta.model ?? null,
    created_by: meta.createdBy ?? null,
  }));
  const { error } = await supabase.from(TABLE).insert(rows);
  if (error) throw new Error(error.message);
}

/** Every non-archived generated piece, newest first, as ContentPieces. */
export async function listGeneratedPieces(): Promise<ContentPiece[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('piece')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r: { piece: ContentPiece | null }) => r.piece)
    .filter((p): p is ContentPiece => !!p && typeof p.id === 'string');
}

/** Delete a single generated piece by id. */
export async function deleteGeneratedPiece(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Delete every piece in a batch. */
export async function deleteGeneratedBatch(batchId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('batch_id', batchId);
  if (error) throw new Error(error.message);
}

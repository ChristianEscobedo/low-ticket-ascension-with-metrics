/**
 * Server-only data access for composed versions (mothermode_content_versions).
 * Lists every saved version for a piece, upserts one, and removes one. The
 * composed post (hook/body/cta) lives in the `version` JSONB column; status,
 * schedule, and attribution live in their own columns so they are queryable.
 * Uses the service role, so this must never be imported from a browser bundle.
 */
import { createClient } from '@supabase/supabase-js';
import type {
  SavedVersion,
  VersionStatus,
} from '@/lib/mothermode/content/versions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const TABLE = 'mothermode_content_versions';

/** Shape of one row as stored, before mapping back to a SavedVersion. */
interface VersionRow {
  id: string;
  version: { hook?: string; body?: string[]; cta?: string; image?: string } | null;
  status: VersionStatus;
  scheduled_for: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Map a stored row back into the SavedVersion the client renders. */
function rowToVersion(row: VersionRow): SavedVersion {
  return {
    id: row.id,
    hook: row.version?.hook ?? '',
    body: Array.isArray(row.version?.body) ? row.version!.body : [],
    cta: row.version?.cta ?? '',
    image: row.version?.image ?? undefined,
    status: row.status,
    scheduledFor: row.scheduled_for ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by,
  };
}

/** Every saved version for a piece (or the whole offer when pieceId is omitted). */
export async function listVersions(
  offerSlug: string,
  pieceId?: string,
): Promise<SavedVersion[]> {
  let query = supabase
    .from(TABLE)
    .select('id, version, status, scheduled_for, updated_by, created_at, updated_at')
    .eq('offer_slug', offerSlug);
  if (pieceId) query = query.eq('piece_id', pieceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToVersion(r as VersionRow));
}

/** Upsert one composed version. The client sends the full SavedVersion so the
 *  row mirrors exactly what the composer shows. */
export async function upsertVersion(
  offerSlug: string,
  pieceId: string,
  version: SavedVersion,
  updatedBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      id: version.id,
      offer_slug: offerSlug,
      piece_id: pieceId,
      version: {
        hook: version.hook,
        body: version.body,
        cta: version.cta,
        ...(version.image ? { image: version.image } : {}),
      },
      status: version.status,
      scheduled_for: version.scheduledFor ?? null,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message);
}

/** Remove one saved version by id. */
export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

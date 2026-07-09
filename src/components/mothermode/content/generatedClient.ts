/**
 * Browser-side wrappers for the generated-content endpoint
 * (/api/mothermode/content/generated). Generate a batch (optionally without
 * saving), save selected pieces after review, list saved pieces, and delete
 * one. Each throws a readable Error on failure so the panel can surface it
 * inline. The route is admin-gated, so these only succeed for admins.
 */
import type { ContentPiece } from '@/lib/mothermode/content/types';
import type {
  Perspective,
  Sophistication,
} from '@/lib/mothermode/content/amplify';

const ENDPOINT = '/api/mothermode/content/generated';

/** The controls a Generate run is built from. */
export interface GenerateBatchArgs {
  offerSlug: string;
  mode: 'batch' | 'variations';
  count: number;
  platform: string;
  format: string;
  kind: 'organic' | 'ad';
  tone: string;
  theme?: string;
  guides?: string;
  /** Variations mode: the existing piece to riff on. */
  source?: ContentPiece;
  /** Optional narrative voice for the copy. */
  perspective?: Perspective;
  /** Optional market sophistication level the copy is pitched at. */
  sophistication?: Sophistication;
  /** Optional text model id. Omit/empty for Auto. */
  model?: string;
  /** Prompt style id from the Generate drawer. Omit/empty for Auto. */
  style?: string;
  /**
   * When true, the server inserts the batch immediately (Amplify full-post path).
   * When false/omitted, pieces are returned for review and nothing is saved yet.
   */
  persist?: boolean;
}

/** Args for saving a reviewed selection into the library. */
export interface SaveGeneratedBatchArgs {
  pieces: ContentPiece[];
  offerSlug?: string;
  sourcePieceId?: string;
  guides?: string;
  model?: string;
  batchId?: string;
}

async function parse(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) {
    const msg =
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Generate a batch. By default does NOT persist (review-before-library).
 * Pass persist: true to keep the Amplify one-shot save behavior.
 */
export async function generateBatch(
  args: GenerateBatchArgs,
): Promise<ContentPiece[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'generate',
      ...args,
      // Explicit default: Generate UI reviews first. Amplify passes true.
      persist: args.persist === true,
    }),
  });
  const json = await parse(res);
  return Array.isArray(json.pieces) ? (json.pieces as ContentPiece[]) : [];
}

/** Persist selected pieces after the reviewer accepts them. */
export async function saveGeneratedBatch(
  args: SaveGeneratedBatchArgs,
): Promise<ContentPiece[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'save', ...args }),
  });
  const json = await parse(res);
  return Array.isArray(json.pieces) ? (json.pieces as ContentPiece[]) : [];
}

/** Every saved generated piece, newest first. */
export async function listGenerated(): Promise<ContentPiece[]> {
  const res = await fetch(ENDPOINT, { method: 'GET' });
  const json = await parse(res);
  return Array.isArray(json.pieces) ? (json.pieces as ContentPiece[]) : [];
}

/** Delete a single generated piece by id. */
export async function deleteGenerated(id: string): Promise<void> {
  const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parse(res);
}

/**
 * The compliance pass over a single piece's live copy. It overlays the
 * reviewer's edits onto the catalog piece (so it judges exactly what the
 * preview shows), runs the shared compliance engine, and offers a
 * deterministic edits patch for the fields the editor can write back to. Pure
 * and side-effect free, so the React panel stays thin and this is unit tested.
 */
import { applyFixes } from './compliance';
import { splitParas } from './compose';
import { reviewHooks, type PieceEdits } from './review';
import type { ContentPiece } from './types';

/** The live editable copy: edits over catalog, as the preview composes it. */
export interface EditableCopy {
  hooks: string[];
  caption: string;
  body: string;
}

/** Catalog hook variants: the explicit list, else the single hook, else none. */
function catalogHooks(p: ContentPiece): string[] {
  if (p.hooks && p.hooks.length > 0) return p.hooks;
  return p.hook ? [p.hook] : [];
}

/** The copy currently in force for a piece: each edit wins over the catalog. */
export function effectiveCopy(
  piece: ContentPiece,
  edits: PieceEdits | undefined,
): EditableCopy {
  const e = edits ?? {};
  const editedHooks = reviewHooks(e);
  return {
    hooks: editedHooks.length > 0 ? editedHooks : catalogHooks(piece),
    caption: e.caption?.trim() ? e.caption : (piece.caption ?? ''),
    body: e.body?.trim() ? e.body : (piece.body ?? []).join('\n\n'),
  };
}

/**
 * A piece whose editable fields reflect the live edits, for a whole-piece
 * check. The single legacy `hook` is blanked so the report counts the active
 * hook list once, not the stale catalog hook too.
 */
export function effectivePiece(
  piece: ContentPiece,
  edits: PieceEdits | undefined,
): ContentPiece {
  const c = effectiveCopy(piece, edits);
  return {
    ...piece,
    hook: '',
    hooks: c.hooks,
    caption: c.caption,
    body: splitParas(c.body),
  };
}

/** The store fields the editor can write back to (base of a dotted path). */
const EDITABLE_BASES = ['hook', 'hooks', 'caption', 'body'];

/** True when a violation's field maps to a field the editor can fix in place. */
export function isEditableField(field: string): boolean {
  return EDITABLE_BASES.includes(field.split(/[.[]/)[0]);
}

/**
 * The deterministic fixes for a piece's editable copy, as an edits patch:
 * dashes and exclamation points removed from the hooks, caption, and body.
 * Empty when nothing changes, so the caller can skip a no-op save. Banned
 * words and ALL CAPS are never touched; those need a human or AI rewrite.
 */
export function complianceFixPatch(
  piece: ContentPiece,
  edits: PieceEdits | undefined,
): Partial<PieceEdits> {
  const c = effectiveCopy(piece, edits);
  const patch: Partial<PieceEdits> = {};
  const hooks = c.hooks.map(applyFixes);
  if (hooks.some((h, i) => h !== c.hooks[i])) patch.hooks = hooks;
  const caption = applyFixes(c.caption);
  if (caption !== c.caption) patch.caption = caption;
  const body = applyFixes(c.body);
  if (body !== c.body) patch.body = body;
  return patch;
}

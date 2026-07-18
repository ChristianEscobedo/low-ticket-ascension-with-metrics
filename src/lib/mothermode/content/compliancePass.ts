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
  adPrimaryText: string;
  adHeadline: string;
  adDescription: string;
  emailSubject: string;
  emailPreheader: string;
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
    adPrimaryText: e.adPrimaryText?.trim()
      ? e.adPrimaryText
      : (piece.ad?.primaryText ?? ''),
    adHeadline: e.adHeadline?.trim()
      ? e.adHeadline
      : (piece.ad?.headline ?? ''),
    adDescription: e.adDescription?.trim()
      ? e.adDescription
      : (piece.ad?.description ?? ''),
    emailSubject: e.emailSubject?.trim()
      ? e.emailSubject
      : (piece.email?.subject ?? ''),
    emailPreheader: e.emailPreheader?.trim()
      ? e.emailPreheader
      : (piece.email?.preheader ?? ''),
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
    ad: piece.ad
      ? {
          ...piece.ad,
          primaryText: c.adPrimaryText || piece.ad.primaryText,
          headline: c.adHeadline || piece.ad.headline,
          description: c.adDescription || piece.ad.description,
        }
      : c.adPrimaryText || c.adHeadline
        ? {
            primaryText: c.adPrimaryText,
            headline: c.adHeadline,
            description: c.adDescription || undefined,
            button: 'LEARN_MORE',
          }
        : piece.ad,
    email: piece.email
      ? {
          ...piece.email,
          subject: c.emailSubject || piece.email.subject,
          preheader: c.emailPreheader || piece.email.preheader,
        }
      : c.emailSubject
        ? {
            subject: c.emailSubject,
            preheader: c.emailPreheader || undefined,
          }
        : piece.email,
  };
}

/** The store fields the editor can write back to (base of a dotted path). */
const EDITABLE_BASES = [
  'hook',
  'hooks',
  'caption',
  'body',
  'ad',
  'email',
];

/** True when a violation's field maps to a field the editor can fix in place. */
export function isEditableField(field: string): boolean {
  const base = field.split(/[.[]/)[0];
  return EDITABLE_BASES.includes(base);
}

/**
 * The deterministic fixes for a piece's editable copy, as an edits patch:
 * dashes and exclamation points removed from hooks, caption, body, and ad/email
 * fields. Empty when nothing changes. Banned words and ALL CAPS are never
 * touched; those need a human or AI rewrite.
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

  const adPrimaryText = applyFixes(c.adPrimaryText);
  if (adPrimaryText !== c.adPrimaryText && adPrimaryText)
    patch.adPrimaryText = adPrimaryText;
  const adHeadline = applyFixes(c.adHeadline);
  if (adHeadline !== c.adHeadline && adHeadline) patch.adHeadline = adHeadline;
  const adDescription = applyFixes(c.adDescription);
  if (adDescription !== c.adDescription && adDescription)
    patch.adDescription = adDescription;

  const emailSubject = applyFixes(c.emailSubject);
  if (emailSubject !== c.emailSubject && emailSubject)
    patch.emailSubject = emailSubject;
  const emailPreheader = applyFixes(c.emailPreheader);
  if (emailPreheader !== c.emailPreheader && emailPreheader)
    patch.emailPreheader = emailPreheader;

  return patch;
}

/**
 * Map an AI compliance fix payload onto PieceEdits. Applies strip/fix hygiene
 * via applyFixes on every string field.
 */
export function aiCompliancePatchToEdits(raw: {
  hooks?: string[];
  caption?: string;
  body?: string;
  adPrimaryText?: string;
  adHeadline?: string;
  adDescription?: string;
  emailSubject?: string;
  emailPreheader?: string;
}): Partial<PieceEdits> {
  const patch: Partial<PieceEdits> = {};
  if (Array.isArray(raw.hooks) && raw.hooks.length) {
    patch.hooks = raw.hooks.map((h) => applyFixes(String(h)));
  }
  if (typeof raw.caption === 'string' && raw.caption.trim()) {
    patch.caption = applyFixes(raw.caption);
  }
  if (typeof raw.body === 'string' && raw.body.trim()) {
    patch.body = applyFixes(raw.body);
  }
  if (typeof raw.adPrimaryText === 'string' && raw.adPrimaryText.trim()) {
    patch.adPrimaryText = applyFixes(raw.adPrimaryText);
  }
  if (typeof raw.adHeadline === 'string' && raw.adHeadline.trim()) {
    patch.adHeadline = applyFixes(raw.adHeadline);
  }
  if (typeof raw.adDescription === 'string' && raw.adDescription.trim()) {
    patch.adDescription = applyFixes(raw.adDescription);
  }
  if (typeof raw.emailSubject === 'string' && raw.emailSubject.trim()) {
    patch.emailSubject = applyFixes(raw.emailSubject);
  }
  if (typeof raw.emailPreheader === 'string' && raw.emailPreheader.trim()) {
    patch.emailPreheader = applyFixes(raw.emailPreheader);
  }
  return patch;
}

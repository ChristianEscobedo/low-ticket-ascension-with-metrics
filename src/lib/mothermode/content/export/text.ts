/**
 * Build a publishable caption for planner export. Mirrors the Schedule tab's
 * assembly so Metricool / GHL get the same text a human would paste.
 */
import { CONTENT_OFFER_URL } from '../constants';
import type { ContentPiece } from '../types';
import {
  clampIndex,
  reviewHooks,
  reviewImages,
  type PieceReview,
} from '../review';
import type { SavedVersion } from '../versions';

/** Absolute http(s) only — planners reject data URLs and relative paths. */
export function isAbsoluteHttpUrl(url: string | undefined | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

/** Catalog still: prefer video poster, else image src. */
function catalogImage(piece: ContentPiece): string | undefined {
  if (!piece.media) return undefined;
  return piece.media.type === 'video' ? piece.media.poster : piece.media.src;
}

/** Catalog frames from slides, else single media. */
function catalogFrames(piece: ContentPiece): string[] {
  const fromSlides = (piece.slides ?? [])
    .map((s) => {
      const m = s.media;
      if (!m) return undefined;
      return m.type === 'video' ? m.poster : m.src;
    })
    .filter((s): s is string => Boolean(s));
  if (fromSlides.length > 0) return fromSlides;
  const single = catalogImage(piece);
  return single ? [single] : [];
}

/** Active hook after review overrides. */
export function resolveHook(
  piece: ContentPiece,
  review?: PieceReview,
  version?: SavedVersion,
): string {
  if (version?.hook?.trim()) return version.hook.trim();
  const edits = review?.edits;
  const hooks = reviewHooks(edits);
  if (hooks.length > 0) {
    const idx = clampIndex(edits?.hookIndex, hooks.length);
    return hooks[idx] ?? hooks[0];
  }
  if (piece.hooks && piece.hooks.length > 0) return piece.hooks[0];
  return piece.hook;
}

/** Body paragraphs after review / version overrides. */
export function resolveBody(
  piece: ContentPiece,
  review?: PieceReview,
  version?: SavedVersion,
): string[] {
  if (version?.body && version.body.length > 0) return version.body;
  const edited = review?.edits?.body;
  if (edited && edited.trim() !== '') {
    return edited
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return piece.body ?? [];
}

/** Caption line after review override. */
export function resolveCaption(
  piece: ContentPiece,
  review?: PieceReview,
): string | undefined {
  const edited = review?.edits?.caption;
  if (edited && edited.trim() !== '') return edited.trim();
  return piece.caption;
}

/** CTA after version override. */
export function resolveCta(
  piece: ContentPiece,
  version?: SavedVersion,
): string {
  if (version?.cta?.trim()) return version.cta.trim();
  return piece.cta;
}

/**
 * Publishable post text for social planners: opener, body, caption (when
 * distinct), CTA, link, hashtags. No production notes or SEO blocks.
 */
export function buildExportCaption(
  piece: ContentPiece,
  review?: PieceReview,
  version?: SavedVersion,
  offerUrl?: string,
): string {
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  const blocks: string[] = [];

  if (piece.ad) {
    blocks.push(piece.ad.primaryText);
    if (piece.ad.headline) blocks.push(piece.ad.headline);
    if (piece.ad.description) blocks.push(piece.ad.description);
  } else if (piece.tweets && piece.tweets.length > 0) {
    piece.tweets.forEach((t, i) => blocks.push(`${i + 1}/ ${t}`));
  } else if (piece.script && piece.script.length > 0) {
    const hook = resolveHook(piece, review, version);
    if (hook) blocks.push(hook);
    const vo = piece.script
      .map((b) => b.voiceover)
      .filter((s): s is string => !!s && s.trim() !== '');
    if (vo.length) blocks.push(vo.join('\n\n'));
    const cap = resolveCaption(piece, review);
    if (cap) blocks.push(cap);
  } else {
    const hook = resolveHook(piece, review, version);
    const caption = resolveCaption(piece, review);
    const body = resolveBody(piece, review, version);
    // Prefer caption as the full post when present; else hook + body.
    if (caption && !body.length) {
      blocks.push(caption);
    } else {
      if (hook) blocks.push(hook);
      if (body.length) blocks.push(body.join('\n\n'));
      if (caption && caption !== hook) blocks.push(caption);
    }
  }

  const cta = resolveCta(piece, version);
  if (cta) blocks.push(cta);
  if (link) blocks.push(link);
  if (piece.hashtags?.length) {
    blocks.push(piece.hashtags.map((t) => `#${t}`).join(' '));
  }

  return blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/** Collect absolute image URLs (review gallery wins, then version, then catalog). */
export function collectImageUrls(
  piece: ContentPiece,
  review?: PieceReview,
  version?: SavedVersion,
): { urls: string[]; missingMedia: boolean } {
  const candidates: string[] = [];
  if (version?.image) candidates.push(version.image);
  if (review) candidates.push(...reviewImages(review));
  candidates.push(...catalogFrames(piece));
  if (piece.media?.type === 'image' && piece.media.src) {
    candidates.push(piece.media.src);
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  let hadAny = false;
  for (const c of candidates) {
    if (!c || !c.trim()) continue;
    hadAny = true;
    if (!isAbsoluteHttpUrl(c)) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    urls.push(c);
  }
  return { urls, missingMedia: hadAny && urls.length === 0 };
}

/** Collect absolute video URLs and optional thumbnail. */
export function collectVideoUrls(
  piece: ContentPiece,
  review?: PieceReview,
): { videos: string[]; thumbnail?: string } {
  const videos: string[] = [];
  const seen = new Set<string>();
  const push = (u?: string) => {
    if (!u || !isAbsoluteHttpUrl(u) || seen.has(u)) return;
    seen.add(u);
    videos.push(u);
  };

  if (piece.media?.type === 'video') push(piece.media.src);
  for (const s of piece.slides ?? []) {
    if (s.media?.type === 'video') push(s.media.src);
  }

  const thumbCandidates = [
    ...(review ? reviewImages(review) : []),
    piece.media?.poster,
    piece.media?.type === 'image' ? piece.media.src : undefined,
  ];
  const thumbnail = thumbCandidates.find((u) => isAbsoluteHttpUrl(u));

  return { videos, thumbnail };
}

/** Resolve the outbound link for OG / pin fields. */
export function resolveLink(
  piece: ContentPiece,
  offerUrl?: string,
): string | undefined {
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  return link || undefined;
}

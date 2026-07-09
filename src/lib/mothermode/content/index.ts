/**
 * Aggregator for the MotherMode content hub. Collects every organic post, paid
 * ad, and email across channels, exposes filter helpers, and a pieceToText()
 * that renders any piece as clean copy-paste plain text. Voice rules apply: no
 * em dashes, no NO-list words.
 */
import type {
  ContentKind,
  ContentPiece,
  ContentPlatform,
  ToneRegister,
} from './types';
import {
  CONTENT_OFFER_URL,
  FORMAT_LABEL,
  PLATFORM_LABEL,
  buildImagePrompt,
} from './constants';
import { facebookContent } from './facebook';
import { instagramContent } from './instagram';
import { xContent } from './x';
import { tiktokContent } from './tiktok';
import { emailContent } from './email';
import { pinterestContent } from './pinterest';
import { blogContent } from './blog';
import { aeoContent } from './aeo';
import { adsContent } from './ads';

export * from './types';
export * from './constants';
export * from './models';
export * from './amplify';
export * from './promptStyles';
export * from './compliance';
export * from './compliancePass';
export * from './compose';
export * from './versions';
export * from './export';


/** Every piece in the hub, organic and paid, in display order. */
export const allContent: ContentPiece[] = [
  ...facebookContent,
  ...instagramContent,
  ...xContent,
  ...tiktokContent,
  ...pinterestContent,
  ...blogContent,
  ...aeoContent,
  ...emailContent,
  ...adsContent,
];

/** Optional filters for narrowing the hub down to a working set. */
export interface ContentFilter {
  platform?: ContentPlatform;
  kind?: ContentKind;
  tone?: ToneRegister;
  theme?: string;
}

/** Return the pieces that match every provided filter field. */
export function filterContent(
  filter: ContentFilter,
  pieces: ContentPiece[] = allContent,
): ContentPiece[] {
  return pieces.filter(
    (p) =>
      (!filter.platform || p.platform === filter.platform) &&
      (!filter.kind || p.kind === filter.kind) &&
      (!filter.tone || p.tone === filter.tone) &&
      (!filter.theme || p.theme === filter.theme),
  );
}

/** Look up a single piece by its stable id. */
export function getPiece(id: string): ContentPiece | undefined {
  return allContent.find((p) => p.id === id);
}

/** Flatten every readable text field of a piece into one lowercase haystack. */
function pieceHaystack(p: ContentPiece): string {
  const parts: (string | undefined)[] = [
    p.title,
    p.theme,
    p.hook,
    p.caption,
    p.cta,
    p.email?.subject,
    p.email?.preheader,
    p.email?.from,
    p.ad?.primaryText,
    p.ad?.headline,
    p.ad?.description,
    p.ad?.button,
    p.media?.alt,
    p.media?.hint,
    p.media?.prompt,
    p.seo?.metaTitle,
    p.seo?.metaDescription,
    ...(p.hooks ?? []),
    ...(p.body ?? []),
    ...(p.tweets ?? []),
    ...(p.hashtags ?? []),
    ...(p.seo?.keywords ?? []),
    ...(p.seo?.questions ?? []).flatMap((qa) => [qa.q, qa.a]),
    ...(p.slides ?? []).flatMap((s) => [s.text, s.sub]),
    ...(p.script ?? []).flatMap((b) => [b.at, b.onScreen, b.voiceover]),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Free-text search across every readable field. Whitespace-split terms are
 * matched with AND semantics, so "reel mental" returns pieces mentioning both.
 */
export function searchContent(
  query: string,
  pieces: ContentPiece[] = allContent,
): ContentPiece[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return pieces;
  return pieces.filter((p) => {
    const hay = pieceHaystack(p);
    return terms.every((t) => hay.includes(t));
  });
}

/** Count pieces per platform within a set, keyed for filter badges. */
export function countByPlatform(
  pieces: ContentPiece[] = allContent,
): Record<ContentPlatform, number> {
  const counts = {
    facebook: 0,
    instagram: 0,
    x: 0,
    tiktok: 0,
    email: 0,
    pinterest: 0,
    blog: 0,
    aeo: 0,
  } as Record<ContentPlatform, number>;
  for (const p of pieces) counts[p.platform] += 1;
  return counts;
}

/** The distinct themes present, in first-seen order, for filter chips. */
export function listThemes(pieces: ContentPiece[] = allContent): string[] {
  return Array.from(new Set(pieces.map((p) => p.theme)));
}

/** The number of calendar weeks the hub plans across. */
export const TOTAL_WEEKS = 12;

/** The week numbers in order, for the side-nav and counts. */
export const WEEKS: number[] = Array.from(
  { length: TOTAL_WEEKS },
  (_, i) => i + 1,
);

/** Stable small hash of a string, for deterministic week assignment. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * The calendar week (1-12) a piece files under. Uses the explicit `week` when
 * set and in range, otherwise derives a stable week from the id so the plan is
 * always fully populated and a piece never jumps weeks between renders.
 */
export function weekOf(piece: ContentPiece): number {
  if (
    typeof piece.week === 'number' &&
    piece.week >= 1 &&
    piece.week <= TOTAL_WEEKS
  ) {
    return piece.week;
  }
  return (hashId(piece.id) % TOTAL_WEEKS) + 1;
}

/** Count pieces per kind (organic vs ad) within a set. */
export function countByKind(
  pieces: ContentPiece[] = allContent,
): Record<ContentKind, number> {
  const counts = { organic: 0, ad: 0 } as Record<ContentKind, number>;
  for (const p of pieces) counts[p.kind] += 1;
  return counts;
}

/** Count pieces per calendar week within a set, keyed 1-12. */
export function countByWeek(
  pieces: ContentPiece[] = allContent,
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const w of WEEKS) counts[w] = 0;
  for (const p of pieces) counts[weekOf(p)] += 1;
  return counts;
}

/** The distinct platforms present, in canonical order. */
export const PLATFORM_ORDER: ContentPlatform[] = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'pinterest',
  'blog',
  'aeo',
  'email',
];

/** Group pieces by platform, preserving canonical platform order. */
export function groupByPlatform(
  pieces: ContentPiece[] = allContent,
): { platform: ContentPlatform; pieces: ContentPiece[] }[] {
  return PLATFORM_ORDER.map((platform) => ({
    platform,
    pieces: pieces.filter((p) => p.platform === platform),
  })).filter((g) => g.pieces.length > 0);
}

/** Render hashtags as a single space-joined, hashed line. */
function hashtagLine(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags.map((t) => `#${t}`).join(' ');
}

/**
 * Render any piece as clean plain text, ready to paste into a scheduler or ad
 * manager. Sections vary by format: threads number their tweets, scripts list
 * their beats, carousels and stories list their frames, ads lead with the
 * ad-manager fields.
 */
export function pieceToText(
  piece: ContentPiece,
  hook?: string,
  offerUrl?: string,
): string {
  const out: string[] = [];
  const link = piece.link ?? offerUrl ?? CONTENT_OFFER_URL;
  const opener = hook ?? piece.hooks?.[0] ?? piece.hook;

  out.push(`${PLATFORM_LABEL[piece.platform]} / ${FORMAT_LABEL[piece.format]}`);
  out.push(piece.title);
  out.push('');

  if (piece.email) {
    out.push(`SUBJECT: ${piece.email.subject}`);
    if (piece.email.preheader)
      out.push(`PREHEADER: ${piece.email.preheader}`);
    if (piece.email.from) out.push(`FROM: ${piece.email.from}`);
    out.push('');
  }

  if (piece.media) {
    const m = piece.media;
    out.push(
      `MEDIA (${m.type}): ${m.src ?? m.poster ?? 'to be produced'} [${m.alt}]`,
    );
    if (m.prompt) {
      out.push(`IMAGE PROMPT: ${buildImagePrompt(m.prompt, opener)}`);
    }
    out.push('');
  }

  if (piece.ad) {
    out.push('PRIMARY TEXT');
    out.push(piece.ad.primaryText);
    out.push('');
    out.push(`HEADLINE: ${piece.ad.headline}`);
    if (piece.ad.description) out.push(`DESCRIPTION: ${piece.ad.description}`);
    out.push(`BUTTON: ${piece.ad.button}`);
    out.push('');
  } else {
    out.push(opener);
    out.push('');
  }

  if (piece.body?.length) {
    out.push(piece.body.join('\n\n'));
    out.push('');
  }

  if (piece.tweets?.length) {
    piece.tweets.forEach((t, i) => out.push(`${i + 1}/ ${t}`));
    out.push('');
  }

  if (piece.slides?.length) {
    piece.slides.forEach((s, i) => {
      out.push(`Slide ${i + 1}: ${s.text}`);
      if (s.sub) out.push(`  ${s.sub}`);
    });
    out.push('');
  }

  if (piece.script?.length) {
    piece.script.forEach((b) => {
      out.push(b.at);
      if (b.onScreen) out.push(`  On screen: ${b.onScreen}`);
      if (b.voiceover) out.push(`  Voiceover: ${b.voiceover}`);
    });
    out.push('');
  }

  if (piece.caption) {
    out.push(`Caption: ${piece.caption}`);
    out.push('');
  }

  if (piece.seo) {
    const s = piece.seo;
    out.push('SEO');
    if (s.slug) out.push(`SLUG: ${s.slug}`);
    out.push(`META TITLE: ${s.metaTitle}`);
    out.push(`META DESCRIPTION: ${s.metaDescription}`);
    out.push(`KEYWORDS: ${s.keywords.join(', ')}`);
    if (s.questions?.length) {
      out.push('');
      out.push('AEO (questions answered)');
      s.questions.forEach((qa) => {
        out.push(`Q: ${qa.q}`);
        out.push(`A: ${qa.a}`);
      });
    }
    out.push('');
  }

  out.push(piece.cta);
  out.push(link);

  const tags = hashtagLine(piece.hashtags);
  if (tags) {
    out.push('');
    out.push(tags);
  }

  return out.join('\n').trim();
}

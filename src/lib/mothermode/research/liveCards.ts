/**
 * Live result cards (roadmap task 2.2): the structured, pinnable shape of a
 * tool result — post ladders, comment threads, review tables — carried on
 * the reasoning trace and rendered in the chat.
 *
 * Pure: no imports. The executors (agent/tools.ts) build cards with the
 * helpers here; the trace normalizer (types.ts) defends them at the JSONB
 * boundary; the workspace renders + pins from them.
 */

export type LiveCardKind = 'posts' | 'comments' | 'reviews';

export interface LiveCardItem {
  /** The caption, comment, or review body (already one-lined). */
  text: string;
  /** "12.4% engagement", "4.8k likes", "847 pts", "3★", or ''. */
  meta: string;
  /** The source URL when one exists ('' otherwise). */
  url: string;
  /** Nested lines (top comments under a post), same shape minus url. */
  lines: string[];
}

export interface LiveResultCard {
  kind: LiveCardKind;
  /** e.g. `tiktok "momlife" · 10 posts ranked`. */
  title: string;
  items: LiveCardItem[];
}

const TEXT_CAP = 240;
const LINE_CAP = 200;
const ITEM_CAP = 15;
const LINE_N_CAP = 6;

function oneLine(v: unknown, cap: number): string {
  const clean = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return clean.length <= cap ? clean : `${clean.slice(0, cap - 1)}…`;
}

function item(raw: Partial<LiveCardItem>): LiveCardItem {
  return {
    text: oneLine(raw.text, TEXT_CAP),
    meta: oneLine(raw.meta, 60),
    url: oneLine(raw.url, 400),
    lines: Array.isArray(raw.lines)
      ? raw.lines
          .filter((l): l is string => typeof l === 'string' && !!l.trim())
          .slice(0, LINE_N_CAP)
          .map((l) => oneLine(l, LINE_CAP))
      : [],
  };
}

/** Defensive normalize at the trace boundary (stored JSONB -> cards). */
export function normalizeCards(value: unknown): LiveResultCard[] {
  if (!Array.isArray(value)) return [];
  const out: LiveResultCard[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const kind = rec.kind;
    if (kind !== 'posts' && kind !== 'comments' && kind !== 'reviews') continue;
    const items = Array.isArray(rec.items)
      ? rec.items
          .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
          .slice(0, ITEM_CAP)
          .map((i) =>
            item({
              text: typeof i.text === 'string' ? i.text : '',
              meta: typeof i.meta === 'string' ? i.meta : '',
              url: typeof i.url === 'string' ? i.url : '',
              lines: Array.isArray(i.lines) ? (i.lines as string[]) : undefined,
            }),
          )
          .filter((i) => i.text)
      : [];
    if (items.length === 0) continue;
    out.push({ kind, title: oneLine(rec.title, 120), items });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builders (the executors call these with their normalized digest shapes)
// ---------------------------------------------------------------------------

export interface CardPost {
  caption: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  engagement: number | null;
  url: string | null;
  postedAt?: string | null;
  topComments?: Array<{ body: string; score: number | null }>;
}

function postMeta(p: CardPost): string {
  if (p.engagement !== null) return `${(p.engagement * 100).toFixed(1)}% engagement`;
  const parts: string[] = [];
  if (p.likes !== null) parts.push(`${p.likes.toLocaleString()} likes`);
  if (p.comments !== null) parts.push(`${p.comments.toLocaleString()} comments`);
  if (p.views !== null) parts.push(`${p.views.toLocaleString()} views`);
  return parts.join(' · ');
}

/** A post ladder (top_posts / voice_audit / voice_deep_dive). */
export function postsCard(title: string, posts: CardPost[]): LiveResultCard {
  return {
    kind: 'posts',
    title: oneLine(title, 120),
    items: posts.slice(0, ITEM_CAP).map((p) =>
      item({
        text: p.caption || '(no caption)',
        meta: postMeta(p),
        url: p.url ?? '',
        lines: (p.topComments ?? []).map(
          (c) => `${c.body}${c.score !== null ? ` (${c.score} pts)` : ''}`,
        ),
      }),
    ),
  };
}

export interface CardComment {
  body: string;
  score: number | null;
}

/** A comment thread (post_comments / reddit_deep_dive threads flattened). */
export function commentsCard(
  title: string,
  comments: CardComment[],
): LiveResultCard {
  return {
    kind: 'comments',
    title: oneLine(title, 120),
    items: comments.slice(0, ITEM_CAP).map((c) =>
      item({
        text: c.body,
        meta: c.score !== null ? `${c.score.toLocaleString()} pts` : '',
      }),
    ),
  };
}

export interface CardReview {
  stars: number | null;
  title: string;
  body: string;
}

/** A review table (amazon_reviews, low-star slice kept). */
export function reviewsCard(
  title: string,
  reviews: CardReview[],
): LiveResultCard {
  return {
    kind: 'reviews',
    title: oneLine(title, 120),
    items: reviews.slice(0, ITEM_CAP).map((r) =>
      item({
        text: r.title ? `${r.title} — ${r.body}` : r.body,
        meta: r.stars !== null ? `${r.stars}★` : '',
      }),
    ),
  };
}

/**
 * Pullpush (api.pullpush.io) — the honest reddit fallback when the paid
 * scraper gateway is down. Free, no key, and — the critical property —
 * FRIENDLY TO DATACENTER IPs, which reddit.com's own JSON endpoints are not
 * (they 403 from Vercel egress, which is why the direct fallback died too).
 *
 * Payload shapes ({data: [...]} with title/permalink/subreddit/score/
 * num_comments on submissions and body/author/score on comments) are exactly
 * what the shared normalizers in scrapeNormalize.ts already read.
 */
import {
  normalizeRedditThreads,
  normalizeRedditComments,
  type RedditThreadLite,
  type RedditCommentLite,
} from '@/lib/mothermode/research/scrapeNormalize';

const UA = 'mothermode-research-lab/1.0 (admin research tool)';
const BASE = 'https://api.pullpush.io';

export type RedditPublicResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

async function pullpushGet(path: string): Promise<RedditPublicResult<any>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Pullpush failed (${res.status}) on ${path}`,
        status: res.status,
      };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Pullpush request failed',
      status: 502,
    };
  }
}

/**
 * Search reddit for threads on a topic (optionally scoped to one subreddit),
 * then pull top comments on the strongest threads — the same digest shape as
 * the Monid path, so the tool executor prints it identically.
 */
export async function redditPublicDeepDive(opts: {
  query: string;
  subreddit?: string;
  threadLimit: number;
  commentsPerThread: number;
}): Promise<
  RedditPublicResult<{
    threads: Array<RedditThreadLite & { comments: RedditCommentLite[] }>;
  }>
> {
  const params = new URLSearchParams({
    q: opts.query,
    size: String(Math.min(25, opts.threadLimit * 3)),
    sort: 'desc',
    sort_type: 'num_comments',
  });
  if (opts.subreddit) params.set('subreddit', opts.subreddit);
  const search = await pullpushGet(`/reddit/search/submission/?${params}`);
  if (!search.ok) return search as RedditPublicResult<never>;

  const threads = normalizeRedditThreads(search.data)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, opts.threadLimit);
  if (threads.length === 0) {
    return {
      ok: false,
      error: `No reddit threads matched "${opts.query}"${opts.subreddit ? ` in r/${opts.subreddit}` : ''}.`,
      status: 404,
    };
  }

  const withComments = threads.map((t) => ({
    ...t,
    comments: [] as RedditCommentLite[],
  }));
  if (opts.commentsPerThread > 0) {
    for (const [i, thread] of Array.from(withComments.entries())) {
      if (i >= 3 || !thread.id) break; // politeness: 3 comment pulls per dive
      const listing = await pullpushGet(
        `/reddit/search/comment/?link_id=${encodeURIComponent(thread.id)}&size=${opts.commentsPerThread}&sort=desc&sort_type=score`,
      );
      if (listing.ok) {
        thread.comments = normalizeRedditComments(
          listing.data,
          opts.commentsPerThread,
        );
      }
      // Be a good API citizen between comment pulls.
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return { ok: true, data: { threads: withComments } };
}

/**
 * Pure scraper-payload normalizers for the Research Lab (Monid gateway +
 * Amazon-via-RapidAPI shapes).
 *
 * WHY THIS IS ITS OWN MODULE (same reasoning as planner/adMetrics.ts): it
 * imports NOTHING, so tests, server integrations, and any future surface can
 * share these without dragging the service-role integrations store (which
 * builds a Supabase client at module scope) into the bundle. The paid-call
 * halves live in utils/integrations/monid.ts and amazon-rapidapi.ts.
 */

// ---------------------------------------------------------------------------
// Monid gateway
// ---------------------------------------------------------------------------

export interface MonidEndpointRef {
  id: string;
  /** The backend the endpoint runs on ('apify', ...). '' = gateway default. */
  provider: string;
  name: string;
  description: string;
}

/** Normalize whatever discover returns into a flat endpoint list. */
export function normalizeDiscovered(payload: unknown): MonidEndpointRef[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.endpoints)
      ? (payload as any).endpoints
      : Array.isArray((payload as any)?.results)
        ? (payload as any).results
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];
  const out: MonidEndpointRef[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const id =
      (typeof rec.id === 'string' && rec.id) ||
      (typeof rec.endpoint === 'string' && rec.endpoint) ||
      (typeof rec.slug === 'string' && rec.slug) ||
      '';
    if (!id) continue;
    out.push({
      id,
      provider: typeof rec.provider === 'string' ? rec.provider : '',
      name: typeof rec.name === 'string' ? rec.name : id,
      description: typeof rec.description === 'string' ? rec.description : '',
    });
  }
  return out;
}

/**
 * Two different input intents, deliberately NOT one regex: a SEARCH endpoint
 * wants a phrase, a THREAD endpoint wants a URL. The earlier shared pattern
 * filled `url`/`permalink` with the search phrase, which is exactly how a
 * reddit search ends up posting "overwhelmed mom" into a thread-URL slot.
 */
const SEARCH_FIELD = /^(query|q|keyword|keywords|search|search_query|searchterm|searchterms|search_term|term|hashtag|hashtags|tag|tags|topic|username|handle|user|subreddit|sub)$/i;
const THREAD_FIELD = /^(url|permalink|post_url|thread_url|link|post|thread)$/i;
const LIMIT_FIELD = /^(limit|count|max|max_results|maxresults|max_items|maxitems|results|size|num|n|per_page|pages|items)$/i;
/** Unified social endpoints (e.g. Monid's /surf/search/social/posts) want to
 *  know WHICH platform to search — omit it and every run 400s at $0.00. */
const PLATFORM_FIELD = /^(platform|source|network|site|channel|social|social_network)$/i;
/** Plural query fields take an ARRAY on strict actors ("hashtags": ["x"],
 *  "searchTerms": ["x"]) — a bare string 400s on those same actors. */
const ARRAY_FIELD = /^(hashtags|searchterms|tags|keywords|usernames|users|profiles|subreddits|urls|starturls|start_urls)$/i;

/**
 * Best-effort fill of an endpoint's declared inputs with our query + limit.
 * `mode: 'search'` fills query-ish fields and NEVER url-ish ones (and falls
 * back to `query` when nothing matches); `mode: 'thread'` fills url-ish
 * fields with the value (which IS a thread link) and falls back to `url`.
 * Fields we can't identify are left to the endpoint's own defaults — a wrong
 * guess is worse than no value.
 */
export function mapMonidInputs(opts: {
  query: string;
  limit: number;
  schema: unknown;
  mode?: 'search' | 'thread';
  /** The social platform, for unified endpoints that take it. */
  platform?: string;
}): Record<string, unknown> {
  const mode = opts.mode ?? 'search';
  const intentField = mode === 'thread' ? THREAD_FIELD : SEARCH_FIELD;
  const fallbackKey = mode === 'thread' ? 'url' : 'query';
  const out: Record<string, unknown> = {};

  let fields: string[] = [];
  const s = opts.schema as any;
  const candidates =
    s?.input_schema?.properties ??
    s?.inputSchema?.properties ??
    s?.schema?.properties ??
    s?.inputs?.properties ??
    s?.inputs ??
    s?.parameters ??
    null;
  if (candidates && typeof candidates === 'object' && !Array.isArray(candidates)) {
    fields = Object.keys(candidates);
  } else if (Array.isArray(candidates)) {
    fields = candidates
      .map((c) =>
        c && typeof c === 'object'
          ? (c as Record<string, unknown>).name
          : undefined,
      )
      .filter((n): n is string => typeof n === 'string' && !!n);
  }

  if (fields.length === 0) {
    const base: Record<string, unknown> = {
      [fallbackKey]: opts.query,
      limit: opts.limit,
    };
    // No schema at all: a unified endpoint still needs its platform.
    if (opts.platform) base.platform = opts.platform;
    return base;
  }

  for (const field of fields) {
    if (intentField.test(field) && out[field] === undefined) {
      out[field] = ARRAY_FIELD.test(field) ? [opts.query] : opts.query;
    } else if (LIMIT_FIELD.test(field) && out[field] === undefined) {
      out[field] = opts.limit;
    } else if (
      PLATFORM_FIELD.test(field) &&
      opts.platform &&
      out[field] === undefined
    ) {
      out[field] = opts.platform;
    }
  }
  // A platform field the endpoint WANTS but we didn't map is the single most
  // common 400 on unified endpoints — always include it when provided.
  if (opts.platform && !Object.keys(out).some((k) => PLATFORM_FIELD.test(k))) {
    out.platform = opts.platform;
  }
  if (!Object.keys(out).some((k) => intentField.test(k))) {
    out[fallbackKey] = opts.query;
  }
  return out;
}

/**
 * Compact a raw endpoint payload for the model: JSON string, hard-capped.
 * Scraped payloads are huge and repetitive; the agent needs the shape and the
 * highlights, not every byte.
 */
export function compactPayload(payload: unknown, cap = 6000): string {
  let text: string;
  try {
    text = JSON.stringify(payload, null, 1);
  } catch {
    text = String(payload);
  }
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n... [truncated ${text.length - cap} chars]`;
}

// ---------------------------------------------------------------------------
// Reddit (Monid endpoints; payload shapes drift across scrapers)
// ---------------------------------------------------------------------------

export interface RedditThreadLite {
  id: string;
  title: string;
  subreddit: string;
  score: number | null;
  numComments: number | null;
  /** Absolute URL to the thread, for the comments endpoint. */
  url: string;
  /** Self-text preview (clamped), when the scraper carries it. */
  text: string;
}

/**
 * Scraper counts arrive as numbers, plain strings, or suffixed strings
 * ("1.2k", "3.4M"). Only the suffix forms get multiplied; anything else
 * unparsable is null (unknown), never 0 (a fact).
 */
export function parseScraperNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.trim().toLowerCase().match(/^([\d.,]+)\s*([km])?$/);
  if (!m) return null;
  const base = Number.parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  if (m[2] === 'k') return Math.round(base * 1000);
  if (m[2] === 'm') return Math.round(base * 1_000_000);
  return base;
}

/** Pull threads out of a reddit search/posts payload, whatever its wrapper. */
export function normalizeRedditThreads(payload: unknown): RedditThreadLite[] {
  const p = payload as any;
  const firstList = (...keys: any[]): any[] | null => {
    for (const key of keys) {
      if (Array.isArray(key)) return key;
    }
    return null;
  };
  const rawList =
    firstList(
      p?.data?.posts,
      p?.posts,
      p?.data?.children,
      p?.children,
      p?.data?.results,
      p?.results,
      p?.data?.items,
      p?.items,
      p?.data,
      p,
    ) ?? [];
  const out: RedditThreadLite[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    // Old-reddit JSON wraps each post in { kind, data }.
    const rec = ((raw as any).data && typeof (raw as any).data === 'object'
      ? (raw as any).data
      : raw) as Record<string, any>;
    const title =
      typeof rec.title === 'string'
        ? rec.title
        : typeof rec.post_title === 'string'
          ? rec.post_title
          : '';
    if (!title) continue;
    const permalink =
      typeof rec.permalink === 'string'
        ? rec.permalink
        : typeof rec.post_url === 'string'
          ? rec.post_url
          : typeof rec.url === 'string' && /reddit\.com/.test(rec.url)
            ? rec.url
            : '';
    const url = permalink
      ? permalink.startsWith('http')
        ? permalink
        : `https://www.reddit.com${permalink}`
      : '';
    out.push({
      id:
        (typeof rec.id === 'string' && rec.id) ||
        (typeof rec.post_id === 'string' && rec.post_id) ||
        url,
      title: title.replace(/\s+/g, ' ').trim(),
      subreddit:
        (typeof rec.subreddit === 'string' && rec.subreddit) ||
        (typeof rec.subreddit_name === 'string' && rec.subreddit_name) ||
        (typeof rec.community === 'string' && rec.community) ||
        '',
      score: parseScraperNum(rec.score ?? rec.upvotes ?? rec.ups),
      numComments: parseScraperNum(
        rec.num_comments ?? rec.comments ?? rec.comment_count,
      ),
      url,
      text:
        (typeof rec.selftext === 'string' ? rec.selftext : typeof rec.text === 'string' ? rec.text : '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300),
    });
  }
  return out;
}

export interface RedditCommentLite {
  author: string;
  body: string;
  score: number | null;
}

/** Pull top comments out of a thread/comments payload, whatever its wrapper. */
export function normalizeRedditComments(
  payload: unknown,
  cap = 5,
): RedditCommentLite[] {
  const p = payload as any;
  const rawList = Array.isArray(p?.data?.comments)
    ? p.data.comments
    : Array.isArray(p?.comments)
      ? p.comments
      : Array.isArray(p?.data?.children)
        ? p.data.children
        : Array.isArray(p?.children)
          ? p.children
          : Array.isArray(p?.data)
            ? p.data
            : Array.isArray(p)
              ? p
              : [];
  const out: RedditCommentLite[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = ((raw as any).data && typeof (raw as any).data === 'object'
      ? (raw as any).data
      : raw) as Record<string, any>;
    const body =
      typeof rec.body === 'string'
        ? rec.body
        : typeof rec.comment === 'string'
          ? rec.comment
          : typeof rec.text === 'string'
            ? rec.text
            : '';
    if (!body.trim()) continue;
    out.push({
      author:
        (typeof rec.author === 'string' && rec.author) ||
        (typeof rec.user === 'string' && rec.user) ||
        '',
      body: body.replace(/\s+/g, ' ').trim().slice(0, 400),
      score: parseScraperNum(rec.score ?? rec.upvotes ?? rec.ups),
    });
    if (out.length >= cap) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Social profile posts (voice audit — tiktok/instagram/x/youtube scrapers)
// ---------------------------------------------------------------------------

export interface SocialPostLite {
  id: string;
  caption: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  url: string;
  postedAt: string;
  /** Follower count of the author when the scraper carries it. */
  authorFollowers: number | null;
}

/** Lenient post mapping across apidojo/apify/tiktok/instagram shapes. */
export function normalizeSocialPosts(payload: unknown): SocialPostLite[] {
  const p = payload as any;
  const list = Array.isArray(p?.data?.posts)
    ? p.data.posts
    : Array.isArray(p?.posts)
      ? p.posts
      : Array.isArray(p?.data?.items)
        ? p.data.items
        : Array.isArray(p?.items)
          ? p.items
          : Array.isArray(p?.data)
            ? p.data
            : Array.isArray(p)
              ? p
              : [];
  const out: SocialPostLite[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, any>;
    const caption =
      (typeof rec.caption === 'string' && rec.caption) ||
      (typeof rec.text === 'string' && rec.text) ||
      (typeof rec.desc === 'string' && rec.desc) ||
      (typeof rec.title === 'string' && rec.title) ||
      '';
    const url =
      (typeof rec.url === 'string' && rec.url) ||
      (typeof rec.postUrl === 'string' && rec.postUrl) ||
      (typeof rec.videoUrl === 'string' && rec.videoUrl) ||
      (typeof rec.permalink === 'string' && rec.permalink) ||
      (typeof rec.shareUrl === 'string' && rec.shareUrl) ||
      '';
    if (!caption && !url) continue;
    const author = (rec.author ?? rec.authorMeta ?? rec.owner ?? {}) as Record<string, any>;
    out.push({
      id:
        (typeof rec.id === 'string' && rec.id) ||
        (typeof rec.postId === 'string' && rec.postId) ||
        url,
      caption: caption.replace(/\s+/g, ' ').trim().slice(0, 300),
      likes: parseScraperNum(rec.likes ?? rec.likeCount ?? rec.diggCount),
      comments: parseScraperNum(rec.comments ?? rec.commentCount),
      shares: parseScraperNum(rec.shares ?? rec.shareCount),
      views: parseScraperNum(rec.views ?? rec.playCount ?? rec.viewCount),
      url,
      postedAt:
        (typeof rec.createTimeISO === 'string' && rec.createTimeISO) ||
        (typeof rec.timestamp === 'string' && rec.timestamp) ||
        (typeof rec.takenAt === 'string' && rec.takenAt) ||
        '',
      authorFollowers: parseScraperNum(
        author.followers ?? author.followerCount ?? author.fans,
      ),
    });
  }
  return out;
}

/** (likes + comments) / followers — the honest "is this actually viral" number. */
export function engagementRate(post: SocialPostLite): number | null {
  if (!post.authorFollowers || post.authorFollowers <= 0) return null;
  const engagements = (post.likes ?? 0) + (post.comments ?? 0);
  return engagements / post.authorFollowers;
}

/**
 * The configured RapidAPI host, stripped to a bare hostname from whatever an
 * admin pastes: a full URL (`https://host/`), or the whole HEADER LINE copied
 * from RapidAPI's docs (`x-rapidapi-host: host`) — the pasted-header case
 * otherwise builds `https://x-rapidapi-host: host/...` and every call fails.
 */
export function sanitizeRapidApiHost(raw: string): string {
  let v = raw.trim();
  // Header line ("x-rapidapi-host: host") — but never the URL scheme itself.
  const headerMatch = v.match(/^([a-z0-9-]+):\s*(\S+)$/i);
  if (
    headerMatch &&
    headerMatch[1].toLowerCase() !== 'http' &&
    headerMatch[1].toLowerCase() !== 'https'
  ) {
    v = headerMatch[2];
  }
  return v
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export interface AmazonProductLite {
  asin: string;
  title: string;
  rating: number | null;
  ratingsTotal: number | null;
  price: string;
  url: string;
}

/** Pull a product list out of whatever shape the search endpoint returned. */
export function normalizeAmazonProducts(payload: unknown): AmazonProductLite[] {
  const p = payload as any;
  const list = Array.isArray(p?.data?.products)
    ? p.data.products
    : Array.isArray(p?.products)
      ? p.products
      : Array.isArray(p?.data)
        ? p.data
        : [];
  const out: AmazonProductLite[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, any>;
    const asin = typeof rec.asin === 'string' ? rec.asin.trim() : '';
    if (!asin) continue;
    out.push({
      asin,
      title: typeof rec.product_title === 'string' ? rec.product_title
        : typeof rec.title === 'string' ? rec.title : '',
      rating:
        typeof rec.product_star_rating === 'string'
          ? Number.parseFloat(rec.product_star_rating) || null
          : typeof rec.rating === 'number' ? rec.rating : null,
      ratingsTotal:
        typeof rec.product_num_ratings === 'number'
          ? rec.product_num_ratings
          : typeof rec.ratings_total === 'number' ? rec.ratings_total : null,
      price: typeof rec.product_price === 'string' ? rec.product_price : '',
      url: typeof rec.product_url === 'string' ? rec.product_url : '',
    });
  }
  return out;
}

export interface AmazonReviewLite {
  stars: number | null;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

/** Pull reviews out of whatever shape the reviews endpoint returned. */
export function normalizeAmazonReviews(payload: unknown): AmazonReviewLite[] {
  const p = payload as any;
  const list = Array.isArray(p?.data?.reviews)
    ? p.data.reviews
    : Array.isArray(p?.reviews)
      ? p.reviews
      : Array.isArray(p?.data)
        ? p.data
        : [];
  const out: AmazonReviewLite[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, any>;
    const body =
      typeof rec.review_comment === 'string'
        ? rec.review_comment
        : typeof rec.body === 'string'
          ? rec.body
          : typeof rec.review_text === 'string'
            ? rec.review_text
            : '';
    const title =
      typeof rec.review_title === 'string'
        ? rec.review_title
        : typeof rec.title === 'string'
          ? rec.title
          : '';
    if (!body && !title) continue;
    const starsRaw = rec.review_star_rating ?? rec.stars ?? rec.rating;
    out.push({
      stars:
        typeof starsRaw === 'number'
          ? starsRaw
          : typeof starsRaw === 'string'
            ? Number.parseFloat(starsRaw) || null
            : null,
      title,
      body: body.replace(/\s+/g, ' ').trim().slice(0, 400),
      date: typeof rec.review_date === 'string' ? rec.review_date : '',
      verified: rec.is_verified_purchase === true || rec.verified === true,
    });
  }
  return out;
}

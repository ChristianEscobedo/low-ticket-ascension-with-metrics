/**
 * Monid (monid.ai) — the discover -> inspect -> run scraping gateway the
 * Research Lab uses for social network data (X/Twitter, TikTok, Instagram,
 * Reddit, YouTube).
 *
 * Monid is a meta-API: endpoints are discovered by query and executed by id,
 * and every run costs money. Three consequences shape this module:
 *   1. RESULTS ARE CACHED — `social_search` results live in the research
 *      cache table, so the same platform+query never pays twice in a window.
 *   2. ENDPOINT PINS WIN — an admin can pin exact endpoint ids per platform in
 *      /admin/integrations (monid endpoint_*) to skip discovery entirely.
 *   3. INPUT MAPPING IS HEURISTIC — endpoint schemas vary, so the pure
 *      `mapMonidInputs` fills the fields that look like query/limit slots and
 *      nothing else.
 *
 * The pure payload normalizers (mapMonidInputs / normalizeDiscovered /
 * compactPayload) live in lib/mothermode/research/scrapeNormalize.ts — no
 * service-role imports — and are re-exported here for convenience.
 *
 * Server-only: reads the key through runtime-config.
 */
import {
  getMonidKey,
  getMonidBaseUrl,
  getMonidEndpoints,
} from './runtime-config';
import {
  buildCacheKey,
  readResearchCache,
  writeResearchCache,
} from '@/lib/mothermode/research/cache';
import { redditPublicDeepDive } from './reddit-public';
import {
  mapMonidInputs,
  normalizeDiscovered,
  compactPayload,
  normalizeRedditThreads,
  normalizeRedditComments,
  normalizeSocialPosts,
  engagementRate,
  type MonidEndpointRef,
  type RedditThreadLite,
  type RedditCommentLite,
  type SocialPostLite,
} from '@/lib/mothermode/research/scrapeNormalize';
import {
  rollUpCommentLanguage,
  type CommentLanguageRollup,
} from '@/lib/mothermode/research/commentLanguage';

export {
  mapMonidInputs,
  normalizeDiscovered,
  compactPayload,
  normalizeRedditThreads,
  normalizeRedditComments,
} from '@/lib/mothermode/research/scrapeNormalize';

export const MONID_PLATFORMS = [
  'x',
  'twitter',
  'tiktok',
  'instagram',
  'reddit',
  'youtube',
] as const;
export type MonidPlatform = (typeof MONID_PLATFORMS)[number];

export type MonidResult<T> =
  | { ok: true; data: T; cached?: boolean }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Raw gateway calls
// ---------------------------------------------------------------------------

async function monidFetch(
  path: '/v1/discover' | '/v1/inspect' | '/v1/run',
  body: Record<string, unknown>,
): Promise<MonidResult<unknown>> {
  const key = await getMonidKey();
  if (!key) {
    return {
      ok: false,
      error:
        'Monid is not configured. Add an API key under /admin/integrations (Monid) or set MONID_API_KEY.',
      status: 503,
    };
  }
  const base = (await getMonidBaseUrl()).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Carry the gateway's own message plus a generous body snippet — a 400
      // with a runId is a RUN failure on Monid's backend, and the reason
      // lives in this body, not in the status code.
      const snippet = JSON.stringify(json).slice(0, 600);
      return {
        ok: false,
        error:
          json?.error?.message ||
          json?.message ||
          `Monid ${path} failed (${res.status}): ${snippet}`,
        status: res.status,
      };
    }
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Monid request failed',
      status: 502,
    };
  }
}

/** Discover endpoints by natural-language query (e.g. "tiktok search posts"). */
export async function discoverMonid(
  query: string,
): Promise<MonidResult<MonidEndpointRef[]>> {
  const res = await monidFetch('/v1/discover', { query });
  if (!res.ok) return res as MonidResult<MonidEndpointRef[]>;
  return { ok: true, data: normalizeDiscovered(res.data) };
}

/**
 * Inspect an endpoint's input schema. The gateway expects the backend
 * `provider` alongside the endpoint id ('apify' when unknown — it is the
 * demonstrated backend in Monid's docs).
 */
export async function inspectMonid(
  endpoint: string,
  provider?: string,
): Promise<MonidResult<unknown>> {
  return monidFetch('/v1/inspect', {
    endpoint,
    provider: provider || 'apify',
  });
}

// ---------------------------------------------------------------------------
// Async-run polling
//
// Some Monid endpoints (the blockrun.ai-backed ones, e.g. the surf social
// search) are ASYNC under the hood: /v1/run returns {runId, status:"RUNNING"}
// and the result has to be polled for. The docs show sync runs only, so the
// poller tolerates both common poll shapes and every terminal-status variant.
// ---------------------------------------------------------------------------

const ASYNC_STATUSES = new Set(['RUNNING', 'PENDING', 'QUEUED', 'STARTING']);
const DONE_STATUSES = new Set(['COMPLETED', 'SUCCEEDED', 'DONE', 'FINISHED']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'ABORTED', 'TIMED_OUT']);

/**
 * A run can REJECT at three channels: HTTP non-2xx (handled by monidFetch),
 * an async ack (polled), and — the sneaky one — HTTP 200 with a FAILED body
 * ({runId, status:"FAILED", error:"requires: q"}), which transport-level
 * checks sail straight past. Detect it so variants still cycle.
 */
function failedPayloadError(payload: unknown): string | null {
  const p = payload as any;
  if (!p || typeof p !== 'object') return null;
  const status = typeof p.status === 'string' ? p.status.toUpperCase() : '';
  if (FAILED_STATUSES.has(status)) {
    const msg =
      (typeof p.error === 'string' && p.error) ||
      (typeof p.error?.message === 'string' && p.error.message) ||
      (typeof p.message === 'string' && p.message) ||
      '';
    return msg || `run ${status.toLowerCase()}`;
  }
  if (typeof p.error === 'string' && p.error && !ASYNC_STATUSES.has(status)) {
    return p.error;
  }
  return null;
}

function asyncRunId(payload: unknown): string | null {
  const p = payload as any;
  if (!p || typeof p !== 'object') return null;
  const status = typeof p.status === 'string' ? p.status.toUpperCase() : '';
  if (!ASYNC_STATUSES.has(status)) return null;
  const id =
    (typeof p.runId === 'string' && p.runId) ||
    (typeof p.run_id === 'string' && p.run_id) ||
    (typeof p.id === 'string' && p.id) ||
    '';
  return id || null;
}

/** Poll one async run until it completes, tolerating both poll shapes. */
async function pollMonidRun(
  runId: string,
  opts: { maxMs?: number; intervalMs?: number } = {},
): Promise<MonidResult<unknown>> {
  const key = await getMonidKey();
  if (!key) {
    return { ok: false, error: 'Monid is not configured.', status: 503 };
  }
  const base = (await getMonidBaseUrl()).replace(/\/+$/, '');
  const maxMs = opts.maxMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const started = Date.now();

  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    // Shape A: GET /v1/runs/{id}. Shape B: POST /v1/run/status {runId}.
    for (const attempt of [
      () =>
        fetch(`${base}/v1/runs/${encodeURIComponent(runId)}`, {
          headers: { authorization: `Bearer ${key}` },
        }),
      () =>
        fetch(`${base}/v1/run/status`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ runId }),
        }),
    ]) {
      try {
        const res = await attempt();
        if (res.status === 404) continue; // try the other shape
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const status =
          typeof json?.status === 'string' ? json.status.toUpperCase() : '';
        if (DONE_STATUSES.has(status) || !ASYNC_STATUSES.has(status)) {
          // Terminal (or the result payload itself): hand it back.
          const data = json?.data ?? json?.output ?? json?.result ?? json;
          return { ok: true, data };
        }
        // Still running: this shape works, poll again with it next time.
        break;
      } catch {
        /* try the other shape */
      }
    }
  }
  return {
    ok: false,
    error: `Monid run ${runId} did not finish within ${Math.round(maxMs / 1000)}s. It may still be running on their side; retry the search in a minute.`,
    status: 504,
  };
}

/** Run an endpoint with inputs (polls async runs to completion). */
export async function runMonid(
  endpoint: string,
  input: Record<string, unknown>,
  provider?: string,
): Promise<MonidResult<unknown>> {
  const ran = await monidFetch('/v1/run', {
    endpoint,
    provider: provider || 'apify',
    input,
  });
  if (!ran.ok) return ran;
  const runId = asyncRunId(ran.data);
  if (!runId) return ran;
  return pollMonidRun(runId);
}

/**
 * The unified surf endpoint (/surf/search/social/posts) is the ONLY one that
 * wants a platform field; strict actors (apify/instagram-hashtag-scraper)
 * 400 on ANY unknown field, so platform rides along ONLY on surf endpoints.
 */
function isUnifiedEndpoint(endpoint: string): boolean {
  return endpoint.toLowerCase().includes('surf');
}

/**
 * Is this run attempt a FAILURE worth cycling a variant on? Covers all three
 * channels: HTTP 400/5xx, and 200-with-FAILED-body.
 */
function attemptFailed(
  r: MonidResult<unknown>,
): { failed: boolean; retryable: boolean; error: string } {
  if (!r.ok) {
    return {
      failed: true,
      retryable: r.status === 400 || r.status >= 500,
      error: r.error,
    };
  }
  const bodyError = failedPayloadError(r.data);
  if (bodyError) return { failed: true, retryable: true, error: bodyError };
  return { failed: false, retryable: false, error: '' };
}

async function runWithVariants(opts: {
  endpoint: string;
  provider?: string;
  query: string;
  limit: number;
  /** The social platform, for unified endpoints that take it. */
  platform?: string;
  /** The heuristic-mapped input to try first. */
  primary: Record<string, unknown>;
}): Promise<{ ran: MonidResult<unknown>; viaKey: string | null }> {
  // Clean PAIRS, nothing extra: strict actors 400 on any unknown field, so
  // limit/platform only ride along where they belong. The unified surf
  // endpoint gets platform; everything else gets nothing but its own keys.
  const plat =
    opts.platform && isUnifiedEndpoint(opts.endpoint)
      ? { platform: opts.platform }
      : {};
  const shapes: Array<{ via: string; body: Record<string, unknown> }> = [
    { via: 'primary', body: opts.primary },
    { via: 'query', body: { query: opts.query, limit: opts.limit, ...plat } },
    { via: 'q', body: { q: opts.query, limit: opts.limit, ...plat } },
    {
      via: 'searchTerm',
      body: { searchTerm: opts.query, maxItems: opts.limit, ...plat },
    },
    // apidojo convention: searchTerms array + maxItems.
    {
      via: 'searchTerms',
      body: { searchTerms: [opts.query], maxItems: opts.limit, ...plat },
    },
    // apify official instagram hashtag scraper: hashtags array + maxItems.
    {
      via: 'hashtags',
      body: {
        hashtags: [opts.query.replace(/^#/, '')],
        maxItems: opts.limit,
        ...plat,
      },
    },
    { via: 'keyword', body: { keyword: opts.query, limit: opts.limit, ...plat } },
    {
      via: 'searchQuery',
      body: { searchQuery: opts.query, limit: opts.limit, ...plat },
    },
  ];
  let lastError = 'Monid run failed';
  const attempted: string[] = [];
  for (const shape of shapes) {
    attempted.push(shape.via);
    const ran = await runMonid(opts.endpoint, shape.body, opts.provider);
    const check = attemptFailed(ran);
    if (!check.failed) return { ran, viaKey: shape.via === 'primary' ? null : shape.via };
    lastError = check.error;
    if (!check.retryable) {
      return {
        ran: ran.ok ? { ok: false, error: check.error, status: 502 } : ran,
        viaKey: null,
      };
    }
  }
  return {
    ran: {
      ok: false,
      error: `${lastError} (input shapes tried: ${attempted.join(', ')})`,
      status: 400,
    },
    viaKey: null,
  };
}

// ---------------------------------------------------------------------------
// social_search — the tool-facing entry point
// ---------------------------------------------------------------------------

const PLATFORM_DISCOVERY_QUERY: Record<string, string> = {
  x: 'twitter posts search tweets',
  twitter: 'twitter posts search tweets',
  tiktok: 'tiktok search videos posts',
  instagram: 'instagram hashtag posts search',
  reddit: 'reddit search posts',
  youtube: 'youtube search videos',
};

export interface SocialSearchResult {
  platform: string;
  endpoint: string;
  endpointName: string;
  query: string;
  payloadText: string;
  /** Set when the run only succeeded with a variant input key name. */
  viaKey?: string;
}

/**
 * Search one social platform for posts about a topic. Flow: pinned endpoint
 * or discover -> inspect -> mapped run -> cached, compacted text. A failure at
 * any step returns a readable error (the agent reports it and moves on).
 */
export async function socialSearch(opts: {
  platform: string;
  query: string;
  limit?: number;
}): Promise<MonidResult<SocialSearchResult>> {
  const platform = (opts.platform || '').trim().toLowerCase();
  const query = (opts.query || '').trim();
  const limit = Math.max(1, Math.min(50, Math.round(opts.limit ?? 12)));
  if (!platform) return { ok: false, error: 'platform is required', status: 400 };
  if (!query) return { ok: false, error: 'query is required', status: 400 };

  // v2: v1 entries are async "RUNNING" acks cached as if they were results.
  const cacheKey = buildCacheKey('monid:social:v2', { platform, query, limit });
  const cached = await readResearchCache<SocialSearchResult>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  // 1. Endpoint: admin pin wins; otherwise discover.
  const pins = await getMonidEndpoints();
  let endpoint = pins[platform] || '';
  let endpointName = endpoint ? 'pinned endpoint' : '';
  let provider = '';
  if (!endpoint) {
    const discoveryQuery = PLATFORM_DISCOVERY_QUERY[platform] || `${platform} search posts`;
    const found = await discoverMonid(discoveryQuery);
    if (!found.ok) return found as MonidResult<SocialSearchResult>;
    if (found.data.length === 0) {
      return {
        ok: false,
        error: `Monid has no endpoint matching "${discoveryQuery}". Pin one under /admin/integrations (Monid).`,
        status: 404,
      };
    }
    endpoint = found.data[0].id;
    endpointName = found.data[0].name;
    provider = found.data[0].provider;
  }

  // 2. Inspect for input mapping (best-effort — run without it on failure).
  let schema: unknown = null;
  const inspected = await inspectMonid(endpoint, provider);
  if (inspected.ok) schema = inspected.data;

  // 3. Run (heuristic mapping first, key-variant cycle on a 400). Platform
  //    rides along ONLY on the unified surf endpoint — strict actors 400 on
  //    the unknown `platform` field, which was the instagram/tiktok saga.
  const input = mapMonidInputs({
    query,
    limit,
    schema,
    platform: isUnifiedEndpoint(endpoint) ? platform : undefined,
  });
  const { ran, viaKey } = await runWithVariants({
    endpoint,
    provider,
    query,
    limit,
    platform,
    primary: input,
  });
  if (!ran.ok) return ran as MonidResult<SocialSearchResult>;

  const result: SocialSearchResult = {
    platform,
    endpoint,
    endpointName,
    query,
    payloadText: compactPayload(ran.data),
    viaKey: viaKey ?? undefined,
  };
  await writeResearchCache(cacheKey, result);
  return { ok: true, data: result };
}

// ---------------------------------------------------------------------------
// Shared creator/comments lanes (voice_audit + the deep-mode tools)
// ---------------------------------------------------------------------------

/**
 * Resolve the platform's COMMENTS endpoint: admin pin first
 * (endpoint_{platform}_comments), else discover with the usual phrasings.
 * Returns null when the marketplace has none — the caller then degrades to a
 * posts-only digest, exactly like a reddit dive without a comments lane.
 */
async function resolveCommentsEndpoint(
  platform: string,
): Promise<{ endpoint: string; provider: string; schema: unknown } | null> {
  const pins = await getMonidEndpoints();
  let endpoint = pins[`${platform}_comments`] || '';
  let provider = '';
  if (!endpoint) {
    let found: MonidResult<MonidEndpointRef[]> | null = null;
    for (const q of [
      `${platform} post comments`,
      `${platform} comments scraper`,
      `${platform} video comments`,
    ]) {
      const attempt = await discoverMonid(q);
      if (attempt.ok && attempt.data.length > 0) {
        found = attempt;
        break;
      }
    }
    if (!found || found.data.length === 0) return null;
    endpoint = found.data[0].id;
    provider = found.data[0].provider;
  }
  let schema: unknown = null;
  const inspected = await inspectMonid(endpoint, provider);
  if (inspected.ok) schema = inspected.data;
  return { endpoint, provider, schema };
}

/**
 * Pull the top comments on ONE post/reel/video URL. Clean-pair variants cycle
 * on retryable failures (mapped thread-mode input first, then the bare url
 * field names comment scrapers use): a systematically wrong endpoint costs at
 * most a handful of runs, and only on the failure path.
 */
async function fetchPostComments(opts: {
  endpoint: string;
  provider: string;
  schema: unknown;
  url: string;
  limit: number;
}): Promise<RedditCommentLite[]> {
  const shapes: Array<Record<string, unknown>> = [
    mapMonidInputs({
      query: opts.url,
      limit: opts.limit,
      schema: opts.schema,
      mode: 'thread',
    }),
    { url: opts.url, limit: opts.limit },
    { postUrl: opts.url, limit: opts.limit },
    { videoUrl: opts.url, limit: opts.limit },
  ];
  for (const body of shapes) {
    const ran = await runMonid(opts.endpoint, body, opts.provider);
    const check = attemptFailed(ran);
    if (!check.failed && ran.ok) {
      return normalizeRedditComments(ran.data, opts.limit);
    }
    if (!check.retryable) break;
  }
  return [];
}

/**
 * A creator's recent posts from the profile-posts lane (pin -> discover ->
 * inspect -> mapped run with variant cycle), normalized but NOT yet ranked.
 * Shared by voice_audit (a short ladder) and voice_deep_dive (a long one).
 */
async function fetchCreatorPosts(opts: {
  handle: string;
  platform: string;
  /** How many posts to request from the endpoint (the pre-ranking pool). */
  poolSize: number;
}): Promise<MonidResult<SocialPostLite[]>> {
  const pins = await getMonidEndpoints();
  let endpoint = pins[`${opts.platform}_profile`] || pins[opts.platform] || '';
  let provider = '';
  if (!endpoint) {
    let found: MonidResult<MonidEndpointRef[]> | null = null;
    for (const q of [
      `${opts.platform} profile posts`,
      `${opts.platform} user posts scraper`,
      `${opts.platform} profile scraper`,
    ]) {
      const attempt = await discoverMonid(q);
      if (!attempt.ok) return attempt as MonidResult<SocialPostLite[]>;
      if (attempt.data.length > 0) {
        found = attempt;
        break;
      }
    }
    if (!found || found.data.length === 0) {
      return {
        ok: false,
        error: `Monid has no ${opts.platform} profile-posts endpoint. Pin one under /admin/integrations (Monid).`,
        status: 404,
      };
    }
    endpoint = found.data[0].id;
    provider = found.data[0].provider;
  }
  let schema: unknown = null;
  const inspected = await inspectMonid(endpoint, provider);
  if (inspected.ok) schema = inspected.data;

  const { ran: postsRun } = await runWithVariants({
    endpoint,
    provider,
    query: opts.handle,
    limit: opts.poolSize,
    primary: mapMonidInputs({
      query: opts.handle,
      limit: opts.poolSize,
      schema,
      mode: 'search',
    }),
  });
  if (!postsRun.ok) return postsRun as MonidResult<SocialPostLite[]>;
  return { ok: true, data: normalizeSocialPosts(postsRun.data) };
}

/** Best-first: engagement rate when followers came through, else raw. */
function rankSocialPosts(
  posts: SocialPostLite[],
  keep: number,
): VoiceAuditPost[] {
  return posts
    .map((p) => ({ ...p, engagement: engagementRate(p) }))
    .sort(
      (a, b) =>
        (b.engagement ?? (b.likes ?? 0) + (b.comments ?? 0)) -
          (a.engagement ?? (a.likes ?? 0) + (a.comments ?? 0)) ||
        (b.views ?? 0) - (a.views ?? 0),
    )
    .slice(0, keep)
    .map((p) => ({ ...p, topComments: [] as RedditCommentLite[] }));
}

// ---------------------------------------------------------------------------
// voice_audit — a creator's posts ranked by engagement + comment language
// ---------------------------------------------------------------------------

export interface VoiceAuditPost extends SocialPostLite {
  /** (likes+comments)/followers when the author count came through. */
  engagement: number | null;
  topComments: RedditCommentLite[];
}

export interface VoiceAuditDigest {
  handle: string;
  platform: string;
  posts: VoiceAuditPost[];
  /** How many comment runs landed (posts mineable for language). */
  commentsOn: number;
}

/**
 * Audit a creator's feed: recent posts ranked by engagement (rate when the
 * author's follower count came through, raw engagements otherwise), then the
 * top comments on the strongest posts. Posts say what hooks WORK; comments
 * say what the audience wants NEXT. Whole digest cached like every paid call.
 */
export async function voiceAudit(opts: {
  handle: string;
  platform: string;
  topPosts?: number;
  commentsPerPost?: number;
  /**
   * How many of the top posts to mine comments on (default 3, max 5). The
   * tool layer keeps standard sessions at 3; deep sessions may raise it.
   */
  commentPosts?: number;
}): Promise<MonidResult<VoiceAuditDigest>> {
  const handle = (opts.handle || '').trim().replace(/^@/, '');
  const platform = (opts.platform || '').trim().toLowerCase();
  // Hard ceilings are the deep-mode maxima; the tool executor enforces the
  // tighter standard caps itself (policy lives in the tool layer, not here).
  const topPosts = Math.max(1, Math.min(15, Math.round(opts.topPosts ?? 6)));
  const commentsPerPost = Math.max(
    0,
    Math.min(15, Math.round(opts.commentsPerPost ?? 5)),
  );
  const commentPosts = Math.max(
    0,
    Math.min(5, Math.round(opts.commentPosts ?? 3)),
  );
  if (!handle) return { ok: false, error: 'handle is required', status: 400 };
  if (!platform) return { ok: false, error: 'platform is required', status: 400 };

  const cacheKey = buildCacheKey('monid:voice', {
    handle,
    platform,
    topPosts,
    commentsPerPost,
    commentPosts,
  });
  const cached = await readResearchCache<VoiceAuditDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  // 1. Posts: ranked pool from the profile-posts lane (pin -> discover).
  const got = await fetchCreatorPosts({
    handle,
    platform,
    poolSize: Math.min(30, topPosts * 3),
  });
  if (!got.ok) return got as MonidResult<VoiceAuditDigest>;
  if (got.data.length === 0) {
    return {
      ok: false,
      error: `No posts normalized for @${handle} on ${platform}. The handle may be wrong, the account private, or the endpoint shape unexpected.`,
      status: 404,
    };
  }
  const ranked = rankSocialPosts(got.data, topPosts);

  // 2. Comments on the strongest posts (best-effort, capped runs).
  let commentsOn = 0;
  if (commentsPerPost > 0 && commentPosts > 0) {
    const lane = await resolveCommentsEndpoint(platform);
    if (lane) {
      for (const [i, post] of Array.from(ranked.entries())) {
        if (i >= commentPosts || !post.url) break; // comments cost a run each
        post.topComments = await fetchPostComments({
          endpoint: lane.endpoint,
          provider: lane.provider,
          schema: lane.schema,
          url: post.url,
          limit: commentsPerPost,
        });
        if (post.topComments.length > 0) commentsOn++;
      }
    }
  }

  const digest: VoiceAuditDigest = {
    handle,
    platform,
    posts: ranked,
    commentsOn,
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

export interface RedditDigestThread extends RedditThreadLite {
  comments: RedditCommentLite[];
}

export interface RedditDigest {
  query: string;
  threads: RedditDigestThread[];
  /** null when Monid has no comments endpoint (posts-only digest). */
  commentsEndpoint: string | null;
  /**
   * Set when the endpoint ran but the normalizer found no threads: a compact
   * preview of the RAW payload, so the agent still gets the language from a
   * paid run instead of a dead "no threads" error.
   */
  rawPreview?: string;
}

/**
 * Mine Reddit for a topic: search threads (optionally scoped to a subreddit),
 * then pull the top comments on the strongest threads. The comments are where
 * the pain language lives, so a posts-only digest is the degraded path, never
 * the goal. Whole digest cached like every other paid call.
 */
export async function redditDeepDive(opts: {
  query: string;
  subreddit?: string;
  threadLimit?: number;
  commentsPerThread?: number;
}): Promise<MonidResult<RedditDigest>> {
  const query = (opts.query || '').trim();
  const subreddit = (opts.subreddit || '').trim().replace(/^r\//i, '');
  const threadLimit = Math.max(
    1,
    Math.min(10, Math.round(opts.threadLimit ?? 5)),
  );
  const commentsPerThread = Math.max(
    0,
    Math.min(10, Math.round(opts.commentsPerThread ?? 4)),
  );
  if (!query) return { ok: false, error: 'query is required', status: 400 };

  // v2: v1 entries are async "RUNNING" acks cached as if they were results.
  const cacheKey = buildCacheKey('monid:reddit:v2', {
    query,
    subreddit,
    threadLimit,
    commentsPerThread,
  });
  const cached = await readResearchCache<RedditDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  // 1. Threads: pinned endpoint wins, else discover a reddit search endpoint.
  //    Discovery tries several phrasings — the marketplace names these
  //    endpoints inconsistently, and one query returning nothing should not
  //    read as "reddit is down".
  const pins = await getMonidEndpoints();
  let postsEndpoint = pins['reddit'] || '';
  let postsProvider = '';
  if (!postsEndpoint) {
    let found: MonidResult<MonidEndpointRef[]> | null = null;
    for (const q of [
      'reddit search posts',
      'reddit posts subreddit',
      'reddit scraper search',
    ]) {
      const attempt = await discoverMonid(q);
      if (!attempt.ok) return attempt as MonidResult<RedditDigest>;
      if (attempt.data.length > 0) {
        found = attempt;
        break;
      }
    }
    if (!found || found.data.length === 0) {
      return {
        ok: false,
        error:
          'Monid has no reddit search endpoint. Pin one under /admin/integrations (Monid).',
        status: 404,
      };
    }
    postsEndpoint = found.data[0].id;
    postsProvider = found.data[0].provider;
  }
  let postsSchema: unknown = null;
  const inspected = await inspectMonid(postsEndpoint, postsProvider);
  if (inspected.ok) postsSchema = inspected.data;

  const runPosts = async (q: string) => {
    const { ran } = await runWithVariants({
      endpoint: postsEndpoint,
      provider: postsProvider,
      query: q,
      limit: threadLimit * 2,
      platform: 'reddit',
      primary: mapMonidInputs({
        query: q,
        limit: threadLimit * 2,
        schema: postsSchema,
        mode: 'search',
        platform: isUnifiedEndpoint(postsEndpoint) ? 'reddit' : undefined,
      }),
    });
    return ran;
  };

  const searchQuery = subreddit ? `${query} subreddit:${subreddit}` : query;
  let postsRun = await runPosts(searchQuery);

  // Last-resort for a persistent 400: many reddit scrapers take a URL, not a
  // phrase — hand it a real reddit search URL.
  if (!postsRun.ok && postsRun.status === 400) {
    const searchUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;
    for (const shape of [
      { url: searchUrl },
      { startUrls: [searchUrl] },
      { urls: [searchUrl] },
    ]) {
      const retry = await runMonid(postsEndpoint, shape, postsProvider);
      if (retry.ok) {
        postsRun = retry;
        break;
      }
      if (retry.status !== 400) {
        postsRun = retry;
        break;
      }
    }
  }
  if (!postsRun.ok) {
    // THE HONEST FALLBACK: reddit's own public JSON API needs no key and no
    // gateway. A paid-source outage never blocks the dive.
    const fallback = await redditPublicDeepDive({
      query,
      subreddit: subreddit || undefined,
      threadLimit,
      commentsPerThread,
    });
    if (fallback.ok) {
      const digest: RedditDigest = {
        query: searchQuery,
        threads: fallback.data.threads,
        commentsEndpoint: 'reddit-public-json',
      };
      await writeResearchCache(cacheKey, digest);
      return { ok: true, data: digest };
    }
    // Both legs failed: name BOTH, so the trace shows which one died and why.
    const monidError = postsRun.ok ? '' : postsRun.error;
    return {
      ok: false,
      error: `Monid: ${monidError} | pullpush: ${fallback.error}`,
      status: 502,
    };
  }
  let threads = normalizeRedditThreads(postsRun.data);
  let lastData = postsRun.data;

  // A subreddit-scoped search that comes up empty retries WITHOUT the scope:
  // scrapers do not all speak Reddit's `subreddit:` query syntax.
  if (threads.length === 0 && subreddit) {
    const retry = await runPosts(query);
    if (retry.ok) {
      threads = normalizeRedditThreads(retry.data);
      lastData = retry.data;
    }
  }

  threads = threads
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, threadLimit);

  if (threads.length === 0) {
    // The paid source returned NOTHING USABLE. Empty results fall back to the
    // free pullpush lane too — a Monid "success" with garbage in it is still
    // an outage as far as the agent is concerned. Try the full query, then
    // its first word when multi-word. (Single-word queries were skipping this
    // entirely before, which is why reddit "found no data".)
    for (const attempt of [
      { q: query, label: '' },
      ...(query.includes(' ')
        ? [{ q: query.split(/\s+/)[0], label: ` (broadened to "${query.split(/\s+/)[0]}")` }]
        : []),
    ]) {
      const retry = await redditPublicDeepDive({
        query: attempt.q,
        subreddit: subreddit || undefined,
        threadLimit,
        commentsPerThread,
      });
      if (retry.ok) {
        const digest: RedditDigest = {
          query: `${searchQuery}${attempt.label}`,
          threads: retry.data.threads,
          commentsEndpoint: 'reddit-public-json',
        };
        await writeResearchCache(cacheKey, digest);
        return { ok: true, data: digest };
      }
    }
    // Never waste a paid run on a bare 404: hand the agent the raw payload so
    // it can still read whatever the endpoint actually returned (and say so).
    // Deliberately NOT cached: a 7-day cache of "nothing normalized" pins the
    // source as broken long after it recovered.
    const digest: RedditDigest = {
      query: searchQuery,
      threads: [],
      commentsEndpoint: null,
      rawPreview: compactPayload(lastData, 3000),
    };
    return { ok: true, data: digest };
  }

  // 2. Comments on the strongest threads (best-effort: a Monid without a
  //    comments endpoint just yields a posts-only digest).
  let commentsEndpoint: string | null = null;
  const withComments: RedditDigestThread[] = threads.map((t) => ({
    ...t,
    comments: [],
  }));
  if (commentsPerThread > 0) {
    let found: MonidResult<MonidEndpointRef[]> | null = null;
    for (const q of ['reddit post comments', 'reddit comments thread', 'reddit comments']) {
      const attempt = await discoverMonid(q);
      if (attempt.ok && attempt.data.length > 0) {
        found = attempt;
        break;
      }
    }
    if (found && found.data.length > 0) {
      commentsEndpoint = found.data[0].id;
      const commentsProvider = found.data[0].provider;
      let commentsSchema: unknown = null;
      const cInspected = await inspectMonid(commentsEndpoint, commentsProvider);
      if (cInspected.ok) commentsSchema = cInspected.data;
      for (const [i, thread] of Array.from(withComments.entries())) {
        if (i >= 3 || !thread.url) break; // comments cost a run each
        const ran = await runMonid(
          commentsEndpoint,
          mapMonidInputs({
            query: thread.url,
            limit: commentsPerThread,
            schema: commentsSchema,
            mode: 'thread',
          }),
          commentsProvider,
        );
        if (ran.ok) {
          thread.comments = normalizeRedditComments(
            ran.data,
            commentsPerThread,
          );
        }
      }
    }
  }

  const digest: RedditDigest = {
    query: searchQuery,
    threads: withComments,
    commentsEndpoint,
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

// ---------------------------------------------------------------------------
// DEEP MODE lane: top_posts / post_comments / voice_deep_dive
//
// These back the three tools that exist only when a session's research depth
// is DEEP. The house rules still hold: every paid call flows through the
// cache table, empty digests are never cached, and the resilience stack
// (variants, FAILED-body detection, platform-on-surf-only) is reused, never
// reimplemented.
// ---------------------------------------------------------------------------

export interface TopPostsDigest {
  platform: string;
  query: string;
  endpoint: string;
  endpointName: string;
  posts: VoiceAuditPost[];
  /** Set when the run returned data but nothing normalized (never cached). */
  rawPreview?: string;
}

/**
 * Search a platform for a topic/hashtag and rank what came back by REAL
 * performance — engagement rate when follower counts ride along, raw
 * engagements (then views) otherwise. The structured sibling of social_search:
 * the answer to "which posts perform best", with URLs kept so the agent can
 * hand the winners to post_comments.
 */
export async function topPosts(opts: {
  platform: string;
  query: string;
  limit?: number;
}): Promise<MonidResult<TopPostsDigest>> {
  const platform = (opts.platform || '').trim().toLowerCase();
  const query = (opts.query || '').trim();
  const limit = Math.max(1, Math.min(20, Math.round(opts.limit ?? 10)));
  if (!platform) return { ok: false, error: 'platform is required', status: 400 };
  if (!query) return { ok: false, error: 'query is required', status: 400 };

  const cacheKey = buildCacheKey('monid:top:v1', { platform, query, limit });
  const cached = await readResearchCache<TopPostsDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  // Same endpoint lane as social_search: pin wins, else discover.
  const pins = await getMonidEndpoints();
  let endpoint = pins[platform] || '';
  let endpointName = endpoint ? 'pinned endpoint' : '';
  let provider = '';
  if (!endpoint) {
    const discoveryQuery =
      PLATFORM_DISCOVERY_QUERY[platform] || `${platform} search posts`;
    const found = await discoverMonid(discoveryQuery);
    if (!found.ok) return found as MonidResult<TopPostsDigest>;
    if (found.data.length === 0) {
      return {
        ok: false,
        error: `Monid has no endpoint matching "${discoveryQuery}". Pin one under /admin/integrations (Monid).`,
        status: 404,
      };
    }
    endpoint = found.data[0].id;
    endpointName = found.data[0].name;
    provider = found.data[0].provider;
  }
  let schema: unknown = null;
  const inspected = await inspectMonid(endpoint, provider);
  if (inspected.ok) schema = inspected.data;

  const poolSize = Math.min(40, limit * 2); // rank from a pool, keep the best
  const { ran } = await runWithVariants({
    endpoint,
    provider,
    query,
    limit: poolSize,
    platform,
    primary: mapMonidInputs({
      query,
      limit: poolSize,
      schema,
      platform: isUnifiedEndpoint(endpoint) ? platform : undefined,
    }),
  });
  if (!ran.ok) return ran as MonidResult<TopPostsDigest>;

  const posts = rankSocialPosts(normalizeSocialPosts(ran.data), limit);
  if (posts.length === 0) {
    // Not cached: an empty success today would pin a recovered source as
    // broken. Hand the agent the raw payload instead (same rule as reddit).
    return {
      ok: true,
      data: {
        platform,
        query,
        endpoint,
        endpointName,
        posts: [],
        rawPreview: compactPayload(ran.data, 3000),
      },
    };
  }

  const digest: TopPostsDigest = {
    platform,
    query,
    endpoint,
    endpointName,
    posts,
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

export interface PostCommentsDigest {
  platform: string;
  url: string;
  endpoint: string;
  comments: RedditCommentLite[];
}

/**
 * Mine the comments on ONE post/reel/video: the audience's own words on a
 * specific winner — objections, questions, "where do I get it". Cached per
 * URL; empty threads are never cached (a comments endpoint that was down at
 * 2pm should not look empty at 2am).
 */
export async function postComments(opts: {
  platform: string;
  url: string;
  limit?: number;
}): Promise<MonidResult<PostCommentsDigest>> {
  const platform = (opts.platform || '').trim().toLowerCase();
  const url = (opts.url || '').trim();
  const limit = Math.max(1, Math.min(25, Math.round(opts.limit ?? 10)));
  if (!platform) return { ok: false, error: 'platform is required', status: 400 };
  if (!url) return { ok: false, error: 'url is required', status: 400 };

  const cacheKey = buildCacheKey('monid:comments:v1', { platform, url, limit });
  const cached = await readResearchCache<PostCommentsDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  const lane = await resolveCommentsEndpoint(platform);
  if (!lane) {
    return {
      ok: false,
      error: `Monid has no ${platform} comments endpoint. Pin one under /admin/integrations (Monid endpoint_${platform}_comments).`,
      status: 404,
    };
  }
  const comments = await fetchPostComments({
    endpoint: lane.endpoint,
    provider: lane.provider,
    schema: lane.schema,
    url,
    limit,
  });
  if (comments.length === 0) {
    return {
      ok: false,
      error: `No comments came back for that ${platform} post. The post may have comments off, the URL may be wrong, or the endpoint returned an unexpected shape.`,
      status: 404,
    };
  }
  const digest: PostCommentsDigest = {
    platform,
    url,
    endpoint: lane.endpoint,
    comments,
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

export interface VoiceDeepDiveDigest {
  handle: string;
  platform: string;
  posts: VoiceAuditPost[];
  commentsOn: number;
  /** The deterministic phrase/question rollup across every mined comment. */
  language: CommentLanguageRollup;
}

/**
 * The deep-mode influencer digest, chained server-side so it costs the agent
 * ONE tool call instead of four rounds: a longer ladder of the creator's
 * posts ranked by performance, comments mined on the top posts, and a
 * deterministic comment-language rollup (repeated phrases + the literal
 * questions the audience keeps asking) counted from every mined comment.
 */
export async function voiceDeepDive(opts: {
  handle: string;
  platform: string;
  topPosts?: number;
  commentsPerPost?: number;
  commentPosts?: number;
}): Promise<MonidResult<VoiceDeepDiveDigest>> {
  const handle = (opts.handle || '').trim().replace(/^@/, '');
  const platform = (opts.platform || '').trim().toLowerCase();
  const topPosts = Math.max(1, Math.min(12, Math.round(opts.topPosts ?? 10)));
  const commentsPerPost = Math.max(
    0,
    Math.min(15, Math.round(opts.commentsPerPost ?? 8)),
  );
  const commentPosts = Math.max(
    0,
    Math.min(6, Math.round(opts.commentPosts ?? 5)),
  );
  if (!handle) return { ok: false, error: 'handle is required', status: 400 };
  if (!platform) return { ok: false, error: 'platform is required', status: 400 };

  const cacheKey = buildCacheKey('monid:voice-deep:v1', {
    handle,
    platform,
    topPosts,
    commentsPerPost,
    commentPosts,
  });
  const cached = await readResearchCache<VoiceDeepDiveDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  const got = await fetchCreatorPosts({
    handle,
    platform,
    poolSize: Math.min(40, topPosts * 3),
  });
  if (!got.ok) return got as MonidResult<VoiceDeepDiveDigest>;
  if (got.data.length === 0) {
    return {
      ok: false,
      error: `No posts normalized for @${handle} on ${platform}. The handle may be wrong, the account private, or the endpoint shape unexpected.`,
      status: 404,
    };
  }
  const ranked = rankSocialPosts(got.data, topPosts);

  let commentsOn = 0;
  if (commentsPerPost > 0 && commentPosts > 0) {
    const lane = await resolveCommentsEndpoint(platform);
    if (lane) {
      for (const [i, post] of Array.from(ranked.entries())) {
        if (i >= commentPosts || !post.url) break; // comments cost a run each
        post.topComments = await fetchPostComments({
          endpoint: lane.endpoint,
          provider: lane.provider,
          schema: lane.schema,
          url: post.url,
          limit: commentsPerPost,
        });
        if (post.topComments.length > 0) commentsOn++;
      }
    }
  }

  const allComments = ranked.reduce<RedditCommentLite[]>(
    (acc, p) => acc.concat(p.topComments),
    [],
  );
  const digest: VoiceDeepDiveDigest = {
    handle,
    platform,
    posts: ranked,
    commentsOn,
    language: rollUpCommentLanguage(allComments),
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

/**
 * Amazon product + review data via RapidAPI, for the Research Lab's review
 * mining (pain language, desired outcomes, objection mining from low-star
 * reviews on books/products in the buyer's niche).
 *
 * Default host is `real-time-amazon-data` (letscrape) — the most-used Amazon
 * API on the marketplace, with search + paginated product reviews under one
 * key. The host is a config value (`rapidapi.amazon_host`, env
 * RAPIDAPI_AMAZON_HOST) so the same code works against a different Amazon API
 * subscription without a redeploy.
 *
 * Every call runs through the research cache — RapidAPI bills per request.
 * The pure normalizers live in lib/mothermode/research/scrapeNormalize.ts
 * (re-exported here). Server-only: reads the key through runtime-config.
 */
import {
  getRapidApiKey,
  getRapidApiAmazonHost,
  getApifyToken,
  getAmazonEngine,
} from './runtime-config';
import { apifyFetchReviews, apifySearchAsin } from './amazon-apify';
import {
  buildCacheKey,
  readResearchCache,
  writeResearchCache,
} from '@/lib/mothermode/research/cache';
import {
  normalizeAmazonProducts,
  normalizeAmazonReviews,
  sanitizeRapidApiHost,
  type AmazonProductLite,
  type AmazonReviewLite,
} from '@/lib/mothermode/research/scrapeNormalize';

export {
  normalizeAmazonProducts,
  normalizeAmazonReviews,
  sanitizeRapidApiHost,
} from '@/lib/mothermode/research/scrapeNormalize';
export type {
  AmazonProductLite,
  AmazonReviewLite,
} from '@/lib/mothermode/research/scrapeNormalize';

export type AmazonResult<T> =
  | { ok: true; data: T; cached?: boolean }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Raw GET
// ---------------------------------------------------------------------------

async function amazonGet(
  path: string,
  params: Record<string, string | number>,
): Promise<AmazonResult<unknown>> {
  const key = await getRapidApiKey();
  if (!key) {
    return {
      ok: false,
      error:
        'RapidAPI is not configured. Add a key under /admin/integrations (RapidAPI) or set RAPIDAPI_KEY.',
      status: 503,
    };
  }
  const host = sanitizeRapidApiHost(await getRapidApiAmazonHost());
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  try {
    let res = await fetch(`https://${host}${path}?${qs}`, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    });
    // The free tier rate-limits at roughly one request a second; one delayed
    // retry turns most 429s into the data the agent asked for.
    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      res = await fetch(`https://${host}${path}?${qs}`, {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': host,
        },
      });
    }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      let error =
        json?.message ||
        json?.error?.message ||
        `Amazon request failed (${res.status})`;
      // RapidAPI's unsubscribed message deserves the fix, not just the fact.
      if (/subscribe/i.test(String(error))) {
        error +=
          ' — subscribe to real-time-amazon-data on rapidapi.com (the host field must be real-time-amazon-data.p.rapidapi.com unless you changed providers)';
      }
      return { ok: false, error, status: res.status };
    }
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Amazon request failed',
      status: 502,
    };
  }
}

// ---------------------------------------------------------------------------
// amazon_reviews — the tool-facing entry point
// ---------------------------------------------------------------------------

export interface AmazonReviewDigest {
  product: AmazonProductLite;
  reviews: AmazonReviewLite[];
  totalFound: number;
  /** Which engine actually returned the reviews (for the reasoning trace). */
  provider: 'rapidapi' | 'apify';
}

/**
 * Mine reviews for a product: by ASIN directly, or by search query (first
 * credible product wins — a niche book/organizer/planner, not a sponsored
 * accessory). The digest is capped and cached; the agent summarizes themes
 * from it.
 */
export async function amazonReviewDigest(opts: {
  query?: string;
  asin?: string;
  maxReviews?: number;
}): Promise<AmazonResult<AmazonReviewDigest>> {
  const asinInput = (opts.asin || '').trim();
  const query = (opts.query || '').trim();
  const maxReviews = Math.max(
    1,
    Math.min(25, Math.round(opts.maxReviews ?? 14)),
  );
  if (!asinInput && !query) {
    return { ok: false, error: 'query or asin is required', status: 400 };
  }

  const cacheKey = buildCacheKey('amazon:reviews', {
    asin: asinInput,
    query,
    maxReviews,
  });
  const cached = await readResearchCache<AmazonReviewDigest>(cacheKey);
  if (cached) return { ok: true, data: cached, cached: true };

  // 1. Resolve the product. In Apify mode, query->ASIN resolves through
  //    Apify too, so the engine works with no RapidAPI key at all.
  let product: AmazonProductLite | null = null;
  if (asinInput) {
    product = { asin: asinInput, title: '', rating: null, ratingsTotal: null, price: '', url: '' };
  } else if ((await getAmazonEngine()) === 'apify') {
    const found = await apifySearchAsin({ query });
    if (!found.ok) {
      return {
        ok: false,
        error: `Apify search could not resolve "${query}" to a product: ${found.error}`,
        status: found.status,
      };
    }
    product = { asin: found.data, title: '', rating: null, ratingsTotal: null, price: '', url: '' };
  } else {
    const found = await amazonGet('/search', {
      query,
      page: 1,
      country: 'US',
      sort_by: 'RELEVANCE',
    });
    if (!found.ok) return found as AmazonResult<AmazonReviewDigest>;
    const products = normalizeAmazonProducts(found.data);
    if (products.length === 0) {
      return {
        ok: false,
        error: `No Amazon products matched "${query}".`,
        status: 404,
      };
    }
    // Prefer a product with real review volume — mining a 3-review listing
    // produces anecdotes, not patterns.
    product =
      products.find((p) => (p.ratingsTotal ?? 0) >= 50) ?? products[0];
  }

  // 2. Reviews. Engine preference: 'apify' skips RapidAPI entirely; the
  //    default tries RapidAPI first and falls through to Apify on ANY
  //    failure (403 "not subscribed", 429, 5xx) when a token is configured.
  let all: AmazonReviewLite[] = [];
  let provider: AmazonReviewDigest['provider'] = 'rapidapi';
  const engine = await getAmazonEngine();
  if (engine === 'apify') {
    const apifyToken = await getApifyToken();
    if (!apifyToken) {
      return {
        ok: false,
        error:
          'The Amazon engine is set to Apify but no Apify token is configured. Add one under /admin/integrations (Apify).',
        status: 503,
      };
    }
    const apifyRes = await apifyFetchReviews({
      asin: product.asin,
      maxReviews,
    });
    if (!apifyRes.ok) {
      return {
        ok: false,
        error: `Apify (preferred engine) failed: ${apifyRes.error}`,
        status: apifyRes.status,
      };
    }
    all = apifyRes.data;
    provider = 'apify';
  } else {
    const reviewsRes = await amazonGet('/product-reviews', {
      asin: product.asin,
      page: 1,
      country: 'US',
      sort_by: 'Top',
      star_rating: 'ALL',
    });
    if (reviewsRes.ok) {
      all = normalizeAmazonReviews(reviewsRes.data);
    } else {
      const rapidError = reviewsRes.error;
      const apifyToken = await getApifyToken();
      if (!apifyToken) {
        return {
          ok: false,
          error: `${rapidError} (Apify fallback is not configured: add an API token under /admin/integrations to make this source redundant.)`,
          status: reviewsRes.status,
        };
      }
      const apifyRes = await apifyFetchReviews({
        asin: product.asin,
        maxReviews,
      });
      if (!apifyRes.ok) {
        return {
          ok: false,
          error: `RapidAPI failed: ${rapidError} | Apify fallback failed: ${apifyRes.error}`,
          status: apifyRes.status,
        };
      }
      all = apifyRes.data;
      provider = 'apify';
    }
  }

  // Keep a deliberate mix: low-star objections first, then top reviews, capped.
  const lowStars = all.filter((r) => (r.stars ?? 5) <= 3).slice(0, 4);
  const rest = all.filter((r) => !lowStars.includes(r));
  const reviews = [...lowStars, ...rest].slice(0, maxReviews);

  const digest: AmazonReviewDigest = {
    product,
    reviews,
    totalFound: all.length,
    provider,
  };
  await writeResearchCache(cacheKey, digest);
  return { ok: true, data: digest };
}

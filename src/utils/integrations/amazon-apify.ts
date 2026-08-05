/**
 * Apify — the fallback engine for Amazon review mining. When RapidAPI 403s
 * ("not subscribed") or dies, the Research Lab falls through to a maintained
 * Apify reviews actor (proxy rotation and retries built in).
 *
 * One call shape: run the actor synchronously and read its dataset. Actor
 * output shapes vary, so the review normalizer here is deliberately broad
 * (rating/title/body under a handful of common field names).
 *
 * Server-only: reads the token through runtime-config. Every result flows
 * through the same research cache as the RapidAPI path.
 */
import {
  getApifyToken,
  getApifyReviewsActor,
} from './runtime-config';
import type { AmazonReviewLite } from '@/lib/mothermode/research/scrapeNormalize';

const APIFY_BASE = 'https://api.apify.com/v2';

export type ApifyResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** Defensive review mapping across common actor field names. */
function mapApifyReview(rec: Record<string, any>): AmazonReviewLite | null {
  const body =
    (typeof rec.reviewDescription === 'string' && rec.reviewDescription) ||
    (typeof rec.body === 'string' && rec.body) ||
    (typeof rec.text === 'string' && rec.text) ||
    (typeof rec.review === 'string' && rec.review) ||
    (typeof rec.reviewText === 'string' && rec.reviewText) ||
    '';
  const title =
    (typeof rec.reviewTitle === 'string' && rec.reviewTitle) ||
    (typeof rec.title === 'string' && rec.title) ||
    '';
  if (!body && !title) return null;
  const starsRaw = rec.rating ?? rec.stars ?? rec.reviewStars ?? rec.starRating;
  return {
    stars:
      typeof starsRaw === 'number'
        ? starsRaw
        : typeof starsRaw === 'string'
          ? Number.parseFloat(starsRaw) || null
          : null,
    title,
    body: body.replace(/\s+/g, ' ').trim().slice(0, 400),
    date: typeof rec.date === 'string' ? rec.date : '',
    verified: rec.verified === true || rec.isVerified === true,
  };
}

/**
 * Pull reviews for one ASIN via the configured Apify reviews actor. The actor
 * id is a config value — Apify's store rotates, and a 404 deserves a clear
 * "swap the actor in /admin/integrations" message, not a mystery.
 */
/**
 * Resolve a search query to one product's ASIN via an Apify search actor, so
 * the Apify engine works WITHOUT RapidAPI entirely. Configurable like the
 * reviews actor (store rotates).
 */
export async function apifySearchAsin(opts: {
  query: string;
}): Promise<ApifyResult<string>> {
  const token = await getApifyToken();
  if (!token) {
    return {
      ok: false,
      error: 'Apify is not configured.',
      status: 503,
    };
  }
  const candidates = [
    'epctex/amazon-product-scraper',
    'junglee/amazon-scraper',
    'apify/amazon-product-scraper',
  ];
  const input = {
    keyword: opts.query,
    searchTerms: [opts.query],
    maxItems: 10,
    country: 'US',
  };
  let lastError = '';
  let lastStatus = 502;
  for (const actor of candidates) {
    try {
      const res = await fetch(
        `${APIFY_BASE}/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      const json: any = await res.json().catch(() => []);
      if (!res.ok) {
        lastStatus = res.status;
        lastError =
          (typeof json?.error?.message === 'string' && json.error.message) ||
          `Apify actor run failed (${res.status})`;
        continue;
      }
      const list = Array.isArray(json) ? json : [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const rec = raw as Record<string, any>;
        const asin =
          (typeof rec.asin === 'string' && rec.asin.trim()) ||
          (typeof rec.ASIN === 'string' && rec.ASIN.trim()) ||
          '';
        if (asin) return { ok: true, data: asin };
      }
      lastError = `Apify actor "${actor}" found no ASIN for "${opts.query}".`;
      lastStatus = 404;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Apify request failed';
      lastStatus = 502;
    }
  }
  return { ok: false, error: lastError, status: lastStatus };
}

export async function apifyFetchReviews(opts: {
  asin: string;
  maxReviews: number;
}): Promise<ApifyResult<AmazonReviewLite[]>> {
  const token = await getApifyToken();
  if (!token) {
    return {
      ok: false,
      error:
        'Apify is not configured. Add an API token under /admin/integrations (Apify) or set APIFY_API_TOKEN.',
      status: 503,
    };
  }
  const configured = (await getApifyReviewsActor()).trim();
  // The store rotates: try the configured actor first, then the well-known
  // candidates, so a 404 on one is not a dead end.
  const candidates = [
    configured,
    'apify/amazon-reviews-scraper',
    'epctex/amazon-reviews-scraper',
    'junglee/amazon-reviews-scraper',
  ].filter((a, i, arr) => a && arr.indexOf(a) === i);
  const input = {
    asin: opts.asin,
    maxReviews: opts.maxReviews,
    // Cover the two input conventions reviews actors use; extras are ignored.
    productUrls: [`https://www.amazon.com/dp/${opts.asin}`],
  };
  let lastError = '';
  let lastStatus = 502;
  for (const actor of candidates) {
    try {
      const res = await fetch(
        `${APIFY_BASE}/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      const json: any = await res.json().catch(() => []);
      if (!res.ok) {
        lastStatus = res.status;
        lastError =
          (typeof json?.error?.message === 'string' && json.error.message) ||
          `Apify actor run failed (${res.status})`;
        if (res.status === 404) continue; // try the next candidate actor
        continue;
      }
      const list = Array.isArray(json) ? json : [];
      const reviews: AmazonReviewLite[] = [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const mapped = mapApifyReview(raw as Record<string, any>);
        if (mapped) reviews.push(mapped);
        if (reviews.length >= opts.maxReviews) break;
      }
      if (reviews.length === 0) {
        lastError = `Apify actor "${actor}" returned no reviews for ASIN ${opts.asin}.`;
        lastStatus = 404;
        continue;
      }
      return { ok: true, data: reviews };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Apify request failed';
      lastStatus = 502;
    }
  }
  return {
    ok: false,
    error: `${lastError} (tried actors: ${candidates.join(', ')}; swap a working one in under /admin/integrations -> Apify)`,
    status: lastStatus,
  };
}

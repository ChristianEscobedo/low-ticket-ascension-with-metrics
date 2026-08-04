'use client';

/**
 * The piece→link and piece→date maps, in the browser.
 *
 * WHY THIS EXISTS AS A MODULE AND NOT A HOOK IN ONE COMPONENT
 * ----------------------------------------------------------
 * `runExport` runs client-side (`/api/mothermode/content/export` converts an
 * already-built CSV; it does not build one), so the browser — not a server route
 * — has to hold `linkByPieceId` and `scheduleByPieceId`. Two different surfaces
 * need them: the export panel, which injects them into the CSV, and the per-post
 * link control, which shows whether a piece already has a tracked link.
 *
 * Those two surfaces don't share a parent that would naturally own the state
 * (the panel and the sheet are siblings mounted conditionally), so instead of
 * threading props down through the hub for something neither the hub nor the
 * cards care about, the fetch is cached at module scope. Both consumers call the
 * hook and share one in-flight request.
 *
 * The cache is invalidated explicitly, never by time: the only thing that
 * changes these maps mid-session is the admin minting a link or moving a card,
 * and both of those know to call `refreshPieceLinks()`. A TTL would either be
 * short enough to re-fetch pointlessly or long enough to serve a link the admin
 * just created as missing.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TrafficSplit, TrafficType } from '@/lib/mothermode/planner/adMetrics';


export interface PieceLinkFunnel {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface PieceLinksPayload {
  origin: string;
  /** pieceId -> tracked URL (short `/go/<code>` form when available). */
  linkByPieceId: Record<string, string>;
  /** pieceId -> planner `scheduled_at` ISO string, scoped to the offer. */
  scheduleByPieceId: Record<string, string>;
  funnels: PieceLinkFunnel[];
  /**
   * Lead magnets (opt-in funnels), kept as their own list rather than merged
   * into `funnels`. Their step vocabulary is different ('oto' / 'thank-you' vs
   * 'checkout' / 'upsell1'), so a merged list would let the picker offer a step
   * the chosen destination does not have and mint a link to a 404.
   */
  optinFunnels: PieceLinkFunnel[];
}

const EMPTY: PieceLinksPayload = {
  origin: '',
  linkByPieceId: {},
  scheduleByPieceId: {},
  funnels: [],
  optinFunnels: []
};


/** Keyed by offerSlug, because scheduleByPieceId is offer-scoped. */
const cache = new Map<string, Promise<PieceLinksPayload>>();

async function load(offerSlug: string): Promise<PieceLinksPayload> {
  const qs = new URLSearchParams({ format: 'byPiece' });
  if (offerSlug) qs.set('offerSlug', offerSlug);
  const res = await fetch(`/api/admin/mothermode-links?${qs.toString()}`, {
    // Always a live read: a stale bfcache entry here means exporting yesterday's
    // links, which is silently wrong rather than visibly broken.
    cache: 'no-store'
  });
  const json = (await res.json().catch(() => ({}))) as Partial<
    PieceLinksPayload & { success: boolean; error: string }
  >;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Link map failed (${res.status})`);
  }
  return {
    origin: json.origin || '',
    linkByPieceId: json.linkByPieceId || {},
    scheduleByPieceId: json.scheduleByPieceId || {},
    funnels: json.funnels || [],
    optinFunnels: json.optinFunnels || []
  };
}


/** Fetch (or reuse) the maps for an offer. */
export function fetchPieceLinks(offerSlug: string): Promise<PieceLinksPayload> {
  const key = offerSlug || '';
  let inFlight = cache.get(key);
  if (!inFlight) {
    inFlight = load(key);
    cache.set(key, inFlight);
    // A rejected promise must not be cached, or one flaky request would make the
    // maps permanently unavailable for the rest of the session.
    inFlight.catch(() => cache.delete(key));
  }
  return inFlight;
}

/** Drop the cache so the next read re-fetches. Call after minting a link. */
export function refreshPieceLinks(offerSlug?: string): void {
  if (typeof offerSlug === 'string') cache.delete(offerSlug || '');
  else cache.clear();
}

export interface UsePieceLinksResult extends PieceLinksPayload {
  /** False while the first load is in flight. */
  ready: boolean;
  /** Non-null when the maps could not be loaded. Never blocks the caller. */
  error: string | null;
  reload: () => void;
}

/**
 * Read the maps in a component.
 *
 * Failure is deliberately NOT fatal: it resolves to empty maps plus an `error`
 * string. An export that ships the bare offer URL is a worse export; an export
 * that refuses to run because a secondary lookup failed is a broken feature.
 * Callers surface `error` as a note next to the button, not as a blocker.
 */
export function usePieceLinks(offerSlug: string): UsePieceLinksResult {
  const [state, setState] = useState<PieceLinksPayload>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setError(null);
    fetchPieceLinks(offerSlug)
      .then((payload) => {
        if (!alive) return;
        setState(payload);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setState(EMPTY);
        setError(err instanceof Error ? err.message : 'Could not load links');
        // ready=true even on failure: the caller is done waiting and should
        // proceed without the maps rather than spin forever.
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [offerSlug, nonce]);

  const reload = useCallback(() => {
    refreshPieceLinks(offerSlug);
    setNonce((n) => n + 1);
  }, [offerSlug]);

  return { ...state, ready, error, reload };
}

// ---------------------------------------------------------------------------
// Per-piece metrics (clicks + opt-ins)
// ---------------------------------------------------------------------------

export interface PieceMetricsPayload {
  /** False when the click roll-up could not be read — render `n/a`, not `0`. */
  clicksAvailable: boolean;
  /** False when the opt-in join could not run — same rule. */
  attributionAvailable: boolean;
  /** All-time clicks, from the hot counter. */
  clicksByPieceId: Record<string, number>;
  optinsByPieceId: Record<string, number>;
  purchasesByPieceId: Record<string, number>;
  /**
   * ATTRIBUTED revenue per piece, in cents.
   *
   * A floor, never "revenue": it counts only sales that arrived through a
   * tracked link, so it is always below Stripe's totals and the two must never
   * be added. Every surface that renders it also renders
   * `ATTRIBUTED_REVENUE_FLOOR_SHORT` for exactly that reason.
   */
  revenueCentsByPieceId: Record<string, number>;
  /**
   * Per piece, leads split by the LEAD's `utm_medium`. Absent key = no leads.
   *
   * Needed in the browser because a break-even CPC is only a bid ceiling if it
   * was computed from paid results alone; without this the panel could only show
   * a blended figure, which organic reach inflates.
   */
  trafficSplitByPieceId: Record<string, TrafficSplit>;
  /**
   * Per piece, all-time clicks split by the LINK's `utm_medium`.
   *
   * The paid denominator. Note the homonym it deliberately avoids:
   * `unattributedClicksByPieceId` below means "no IP hash" (we don't know WHO),
   * while the `unattributed` bucket in here means "no utm_medium" (we don't know
   * WHERE FROM) — which is why this is a nested split and not three more flat
   * maps that would read as the same number.
   */
  clickMediumSplitByPieceId: Record<string, Record<TrafficType, number>>;

  /*

   * Window-scoped, from the click log. Kept under names that can't be confused
   * with `clicksByPieceId`, because the one thing no surface may do is divide
   * an all-time counter by a 30-day unique count — see `readPeople`.
   */
  /** Distinct people per piece, inside `clickWindowDays`. */
  uniqueClicksByPieceId: Record<string, number>;
  /** Clicks inside that same window — the only valid numerator for uniques. */
  windowClicksByPieceId: Record<string, number>;
  /** Window clicks with no IP hash, which make the unique count a floor. */
  unattributedClicksByPieceId: Record<string, number>;
  clickWindowDays: number;
  /** The click log hit its row cap, so the window is shorter than stated. */
  clickWindowTruncated: boolean;
}

const EMPTY_METRICS: PieceMetricsPayload = {
  clicksAvailable: false,
  attributionAvailable: false,
  clicksByPieceId: {},
  optinsByPieceId: {},
  purchasesByPieceId: {},
  revenueCentsByPieceId: {},
  trafficSplitByPieceId: {},
  clickMediumSplitByPieceId: {},
  uniqueClicksByPieceId: {},

  windowClicksByPieceId: {},
  unattributedClicksByPieceId: {},
  clickWindowDays: 30,
  clickWindowTruncated: false
};


/**
 * Metrics are NOT offer-scoped, so one cache entry serves the whole session.
 *
 * They are also a separate request from the link maps rather than extra fields
 * on them: the link maps are on the export path, which is documented as
 * deliberately not paying for a click read or an opt-in join. Two caches keeps
 * that promise instead of quietly making every CSV preview slower.
 */
let metricsCache: Promise<PieceMetricsPayload> | null = null;

async function loadMetrics(): Promise<PieceMetricsPayload> {
  const res = await fetch('/api/admin/mothermode-links?format=pieceMetrics', {
    cache: 'no-store'
  });
  const json = (await res.json().catch(() => ({}))) as Partial<
    PieceMetricsPayload & { success: boolean; error: string }
  >;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Piece metrics failed (${res.status})`);
  }
  return {
    // Absent flags are treated as unavailable, never as "measured zero".
    clicksAvailable: json.clicksAvailable === true,
    attributionAvailable: json.attributionAvailable === true,
    clicksByPieceId: json.clicksByPieceId || {},
    optinsByPieceId: json.optinsByPieceId || {},
    purchasesByPieceId: json.purchasesByPieceId || {},
    // `|| {}` and not a zero-filled default: an absent key means "this piece
    // earned nothing recorded", which the consumers read through
    // `attributionAvailable` before they decide between `$0.00` and `n/a`.
    revenueCentsByPieceId: json.revenueCentsByPieceId || {},
    trafficSplitByPieceId: json.trafficSplitByPieceId || {},
    clickMediumSplitByPieceId: json.clickMediumSplitByPieceId || {},
    uniqueClicksByPieceId: json.uniqueClicksByPieceId || {},

    windowClicksByPieceId: json.windowClicksByPieceId || {},
    unattributedClicksByPieceId: json.unattributedClicksByPieceId || {},
    // 30 to match the server's default. A missing window would otherwise render
    // as "in the last 0 days", which reads as a bug in the label.
    clickWindowDays:
      typeof json.clickWindowDays === 'number' ? json.clickWindowDays : 30,
    clickWindowTruncated: json.clickWindowTruncated === true
  };
}


export function fetchPieceMetrics(): Promise<PieceMetricsPayload> {
  if (!metricsCache) {
    metricsCache = loadMetrics();
    metricsCache.catch(() => {
      metricsCache = null;
    });
  }
  return metricsCache;
}

/** Drop the metrics cache. Clicks change on their own, so callers rarely need this. */
export function refreshPieceMetrics(): void {
  metricsCache = null;
}

export interface UsePieceMetricsResult extends PieceMetricsPayload {
  ready: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Clicks and opt-ins for one piece, read in a client component.
 *
 * Like `usePieceLinks`, a failure resolves to empty maps with the availability
 * flags false — which is the whole reason those flags exist. A piece with a
 * tracked link and no clicks yet is a real `0`; a piece whose numbers could not
 * be read is `n/a`. Collapsing the two would tell an admin their post flopped
 * when in fact the planner migration simply isn't applied.
 */
export function usePieceMetrics(): UsePieceMetricsResult {
  const [state, setState] = useState<PieceMetricsPayload>(EMPTY_METRICS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setError(null);
    fetchPieceMetrics()
      .then((payload) => {
        if (!alive) return;
        setState(payload);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setState(EMPTY_METRICS);
        setError(err instanceof Error ? err.message : 'Could not load metrics');
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    refreshPieceMetrics();
    setNonce((n) => n + 1);
  }, []);

  return { ...state, ready, error, reload };
}

/** How many of these pieces already carry a tracked link. */

export function countTrackedPieces(
  pieceIds: string[],
  linkByPieceId: Record<string, string>
): number {
  return pieceIds.reduce((n, id) => (linkByPieceId[id] ? n + 1 : n), 0);
}

/**
 * Asset Hub attribution helpers — pure, no DB, no env, safe on both sides.
 *
 * Two data gaps the collectors used to have, fixed here so they can be unit
 * tested without a database:
 *
 * 1. **Sequences had no system.** Funnels/pages carry `offerSlug` + `funnelSlug`
 *    and generated content carries `offerSlug`, but email kits are stored on
 *    their own table and know nothing about the funnel that fires them. The
 *    funnel→kit link only exists on the funnel side (`emailKits[].emailKitId`
 *    plus the legacy single `emailKitId`), and the sales collector used to throw
 *    it away after counting it. `sequenceAttributionFrom` keeps that link as a
 *    kit-id → owning-funnel map, and `applySequenceAttribution` stamps it onto
 *    the collected `sequence` items so every asset can name its system.
 *
 * 2. **Page counts were hardcoded.** `metrics.pages` reported the length of the
 *    full page list, so a funnel with three disabled upsells still claimed ten
 *    pages. `salesPagePlan` returns only the pages a given funnel actually
 *    exposes, and the collector both builds children from it and counts it.
 */
import type { AssetItem } from './types';

/* ------------------------------------------------------ sequence attribution */

/** Where a sequence lives: the funnel that fires it and that funnel's offer. */
export interface SequenceAttributionEntry {
  offerSlug?: string;
  funnelSlug?: string;
  funnelTitle?: string;
}

/** kit id → owning funnel. Kits bound to nothing are simply absent. */
export type SequenceAttribution = Record<string, SequenceAttributionEntry>;

/**
 * The minimum a funnel record must expose to attribute its kits. Structural so
 * both the sales and opt-in records satisfy it without importing either type.
 */
export interface FunnelKitSource {
  slug: string;
  name?: string | null;
  offerSlug?: string | null;
  /** Legacy single-kit binding (opt-in event on sales funnels). */
  emailKitId?: string | null;
  /** Multi-event bindings. */
  emailKits?: ({ emailKitId?: string | null } | null)[] | null;
}

/** Every kit id a funnel binds, de-duplicated across legacy + multi-event. */
export function kitIdsOf(funnel: FunnelKitSource): string[] {
  const ids = new Set<string>();
  for (const binding of funnel.emailKits ?? []) {
    if (binding?.emailKitId) ids.add(binding.emailKitId);
  }
  if (funnel.emailKitId) ids.add(funnel.emailKitId);
  return Array.from(ids);
}

/**
 * Build the kit → funnel map. When two funnels bind the same kit the first one
 * in input order wins, so the result is deterministic; the shared kit still
 * shows up under that funnel rather than being dropped or duplicated.
 */
export function sequenceAttributionFrom(
  funnels: FunnelKitSource[],
): SequenceAttribution {
  const out: SequenceAttribution = {};
  for (const funnel of funnels) {
    for (const id of kitIdsOf(funnel)) {
      if (out[id]) continue;
      out[id] = {
        offerSlug: funnel.offerSlug ?? undefined,
        funnelSlug: funnel.slug,
        funnelTitle: funnel.name || funnel.slug,
      };
    }
  }
  return out;
}

/** Prefix `collectSequences` uses for its item ids (`seq:<kitId>`). */
export const SEQUENCE_ID_PREFIX = 'seq:';

/** The kit id behind a sequence item id. Non-prefixed ids pass through. */
export function kitIdFromAssetId(id: string): string {
  return id.startsWith(SEQUENCE_ID_PREFIX)
    ? id.slice(SEQUENCE_ID_PREFIX.length)
    : id;
}

/**
 * Stamp `offerSlug` / `funnelSlug` onto sequence items from the funnel that
 * binds them, and tag the row with the funnel name so the Sequences tab reads
 * as "which funnel does this belong to?". Existing values are never overwritten
 * and unbound kits are returned untouched, so they group as unassigned instead
 * of being invented into a system.
 */
export function applySequenceAttribution(
  items: AssetItem[],
  attribution: SequenceAttribution,
): AssetItem[] {
  return items.map((item) => {
    const hit = attribution[kitIdFromAssetId(item.id)];
    if (!hit) return item;
    const tags = hit.funnelTitle
      ? Array.from(new Set([...(item.tags ?? []), hit.funnelTitle]))
      : item.tags;
    return {
      ...item,
      offerSlug: item.offerSlug ?? hit.offerSlug,
      funnelSlug: item.funnelSlug ?? hit.funnelSlug,
      tags,
    };
  });
}

/* ------------------------------------------------------------- page planning */

/** One public page of a sales funnel. */
export interface SalesPageSpec {
  suffix: string;
  label: string;
}

/** Always-present pages, in ascension order. */
const BASE_SALES_PAGES: SalesPageSpec[] = [
  { suffix: '', label: 'Opt-in' },
  { suffix: '/sales', label: 'Sales' },
  { suffix: '/vsl', label: 'VSL' },
  { suffix: '/checkout', label: 'Checkout' },
];

/** Optional pages: each upsell exists only when its slot is enabled. */
const UPSELL_SALES_PAGES = [
  { suffix: '/upsell', label: 'Upsell 1', key: 'upsell1' },
  { suffix: '/upsell-2', label: 'Upsell 2', key: 'upsell2' },
  { suffix: '/upsell-3', label: 'Upsell 3', key: 'upsell3' },
  { suffix: '/upsell-4', label: 'Upsell 4', key: 'upsell4' },
] as const;

/** Post-purchase pages, always present. */
const TAIL_SALES_PAGES: SalesPageSpec[] = [
  { suffix: '/success', label: 'Success' },
  { suffix: '/access', label: 'Access' },
];

/** Just the upsell `enabled` flags a funnel record carries. */
export type SalesPageFlags = {
  [K in (typeof UPSELL_SALES_PAGES)[number]['key']]?: {
    enabled?: boolean;
  } | null;
};

/**
 * The pages this funnel actually exposes. Disabled upsell slots are skipped, so
 * both the nested page rows and the `pages` metric describe the real funnel
 * instead of the maximum shape one could have.
 */
export function salesPagePlan(funnel: SalesPageFlags): SalesPageSpec[] {
  const upsells = UPSELL_SALES_PAGES.filter(
    (page) => funnel[page.key]?.enabled !== false,
  ).map(({ suffix, label }) => ({ suffix, label }));
  return [...BASE_SALES_PAGES, ...upsells, ...TAIL_SALES_PAGES];
}

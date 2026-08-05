/**
 * Asset Hub metrics. Pure functions over `AssetItem[]` — no DB, no env, no React
 * — so the Overview dashboard math is unit-testable and safe on both server and
 * client. Collectors produce the items; this module only counts and ranks them.
 */
import type { AssetBundle, AssetItem, AssetStatus } from './types';

/** Sum one metric key across items, ignoring items that don't carry it. */
export function sumMetric(items: AssetItem[], key: string): number {
  return items.reduce((total, item) => total + (item.metrics?.[key] ?? 0), 0);
}

/** Count items per status. Every status present in the input gets a key. */
export function countByStatus(
  items: AssetItem[],
): Partial<Record<AssetStatus, number>> {
  const out: Partial<Record<AssetStatus, number>> = {};
  for (const item of items) out[item.status] = (out[item.status] ?? 0) + 1;
  return out;
}

/**
 * Count items by an arbitrary field (platform, format, offerSlug…), skipping
 * items where the field is empty. Returned newest-largest first for charting.
 */
export function countByField(
  items: AssetItem[],
  field: 'platform' | 'format' | 'offerSlug' | 'kind',
): { key: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const item of items) {
    const key = item[field];
    if (!key) continue;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Funnel-wide performance rollup. Rates are 0–100, rounded to one decimal. */
export interface FunnelRollup {
  funnels: number;
  live: number;
  views: number;
  leads: number;
  checkouts: number;
  purchases: number;
  revenueCents: number;
  /** leads / views */
  optinRate: number;
  /** purchases / leads */
  closeRate: number;
  /** average revenue per purchase, in cents */
  aovCents: number;
}

const rate = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

/** Roll up every funnel row (sales + optin) into one performance summary. */
export function rollupFunnels(items: AssetItem[]): FunnelRollup {
  const views = sumMetric(items, 'views');
  const leads = sumMetric(items, 'leads');
  const purchases = sumMetric(items, 'purchases');
  const revenueCents = sumMetric(items, 'revenueCents');
  return {
    funnels: items.length,
    live: items.filter((i) => i.status === 'published').length,
    views,
    leads,
    checkouts: sumMetric(items, 'checkouts'),
    purchases,
    revenueCents,
    optinRate: rate(leads, views),
    closeRate: rate(purchases, leads),
    aovCents: purchases > 0 ? Math.round(revenueCents / purchases) : 0,
  };
}

/** Headline counts for the Overview stat cards. */
export interface AssetTotals {
  total: number;
  live: number;
  draft: number;
  planned: number;
  byKind: { key: string; count: number }[];
}

/** Flatten a bundle into a single list, in tab order. */
export function flattenBundle(bundle: AssetBundle): AssetItem[] {
  return [
    ...bundle.salesFunnels,
    ...bundle.optinFunnels,
    ...bundle.sequences,
    ...bundle.organic,
    ...bundle.ads,
    ...bundle.deliverables,
    ...bundle.kits,
    ...bundle.catalog,
  ];
}

export function totals(bundle: AssetBundle): AssetTotals {
  const all = flattenBundle(bundle);
  const status = countByStatus(all);
  return {
    total: all.length,
    live: status.published ?? 0,
    draft: status.draft ?? 0,
    planned: status.planned ?? 0,
    byKind: countByField(all, 'kind'),
  };
}

/**
 * Newest-updated items across every source. Items with no `updatedAt` sort last
 * so real activity always wins over static catalog entries.
 */
export function recentActivity(bundle: AssetBundle, limit = 12): AssetItem[] {
  return flattenBundle(bundle)
    .filter((i) => !!i.updatedAt)
    .sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : -1))
    .slice(0, limit);
}

/** One actionable problem found in the asset graph. */
export interface AssetGap {
  id: string;
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  href?: string;
}

/**
 * Surface the things an operator would want to fix: funnels with no email
 * sequence attached, published funnels that have never converted, drafts left
 * unpublished, and asset families that are still completely empty.
 */
export function findGaps(bundle: AssetBundle): AssetGap[] {
  const gaps: AssetGap[] = [];
  const funnels = [...bundle.salesFunnels, ...bundle.optinFunnels].filter(
    (i) => !i.parentId,
  );

  for (const funnel of funnels) {
    if ((funnel.metrics?.sequences ?? 0) === 0) {
      gaps.push({
        id: `no-sequence:${funnel.id}`,
        severity: 'high',
        label: `${funnel.title} has no email sequence`,
        detail: 'Leads capture but nothing follows up. Attach or autobuild a kit.',
        href: funnel.editHref,
      });
    }
    if (
      funnel.status === 'published' &&
      (funnel.metrics?.views ?? 0) >= 25 &&
      (funnel.metrics?.leads ?? 0) === 0
    ) {
      gaps.push({
        id: `no-conversion:${funnel.id}`,
        severity: 'high',
        label: `${funnel.title} gets traffic but zero opt-ins`,
        detail: `${funnel.metrics?.views ?? 0} views, 0 leads. Check the form and offer.`,
        href: funnel.editHref,
      });
    }
    if (funnel.status === 'draft') {
      gaps.push({
        id: `draft:${funnel.id}`,
        severity: 'medium',
        label: `${funnel.title} is still a draft`,
        detail: 'Built but not published, so no traffic can reach it.',
        href: funnel.editHref,
      });
    }
  }

  if (bundle.ads.length === 0) {
    gaps.push({
      id: 'empty:ads',
      severity: 'low',
      label: 'No paid ad creative yet',
      detail: 'Generate ad variants in the Content Hub to fill this library.',
      href: '/admin/content',
    });
  }
  if (bundle.sequences.length === 0) {
    gaps.push({
      id: 'empty:sequences',
      severity: 'medium',
      label: 'No email sequences built',
      detail: 'Every funnel needs at least a delivery and a follow-up sequence.',
      href: '/admin/email-marketing',
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return gaps.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Case-insensitive search across the fields a human would type. */
export function searchAssets(items: AssetItem[], query: string): AssetItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) =>
    [i.title, i.subtitle, i.offerSlug, i.funnelSlug, i.platform, i.format]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );
}

/** Apply the filter bar. Empty/undefined filters are treated as "all". */
export function filterAssets(
  items: AssetItem[],
  opts: { status?: string; platform?: string; offerSlug?: string } = {},
): AssetItem[] {
  return items.filter((i) => {
    if (opts.status && opts.status !== 'all' && i.status !== opts.status)
      return false;
    if (opts.platform && opts.platform !== 'all' && i.platform !== opts.platform)
      return false;
    if (
      opts.offerSlug &&
      opts.offerSlug !== 'all' &&
      i.offerSlug !== opts.offerSlug
    )
      return false;
    return true;
  });
}

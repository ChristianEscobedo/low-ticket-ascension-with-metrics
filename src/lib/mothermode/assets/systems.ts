/**
 * Asset Hub systems view — pure, DB-free, unit-testable.
 *
 * Every other tab answers "what assets of kind X exist?". This module answers
 * the question an operator actually asks: **"is this offer a finished system?"**
 * It regroups the whole bundle by the thing an asset belongs to — the offer, or
 * the funnel when no offer is set — so a funnel, its pages, the sequences that
 * fire from it, the posts and ads pointing at it, and the deliverable it hands
 * over all read as one row instead of being scattered across seven tabs.
 *
 * This is only possible because `./attribution` closed the sequence gap: email
 * kits are stored on their own table and used to carry no `offerSlug` /
 * `funnelSlug`, so grouping them was impossible. Kits still bound to nothing are
 * deliberately grouped as unassigned rather than guessed into a system.
 *
 * The catalog group (`page` / `blueprint`) is excluded on purpose: those rows
 * describe the app's own builders and roadmap, not a customer-facing system, and
 * folding them in would bury the unassigned bucket in noise.
 */
import type { AssetBundle, AssetItem, AssetKind } from './types';
import { rollupFunnels, type FunnelRollup } from './metrics';

/** Group id for assets that name no offer and no funnel. */
export const UNASSIGNED_SYSTEM_ID = '__unassigned__';

/** The buckets a system splits its assets into, in display order. */
export type SystemBucket =
  | 'funnels'
  | 'pages'
  | 'sequences'
  | 'organic'
  | 'ads'
  | 'deliverables'
  | 'kits';

/** Bucket per asset kind. Kinds left out are not part of a system. */
const BUCKET_OF_KIND: Partial<Record<AssetKind, SystemBucket>> = {
  'sales-funnel': 'funnels',
  'optin-funnel': 'funnels',
  'sales-page': 'pages',
  'optin-page': 'pages',
  sequence: 'sequences',
  organic: 'organic',
  ad: 'ads',
  deliverable: 'deliverables',
  'leadgen-kit': 'kits',
  'community-kit': 'kits',
  'highticket-kit': 'kits',
  'brand-bible': 'kits',
};

/** Bucket display order + labels, single source of truth for the UI. */
export const SYSTEM_BUCKETS: { id: SystemBucket; label: string }[] = [
  { id: 'funnels', label: 'Funnels' },
  { id: 'pages', label: 'Pages' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'organic', label: 'Organic' },
  { id: 'ads', label: 'Ads' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'kits', label: 'Kits' },
];

/** One offer/funnel and everything built for it. */
export interface AssetSystem {
  /** Offer slug, funnel slug, or `UNASSIGNED_SYSTEM_ID`. */
  id: string;
  /** Human label for the tab card. */
  label: string;
  /** Set only when the system is keyed by an offer. */
  offerSlug?: string;
  /** Every funnel slug that reports into this system. */
  funnelSlugs: string[];
  funnels: AssetItem[];
  pages: AssetItem[];
  sequences: AssetItem[];
  organic: AssetItem[];
  ads: AssetItem[];
  deliverables: AssetItem[];
  kits: AssetItem[];
  /** Every item in bucket order — what the row expands into. */
  items: AssetItem[];
  total: number;
  /** Performance of this system's funnels only (pages carry no metrics). */
  rollup: FunnelRollup;
  /**
   * Buckets that are completely empty, so the card can say "no sequences, no
   * ads" instead of making the operator diff seven counts. Always empty for the
   * unassigned group, which is a leftovers pile and not a system to complete.
   */
  missing: SystemBucket[];
}

/**
 * The group an asset belongs to: its offer, else its funnel, else unassigned.
 * Offer wins because one offer can own several funnels, and the operator thinks
 * in offers ("is Brain Dump finished?") before funnels.
 */
export function systemKeyOf(item: AssetItem): string {
  return item.offerSlug || item.funnelSlug || UNASSIGNED_SYSTEM_ID;
}

/** `brain-dump-system` → `Brain Dump System`. */
export function titleizeSlug(slug: string): string {
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Every item that can belong to a system: the whole bundle minus the catalog. */
export function systemSourceItems(bundle: AssetBundle): AssetItem[] {
  return [
    ...bundle.salesFunnels,
    ...bundle.optinFunnels,
    ...bundle.sequences,
    ...bundle.organic,
    ...bundle.ads,
    ...bundle.deliverables,
    ...bundle.kits,
  ].filter((item) => BUCKET_OF_KIND[item.kind] !== undefined);
}

/** Build one system from the items already known to share a group key. */
function assembleSystem(id: string, members: AssetItem[]): AssetSystem {
  const buckets: Record<SystemBucket, AssetItem[]> = {
    funnels: [],
    pages: [],
    sequences: [],
    organic: [],
    ads: [],
    deliverables: [],
    kits: [],
  };
  for (const item of members) {
    const bucket = BUCKET_OF_KIND[item.kind];
    if (bucket) buckets[bucket].push(item);
  }

  const unassigned = id === UNASSIGNED_SYSTEM_ID;
  const offerSlug = members.some((i) => i.offerSlug === id) ? id : undefined;
  // A single-funnel system reads better under the funnel's own name; an offer
  // with several funnels gets the offer slug so no one funnel claims the group.
  const label = unassigned
    ? 'Unassigned'
    : !offerSlug && buckets.funnels.length === 1
      ? buckets.funnels[0].title
      : titleizeSlug(id);

  const items = SYSTEM_BUCKETS.flatMap((b) => buckets[b.id]);
  return {
    id,
    label,
    offerSlug,
    funnelSlugs: Array.from(
      new Set(buckets.funnels.map((f) => f.funnelSlug).filter(Boolean)),
    ) as string[],
    ...buckets,
    items,
    total: items.length,
    rollup: rollupFunnels(buckets.funnels),
    missing: unassigned
      ? []
      : SYSTEM_BUCKETS.filter((b) => buckets[b.id].length === 0).map(
          (b) => b.id,
        ),
  };
}

/**
 * Systems ranked the way an operator triages them: highest revenue first, then
 * biggest, then alphabetical for stability. The unassigned pile always sorts
 * last — it's the inbox, not a priority.
 */
function compareSystems(a: AssetSystem, b: AssetSystem): number {
  if (a.id === UNASSIGNED_SYSTEM_ID) return 1;
  if (b.id === UNASSIGNED_SYSTEM_ID) return -1;
  return (
    b.rollup.revenueCents - a.rollup.revenueCents ||
    b.total - a.total ||
    a.label.localeCompare(b.label)
  );
}

/** Group a whole bundle into systems. */
export function buildSystems(bundle: AssetBundle): AssetSystem[] {
  const groups = new Map<string, AssetItem[]>();
  for (const item of systemSourceItems(bundle)) {
    const key = systemKeyOf(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries())
    .map(([id, members]) => assembleSystem(id, members))
    .sort(compareSystems);
}

/**
 * Re-derive systems from a subset of their items, so the search + status filter
 * bar works on the Systems tab too. Systems left with nothing are dropped, and
 * every count / rollup / missing list is recomputed from what survived rather
 * than kept from the unfiltered pass.
 */
export function filterSystems(
  systems: AssetSystem[],
  keep: (item: AssetItem) => boolean,
): AssetSystem[] {
  return systems
    .map((system) => assembleSystem(system.id, system.items.filter(keep)))
    .filter((system) => system.total > 0)
    .sort(compareSystems);
}

/** Headline counts for the Systems tab header. */
export function systemsSummary(systems: AssetSystem[]): {
  systems: number;
  complete: number;
  unassigned: number;
} {
  const real = systems.filter((s) => s.id !== UNASSIGNED_SYSTEM_ID);
  return {
    systems: real.length,
    complete: real.filter((s) => s.missing.length === 0).length,
    unassigned:
      systems.find((s) => s.id === UNASSIGNED_SYSTEM_ID)?.total ?? 0,
  };
}

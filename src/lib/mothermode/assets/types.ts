/**
 * Asset Hub types. One normalized shape (`AssetItem`) that every asset source —
 * sales funnels, optin funnels, email sequences, organic posts, paid ads,
 * deliverables, kits, and the static blueprint catalog — collapses into, so the
 * admin UI can render, filter, search, and roll up metrics without knowing
 * which table (or hardcoded catalog) an item came from.
 *
 * Pure types + label maps only: safe to import from client components.
 */

/** Every asset family the hub knows how to render. */
export type AssetKind =
  | 'sales-funnel'
  | 'sales-page'
  | 'optin-funnel'
  | 'optin-page'
  | 'sequence'
  | 'organic'
  | 'ad'
  | 'deliverable'
  | 'leadgen-kit'
  | 'community-kit'
  | 'highticket-kit'
  | 'brand-bible'
  | 'page'
  | 'blueprint';

/**
 * Lifecycle state. `template` = ships with the app (static catalog piece that is
 * real and usable). `planned` = on the roadmap, nothing built yet — this is what
 * the original hardcoded hub expressed with `planned: true`, preserved here.
 */
export type AssetStatus =
  | 'published'
  | 'draft'
  | 'archived'
  | 'template'
  | 'planned';

/** Tabs in the Asset Hub workspace. */
export type AssetTabId =
  | 'overview'
  /** Bundle regrouped by owning offer/funnel — see `assets/systems`. */
  | 'systems'
  | 'funnels'
  | 'organic'
  | 'ads'
  | 'sequences'
  | 'deliverables'
  | 'kits'
  | 'catalog';

/** A single asset, normalized. Only `id`/`kind`/`title`/`status` are required. */
export interface AssetItem {
  /** Unique within the hub. Prefix by source, e.g. `sf:<uuid>`, `gen:<id>`. */
  id: string;
  kind: AssetKind;
  title: string;
  /** One-line context: slug, platform + format, campaign type, etc. */
  subtitle?: string;
  status: AssetStatus;
  /** Public URL a visitor would see. Absent for drafts with no route. */
  liveHref?: string;
  /** Deep link into the admin editor that owns this asset. */
  editHref?: string;
  /** Grouping keys used by the filter bar. */
  offerSlug?: string;
  funnelSlug?: string;
  platform?: string;
  format?: string;
  /** ISO timestamp, newest-first sorting and the recent-activity feed. */
  updatedAt?: string;
  /** Free-form counters (views, leads, purchases, emails, revenueCents…). */
  metrics?: Record<string, number>;
  /** Short badges rendered next to the title. */
  tags?: string[];
  /** Set on child rows (funnel pages) to nest them under their parent. */
  parentId?: string;
  /**
   * Short label for a child row on its own ("Upsell 2"), so the UI can collapse
   * pages under their parent without parsing the ` — ` out of `title`.
   */
  pageLabel?: string;
}


/** Everything the hub page collects in one render pass. */
export interface AssetBundle {
  salesFunnels: AssetItem[];
  optinFunnels: AssetItem[];
  sequences: AssetItem[];
  organic: AssetItem[];
  ads: AssetItem[];
  deliverables: AssetItem[];
  kits: AssetItem[];
  /** The original hardcoded hub: app/admin routes + planned roadmap assets. */
  catalog: AssetItem[];
}

/** An empty bundle. Used as the fallback when every collector fails. */
export const EMPTY_BUNDLE: AssetBundle = {
  salesFunnels: [],
  optinFunnels: [],
  sequences: [],
  organic: [],
  ads: [],
  deliverables: [],
  kits: [],
  catalog: [],
};

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  'sales-funnel': 'Sales funnel',
  'sales-page': 'Funnel page',
  'optin-funnel': 'Opt-in funnel',
  'optin-page': 'Opt-in page',
  sequence: 'Email sequence',
  organic: 'Organic post',
  ad: 'Paid ad',
  deliverable: 'Deliverable',
  'leadgen-kit': 'Lead gen kit',
  'community-kit': 'Community kit',
  'highticket-kit': 'High ticket kit',
  'brand-bible': 'Brand bible',
  page: 'Page',
  blueprint: 'Blueprint',
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  published: 'Live',
  draft: 'Draft',
  archived: 'Archived',
  template: 'Template',
  planned: 'Planned',
};

/** Tailwind classes per status, matching the admin brass/bone palette. */
export const ASSET_STATUS_CLASS: Record<AssetStatus, string> = {
  published: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  draft: 'border-brass/30 bg-brass/10 text-brass',
  archived: 'border-bone/15 bg-bone/5 text-bone/40',
  template: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  planned: 'border-bone/15 bg-bone/[0.04] text-bone/45',
};

/** Tab order and labels, single source of truth for the tab bar. */
export const ASSET_TABS: { id: AssetTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'systems', label: 'Systems' },
  { id: 'funnels', label: 'Funnels' },
  { id: 'organic', label: 'Organic Content' },
  { id: 'ads', label: 'Paid Ads' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'kits', label: 'Kits' },
  { id: 'catalog', label: 'Catalog & Pages' },
];

export const isAssetTabId = (v: unknown): v is AssetTabId =>
  typeof v === 'string' && ASSET_TABS.some((t) => t.id === v);

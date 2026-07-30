# Asset Hub (`/admin/assets`) — System Port

Goal: turn `/admin/assets` from a static catalog into the single place where every
asset in the system shows up **dynamically**, organized by tab, with a metrics
dashboard on top and gap analysis that tells the operator what to fix next.

## Status

| Piece | File | State |
| --- | --- | --- |
| Types + tab registry | `src/lib/mothermode/assets/types.ts` | ✅ done |
| Metrics / rollups / gaps | `src/lib/mothermode/assets/metrics.ts` | ✅ done |
| Unit tests (19 passing) | `tests/lib/asset-hub.test.ts` | ✅ done |
| Server collectors | `src/lib/mothermode/assets/collect.ts` | ⬜ next |
| Tabbed workspace UI | `src/app/admin/assets/AssetsWorkspace.tsx` | ⬜ next |
| Page rewire | `src/app/admin/assets/page.tsx` | ⬜ next |

Run the tests with:

```
npx vitest run tests/lib/asset-hub.test.ts
```

## Data model

Everything normalizes to one shape, `AssetItem`, so a sales funnel, a Reel, and
an email sequence can sit in the same grid, filter bar, and dashboard:

```ts
interface AssetItem {
  id: string;              // stable, source-prefixed (e.g. "sales:brain-dump")
  kind: AssetKind;         // 'sales-funnel' | 'organic' | 'ad' | 'sequence' | ...
  title: string;
  subtitle?: string;
  status: AssetStatus;     // 'published' | 'draft' | 'planned' | 'archived'
  offerSlug?: string;
  funnelSlug?: string;
  platform?: string;       // organic/ads only
  format?: string;         // 'reel' | 'carousel' | 'ebook' | ...
  parentId?: string;       // page rows point at their funnel
  updatedAt?: string;      // ISO — drives Recent Activity
  metrics?: Record<string, number>;
  editHref?: string;       // admin deep link
  viewHref?: string;       // public URL
  thumbnailUrl?: string;
}
```

`AssetBundle` groups items by tab (`salesFunnels`, `optinFunnels`, `sequences`,
`organic`, `ads`, `deliverables`, `kits`, `catalog`). `EMPTY_BUNDLE` is the
zero value — collectors that fail should degrade to their empty array rather
than throwing the whole page.

### Metric key conventions

Funnel rows carry `views`, `leads`, `checkouts`, `purchases`, `revenueCents`,
and `sequences` (count of attached email kits — this is what drives the
"no sequence attached" gap). Organic/ads rows carry `variants`, `images`,
`videos`. Sequence rows carry `emails`, `sent`, `opens`, `clicks`.

## Tabs

`ASSET_TABS` in `types.ts` is the single source of truth; the UI maps over it so
adding a tab is a one-line change. Order: **Overview · Sales Funnels ·
Opt-in Funnels · Sequences · Organic Content · Paid Ads · Deliverables ·
Kits · Catalog**. `isAssetTabId()` guards the `?tab=` query param.

Organic and Paid Ads are separate tabs (as requested) even though both read from
`mothermode_generated_content` — they split on whether the row's intent/format is
promotional. Keep that predicate in the collector, not the UI.

## Remaining work

### 1. `src/lib/mothermode/assets/collect.ts` (server-only)

One `collect*` function per source, each returning `AssetItem[]` and swallowing
its own errors, then `collectAssetBundle()` running them in `Promise.all`:

- **Sales funnels** — `listSalesFunnels()` from `src/lib/mothermode/sales/store.ts`.
  Emit one parent row per funnel plus child rows (`parentId` set) for
  optin/vsl/sales/checkout/upsell/success/access pages so the tab can expand.
  `editHref: /admin/sales-funnels?slug=…`, `viewHref: /funnel/<slug>`.
  Set `metrics.sequences` from the funnel's attached email kits
  (`sales_funnel_email_kits`) — this is what the gap analysis keys on.
- **Opt-in funnels** — `listOptinFunnels()` from `src/lib/mothermode/optin/store.ts`,
  `editHref: /admin/funnels?slug=…`, `viewHref: /optin/<slug>`.
- **Sequences** — `listEmailKits()` from `src/lib/mothermode/email/store.ts`;
  one row per sequence with `metrics.emails`, plus stats from
  `src/lib/mothermode/email/statsStore.ts` when present.
- **Organic + Ads** — read `mothermode_generated_content`. Needs a new
  `listGeneratedRows({ limit })` export in the generated-content store (the
  existing API route only fetches per-offer). Split promotional formats into
  `ads`, everything else into `organic`; carry `platform`, `format`,
  `thumbnailUrl`, and `updatedAt`.
- **Deliverables** — `listDeliverables()` from `src/lib/mothermode/deliverables/store.ts`,
  `editHref: /admin/deliverables`, `viewHref: /mothermode/resource/<slug>/<key>`.
- **Kits** — lead-gen, community, high-ticket, brand-bible stores; one row each.
- **Catalog** — keep the current hand-written list from the old
  `page.tsx` as `status: 'planned'` rows so nothing is lost.

Metrics live in whatever tables already track them; do **not** add new
migrations for this feature. If a metric isn't available yet, omit the key —
`sumMetric` treats missing as zero and the dashboard just shows 0.

### 2. `AssetsWorkspace.tsx` (client)

Receives the collected bundle as a prop. Structure:

- Sticky header: title, total count, refresh.
- Tab strip from `ASSET_TABS` with per-tab counts, synced to `?tab=`.
- **Overview tab**: stat cards from `totals()`, funnel performance from
  `rollupFunnels([...salesFunnels, ...optinFunnels])` (views → leads → checkouts
  → purchases, opt-in %, close %, AOV), `countByField(all, 'kind')` bar list,
  a `findGaps()` "Needs attention" panel with severity pills and deep links, and
  `recentActivity()`.
- **Every other tab**: shared search + status/platform/offer filter bar wired to
  `searchAssets()` / `filterAssets()`, then a card grid (thumbnail, title,
  status pill, metric chips, Edit / View buttons). Funnel tabs nest child page
  rows under their parent.
- Empty states link to the builder that creates that asset type.

Reuse the existing admin primitives in `src/app/admin/sales-funnels/parts/ui.tsx`
for cards/pills/fields so the styling matches the rest of admin.

### 3. `page.tsx`

Server component: `const bundle = await collectAssetBundle()` →
`<AssetsWorkspace bundle={bundle} />`. Keep `export const dynamic = 'force-dynamic'`
so counts are never stale.

## Design notes

- All math is pure and lives in `metrics.ts` — collectors only normalize, the UI
  only renders. That's why the dashboard is testable without a database.
- Gap analysis filters out child rows (`!parentId`) so a funnel is reported once,
  and only flags zero-conversion funnels past a 25-view noise threshold.
- Rates are whole-number-friendly (0–100, one decimal) and every division is
  guarded, so an empty install renders zeros instead of `NaN`.

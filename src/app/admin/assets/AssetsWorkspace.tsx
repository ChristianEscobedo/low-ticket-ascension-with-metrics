'use client';

/**
 * Asset Hub workspace. Receives the fully collected `AssetBundle` from the
 * server page and renders it as a tabbed inventory: an Overview with totals,
 * the funnel rollup, gap analysis and recent activity, then one tab per asset
 * group with search + status filtering.
 *
 * All derived numbers come from `assets/metrics` — this component only decides
 * how to display them, so the math stays unit-tested and UI-free.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ASSET_KIND_LABEL,
  ASSET_STATUS_CLASS,
  ASSET_STATUS_LABEL,
  ASSET_TABS,
  type AssetBundle,
  type AssetItem,
  type AssetTabId,
} from '@/lib/mothermode/assets/types';
import {
  countByField,
  filterAssets,
  findGaps,
  flattenBundle,
  recentActivity,
  rollupFunnels,
  searchAssets,
  totals,
} from '@/lib/mothermode/assets/metrics';
import {
  buildSystems,
  filterSystems,
  UNASSIGNED_SYSTEM_ID,
} from '@/lib/mothermode/assets/systems';
import SystemsPanel from './SystemsPanel';


/* ------------------------------------------------------------------- atoms */

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-mode/30 bg-mode/[0.10] p-4">
      <div className="text-[11px] uppercase tracking-wider text-bone/45">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-bone">{value}</div>
      {hint ? <div className="mt-1 text-xs text-bone/40">{hint}</div> : null}
    </div>
  );
}

function StatusPill({ item }: { item: AssetItem }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${ASSET_STATUS_CLASS[item.status]}`}
    >
      {ASSET_STATUS_LABEL[item.status]}
    </span>
  );
}

/** One asset row: title, kind, status, metrics summary, and both links. */
function AssetRow({ item, nested }: { item: AssetItem; nested?: boolean }) {
  const summary = item.metrics
    ? Object.entries(item.metrics)
        .filter(([, v]) => v > 0)
        .map(([k, v]) =>
          k === 'revenueCents' ? `revenue ${money(v)}` : `${k} ${v}`,
        )
        .join(' · ')
    : '';
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-bone/[0.06] px-4 py-3 ${
        nested ? 'bg-bone/[0.015] pl-10' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-bone">{item.title}</span>
          <StatusPill item={item} />
          <span className="text-[10px] uppercase tracking-wider text-bone/35">
            {ASSET_KIND_LABEL[item.kind]}
          </span>
          {(item.tags ?? []).map((t) => (
            <span
              key={t}
              className="rounded-full border border-bone/15 px-2 py-0.5 text-[10px] text-bone/50"
            >
              {t}
            </span>
          ))}
        </div>
        {item.subtitle ? (
          <div className="mt-0.5 truncate text-xs text-bone/45">
            {item.subtitle}
          </div>
        ) : null}
        {summary ? (
          <div className="mt-0.5 text-[11px] text-brass/70">{summary}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {item.liveHref ? (
          <a
            href={item.liveHref}
            target="_blank"
            rel="noreferrer"
            className="text-bone/55 underline-offset-2 hover:text-bone hover:underline"
          >
            View
          </a>
        ) : null}
        {item.editHref ? (
          <Link
            href={item.editHref}
            className="text-brass underline-offset-2 hover:underline"
          >
            Edit
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A list of assets with parents first and their child pages nested underneath,
 * so a funnel and its ten pages read as one block instead of eleven rows.
 */
function AssetList({ items }: { items: AssetItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-bone/40">
        Nothing here yet.
      </div>
    );
  }
  const parents = items.filter((i) => !i.parentId);
  const children = items.filter((i) => i.parentId);
  const orphans = children.filter(
    (c) => !parents.some((p) => p.id === c.parentId),
  );
  return (
    <div>
      {parents.map((p) => (
        <div key={p.id}>
          <AssetRow item={p} />
          {children
            .filter((c) => c.parentId === p.id)
            .map((c) => (
              <AssetRow key={c.id} item={c} nested />
            ))}
        </div>
      ))}
      {orphans.map((c) => (
        <AssetRow key={c.id} item={c} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- workspace */

export default function AssetsWorkspace({ bundle }: { bundle: AssetBundle }) {
  const [tab, setTab] = useState<AssetTabId>('overview');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const all = useMemo(() => flattenBundle(bundle), [bundle]);
  const summary = useMemo(() => totals(bundle), [bundle]);
  const funnelItems = useMemo(
    () => [...bundle.salesFunnels, ...bundle.optinFunnels],
    [bundle],
  );
  const rollup = useMemo(() => rollupFunnels(funnelItems), [funnelItems]);
  const gaps = useMemo(() => findGaps(bundle), [bundle]);
  const recent = useMemo(() => recentActivity(bundle, 12), [bundle]);
  const platforms = useMemo(
    () => countByField([...bundle.organic, ...bundle.ads], 'platform'),
    [bundle],
  );

  /** Items for the active tab, then search + status filtered. */
  const visible = useMemo(() => {
    const source: AssetItem[] =
      tab === 'funnels'
        ? funnelItems
        : tab === 'organic'
          ? bundle.organic
          : tab === 'ads'
            ? bundle.ads
            : tab === 'sequences'
              ? bundle.sequences
              : tab === 'deliverables'
                ? bundle.deliverables
                : tab === 'kits'
                  ? bundle.kits
                  : tab === 'catalog'
                    ? bundle.catalog
                    : all;
    return filterAssets(searchAssets(source, query), { status });
  }, [tab, bundle, funnelItems, all, query, status]);

  /**
   * Systems are grouped from the whole bundle (not from `visible`, which is
   * scoped to the active tab) and then narrowed by the same search + status
   * filter. A page is kept when its parent funnel matches, so filtering by
   * "Sales Funnel" doesn't strip the pages out from under it.
   */
  const systems = useMemo(() => {
    const kept = new Set(
      filterAssets(searchAssets(all, query), { status }).map((i) => i.id),
    );
    return filterSystems(
      buildSystems(bundle),
      (item) =>
        kept.has(item.id) || (item.parentId ? kept.has(item.parentId) : false),
    );
  }, [all, bundle, query, status]);

  const systemsSummary = useMemo(() => {
    const named = systems.filter((s) => s.id !== UNASSIGNED_SYSTEM_ID);
    return {
      systems: named.length,
      complete: named.filter((s) => s.missing.length === 0).length,
      unassigned:
        systems.find((s) => s.id === UNASSIGNED_SYSTEM_ID)?.total ?? 0,
    };
  }, [systems]);

  const counts: Record<AssetTabId, number> = {
    overview: summary.total,
    systems: systems.length,
    funnels: funnelItems.length,

    organic: bundle.organic.length,
    ads: bundle.ads.length,
    sequences: bundle.sequences.length,
    deliverables: bundle.deliverables.length,
    kits: bundle.kits.length,
    catalog: bundle.catalog.length,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-bone">Asset Hub</h1>
        <p className="mt-1 text-sm text-bone/50">
          Every funnel, page, sequence, post, ad, deliverable, and kit in the
          system — with the numbers each one is producing.
        </p>
      </header>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-bone/10 pb-px">
        {ASSET_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm transition ${
              tab === t.id
                ? 'border border-b-0 border-bone/15 bg-bone/[0.06] text-bone'
                : 'text-bone/50 hover:text-bone/80'
            }`}
          >
            {t.label}
            <span className="ml-2 text-[10px] text-bone/35">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {tab === 'systems' ? (
        <div className="space-y-3">
          {/* Same filter bar as the list tabs — it drives the grouping too. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, slugs, platforms…"
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-bone/15 bg-ink px-3 text-sm text-bone placeholder:text-bone/30 focus:border-brass/50 focus:outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-bone/15 bg-ink px-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="published">Live</option>
              <option value="draft">Draft</option>
              <option value="template">Template</option>
              <option value="planned">Planned</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <SystemsPanel systems={systems} summary={systemsSummary} />
        </div>
      ) : tab === 'overview' ? (

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total assets"
              value={String(summary.total)}
              hint={`${summary.live} live · ${summary.draft} draft · ${summary.planned} planned`}
            />
            <StatCard
              label="Funnels"
              value={String(rollup.funnels)}
              hint={`${rollup.live} published`}
            />
            <StatCard
              label="Revenue"
              value={money(rollup.revenueCents)}
              hint={`AOV ${money(rollup.aovCents)}`}
            />
            <StatCard
              label="Conversion"
              value={pct(rollup.optinRate)}
              hint={`opt-in rate · close ${pct(rollup.closeRate)}`}
            />
          </div>

          {/* Funnel rollup */}
          <section className="rounded-xl border border-mode/25 bg-mode/[0.07]">
            <h2 className="border-b border-bone/10 px-4 py-3 text-sm font-medium text-bone">
              Funnel performance
            </h2>
            <div className="grid gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Views', rollup.views],
                ['Leads', rollup.leads],
                ['Checkouts', rollup.checkouts],
                ['Purchases', rollup.purchases],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="text-[11px] uppercase tracking-wider text-bone/45">
                    {label}
                  </div>
                  <div className="text-lg text-bone">
                    {Number(value).toLocaleString('en-US')}
                  </div>
                </div>
              ))}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-bone/45">
                  Revenue
                </div>
                <div className="text-lg text-brass">
                  {money(rollup.revenueCents)}
                </div>
              </div>
            </div>
          </section>

          {/* Gaps */}
          <section className="rounded-xl border border-mode/25 bg-mode/[0.07]">
            <h2 className="border-b border-bone/10 px-4 py-3 text-sm font-medium text-bone">
              Gaps to close{' '}
              <span className="text-bone/40">({gaps.length})</span>
            </h2>
            {gaps.length === 0 ? (
              <div className="px-4 py-6 text-sm text-bone/45">
                No gaps detected — every funnel has pages, sequences, and
                content attached.
              </div>
            ) : (
              <ul>
                {gaps.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center gap-3 border-t border-bone/[0.06] px-4 py-3"
                  >
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        g.severity === 'high'
                          ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                          : g.severity === 'medium'
                            ? 'border-brass/30 bg-brass/10 text-brass'
                            : 'border-bone/15 bg-bone/5 text-bone/50'
                      }`}
                    >
                      {g.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-bone">{g.label}</div>
                      <div className="text-xs text-bone/45">{g.detail}</div>
                    </div>
                    {g.href ? (
                      <Link
                        href={g.href}
                        className="text-xs text-brass underline-offset-2 hover:underline"
                      >
                        Fix
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Mix by kind */}
            <section className="rounded-xl border border-mode/25 bg-mode/[0.07]">
              <h2 className="border-b border-bone/10 px-4 py-3 text-sm font-medium text-bone">
                Asset mix
              </h2>
              <ul className="p-4 text-sm">
                {summary.byKind.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-bone/60">
                      {ASSET_KIND_LABEL[
                        row.key as keyof typeof ASSET_KIND_LABEL
                      ] ?? row.key}
                    </span>
                    <span className="text-bone">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Recent activity */}
            <section className="rounded-xl border border-mode/25 bg-mode/[0.07]">
              <h2 className="border-b border-bone/10 px-4 py-3 text-sm font-medium text-bone">
                Recent activity
              </h2>
              {recent.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bone/45">
                  Nothing has been edited yet.
                </div>
              ) : (
                <ul>
                  {recent.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center gap-3 border-t border-bone/[0.06] px-4 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-bone/70">
                        {i.title}
                      </span>
                      <span className="text-[11px] text-bone/35">
                        {i.updatedAt
                          ? new Date(i.updatedAt).toLocaleDateString('en-US')
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {platforms.length > 0 ? (
            <section className="rounded-xl border border-mode/25 bg-mode/[0.07]">
              <h2 className="border-b border-bone/10 px-4 py-3 text-sm font-medium text-bone">
                Content by platform
              </h2>
              <div className="flex flex-wrap gap-2 p-4">
                {platforms.map((p) => (
                  <span
                    key={p.key}
                    className="rounded-full border border-bone/15 px-3 py-1 text-xs text-bone/60"
                  >
                    {p.key} <span className="text-bone/40">{p.count}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, slugs, platforms…"
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-bone/15 bg-ink px-3 text-sm text-bone placeholder:text-bone/30 focus:border-brass/50 focus:outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-bone/15 bg-ink px-2 text-sm text-bone focus:border-brass/50 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="published">Live</option>
              <option value="draft">Draft</option>
              <option value="template">Template</option>
              <option value="planned">Planned</option>
              <option value="archived">Archived</option>
            </select>
            <span className="text-xs text-bone/40">
              {visible.length} shown
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-mode/25 bg-mode/[0.07]">
            <AssetList items={visible} />
          </div>
        </div>
      )}
    </div>
  );
}

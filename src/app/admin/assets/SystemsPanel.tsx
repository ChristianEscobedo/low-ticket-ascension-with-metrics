'use client';

/**
 * Asset Hub → Systems tab.
 *
 * Every other tab is a flat list of one asset kind. This one answers the
 * question an operator actually asks — **"is this offer a finished system?"** —
 * by grouping the bundle by owning offer/funnel (see `assets/systems`) and
 * nesting properly inside each group: funnel first, its pages indented under it
 * (via `parentId` + `pageLabel`, no title parsing), then the sequences, posts,
 * ads, deliverables and kits that point at the same offer.
 *
 * Kits and posts that name no offer and no funnel land in the **Unassigned**
 * group rather than being guessed into a system. That group is the work queue:
 * each row links straight to the editor that owns the asset, which is where the
 * offer/funnel field lives. There is no assign control here yet — writing
 * attribution from the hub needs a mutation endpoint per source table, so this
 * panel deliberately reads and routes instead of pretending to write.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ASSET_KIND_LABEL,
  ASSET_STATUS_CLASS,
  ASSET_STATUS_LABEL,
  type AssetItem,
} from '@/lib/mothermode/assets/types';
import {
  SYSTEM_BUCKETS,
  UNASSIGNED_SYSTEM_ID,
  type AssetSystem,
  type SystemBucket,
} from '@/lib/mothermode/assets/systems';

const money = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/** Burgundy tint, matching the Overview/section cards in AssetsWorkspace. */
const CARD = 'rounded-xl border border-mode/25 bg-mode/[0.07]';

/**
 * One header figure. Rendered only when non-zero so a system with no traffic
 * yet stays quiet instead of showing a row of confident zeros.
 */
function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="text-[11px] text-bone/40">
      {label} <span className={tone ?? 'text-bone/70'}>{value}</span>
    </span>
  );
}


function StatusPill({ item }: { item: AssetItem }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${ASSET_STATUS_CLASS[item.status]}`}
    >
      {ASSET_STATUS_LABEL[item.status]}
    </span>
  );
}

/** One asset line. `nested` indents funnel pages under their funnel. */
function Row({ item, nested }: { item: AssetItem; nested?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 py-1.5 text-sm ${
        nested ? 'ml-4 border-l border-bone/10 pl-3 text-bone/70' : 'text-bone'
      }`}
    >
      <span className="truncate">{nested ? item.pageLabel || item.title : item.title}</span>
      <StatusPill item={item} />
      {!nested ? (
        <span className="text-[11px] text-bone/40">{ASSET_KIND_LABEL[item.kind]}</span>
      ) : null}
      <span className="ml-auto flex items-center gap-3 text-[11px]">
        {item.liveHref ? (
          <Link href={item.liveHref} className="text-bone/50 hover:text-bone" target="_blank">
            View
          </Link>
        ) : null}
        {item.editHref ? (
          <Link href={item.editHref} className="text-brass hover:underline">
            Edit
          </Link>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Funnels bucket, rendered as a tree: each funnel followed by the pages that
 * claim it as their parent. Pages whose parent lives in another system (or was
 * filtered out) fall through to the flat Pages bucket instead of disappearing.
 */
function FunnelTree({ system }: { system: AssetSystem }) {
  return (
    <div>
      {system.funnels.map((funnel) => {
        const pages = system.pages.filter((page) => page.parentId === funnel.id);
        return (

          <div key={funnel.id} className="py-0.5">
            <Row item={funnel} />
            {pages.map((page) => (
              <Row key={page.id} item={page} nested />
            ))}
          </div>
        );
      })}
      {system.pages
        .filter((page) => !system.funnels.some((f) => f.id === page.parentId))
        .map((page) => (
          <Row key={page.id} item={page} />
        ))}
    </div>
  );
}

function Bucket({
  bucket,
  label,
  items,
}: {
  bucket: SystemBucket;
  label: string;
  items: AssetItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div key={bucket} className="border-t border-bone/5 px-4 py-2 first:border-t-0">
      <p className="text-[11px] uppercase tracking-wide text-bone/40">
        {label} · {items.length}
      </p>
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </div>
  );
}

function SystemCard({ system }: { system: AssetSystem }) {
  const [open, setOpen] = useState(false);
  const unassigned = system.id === UNASSIGNED_SYSTEM_ID;
  // The map deep-links to this system's funnel (the focus view). A system with
  // a funnel gets a "Map →" button opening its subgraph on the canvas.
  const mapFunnelId = system.funnels[0]?.id ?? null;

  return (
    <div className={CARD}>
      <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-left"
        >
          <span className="text-bone/30">{open ? '▾' : '▸'}</span>
          <span className="font-medium text-bone">{system.label}</span>
          <span className="text-[11px] text-bone/40">{system.total} assets</span>
          {system.rollup.leads > 0 ? (
            <Figure label="Leads" value={system.rollup.leads.toLocaleString()} />
          ) : null}
          {system.rollup.purchases > 0 ? (
            <Figure label="Sales" value={system.rollup.purchases.toLocaleString()} />
          ) : null}
          {system.rollup.revenueCents > 0 ? (
            <Figure
              label="Revenue"
              value={money(system.rollup.revenueCents)}
              tone="text-emerald-300"
            />
          ) : null}
        </button>

        <span className="ml-auto flex items-center gap-3">
          {/* Open just this system on the System Map (the focus view). */}
          {mapFunnelId ? (
            <Link
              href={`/admin/system-map?funnel=${mapFunnelId}`}
              className="rounded-md border border-brass/40 px-2 py-0.5 text-[11px] font-semibold text-brass hover:bg-brass/10"
            >
              Map →
            </Link>
          ) : null}
          {unassigned ? (
            <span className="text-[11px] text-bone/40">
              Not attributed to an offer or funnel — open each asset to assign it
            </span>
          ) : system.missing.length > 0 ? (
            <span className="text-[11px] text-brass/80">
              Missing: {system.missing.map((m) => SYSTEM_BUCKETS.find((b) => b.id === m)?.label).join(', ')}
            </span>
          ) : (
            <span className="text-[11px] text-emerald-300">Complete</span>
          )}
        </span>
      </div>

      {open ? (
        <div className="pb-2">
          {system.funnels.length > 0 || system.pages.length > 0 ? (
            <div className="border-t border-bone/5 px-4 py-2">
              <p className="text-[11px] uppercase tracking-wide text-bone/40">
                Funnels &amp; pages · {system.funnels.length + system.pages.length}
              </p>
              <FunnelTree system={system} />
            </div>
          ) : null}
          {SYSTEM_BUCKETS.filter((b) => b.id !== 'funnels' && b.id !== 'pages').map((b) => (
            <Bucket key={b.id} bucket={b.id} label={b.label} items={system[b.id]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SystemsPanel({
  systems,
  summary,
}: {
  systems: AssetSystem[];
  summary: { systems: number; complete: number; unassigned: number };
}) {
  if (systems.length === 0) {
    return (
      <p className="rounded-xl border border-bone/10 bg-bone/[0.02] px-4 py-6 text-sm text-bone/50">
        No assets match the current search or status filter.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* The system map — the whole thing as a node graph (pages, the emails
          each step fires, the ads/content feeding traffic in), on its own
          fullscreen canvas. */}
      <Link
        href="/admin/system-map"
        className={`${CARD} group flex items-center gap-3 px-4 py-3 transition-colors hover:border-brass/40`}
      >
        <span className="font-medium text-bone">System map</span>
        <span className="text-[11px] text-bone/40">
          the whole system as a graph — pages, emails, and the traffic feeding them
        </span>
        <span className="ml-auto text-brass transition-transform group-hover:translate-x-0.5">
          Open the map →
        </span>
      </Link>
      <p className="text-sm text-bone/50">
        {summary.systems} system{summary.systems === 1 ? '' : 's'} · {summary.complete}{' '}
        complete
        {summary.unassigned > 0 ? ` · ${summary.unassigned} unassigned assets` : ''}
      </p>
      {systems.map((system) => (
        <SystemCard key={system.id} system={system} />
      ))}
    </div>
  );
}

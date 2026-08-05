/**
 * Asset Hub collectors — server-only.
 *
 * Every builder in the system already persists its own records (sales funnels,
 * opt-in funnels, email kits, generated content, deliverables, lead-gen /
 * community / high-ticket kits). This module reads each of those stores and
 * normalizes what it finds into the single `AssetItem` shape from `./types`,
 * grouped into an `AssetBundle`, so the admin UI can render, filter, and roll up
 * metrics without knowing how any individual builder stores its data.
 *
 * Rules every collector follows:
 *  - Never throw. A missing table or failed query yields `[]` for that group
 *    only, so one broken store can't blank the whole hub.
 *  - Always set `editHref` (admin deep link) and, when a public route exists,
 *    `liveHref`.
 *  - Metrics keys are omitted when a number isn't tracked, so the funnel rollup
 *    can tell "no data" apart from "genuinely zero".
 */
import type { AssetBundle, AssetItem, AssetStatus } from './types';
import { EMPTY_BUNDLE } from './types';
import type { SequenceAttribution } from './attribution';
import {
  applySequenceAttribution,
  salesPagePlan,
  sequenceAttributionFrom,
} from './attribution';

import { listFunnelsForAdmin as listSalesFunnelsForAdmin } from '@/lib/mothermode/sales/store';
import { listFunnelsForAdmin as listOptinFunnelsForAdmin } from '@/lib/mothermode/optin/store';
import { listKitsForAdmin as listEmailKitsForAdmin } from '@/lib/mothermode/email/store';
import { listKitsForAdmin as listLeadGenKitsForAdmin } from '@/lib/mothermode/leadgen/store';
import { listKitsForAdmin as listCommunityKitsForAdmin } from '@/lib/mothermode/community/store';
import { listKitsForAdmin as listHighTicketKitsForAdmin } from '@/lib/mothermode/highticket/store';
import { listGeneratedRows } from '@/utils/mothermode/generated-content';
import { DELIVERABLE_CATALOG } from '@/lib/mothermode/deliverables';

/* ------------------------------------------------------------------ helpers */

/** Funnel lifecycle → AssetStatus (identical vocabularies). */
function funnelStatus(status: string | null | undefined): AssetStatus {
  if (status === 'archived') return 'archived';
  if (status === 'published') return 'published';
  return 'draft';
}

/** Kit lifecycle → AssetStatus. A kit's 'active' is a funnel's 'published'. */
function kitStatus(status: string | null | undefined): AssetStatus {
  if (status === 'archived') return 'archived';
  if (status === 'active' || status === 'published') return 'published';
  return 'draft';
}

/** ISO string or `undefined` — `AssetItem.updatedAt` is optional, never null. */
function iso(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return undefined;
}

/** A finite number, or `undefined` so the key can be dropped. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Drops undefined metric values; returns undefined when nothing is tracked. */
function metrics(
  input: Record<string, number | undefined>,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v;
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ------------------------------------------------------------ sales funnels */

/**
 * Sales funnels: a parent `sales-funnel` item per funnel carrying the whole
 * rollup (views → leads → checkouts → purchases → revenue), plus one nested
 * `sales-page` child per public page so every URL the funnel exposes is listed
 * and clickable.
 *
 * Pages come from `salesPagePlan(f)`, which skips disabled upsell slots, so the
 * `pages` metric describes the funnel that exists instead of the ten-page shape
 * a maximal funnel could have.
 *
 * Also returns the kit → funnel map: this is the only place the funnel→email-kit
 * binding is visible, and `collectAssetBundle` stamps it onto the sequence items
 * so email kits can name the system they belong to.
 */
export async function collectSalesFunnels(): Promise<{
  items: AssetItem[];
  attribution: SequenceAttribution;
}> {
  try {
    const funnels = await listSalesFunnelsForAdmin();
    const items: AssetItem[] = [];
    const attribution = sequenceAttributionFrom(funnels);
    for (const f of funnels) {
      const editHref = `/admin/sales-funnels?slug=${encodeURIComponent(f.slug)}`;
      const status = funnelStatus(f.status);
      const updatedAt = iso(f.updatedAt, f.createdAt);
      const upsells =
        (num(f.upsell1Yes) ?? 0) +
        (num(f.upsell2Yes) ?? 0) +
        (num(f.upsell3Yes) ?? 0) +
        (num(f.upsell4Yes) ?? 0);
      const pagePlan = salesPagePlan(f);
      const sequenceIds = new Set<string>(
        (f.emailKits ?? []).map((b) => b.emailKitId).filter(Boolean),
      );
      if (f.emailKitId) sequenceIds.add(f.emailKitId);
      items.push({
        id: `sf:${f.id}`,
        kind: 'sales-funnel',
        title: f.name || f.slug,
        subtitle: f.offerSlug ? `Offer · ${f.offerSlug}` : `/funnel/${f.slug}`,
        status,
        liveHref: `/funnel/${f.slug}`,
        editHref,
        offerSlug: f.offerSlug ?? undefined,
        funnelSlug: f.slug,
        updatedAt,
        metrics: metrics({
          views: num(f.viewCount),
          leads: num(f.conversionCount),
          checkouts: num(f.checkoutCount),
          purchases: num(f.purchaseCount),
          upsells,
          revenueCents: num(f.revenueCents),
          sequences: sequenceIds.size,
          pages: pagePlan.length,
        }),
      });
      for (const page of pagePlan) {
        items.push({
          id: `sf:${f.id}:${page.suffix || 'optin'}`,
          kind: 'sales-page',
          title: `${f.name || f.slug} — ${page.label}`,
          subtitle: `/funnel/${f.slug}${page.suffix}`,
          status,
          liveHref: `/funnel/${f.slug}${page.suffix}`,
          editHref,
          funnelSlug: f.slug,
          offerSlug: f.offerSlug ?? undefined,
          updatedAt,
          parentId: `sf:${f.id}`,
          pageLabel: page.label,
        });
      }
    }
    return { items, attribution };
  } catch {
    return { items: [], attribution: {} };
  }
}

/* ------------------------------------------------------------ optin funnels */

/** The public pages an opt-in funnel ships. */
const OPTIN_PAGES: { suffix: string; label: string }[] = [
  { suffix: '', label: 'Opt-in' },
  { suffix: '/oto', label: 'OTO' },
  { suffix: '/thank-you', label: 'Thank you' },
];

/**
 * Opt-in funnels: parent item with views / leads / OTO takes, plus a nested
 * `optin-page` child per page. OTO "yes" counts feed the upsell column.
 */
export async function collectOptinFunnels(): Promise<{
  items: AssetItem[];
  attribution: SequenceAttribution;
}> {
  try {
    const funnels = await listOptinFunnelsForAdmin();
    const items: AssetItem[] = [];
    const attribution = sequenceAttributionFrom(funnels);
    for (const f of funnels) {
      const editHref = `/admin/funnels?slug=${encodeURIComponent(f.slug)}`;
      const status = funnelStatus(f.status);
      const updatedAt = iso(f.updatedAt, f.createdAt);
      items.push({
        id: `of:${f.id}`,
        kind: 'optin-funnel',
        title: f.name || f.slug,
        subtitle: f.leadGenSlug
          ? `Lead magnet · ${f.leadGenSlug}`
          : `/optin/${f.slug}`,
        status,
        liveHref: `/optin/${f.slug}`,
        editHref,
        offerSlug: f.offerSlug ?? undefined,
        funnelSlug: f.slug,
        updatedAt,
        metrics: metrics({
          views: num(f.viewCount),
          leads: num(f.conversionCount),
          upsells: num(f.otoYesCount),
          sequences: f.emailKitId ? 1 : 0,
          pages: OPTIN_PAGES.length,
        }),
      });
      for (const page of OPTIN_PAGES) {
        items.push({
          id: `of:${f.id}:${page.suffix || 'optin'}`,
          kind: 'optin-page',
          title: `${f.name || f.slug} — ${page.label}`,
          subtitle: `/optin/${f.slug}${page.suffix}`,
          status,
          liveHref: `/optin/${f.slug}${page.suffix}`,
          editHref,
          funnelSlug: f.slug,
          offerSlug: f.offerSlug ?? undefined,
          updatedAt,
          parentId: `of:${f.id}`,
          pageLabel: page.label,
        });
      }
    }
    return { items, attribution };
  } catch {
    return { items: [], attribution: {} };
  }
}

/* --------------------------------------------------------------- sequences */

/**
 * Email kits, one `sequence` item each. The `emails` metric exposes kits that
 * exist but have no messages written yet, which the gap analyzer flags.
 */
export async function collectSequences(): Promise<AssetItem[]> {
  try {
    const kits = await listEmailKitsForAdmin();
    return kits.map((k) => ({
      id: `seq:${k.id}`,
      kind: 'sequence' as const,
      title: k.name || k.slug,
      subtitle: `${k.campaignType} · ${k.framework}`,
      status: kitStatus(k.status),
      editHref: `/admin/email-marketing?kit=${encodeURIComponent(k.id)}`,
      format: k.campaignType,
      updatedAt: iso(k.updatedAt, k.createdAt),
      tags: k.sequence?.trigger ? [k.sequence.trigger] : undefined,
      metrics: metrics({ emails: k.sequence?.emails?.length ?? 0 }),
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------- generated content */

/** True when a generated row is an ad rather than an organic post. */
function isPaidAd(row: { format: string | null; kind: string | null }): boolean {
  const haystack = `${row.format ?? ''} ${row.kind ?? ''}`.toLowerCase();
  return haystack.includes('ad') || haystack.includes('paid');
}

/**
 * AI-generated content, split into the Organic Content and Paid Ads groups.
 * Archived rows are kept (flagged archived) so nothing silently disappears from
 * the hub after a cleanup pass.
 */
export async function collectGeneratedContent(): Promise<{
  organic: AssetItem[];
  ads: AssetItem[];
}> {
  try {
    const rows = await listGeneratedRows({ limit: 500 });
    const organic: AssetItem[] = [];
    const ads: AssetItem[] = [];
    for (const r of rows) {
      const paid = isPaidAd(r);
      const item: AssetItem = {
        id: `gen:${r.id}`,
        kind: paid ? 'ad' : 'organic',
        title: r.title || `${r.platform ?? 'Content'} ${r.format ?? ''}`.trim(),
        subtitle: [r.platform, r.format, r.offerSlug]
          .filter(Boolean)
          .join(' · '),
        status: r.status === 'archived' ? 'archived' : 'published',
        // Deep link straight to this piece so the hub can open its sheet.
        editHref: `/admin/content?piece=${encodeURIComponent(r.id)}`,
        platform: r.platform ?? undefined,
        format: r.format ?? undefined,
        offerSlug: r.offerSlug ?? undefined,
        updatedAt: iso(r.createdAt),
      };
      (paid ? ads : organic).push(item);
    }
    return { organic, ads };
  } catch {
    return { organic: [], ads: [] };
  }
}

/* ------------------------------------------------------------ deliverables */

/**
 * Buyer-facing resource docs from the static catalog. These ship with the app,
 * so they report as `template` with a live link to the buyer view and an edit
 * link into the deliverables editor.
 */
export function collectDeliverables(): AssetItem[] {
  try {
    return DELIVERABLE_CATALOG.map((d) => ({
      id: `dlv:${d.slug}:${d.key}`,
      kind: 'deliverable' as const,
      title: d.title,
      subtitle: d.subtitle || `${d.slug} · ${d.key}`,
      status: 'template' as const,
      liveHref: `/mothermode/resource/${d.slug}/${d.key}`,
      editHref: `/admin/deliverables?slug=${encodeURIComponent(d.slug)}&key=${encodeURIComponent(d.key)}`,
      offerSlug: d.slug,
    }));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------- kits */

/**
 * The three non-email kit builders: lead-gen magnets, community kits, and
 * high-ticket kits. Each group is collected independently so a single failing
 * table only removes its own rows.
 */
export async function collectKits(): Promise<AssetItem[]> {
  const items: AssetItem[] = [];
  try {
    for (const k of await listLeadGenKitsForAdmin()) {
      items.push({
        id: `lgk:${k.id}`,
        kind: 'leadgen-kit',
        title: k.name || k.slug,
        subtitle: `Lead magnet · ${k.format}`,
        status: kitStatus(k.status),
        format: k.format,
        editHref: `/admin/lead-gen?kit=${encodeURIComponent(k.id)}`,
        liveHref:
          k.publishedSlug && k.publishedKey
            ? `/mothermode/resource/${k.publishedSlug}/${k.publishedKey}`
            : undefined,
        updatedAt: iso(k.updatedAt, k.createdAt),
      });
    }
  } catch {
    /* lead-gen store unavailable — skip this group only */
  }
  try {
    for (const k of await listCommunityKitsForAdmin()) {
      items.push({
        id: `ck:${k.id}`,
        kind: 'community-kit',
        title: k.name || k.slug,
        subtitle: `Community · ${k.communityType}`,
        status: kitStatus(k.status),
        format: k.communityType,
        editHref: `/admin/community?kit=${encodeURIComponent(k.id)}`,
        updatedAt: iso(k.updatedAt, k.createdAt),
      });
    }
  } catch {
    /* community store unavailable */
  }
  try {
    for (const k of await listHighTicketKitsForAdmin()) {
      items.push({
        id: `htk:${k.id}`,
        kind: 'highticket-kit',
        title: k.name || k.slug,
        subtitle: 'High-ticket kit',
        status: kitStatus(k.status),
        editHref: `/admin/high-ticket?kit=${encodeURIComponent(k.id)}`,
        updatedAt: iso(k.updatedAt, k.createdAt),
      });
    }
  } catch {
    /* high-ticket store unavailable */
  }
  return items;
}

/* ----------------------------------------------------------------- catalog */

/**
 * The static side of the hub: the admin builders and buyer-facing routes that
 * ship with the app (`template`), plus the roadmap items that don't exist yet
 * (`planned`). This preserves what the original hardcoded Asset Hub listed, so
 * the page still answers "what does this system contain?" and not just "what
 * rows are in the database?".
 */
export function collectCatalog(): AssetItem[] {
  const pages: { title: string; href: string; subtitle: string }[] = [
    { title: 'Sales Funnel Builder', href: '/admin/sales-funnels', subtitle: 'Opt-in → sales → VSL → checkout → upsells → success' },
    { title: 'Lead Gen Funnels', href: '/admin/funnels', subtitle: 'Lead capture → OTO → thank you' },
    { title: 'Email Marketing', href: '/admin/email-marketing', subtitle: 'Sequences, triggers, analytics, inbox preview' },
    { title: 'Content Hub', href: '/admin/content', subtitle: 'Organic posts, ads, images, reels, exports' },
    { title: 'Content Planner', href: '/admin/planner', subtitle: 'Calendar board + schedule export bridge' },
    { title: 'Lead Gen Kits', href: '/admin/lead-gen', subtitle: 'Lead magnets in 10 formats' },
    { title: 'Community Kits', href: '/admin/community', subtitle: 'DM scripts, pinned posts, lead forms' },
    { title: 'High Ticket Kits', href: '/admin/high-ticket', subtitle: 'Call scripts, qualifying, close frameworks' },
    { title: 'Deliverables', href: '/admin/deliverables', subtitle: 'Buyer resource docs and overrides' },
    { title: 'Brand Bible', href: '/admin/brand-bible', subtitle: 'Visual direction fed into image + video prompts' },
    { title: 'Help Center', href: '/admin/help', subtitle: 'Knowledge base articles and changelog' },
    { title: 'Asset Hub', href: '/admin/assets', subtitle: 'This page — every asset in one inventory' },
  ];
  const planned: { title: string; subtitle: string }[] = [
    { title: 'Affiliate Center', subtitle: 'Partner links, payouts, leaderboards' },
    { title: 'Course Area', subtitle: 'Modules, lessons, progress tracking' },
    { title: 'Ad Account Sync', subtitle: 'Pull spend + ROAS back into the hub' },
  ];
  return [
    ...pages.map((p) => ({
      id: `page:${p.href}`,
      kind: 'page' as const,
      title: p.title,
      subtitle: p.subtitle,
      status: 'template' as const,
      editHref: p.href,
    })),
    ...planned.map((p) => ({
      id: `bp:${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      kind: 'blueprint' as const,
      title: p.title,
      subtitle: p.subtitle,
      status: 'planned' as const,
    })),
  ];
}

/* ------------------------------------------------------------------ bundle */

/**
 * Collect every asset group in parallel. This is the single call the
 * `/admin/assets` page makes; `./metrics` then derives totals, the funnel
 * rollup, recent activity, and the gap analysis from the bundle. Falls back to
 * `EMPTY_BUNDLE` only if the whole pass fails.
 */
export async function collectAssetBundle(): Promise<AssetBundle> {
  try {
    const [salesFunnels, optinFunnels, sequences, generated, kits] =
      await Promise.all([
        collectSalesFunnels(),
        collectOptinFunnels(),
        collectSequences(),
        collectGeneratedContent(),
        collectKits(),
      ]);
    // Sales bindings win over opt-in ones for a shared kit, matching the order
    // the two funnel families are listed in.
    const attribution: SequenceAttribution = {
      ...optinFunnels.attribution,
      ...salesFunnels.attribution,
    };
    return {
      salesFunnels: salesFunnels.items,
      optinFunnels: optinFunnels.items,
      sequences: applySequenceAttribution(sequences, attribution),
      organic: generated.organic,
      ads: generated.ads,
      deliverables: collectDeliverables(),
      kits,
      catalog: collectCatalog(),
    };
  } catch {
    return EMPTY_BUNDLE;
  }
}

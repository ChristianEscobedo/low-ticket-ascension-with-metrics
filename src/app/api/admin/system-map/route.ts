/**
 * GET /api/admin/system-map — the graph behind the `/admin/system-map` canvas.
 *
 * Loads the live records (sales + optin funnels, email kits, utm links, the
 * planner's content pieces), maps them into the builder's small input, and
 * returns the positioned node/edge graph. The connection tissue is already on
 * the records: a utm link carries funnel_id + funnel_page + piece_id, and a
 * funnel carries emailKits: [{ event, emailKitId }] — no URL parsing.
 *
 * The mapping lives here (thin); the graph + the layout live in
 * `@/lib/mothermode/systemMap` (pure, unit-tested).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { listFunnelsForAdmin as listSalesFunnels } from '@/lib/mothermode/sales/store';
import { listFunnelsForAdmin as listOptinFunnels } from '@/lib/mothermode/optin/store';
import { listKitsForAdmin } from '@/lib/mothermode/email/store';
import { listUtmLinks, updateUtmLinkTarget } from '@/lib/mothermode/planner/links';
import { listContentPlan } from '@/lib/mothermode/planner/store';
import type {
  SystemMapContentInput,
  SystemMapFunnelInput,
  SystemMapLinkInput,
  SystemMapInput,
} from '@/lib/mothermode/systemMap';
import type { SalesFunnelRecord, SalesEmailEvent } from '@/lib/mothermode/sales/types';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';
import type { EmailKitRecord } from '@/lib/mothermode/email/types';

export const dynamic = 'force-dynamic';

const SALES_LEADS = 'mothermode_sales_funnel_leads';

/**
 * Content→buyer attribution: aggregate the sales leads by the piece that
 * produced them (the lead carries the piece id in `utm_content`, plus
 * `purchased` + `purchase_amount_cents`). Returns pieceId → { leads, sales,
 * revenueCents }. Degrades to {} when the table/columns aren't there yet —
 * the map just stays quiet on the content nodes.
 */
async function contentAttribution(): Promise<
  Record<string, { leads: number; sales: number; revenueCents: number }>
> {
  try {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    const { data, error } = await svc
      .from(SALES_LEADS)
      .select('utm_content, purchased, purchase_amount_cents')
      .not('utm_content', 'is', null);
    if (error || !data) return {};
    const out: Record<string, { leads: number; sales: number; revenueCents: number }> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const pieceId = typeof row.utm_content === 'string' ? row.utm_content : '';
      if (!pieceId) continue;
      const purchased = row.purchased === true;
      const cents =
        typeof row.purchase_amount_cents === 'number' ? row.purchase_amount_cents : 0;
      const cur = (out[pieceId] ??= { leads: 0, sales: 0, revenueCents: 0 });
      cur.leads += 1;
      if (purchased) {
        cur.sales += 1;
        cur.revenueCents += cents;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** The public path for a sales-funnel step (the /funnel/<slug>/… routes). */
const SALES_STEP_PATH: Record<string, string> = {
  optin: '',
  sales: '/sales',
  vsl: '/vsl',
  checkout: '/checkout',
  upsell1: '/upsell',
  upsell2: '/upsell-2',
  upsell3: '/upsell-3',
  upsell4: '/upsell-4',
  success: '/success',
  access: '/access',
};

const SALES_STEP_LABEL: Record<string, string> = {
  optin: 'Opt-in',
  sales: 'Sales page',
  vsl: 'VSL',
  checkout: 'Checkout',
  upsell1: 'Upsell 1',
  upsell2: 'Upsell 2',
  upsell3: 'Upsell 3',
  upsell4: 'Upsell 4',
  success: 'Success',
  access: 'Access',
};

/** Which page a sales email event fires on (the edge lands there). */
const SALES_EVENT_PAGE: Record<SalesEmailEvent, string> = {
  optin: 'optin',
  checkout_start: 'checkout',
  purchase: 'success',
  upsell1_yes: 'upsell1',
  upsell1_no: 'upsell1',
  upsell2_yes: 'upsell2',
  upsell2_no: 'upsell2',
  upsell3_yes: 'upsell3',
  upsell3_no: 'upsell3',
  upsell4_yes: 'upsell4',
  upsell4_no: 'upsell4',
  success: 'success',
  access: 'access',
};

const EMAIL_EVENT_LABEL: Record<string, string> = {
  optin: 'on opt-in',
  checkout_start: 'on checkout start',
  purchase: 'on purchase',
  success: 'on success page',
  access: 'on access',
};

function kitMeta(kits: EmailKitRecord[], id: string) {
  const kit = kits.find((k) => k.id === id);
  return {
    name: kit?.name ?? 'Email sequence',
    status: kit?.status ?? 'draft',
    emailCount: kit?.sequence?.emails?.length ?? 0,
  };
}

function salesToInput(f: SalesFunnelRecord, kits: EmailKitRecord[]): SystemMapFunnelInput {
  const editHref = `/admin/sales-funnels?funnel=${f.id}`;
  const live = f.status === 'published';
  // The page spine — the steps that exist, upsells only when enabled.
  const stepKeys = (
    ['optin', 'sales', 'vsl', 'checkout', 'upsell1', 'upsell2', 'upsell3', 'upsell4', 'success', 'access'] as const
  ).filter((k) => {
    if (!k.startsWith('upsell')) return true;
    // Only an upsell step carries `enabled` — narrow before reading it.
    const up = f[k as 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4'];
    return up?.enabled !== false;
  });
  const stepMetric: Record<string, number> = {
    optin: f.conversionCount,
    checkout: f.checkoutCount,
    success: f.purchaseCount,
    upsell1: f.upsell1Yes,
    upsell2: f.upsell2Yes,
    upsell3: f.upsell3Yes,
    upsell4: f.upsell4Yes,
  };
  const stepUnit: Record<string, string> = {
    optin: 'leads',
    checkout: 'checkouts',
    success: 'sales',
    upsell1: 'taken',
    upsell2: 'taken',
    upsell3: 'taken',
    upsell4: 'taken',
  };
  const pages = stepKeys.map((key) => ({
    key,
    label: SALES_STEP_LABEL[key] ?? key,
    metric: stepMetric[key] > 0 ? `${stepMetric[key].toLocaleString()} ${stepUnit[key]}` : '',
    href: editHref,
    liveHref: live ? `/funnel/${f.slug}${SALES_STEP_PATH[key] ?? ''}` : undefined,
  }));

  // The email bindings — the multi-event map + the legacy single optin kit.
  const emails: SystemMapFunnelInput['emails'] = [];
  const seen = new Set<string>();
  for (const b of f.emailKits ?? []) {
    const meta = kitMeta(kits, b.emailKitId);
    emails.push({
      event: EMAIL_EVENT_LABEL[b.event] ?? b.event.replace(/_/g, ' '),
      pageKey: SALES_EVENT_PAGE[b.event] ?? 'optin',
      kitId: b.emailKitId,
      kitName: meta.name,
      kitStatus: meta.status,
      emailCount: meta.emailCount,
      href: `/admin/email-marketing?kit=${b.emailKitId}`,
    });
    seen.add(b.event);
  }
  if (f.emailKitId && !seen.has('optin')) {
    const meta = kitMeta(kits, f.emailKitId);
    emails.push({
      event: 'on opt-in',
      pageKey: 'optin',
      kitId: f.emailKitId,
      kitName: meta.name,
      kitStatus: meta.status,
      emailCount: meta.emailCount,
      href: `/admin/email-marketing?kit=${f.emailKitId}`,
    });
  }

  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    status: f.status,
    kind: 'sales',
    metrics: {
      views: f.viewCount,
      leads: f.conversionCount,
      checkouts: f.checkoutCount,
      purchases: f.purchaseCount,
      revenueCents: f.revenueCents,
    },
    pages,
    emails,
  };
}

function optinToInput(f: OptinFunnelRecord, kits: EmailKitRecord[]): SystemMapFunnelInput {
  const editHref = `/admin/funnels?funnel=${f.id}`;
  const live = f.status === 'published';
  const pages = [
    { key: 'optin', label: 'Opt-in', path: '' },
    { key: 'oto', label: 'OTO', path: '/oto' },
    { key: 'thank-you', label: 'Thank you', path: '/thank-you' },
  ].map((p) => ({
    key: p.key,
    label: p.label,
    metric: p.key === 'optin' && f.conversionCount > 0 ? `${f.conversionCount.toLocaleString()} leads` : '',
    href: editHref,
    liveHref: live ? `/optin/${f.slug}${p.path}` : undefined,
  }));
  const emails: SystemMapFunnelInput['emails'] = [];
  if (f.emailKitId) {
    const meta = kitMeta(kits, f.emailKitId);
    emails.push({
      event: 'on opt-in',
      pageKey: 'optin',
      kitId: f.emailKitId,
      kitName: meta.name,
      kitStatus: meta.status,
      emailCount: meta.emailCount,
      href: `/admin/email-marketing?kit=${f.emailKitId}`,
    });
  }
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    status: f.status,
    kind: 'optin',
    metrics: {
      views: f.viewCount,
      leads: f.conversionCount,
      checkouts: 0,
      purchases: 0,
      revenueCents: 0,
    },
    pages,
    emails,
  };
}

export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const [salesFunnels, optinFunnels, kits, links, content, contentMetrics] =
      await Promise.all([
        listSalesFunnels(),
        listOptinFunnels(),
        listKitsForAdmin(),
        listUtmLinks(),
        listContentPlan(),
        contentAttribution(),
      ]);

    const funnels: SystemMapFunnelInput[] = [
      ...salesFunnels.map((f) => salesToInput(f, kits)),
      ...optinFunnels.map((f) => optinToInput(f, kits)),
    ];

    const mapLinks: SystemMapLinkInput[] = links.map((l) => ({
      id: l.id,
      funnelId: l.funnelId ?? null,
      optinFunnelId: l.optinFunnelId ?? null,
      funnelPage: l.funnelPage || null,
      pieceId: l.pieceId || null,
      label: l.label ?? '',
      shortCode: l.shortCode ?? null,
      clicks: l.clickCount ?? 0,
      source: l.utmSource ?? '',
    }));

    const mapContent: SystemMapContentInput[] = content.map((c) => ({
      id: c.id,
      title: c.title ?? '',
      platform: c.platform ?? '',
      format: c.format ?? '',
      kind: c.kind ?? '',
      href: '/admin/planner',
    }));

    // The route returns the INPUT; the page builds + lays out the graph
    // client-side (the builder is pure, no server imports), so expand /
    // collapse / focus re-layout instantly with no refetch.
    const input: SystemMapInput = {
      funnels,
      links: mapLinks,
      content: mapContent,
      contentMetrics,
    };
    return NextResponse.json({ success: true, input });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'System map failed' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/system-map — the map's first write path: re-point a link at
 * a different funnel page (drag a link onto a page on the canvas).
 *
 * Body: { linkId, funnelId, funnelPage }. `funnelPage: null` re-points at the
 * funnel root. The store throws on failure (the admin half's policy) — a
 * silent mis-point is the wrong default.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as {
      linkId?: string;
      funnelId?: string;
      funnelPage?: string | null;
    };
    if (!body.linkId || !body.funnelId) {
      return NextResponse.json(
        { success: false, error: 'linkId and funnelId are required' },
        { status: 400 },
      );
    }
    await updateUtmLinkTarget(body.linkId, {
      funnelId: body.funnelId,
      funnelPage: body.funnelPage ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Re-point failed' },
      { status: 500 },
    );
  }
}

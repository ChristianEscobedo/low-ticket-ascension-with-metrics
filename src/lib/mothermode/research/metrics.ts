/**
 * Internal metrics for the Research Lab agent: a compact, read-only rollup of
 * the tracked-link system (clicks, opt-ins, purchases, attributed revenue) the
 * agent can reason over when planning offers, content, and ads.
 *
 * Deliberately self-contained rather than reusing planner/links.ts: the agent
 * needs a STABLE, SMALL shape tuned for prompts (top-N rows, totals, caveats),
 * not the admin tables' per-link grain. The same two error policies apply —
 * reads degrade to null fields, never to invented zeros (see adMetrics.ts).
 *
 * Service-role only. The pure aggregation half is exported for tests.
 */
import { createClient } from '@supabase/supabase-js';
import {
  trafficType,
  ratio,
  formatCents,
  formatCentsPrecise,
  ATTRIBUTED_REVENUE_FLOOR_SHORT,
} from '@/lib/mothermode/planner/adMetrics';

const UTM_LINKS = 'mothermode_utm_links';
const SALES_LEADS = 'mothermode_sales_funnel_leads';
const OPTIN_LEADS = 'mothermode_optin_leads';

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface MetricsPieceRow {
  /** utm_content — the piece key clicks and leads join on. */
  key: string;
  clicks: number;
  optins: number;
  purchases: number;
  revenueCents: number;
  paidOptins: number;
  organicOptins: number;
  campaigns: string[];
  sources: string[];
}

export interface MetricsCampaignRow {
  campaign: string;
  clicks: number;
  optins: number;
  revenueCents: number;
}

export interface InternalMetricsSummary {
  totals: {
    links: number;
    clicks: number;
    optins: number;
    purchases: number;
    revenueCents: number;
  };
  topPieces: MetricsPieceRow[];
  topCampaigns: MetricsCampaignRow[];
  /** The standing caveat so the agent never sums attributed + Stripe totals. */
  attributionNote: string;
}

interface LinkLite {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  click_count: number | null;
}

interface SalesLeadLite {
  utm_content: string | null;
  utm_medium: string | null;
  purchased: boolean | null;
  purchase_amount_cents: number | null;
}

interface OptinLeadLite {
  utm_content: string | null;
  utm_medium: string | null;
}

// ---------------------------------------------------------------------------
// Pure aggregation (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Fold links + leads into the agent-facing summary. Null optins mean the lead
 * reads failed — callers render that as "unknown", never zero.
 */
export function aggregateMetrics(input: {
  links: LinkLite[];
  salesLeads: SalesLeadLite[] | null;
  optinLeads: OptinLeadLite[] | null;
  topPieces?: number;
  topCampaigns?: number;
}): InternalMetricsSummary {
  const pieceLimit = Math.max(1, input.topPieces ?? 15);
  const campaignLimit = Math.max(1, input.topCampaigns ?? 10);

  const pieceClicks = new Map<string, number>();
  const pieceCampaigns = new Map<string, Set<string>>();
  const pieceSources = new Map<string, Set<string>>();
  const campaignClicks = new Map<string, number>();
  let totalClicks = 0;

  for (const l of input.links) {
    const clicks = Math.max(0, Math.floor(l.click_count ?? 0));
    totalClicks += clicks;
    const key = (l.utm_content || '').trim();
    const campaign = (l.utm_campaign || '').trim();
    const source = (l.utm_source || '').trim();
    if (key) {
      pieceClicks.set(key, (pieceClicks.get(key) ?? 0) + clicks);
      if (campaign) {
        if (!pieceCampaigns.has(key)) pieceCampaigns.set(key, new Set());
        pieceCampaigns.get(key)!.add(campaign);
      }
      if (source) {
        if (!pieceSources.has(key)) pieceSources.set(key, new Set());
        pieceSources.get(key)!.add(source);
      }
    }
    if (campaign) {
      campaignClicks.set(campaign, (campaignClicks.get(campaign) ?? 0) + clicks);
    }
  }

  // Opt-ins per piece (union of both lead tables) + paid/organic split.
  const pieceOptins = new Map<string, number>();
  const piecePaid = new Map<string, number>();
  const pieceOrganic = new Map<string, number>();
  const campaignOptins = new Map<string, number>();
  let totalOptins: number | null = 0;

  const bump = (
    key: string,
    medium: string | null,
    campaign: string | null,
  ) => {
    pieceOptins.set(key, (pieceOptins.get(key) ?? 0) + 1);
    const type = trafficType(medium);
    if (type === 'paid') piecePaid.set(key, (piecePaid.get(key) ?? 0) + 1);
    if (type === 'organic')
      pieceOrganic.set(key, (pieceOrganic.get(key) ?? 0) + 1);
    if (campaign) {
      campaignOptins.set(campaign, (campaignOptins.get(campaign) ?? 0) + 1);
    }
    totalOptins = (totalOptins ?? 0) + 1;
  };

  if (input.salesLeads === null || input.optinLeads === null) {
    totalOptins = null; // a read failed — opt-ins are unknown, not zero
  }
  // utm_content -> campaign is not carried on lead rows, so campaign opt-ins
  // join through the link table's content->campaign mapping.
  const contentToCampaign = new Map<string, string>();
  for (const l of input.links) {
    const key = (l.utm_content || '').trim();
    const campaign = (l.utm_campaign || '').trim();
    if (key && campaign && !contentToCampaign.has(key)) {
      contentToCampaign.set(key, campaign);
    }
  }

  for (const lead of input.salesLeads ?? []) {
    const key = (lead.utm_content || '').trim();
    if (!key) continue;
    bump(key, lead.utm_medium, contentToCampaign.get(key) ?? null);
  }
  for (const lead of input.optinLeads ?? []) {
    const key = (lead.utm_content || '').trim();
    if (!key) continue;
    bump(key, lead.utm_medium, contentToCampaign.get(key) ?? null);
  }

  // Purchases + revenue come from the sales leads only.
  const piecePurchases = new Map<string, number>();
  const pieceRevenue = new Map<string, number>();
  const campaignRevenue = new Map<string, number>();
  let totalPurchases: number | null = input.salesLeads === null ? null : 0;
  let totalRevenue: number | null = input.salesLeads === null ? null : 0;
  for (const lead of input.salesLeads ?? []) {
    if (!lead.purchased) continue;
    const key = (lead.utm_content || '').trim();
    if (!key) continue;
    const cents = Math.max(0, Math.floor(lead.purchase_amount_cents ?? 0));
    piecePurchases.set(key, (piecePurchases.get(key) ?? 0) + 1);
    pieceRevenue.set(key, (pieceRevenue.get(key) ?? 0) + cents);
    const campaign = contentToCampaign.get(key);
    if (campaign) {
      campaignRevenue.set(campaign, (campaignRevenue.get(campaign) ?? 0) + cents);
    }
    totalPurchases = (totalPurchases ?? 0) + 1;
    totalRevenue = (totalRevenue ?? 0) + cents;
  }

  const keys = new Set<string>([
    ...Array.from(pieceClicks.keys()),
    ...Array.from(pieceOptins.keys()),
    ...Array.from(piecePurchases.keys()),
  ]);
  const pieces: MetricsPieceRow[] = Array.from(keys).map((key) => ({
    key,
    clicks: pieceClicks.get(key) ?? 0,
    optins: pieceOptins.get(key) ?? 0,
    purchases: piecePurchases.get(key) ?? 0,
    revenueCents: pieceRevenue.get(key) ?? 0,
    paidOptins: piecePaid.get(key) ?? 0,
    organicOptins: pieceOrganic.get(key) ?? 0,
    campaigns: Array.from(pieceCampaigns.get(key) ?? []),
    sources: Array.from(pieceSources.get(key) ?? []),
  }));
  pieces.sort((a, b) => b.clicks - a.clicks || b.optins - a.optins);

  const campaigns: MetricsCampaignRow[] = Array.from(
    new Set([
      ...Array.from(campaignClicks.keys()),
      ...Array.from(campaignOptins.keys()),
      ...Array.from(campaignRevenue.keys()),
    ]),
  ).map((campaign) => ({
    campaign,
    clicks: campaignClicks.get(campaign) ?? 0,
    optins: campaignOptins.get(campaign) ?? 0,
    revenueCents: campaignRevenue.get(campaign) ?? 0,
  }));
  campaigns.sort((a, b) => b.clicks - a.clicks || b.optins - a.optins);

  return {
    totals: {
      links: input.links.length,
      clicks: totalClicks,
      optins: totalOptins ?? 0,
      purchases: totalPurchases ?? 0,
      revenueCents: totalRevenue ?? 0,
    },
    topPieces: pieces.slice(0, pieceLimit),
    topCampaigns: campaigns.slice(0, campaignLimit),
    attributionNote: ATTRIBUTED_REVENUE_FLOOR_SHORT,
  };
}

/**
 * Render the summary as compact tool-result text. Every money figure uses the
 * shared formatters so the agent quotes the same numbers the admin sees.
 */
export function metricsSummaryToText(
  summary: InternalMetricsSummary,
  filter?: string,
): string {
  const lines: string[] = [];
  const t = summary.totals;
  const epc = ratio(t.revenueCents, t.clicks);
  lines.push(
    `TOTALS: ${t.links} tracked links, ${t.clicks.toLocaleString()} clicks, ` +
      `${t.optins.toLocaleString()} opt-ins, ${t.purchases.toLocaleString()} purchases, ` +
      `${formatCents(t.revenueCents)} attributed revenue` +
      (epc !== null ? `, ${formatCentsPrecise(epc)} EPC` : '') +
      ` (${summary.attributionNote}).`,
  );

  const needle = (filter || '').trim().toLowerCase();
  const match = (s: string) => !needle || s.toLowerCase().includes(needle);
  const pieces = summary.topPieces.filter(
    (p) =>
      match(p.key) || p.campaigns.some(match) || p.sources.some(match),
  );
  const campaigns = summary.topCampaigns.filter((c) => match(c.campaign));

  if (pieces.length) {
    lines.push('', 'TOP PIECES (by clicks):');
    for (const p of pieces.slice(0, 12)) {
      const optinRate = ratio(p.optins, p.clicks);
      lines.push(
        `- ${p.key}: ${p.clicks} clicks, ${p.optins} opt-ins` +
          (optinRate !== null ? ` (${(optinRate * 100).toFixed(1)}%)` : '') +
          `, ${p.purchases} sales, ${formatCents(p.revenueCents)}` +
          (p.paidOptins ? `, ${p.paidOptins} paid opt-ins` : '') +
          (p.campaigns.length ? ` [campaigns: ${p.campaigns.join(', ')}]` : ''),
      );
    }
  }
  if (campaigns.length) {
    lines.push('', 'TOP CAMPAIGNS (by clicks):');
    for (const c of campaigns.slice(0, 8)) {
      lines.push(
        `- ${c.campaign}: ${c.clicks} clicks, ${c.optins} opt-ins, ${formatCents(c.revenueCents)}`,
      );
    }
  }
  if (needle && !pieces.length && !campaigns.length) {
    lines.push(`No pieces or campaigns matched "${filter}".`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Store half
// ---------------------------------------------------------------------------

/** Read the three tables and aggregate. Never throws; nulls mark failed reads. */
export async function readInternalMetrics(opts?: {
  filter?: string;
  sinceDays?: number;
}): Promise<{ text: string; summary: InternalMetricsSummary }> {
  let links: LinkLite[] = [];
  let salesLeads: SalesLeadLite[] | null = [];
  let optinLeads: OptinLeadLite[] | null = [];

  const sinceIso =
    opts?.sinceDays && opts.sinceDays > 0
      ? new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  try {
    const { data, error } = await (serviceClient() as any)
      .from(UTM_LINKS)
      .select('utm_source, utm_medium, utm_campaign, utm_content, click_count');
    if (error) throw new Error(error.message);
    links = (data ?? []) as LinkLite[];
  } catch {
    links = [];
  }

  try {
    let q = (serviceClient() as any)
      .from(SALES_LEADS)
      .select('utm_content, utm_medium, purchased, purchase_amount_cents')
      .not('utm_content', 'is', null);
    if (sinceIso) q = q.gte('created_at', sinceIso);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    salesLeads = (data ?? []) as SalesLeadLite[];
  } catch {
    salesLeads = null;
  }

  try {
    let q = (serviceClient() as any)
      .from(OPTIN_LEADS)
      .select('utm_content, utm_medium')
      .not('utm_content', 'is', null);
    if (sinceIso) q = q.gte('created_at', sinceIso);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    optinLeads = (data ?? []) as OptinLeadLite[];
  } catch {
    optinLeads = null;
  }

  const summary = aggregateMetrics({ links, salesLeads, optinLeads });
  return { text: metricsSummaryToText(summary, opts?.filter), summary };
}

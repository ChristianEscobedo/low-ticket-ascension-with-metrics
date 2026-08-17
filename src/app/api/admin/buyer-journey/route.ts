/**
 * GET /api/admin/buyer-journey — the input behind the `/admin/buyer-journey`
 * page. Loads the sales leads (each one IS a buyer journey: the funnel, the
 * furthest step reached, the outcome, the source, when) + the funnels for
 * names, maps them into the builder's input, and returns it. The page runs
 * `buildBuyerJourney` client-side (the builder is pure, no server imports).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { listFunnelsForAdmin as listSalesFunnels } from '@/lib/mothermode/sales/store';
import type {
  BuyerJourneyInput,
  BuyerJourneyLead,
} from '@/lib/mothermode/buyerJourney';

export const dynamic = 'force-dynamic';

const SALES_LEADS = 'mothermode_sales_funnel_leads';

/** The leads, mapped to the builder's shape. Degrades to [] on a missing table. */
async function loadLeads(): Promise<BuyerJourneyLead[]> {
  try {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    const { data, error } = await svc
      .from(SALES_LEADS)
      .select(
        'id, funnel_id, email, first_name, step_reached, purchased, purchase_amount_cents, utm_source, utm_content, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ''),
      funnelId: String(row.funnel_id ?? ''),
      name:
        (typeof row.first_name === 'string' && row.first_name) ||
        (typeof row.email === 'string' ? row.email.split('@')[0] : '') ||
        'A buyer',
      email: typeof row.email === 'string' ? row.email : '',
      stepReached: typeof row.step_reached === 'string' ? row.step_reached : 'optin',
      purchased: row.purchased === true,
      purchaseAmountCents:
        typeof row.purchase_amount_cents === 'number' ? row.purchase_amount_cents : 0,
      source: typeof row.utm_source === 'string' ? row.utm_source : '',
      pieceId: typeof row.utm_content === 'string' ? row.utm_content : '',
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  try {
    const [leads, salesFunnels] = await Promise.all([loadLeads(), listSalesFunnels()]);
    const input: BuyerJourneyInput = {
      leads,
      funnels: salesFunnels.map((f) => ({ id: f.id, name: f.name || f.slug })),
    };
    return NextResponse.json({ success: true, input });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Buyer journey failed' },
      { status: 500 },
    );
  }
}

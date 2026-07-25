import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  captureLead,
  checkCaptureRateLimit,
  enrollLeadInEmailKit,
  getFunnelBySlug,
  getLeadById,
  incrementCheckoutCount,
  incrementFunnelConversions,
  incrementUpsellCount,
  markLeadCheckoutStarted,
  markLeadUpsell,
  recordSalesEvent,
  resolveEmailKitIdForEvent,
} from '@/lib/mothermode/sales/store';
import type { SalesEmailEvent } from '@/lib/mothermode/sales/types';

type UpsellKey = 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';

function toUpsellKey(value: string): UpsellKey {
  if (value === 'upsell1' || value === 'upsell2' || value === 'upsell3' || value === 'upsell4') {
    return value;
  }
  return 'upsell1';
}

function upsellNumber(key: UpsellKey): 1 | 2 | 3 | 4 {
  if (key === 'upsell1') return 1;
  if (key === 'upsell2') return 2;
  if (key === 'upsell3') return 3;
  return 4;
}

function upsellEvent(key: UpsellKey, accepted: boolean): SalesEmailEvent {
  const n = upsellNumber(key);
  return (accepted ? `upsell${n}_yes` : `upsell${n}_no`) as SalesEmailEvent;
}

async function maybeEnroll(
  funnel: {
    id: string;
    slug: string;
    emailKitId: string | null;
    emailKits?: { event: string; emailKitId: string }[];
  },
  event: SalesEmailEvent,
  lead: { id: string; email: string; firstName: string | null },
) {
  const kitId = resolveEmailKitIdForEvent(funnel as any, event as SalesEmailEvent);
  if (!kitId) return;
  void enrollLeadInEmailKit({
    emailKitId: kitId,
    email: lead.email,
    leadId: lead.id,
    funnelId: funnel.id,
    funnelSlug: funnel.slug,
    firstName: lead.firstName,
    event,
  });
}

/**
 * Public lead capture for MotherMode sales funnels.
 *
 * POST { slug, email, firstName?, website? (honeypot), utm*, referrer? }
 * POST { action: 'checkout_start', leadId, slug? }
 * POST { action: 'upsell', leadId, upsellKey, accepted, slug? }
 * POST { action: 'purchase', leadId, slug?, amountCents? }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'checkout_start') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }
    try {
      await markLeadCheckoutStarted(leadId);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void incrementCheckoutCount(funnel.id);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'checkout_start',
            leadId,
            step: 'checkout',
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, 'checkout_start', lead);
          }
        }
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] checkout_start failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  if (body.action === 'upsell') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    const rawKey = typeof body.upsellKey === 'string' ? body.upsellKey : '';
    const accepted = Boolean(body.accepted);
    if (!leadId || !rawKey) {
      return NextResponse.json(
        { success: false, error: 'leadId and upsellKey are required' },
        { status: 400 },
      );
    }
    try {
      const key = toUpsellKey(rawKey);
      const slot = upsellNumber(key);
      await markLeadUpsell(leadId, slot, accepted);
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void incrementUpsellCount(funnel.id, slot, accepted);
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: accepted ? 'upsell_yes' : 'upsell_no',
            leadId,
            step: key,
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, upsellEvent(key, accepted), lead);
          }
        }
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] upsell failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  if (body.action === 'purchase') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }
    try {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (slug) {
        const funnel = await getFunnelBySlug(slug);
        if (funnel) {
          void recordSalesEvent({
            funnelId: funnel.id,
            eventType: 'purchase',
            leadId,
            step: 'success',
          });
          const lead = await getLeadById(leadId);
          if (lead) {
            await maybeEnroll(funnel, 'purchase', lead);
          }
        }
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[funnel/capture] purchase failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot) {
    return NextResponse.json({
      success: true,
      redirectTo: 'sales',
      leadId: 'ok',
      isNew: false,
    });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';

  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
  }

  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  const rateKey = `sales:${slug}:${ip}`;
  const rate = checkCaptureRateLimit(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const funnel = await getFunnelBySlug(slug);
  if (!funnel) {
    return NextResponse.json({ success: false, error: 'Funnel not found' }, { status: 404 });
  }

  const ua = request.headers.get('user-agent') || '';
  const ipHash =
    ip && ip !== 'unknown'
      ? createHash('sha256')
          .update(ip + (process.env.OPTIN_IP_SALT || 'mothermode'))
          .digest('hex')
          .slice(0, 32)
      : null;

  try {
    const { lead, isNew } = await captureLead({
      funnelId: funnel.id,
      email,
      firstName: firstName || null,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : null,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : null,
      referrer: typeof body.referrer === 'string' ? body.referrer : null,
      userAgent: ua || null,
      ipHash,
    });

    if (isNew) {
      await incrementFunnelConversions(funnel.id);
    }

    void recordSalesEvent({
      funnelId: funnel.id,
      eventType: 'optin_submit',
      leadId: lead.id,
      step: 'optin',
      metadata: { isNew },
    });

    if (isNew) {
      await maybeEnroll(funnel, 'optin', lead);
    }

    return NextResponse.json({
      success: true,
      redirectTo: 'sales',
      leadId: lead.id,
      isNew,
      funnelSlug: funnel.slug,
    });
  } catch (err) {
    console.error('[funnel/capture] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Capture failed' },
      { status: 500 },
    );
  }
}

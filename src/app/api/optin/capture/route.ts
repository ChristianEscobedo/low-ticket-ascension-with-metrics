import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  captureLead,
  checkCaptureRateLimit,
  enrollLeadInEmailKit,
  getFunnelBySlug,
  incrementFunnelConversions,
  incrementOtoCount,
  markLeadOto,
  recordOptinEvent,
} from '@/lib/mothermode/optin/store';
import { triggerAutoPersonalization } from '@/lib/mothermode/personalize/generate';



/**
 * Public lead capture for MotherMode optin funnels.
 *
 * POST { slug, email, firstName?, website? (honeypot), utm*, referrer? }
 *   → { success, redirectTo, leadId, isNew }
 *
 * POST { action: 'oto', leadId, accepted }
 *   → marks OTO + records event
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // -- OTO accept/decline -------------------------------------------------
  if (body.action === 'oto') {
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';
    const accepted = Boolean(body.accepted);
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }
    try {
      const funnelId = await markLeadOto(leadId, accepted);
      if (funnelId) {
        void incrementOtoCount(funnelId, accepted);
        void recordOptinEvent({
          funnelId,
          eventType: accepted ? 'oto_yes' : 'oto_no',
          leadId,
        });
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('[optin/capture] oto mark failed:', err);
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed' },
        { status: 500 },
      );
    }
  }

  // -- Honeypot (bots fill hidden "website") --------------------------------
  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot) {
    // Silent success so bots think it worked
    return NextResponse.json({
      success: true,
      redirectTo: 'thank-you',
      leadId: 'ok',
      isNew: false,
    });
  }

  // -- Capture ------------------------------------------------------------
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
  const rateKey = `${slug}:${ip}`;
  const rate = checkCaptureRateLimit(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const funnel = await getFunnelBySlug(slug);
  if (!funnel || funnel.status !== 'published') {
    return NextResponse.json({ success: false, error: 'Funnel not found' }, { status: 404 });
  }

  const ua = request.headers.get('user-agent') || '';
  const ipHash = ip && ip !== 'unknown'
    ? createHash('sha256').update(ip + (process.env.OPTIN_IP_SALT || 'mothermode')).digest('hex').slice(0, 32)
    : null;

  try {
    const { lead, isNew } = await captureLead({
      funnelId: funnel.id,
      email,
      firstName: firstName || null,
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : null,
      utmCampaign: typeof body.utmCampaign === 'string' ? body.utmCampaign : null,
      // utm_content carries the planner piece id, so a lead can be traced back
      // to the individual post rather than just the campaign.
      utmContent: typeof body.utmContent === 'string' ? body.utmContent : null,
      referrer: typeof body.referrer === 'string' ? body.referrer : null,
      userAgent: ua || null,
      ipHash,
    });

    if (isNew) {
      await incrementFunnelConversions(funnel.id);
    }

    void recordOptinEvent({
      funnelId: funnel.id,
      eventType: 'submit',
      leadId: lead.id,
      metadata: { isNew },
    });

    // Auto-enroll into linked Email Marketing kit (non-blocking failure)
    if (funnel.emailKitId && isNew) {
      void enrollLeadInEmailKit({
        emailKitId: funnel.emailKitId,
        email: lead.email,
        leadId: lead.id,
        funnelId: funnel.id,
        funnelSlug: funnel.slug,
        firstName: lead.firstName,
      });
    }

    // Kick 1:1 personalization for this lead (fire-and-forget; no-op unless
    // the funnel has personalization enabled in admin).
    triggerAutoPersonalization({
      kind: 'optin',
      funnelId: funnel.id,
      email: lead.email,
      firstName: lead.firstName,
    });

    const redirectTo = funnel.oto.enabled ? 'oto' : 'thank-you';


    return NextResponse.json({
      success: true,
      redirectTo,
      leadId: lead.id,
      isNew,
      funnelSlug: funnel.slug,
    });
  } catch (err) {
    console.error('[optin/capture] failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Capture failed' },
      { status: 500 },
    );
  }
}

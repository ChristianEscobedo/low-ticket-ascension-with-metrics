import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { listFunnelsForAdmin as listSalesFunnels } from '@/lib/mothermode/sales/store';
import { listFunnelsForAdmin as listOptinFunnels } from '@/lib/mothermode/optin/store';
import { getFunnelById as getSalesFunnelById } from '@/lib/mothermode/sales/store';
import { getFunnelById as getOptinFunnelById } from '@/lib/mothermode/optin/store';
import {
  countLeadPersonalizations,
  deleteLeadPersonalization,
  getPersonalizationSettings,
  listLeadPersonalizations,
  listPersonalizationCampaigns,
  upsertPersonalizationSettings,
} from '@/lib/mothermode/personalize/store';
import {
  generateForFunnelLeads,
  generateLeadPersonalization,
} from '@/lib/mothermode/personalize/generate';
import {
  buildPersonalizedUrl,
  signPersonalizationToken,
} from '@/lib/mothermode/personalize/token';
import {
  buildEmailImagePath,
  emailImageCampaignKey,
  EMAIL_IMAGE_TEMPLATES,
} from '@/lib/mothermode/personalize/emailImage';
import {
  toFunnelKind,
  toPersonalizationMode,
  type FunnelKind,
} from '@/lib/mothermode/personalize/types';

/**
 * Admin API for 1:1 Personalization.
 *
 * GET
 *   → { success, funnels: [...] } every sales + optin funnel with its
 *     personalization mode, guidance and cached-payload coverage count.
 *
 * POST { action: 'save',      funnelKind, funnelId, mode, guidance?, baseImageUrl?, emailImageEnabled? }
 * POST { action: 'generate',  funnelKind, funnelId, email?, firstName?, force? }  — one lead, or all when email omitted
 * POST { action: 'clear',     funnelKind, funnelId, email? }                    — one lead, or all when omitted
 * POST { action: 'payloads',  funnelKind, funnelId }                            — recent cached payloads
 * POST { action: 'link',      funnelKind, funnelId, email, firstName?, baseUrl? } — signed ?pp= URL for one lead
 * POST { action: 'image-link',funnelKind, funnelId }                            — signed dynamic email image URL (ESP merge markers)
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const [sales, optin, campaigns] = await Promise.all([
    listSalesFunnels(),
    listOptinFunnels(),
    listPersonalizationCampaigns(),
  ]);

  const campaignByFunnel = new Map(campaigns.map((c) => [`${c.funnelKind}:${c.funnelId}`, c]));

  const funnels = await Promise.all([
    ...sales.map(async (f) => ({
      kind: 'sales' as FunnelKind,
      id: f.id,
      slug: f.slug,
      name: f.name,
      status: f.status,
      leadCount: f.conversionCount,
      mode: campaignByFunnel.get(`sales:${f.id}`)?.mode ?? 'off',
      guidance: campaignByFunnel.get(`sales:${f.id}`)?.guidance ?? '',
      baseImageUrl: campaignByFunnel.get(`sales:${f.id}`)?.baseImageUrl ?? '',
      emailImageEnabled: campaignByFunnel.get(`sales:${f.id}`)?.emailImageEnabled ?? false,
      settingsUpdatedAt: campaignByFunnel.get(`sales:${f.id}`)?.updatedAt ?? null,
      personalizedCount: await countLeadPersonalizations('sales', f.id),
    })),
    ...optin.map(async (f) => ({
      kind: 'optin' as FunnelKind,
      id: f.id,
      slug: f.slug,
      name: f.name,
      status: f.status,
      leadCount: f.conversionCount,
      mode: campaignByFunnel.get(`optin:${f.id}`)?.mode ?? 'off',
      guidance: campaignByFunnel.get(`optin:${f.id}`)?.guidance ?? '',
      baseImageUrl: campaignByFunnel.get(`optin:${f.id}`)?.baseImageUrl ?? '',
      emailImageEnabled: campaignByFunnel.get(`optin:${f.id}`)?.emailImageEnabled ?? false,
      settingsUpdatedAt: campaignByFunnel.get(`optin:${f.id}`)?.updatedAt ?? null,
      personalizedCount: await countLeadPersonalizations('optin', f.id),
    })),
  ]);

  return NextResponse.json({ success: true, funnels });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const funnelId = typeof body.funnelId === 'string' ? body.funnelId.trim() : '';
  if (!action || !funnelId) {
    return NextResponse.json(
      { success: false, error: 'action and funnelId are required' },
      { status: 400 },
    );
  }
  // Mutations require an explicit funnel kind — defaulting a typo to 'sales'
  // could clear or generate payloads against the WRONG funnel.
  if (body.funnelKind !== 'sales' && body.funnelKind !== 'optin') {
    return NextResponse.json(
      { success: false, error: "funnelKind must be 'sales' or 'optin'" },
      { status: 400 },
    );
  }
  const kind = toFunnelKind(body.funnelKind);


  // -- save settings --------------------------------------------------------
  if (action === 'save') {
    const mode = toPersonalizationMode(body.mode);
    const settings = await upsertPersonalizationSettings({
      funnelKind: kind,
      funnelId,
      mode,
      guidance: typeof body.guidance === 'string' ? body.guidance : '',
      baseImageUrl: typeof body.baseImageUrl === 'string' ? body.baseImageUrl : '',
      emailImageEnabled: body.emailImageEnabled === true,
    });
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Save failed (is the migration applied?)' },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, settings });
  }

  // -- generate for one lead or the whole funnel -----------------------------
  if (action === 'generate') {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const force = body.force === true;
    if (email) {
      const res = await generateLeadPersonalization({
        kind,
        funnelId,
        email,
        firstName: typeof body.firstName === 'string' ? body.firstName : null,
        force,
      });
      return NextResponse.json({ success: res.ok, result: res });
    }
    const res = await generateForFunnelLeads({ kind, funnelId, force });
    return NextResponse.json({ success: true, result: res });
  }

  // -- clear cached payloads -------------------------------------------------
  if (action === 'clear') {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const ok = await deleteLeadPersonalization(kind, funnelId, email || undefined);
    return NextResponse.json({ success: ok });
  }

  // -- recent payloads (admin review) -----------------------------------------
  if (action === 'payloads') {
    const payloads = await listLeadPersonalizations(kind, funnelId, 50);
    return NextResponse.json({ success: true, payloads });
  }

  // -- signed per-lead link ----------------------------------------------------
  if (action === 'link') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
    }
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const baseUrlOverride = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';

    let slug = '';
    if (kind === 'sales') {
      slug = (await getSalesFunnelById(funnelId))?.slug ?? '';
    } else {
      slug = (await getOptinFunnelById(funnelId))?.slug ?? '';
    }
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Funnel not found' }, { status: 404 });
    }
    const base =
      baseUrlOverride || (kind === 'sales' ? `/funnel/${slug}` : `/optin/${slug}`);

    const tokenPayload = {
      v: 1 as const,
      k: kind,
      fid: funnelId,
      em: email,
      ...(firstName ? { fn: firstName } : {}),
    };
    const url = buildPersonalizedUrl(base, tokenPayload);
    return NextResponse.json({
      success: true,
      url,
      token: signPersonalizationToken(tokenPayload),
    });
  }

  // -- dynamic email image URL (ESP merge markers kept literal) ----------------
  if (action === 'image-link') {
    const settings = await getPersonalizationSettings(kind, funnelId);
    const campaignKey = emailImageCampaignKey(kind, funnelId);
    const images = EMAIL_IMAGE_TEMPLATES.map((template) => ({
      template,
      // The ESP fills the name at send time; signature covers campaign+tpl only.
      path: buildEmailImagePath({
        campaignKey,
        template,
        name: '{{contact.first_name}}',
      }),
    }));
    return NextResponse.json({
      success: true,
      campaignKey,
      enabled: settings?.emailImageEnabled === true,
      baseImageUrl: settings?.baseImageUrl || '',
      images,
      note: 'Paste the path as an <img> src in your ESP. {{contact.first_name}} is filled per-recipient at open time. Set email_image_enabled + save before sending.',
    });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}

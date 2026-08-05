import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  aiFillSalesIntake,
  aiGenerateSalesFunnel,
  aiGenerateSalesPage,
  normalizeSalesAiIntake,
  type SalesAiPageKey,
} from '@/utils/integrations/openai-sales';

/**
 * Admin-only Sales Funnel AI endpoint.
 *
 *   POST { action: 'fillIntake', intake }
 *     → { success, intake }  // complete brief + offer stack
 *
 *   POST { action: 'generate', intake }
 *     → { success, name, slugHint, optin, sales, vsl, checkout, upsell1-4, success, access }
 *
 *   POST { action: 'generatePage', page, intake }
 *     → { success, page, content }
 *
 * Server-only; keys resolved via runtime-config (same as optin-ai).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action ?? 'generate');
  const intake = normalizeSalesAiIntake(body.intake);

  if (!intake.niche.trim() && !intake.magnetName.trim() && !intake.audience.trim() && !intake.offerName.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Give at least a niche, audience, magnet name, or offer name so the model has something to write from.',
      },
      { status: 400 },
    );
  }

  if (action === 'fillIntake') {
    const result = await aiFillSalesIntake(intake);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, intake: result.data });
  }

  
  if (action === 'generatePage') {
    const page = String(body.page ?? '') as SalesAiPageKey;
    const allowed: SalesAiPageKey[] = [
      'optin', 'sales', 'vsl', 'checkout',
      'upsell1', 'upsell2', 'upsell3', 'upsell4',
      'success', 'access', 'footer',
    ];
    if (!allowed.includes(page)) {
      return NextResponse.json(
        { success: false, error: 'Invalid page. Use one of: ' + allowed.join(', ') },
        { status: 400 },
      );
    }
    const pageResult = await aiGenerateSalesPage(page, intake);
    if (!pageResult.ok) {
      return NextResponse.json(
        { success: false, error: pageResult.error },
        { status: pageResult.status },
      );
    }
    return NextResponse.json({ success: true, page, content: pageResult.data });
  }

if (action !== 'generate') {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 },
    );
  }

  const result = await aiGenerateSalesFunnel(intake);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    name: result.data.name,
    slugHint: result.data.slugHint,
    optin: result.data.optin,
    sales: result.data.sales,
    vsl: result.data.vsl,
    checkout: result.data.checkout,
    upsell1: result.data.upsell1,
    upsell2: result.data.upsell2,
    upsell3: result.data.upsell3,
    upsell4: result.data.upsell4,
    successBlock: result.data.success,
    access: result.data.access,
    footer: result.data.footer,
  });
}

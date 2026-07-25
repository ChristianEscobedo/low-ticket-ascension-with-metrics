import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  aiGenerateOptinFunnel,
  normalizeOptinAiIntake,
} from '@/utils/integrations/openai-optin';

/**
 * Admin-only Optin Funnel AI endpoint.
 *
 *   POST { action: 'generate', intake }
 *     → { success, name, slugHint, optin, oto, thankyou }
 *
 * Server-only; keys resolved via runtime-config (same as leadgen-ai).
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
  if (action !== 'generate') {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 },
    );
  }

  const intake = normalizeOptinAiIntake(body.intake);
  if (!intake.niche.trim() && !intake.magnetName.trim() && !intake.audience.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Give at least a niche, audience, or magnet name so the model has something to write from.',
      },
      { status: 400 },
    );
  }

  const result = await aiGenerateOptinFunnel(intake);
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
    oto: result.data.oto,
    thankyou: result.data.thankyou,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  aiFillIntake,
  aiOutline,
  aiExpandEmail,
  aiGenerateSequence,
  aiExtendSequence,
  type EmailExtendMode,
} from '@/utils/integrations/openai-email';

import {
  normalizeIntake,
  normalizeEmail,
  normalizeSequence,
  toEmailCampaignType,
  toEmailFramework,
  type EmailMessage,
} from '@/lib/mothermode/email/types';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';

/**
 * Admin-only Email Marketing Kit AI endpoint. Server-only generation behind an
 * action switch (mirrors /api/mothermode/leadgen-ai + openai-email.ts). Context
 * refs on the body are resolved to live packs HERE (never trusted from the
 * client) via the shared context bridge resolver.
 *
 *   POST { action: 'fillIntake', intake, campaignType }               -> { intake }
 *   POST { action: 'outline',    intake, campaignType, framework, contextRefs } -> { sequence }
 *   POST { action: 'expand',     intake, campaignType, email, emails, contextRefs } -> { email }
 *   POST { action: 'generate',   intake, campaignType, framework, contextRefs } -> { sequence }
 *   POST { action: 'extend',     intake, campaignType, framework, emails, count, mode, contextRefs } -> { emails }
 */

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const action = String(body.action ?? '');
  const intake = normalizeIntake(body.intake);
  const campaignType = toEmailCampaignType(body.campaignType);
  const framework = toEmailFramework(body.framework);

  if (action === 'fillIntake') {
    const result = await aiFillIntake(intake, campaignType);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, intake: result.data });
  }

  // The remaining actions all need resolved context packs.
  const packs = await resolveContextRefs(body.contextRefs);
  const bodyFormat = body.bodyFormat === 'html' ? 'html' : 'text';
  const bodyLength =
    body.bodyLength === 'short' || body.bodyLength === 'long'
      ? body.bodyLength
      : 'default';


  if (action === 'outline') {
    const result = await aiOutline(intake, campaignType, framework, packs);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, sequence: result.data });
  }

  if (action === 'expand') {
    const email = normalizeEmail(body.email);
    const allEmails: EmailMessage[] = Array.isArray(body.emails)
      ? body.emails.map(normalizeEmail)
      : [email];
    const result = await aiExpandEmail(intake, campaignType, email, allEmails, packs, bodyFormat, bodyLength);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, email: result.data });
  }

  if (action === 'generate') {
    const result = await aiGenerateSequence(intake, campaignType, framework, packs, bodyFormat, bodyLength);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, sequence: result.data });
  }

  if (action === 'extend') {
    const existing: EmailMessage[] = Array.isArray(body.emails)
      ? body.emails.map(normalizeEmail)
      : [];
    const count = typeof body.count === 'number' ? body.count : Number(body.count) || 3;
    const mode: EmailExtendMode =
      body.mode === 'continue' || body.mode === 'reengage' ? body.mode : 'deep-nurture';
    const result = await aiExtendSequence(
      intake,
      campaignType,
      framework,
      existing,
      count,
      packs,
      bodyFormat,
      bodyLength,
      mode,
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, emails: result.data });
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  );
}

// Referenced for its side-effect-free import safety; keep normalizeSequence in
// the bundle for callers that post a whole sequence to re-render.
void normalizeSequence;

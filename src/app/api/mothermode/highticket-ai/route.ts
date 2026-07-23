import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  fillHighTicketIntake,
  generateHighTicketKit,
  generateHighTicketKitSections,
  regenerateKitSection,
} from '@/utils/integrations/openai-highticket';
import {
  normalizeIntake,
  normalizeKit,
  KIT_SECTIONS,
  type KitSection,
} from '@/lib/mothermode/highticket/types';
import { resolveContextRefs } from '@/lib/mothermode/context/resolve';


/**
 * Admin-only High Ticket Kit AI endpoint. Server-only generation behind an
 * action switch (mirrors /api/mothermode/community-ai + openai-highticket.ts):
 *
 *   POST { action: 'fillIntake', intake }
 *   POST { action: 'generate',   intake, sections? }
 *   POST { action: 'regenerate', section, intake, kit }
 *
 * Never runs on the client; the OpenAI/Anthropic key is resolved server-side.
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

  if (action === 'fillIntake') {
    const result = await fillHighTicketIntake(intake);
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

  if (action === 'generate') {
    const requested = Array.isArray(body.sections)
      ? (body.sections.filter((s): s is KitSection =>
          KIT_SECTIONS.includes(s as KitSection),
        ) as KitSection[])
      : null;

    const result =
      requested && requested.length > 0 && requested.length < KIT_SECTIONS.length
        ? await generateHighTicketKitSections(intake, requested, packs)
        : await generateHighTicketKit(intake, packs);


    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, kit: result.data });
  }

  if (action === 'regenerate') {
    const section = String(body.section ?? '') as KitSection;
    if (!KIT_SECTIONS.includes(section)) {
      return NextResponse.json(
        { success: false, error: `Unknown section: ${section}` },
        { status: 400 },
      );
    }
    const currentKit = body.kit ? normalizeKit(body.kit) : undefined;
    const result = await regenerateKitSection(section, intake, currentKit, packs);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, section, patch: result.data });
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  );
}

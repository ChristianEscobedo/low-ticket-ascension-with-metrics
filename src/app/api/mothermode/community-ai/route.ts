import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  fillCommunityIntake,
  generateCommunityKit,
  generateCommunityKitSections,
  regenerateKitSection,
} from '@/utils/integrations/openai-community';


import {
  normalizeIntake,
  normalizeKit,
  toCommunityType,
  KIT_SECTIONS,
  type KitSection,
} from '@/lib/mothermode/community/types';

/**
 * Admin-only Community Kit AI endpoint. Server-only generation behind an
 * action switch (mirrors /api/mothermode/ai + openai-content.ts):
 *
 *   POST { action: 'generate',   intake, communityType }
 *   POST { action: 'regenerate', section, intake, communityType, kit }
 *
 * Never runs on the client; the OpenAI key is resolved server-side.
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
  const communityType = toCommunityType(body.communityType);
  const intake = normalizeIntake(body.intake);

  if (action === 'fillIntake') {
    const result = await fillCommunityIntake(intake, communityType);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, intake: result.data });
  }

  if (action === 'generate') {
    // Optional post-intake wizard: only generate the sections the admin picked.
    const requested = Array.isArray(body.sections)
      ? (body.sections.filter((s): s is KitSection =>
          KIT_SECTIONS.includes(s as KitSection),
        ) as KitSection[])
      : null;

    const result =
      requested && requested.length > 0 && requested.length < KIT_SECTIONS.length
        ? await generateCommunityKitSections(intake, communityType, requested)
        : await generateCommunityKit(intake, communityType);

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
    const result = await regenerateKitSection(
      section,
      intake,
      communityType,
      currentKit,
    );
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

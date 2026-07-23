import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  aiFillIntake,
  aiOutline,
  aiExpandSection,
  aiGenerateDoc,
} from '@/utils/integrations/openai-leadgen';
import {
  normalizeIntake,
  normalizeSection,
  toLeadMagnetFormat,
  type DocSection,
} from '@/lib/mothermode/leadgen/types';

/**
 * Admin-only Lead Gen Kit AI endpoint. Server-only generation behind an action
 * switch (mirrors /api/mothermode/highticket-ai + openai-leadgen.ts):
 *
 *   POST { action: 'fillIntake', intake, format }
 *   POST { action: 'outline',    intake, format }              -> { doc }
 *   POST { action: 'expand',     intake, format, section, sections } -> { section }
 *   POST { action: 'generate',   intake, format }              -> { doc }
 *
 * Never runs on the client; the OpenAI/Anthropic key is resolved server-side.
 * "expand" is the workhorse for long-form: the editor calls it per section so
 * an ultra-length ebook is built incrementally without one giant request.
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
  const format = toLeadMagnetFormat(body.format);

  if (action === 'fillIntake') {
    const result = await aiFillIntake(intake, format);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, intake: result.data });
  }

  if (action === 'outline') {
    const result = await aiOutline(intake, format);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, doc: result.data });
  }

  if (action === 'expand') {
    const section = normalizeSection(body.section);
    const allSections: DocSection[] = Array.isArray(body.sections)
      ? body.sections.map(normalizeSection)
      : [section];
    const result = await aiExpandSection(intake, format, section, allSections);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, section: result.data });
  }

  if (action === 'generate') {
    const result = await aiGenerateDoc(intake, format);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, doc: result.data });
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  );
}

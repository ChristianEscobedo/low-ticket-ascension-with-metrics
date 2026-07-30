import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getSession } from '@/lib/mothermode/research/store';
import {
  runHandoff,
  type HandoffTarget,
} from '@/lib/mothermode/research/handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Build handoffs run the targets' own generation pipelines (leadgen/email),
// and the system builder runs two of them in sequence.
export const maxDuration = 300;

const TARGETS: HandoffTarget[] = [
  'planner-cards',
  'leadgen-kit',
  'email-kit',
  'sales-funnel',
  'system',
];

/**
 * Research Lab handoff. POST { sessionId, artifactId, target } — turns an
 * artifact's structured payload into planner cards / a Lead Gen Kit / an
 * Email Kit / a Sales Funnel draft, then stamps the artifact handed-off.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const artifactId =
    typeof body.artifactId === 'string' ? body.artifactId.trim() : '';
  const target =
    typeof body.target === 'string' ? body.target.trim() : '';
  if (!sessionId || !artifactId || !target) {
    return NextResponse.json(
      { ok: false, error: 'sessionId, artifactId and target are required' },
      { status: 400 },
    );
  }
  if (!TARGETS.includes(target as HandoffTarget)) {
    return NextResponse.json(
      { ok: false, error: 'unknown handoff target' },
      { status: 400 },
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'session not found' },
      { status: 404 },
    );
  }

  try {
    const result = await runHandoff({
      artifactId,
      target: target as HandoffTarget,
      session,
      generate: body.generate === true,
      updatedBy: guard.email,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      handedOffTo: result.handedOffTo,
      artifact: result.artifact,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'handoff failed',
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  appendMessage,
  getArtifact,
  getSession,
} from '@/lib/mothermode/research/store';
import {
  runHandoff,
  type HandoffTarget,
} from '@/lib/mothermode/research/handoff';
import { handoffNotice } from '@/lib/mothermode/research/recipes/crew';

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
  // The artifact, for the notice trail's title (+ an honest early 404).
  const artifact = await getArtifact(artifactId);
  if (!artifact || artifact.sessionId !== session.id) {
    return NextResponse.json(
      { ok: false, error: 'artifact not found' },
      { status: 404 },
    );
  }

  const generate = body.generate === true;
  const kind = target as HandoffTarget;
  /** The chat trail: initiated -> completed/failed, so the owner watches
   *  the build start and land in the session feed. Best-effort — a notice
   *  never breaks the handoff it announces. */
  const notice = (phase: 'initiated' | 'completed' | 'failed', detail?: string) =>
    appendMessage({
      sessionId: session.id,
      role: 'assistant',
      content: handoffNotice({
        phase,
        target: kind,
        generate,
        artifactTitle: artifact.title,
        detail,
      }),
      expertSlug:
        artifact.createdBy === 'owner' || artifact.createdBy === 'agent'
          ? ''
          : artifact.createdBy,
    }).catch(() => {});

  try {
    await notice('initiated');
    const result = await runHandoff({
      artifactId,
      target: kind,
      session,
      generate,
      updatedBy: guard.email,
    });
    if (!result.ok) {
      await notice('failed', result.error);
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      );
    }
    await notice('completed', result.handedOffTo.label);
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

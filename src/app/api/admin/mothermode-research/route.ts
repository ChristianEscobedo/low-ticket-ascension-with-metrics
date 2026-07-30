import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listSessions,
  getSession,
  upsertSession,
  deleteSession,
  listMessages,
  listArtifacts,
  upsertArtifact,
  deleteArtifact,
} from '@/lib/mothermode/research/store';
import {
  isResearchArtifactType,
  toResearchArtifactStatus,
  toResearchSessionStatus,
} from '@/lib/mothermode/research/types';
import { normalizeContextRefs } from '@/lib/mothermode/context';
import { normalizeResearchIntake } from '@/lib/mothermode/research/intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Research Lab admin CRUD (sessions + artifacts). Admin-only.
 *
 *   GET    (no id)                 -> { ok, sessions }
 *   GET    ?id=<sessionId>         -> { ok, session, messages, artifacts }
 *   POST   entity 'session'        -> upsert { id?, title?, offerSlug?,
 *                                     contextRefs?, status? }
 *   POST   entity 'artifact'       -> upsert { id, title?, markdown?,
 *                                     structured?, status? }
 *   POST   entity 'delete-session' -> { id }
 *   POST   entity 'delete-artifact'-> { id }
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (!id) {
    const sessions = await listSessions();
    return NextResponse.json({ ok: true, sessions });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'session not found' },
      { status: 404 },
    );
  }
  const [messages, artifacts] = await Promise.all([
    listMessages(id),
    listArtifacts(id),
  ]);
  return NextResponse.json({ ok: true, session, messages, artifacts });
}

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
  const entity = typeof body.entity === 'string' ? body.entity.trim() : '';

  try {
    if (entity === 'session') {
      const session = await upsertSession({
        id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null,
        ...(body.title !== undefined
          ? { title: typeof body.title === 'string' ? body.title : '' }
          : {}),
        ...(body.offerSlug !== undefined
          ? { offerSlug: typeof body.offerSlug === 'string' ? body.offerSlug : '' }
          : {}),
        ...(body.contextRefs !== undefined
          ? { contextRefs: normalizeContextRefs(body.contextRefs) }
          : {}),
        ...(body.intake !== undefined
          ? { intake: normalizeResearchIntake(body.intake) }
          : {}),
        ...(body.status !== undefined
          ? { status: toResearchSessionStatus(body.status) }
          : {}),
        updatedBy: guard.email,
      });
      return NextResponse.json({ ok: true, session });
    }

    if (entity === 'artifact') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!id && !sessionId) {
        return NextResponse.json(
          { ok: false, error: 'artifact id (or sessionId for a new one) is required' },
          { status: 400 },
        );
      }
      if (
        body.type !== undefined &&
        !isResearchArtifactType(body.type)
      ) {
        return NextResponse.json(
          { ok: false, error: 'unknown artifact type' },
          { status: 400 },
        );
      }
      const artifact = await upsertArtifact({
        id: id || null,
        sessionId,
        ...(body.type !== undefined
          ? { type: body.type as never }
          : {}),
        ...(body.title !== undefined
          ? { title: typeof body.title === 'string' ? body.title : '' }
          : {}),
        ...(body.markdown !== undefined
          ? { markdown: typeof body.markdown === 'string' ? body.markdown : '' }
          : {}),
        ...(body.structured !== undefined &&
        body.structured &&
        typeof body.structured === 'object' &&
        !Array.isArray(body.structured)
          ? { structured: body.structured as Record<string, unknown> }
          : {}),
        ...(body.status !== undefined
          ? { status: toResearchArtifactStatus(body.status) }
          : {}),
      });
      return NextResponse.json({ ok: true, artifact });
    }

    if (entity === 'delete-session') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      await deleteSession(id);
      return NextResponse.json({ ok: true });
    }

    if (entity === 'delete-artifact') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      await deleteArtifact(id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: 'unknown entity' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'request failed',
      },
      { status: 500 },
    );
  }
}

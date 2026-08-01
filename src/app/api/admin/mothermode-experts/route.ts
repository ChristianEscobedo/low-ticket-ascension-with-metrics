import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listExperts,
  upsertExpert,
} from '@/lib/mothermode/research/experts/store';
import {
  expertDraftErrors,
  type ExpertDraft,
} from '@/lib/mothermode/research/experts/interview';
import {
  upsertSession,
  deleteSession,
} from '@/lib/mothermode/research/store';
import { runResearchTurn } from '@/lib/mothermode/research/agent/loop';
import type { ResearchExpert } from '@/lib/mothermode/research/experts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MotherMode Experts admin CRUD (roadmap 1.5). Admin-only.
 *
 *   GET            -> { ok, experts }            (active first, sort_order)
 *   GET ?archived  -> { ok, experts } including archived
 *   POST upsert    -> { ok, expert }             ({ id?, slug, ...fields })
 *   POST {action:'validate', ...draft} -> { ok, errors }   (Build-me-an-agent)
 *   POST {action:'sandbox', expert, message} -> { ok, reply }  (one turn in a
 *     THROWAWAY session — the draft expert runs for real, then the session
 *     row (and any sandbox artifacts/messages, via cascade) is deleted in
 *     the finally, so a test-drive never dirties the lab)
 */

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const includeArchived = request.nextUrl.searchParams.has('archived');
  const experts = await listExperts({ includeArchived });
  return NextResponse.json({ ok: true, experts });
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

  // ------------------------------------------------------- Build-me-an-agent
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (action === 'validate') {
    // The SHARED validator — the builder's live error line and this 400
    // path are the same function, so they can never disagree.
    return NextResponse.json({
      ok: true,
      errors: expertDraftErrors(body as Partial<ExpertDraft>),
    });
  }

  if (action === 'sandbox') {
    const draft = (body.expert ?? {}) as Partial<ExpertDraft>;
    const errors = expertDraftErrors(draft);
    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: errors[0], errors }, { status: 400 });
    }
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : 'Introduce yourself in one line: what do you do, and what do you need from me?';
    // The throwaway session: the draft expert runs ONE real turn (full
    // machinery — tools, the fence, the artifact contract), then the row
    // and everything it produced is deleted in the finally.
    const sandbox: ResearchExpert = {
      id: '',
      slug: (draft.slug ?? '').trim(),
      name: (draft.name ?? '').trim(),
      tagline: (draft.tagline ?? '').trim(),
      glyph: (draft.glyph ?? '').trim() || 'bot',
      persona: (draft.persona ?? '').trim(),
      model: (draft.model ?? '').trim(),
      tools: draft.tools ?? [],
      contextRefs: [],
      artifactTypes: draft.artifactTypes ?? [],
      accepts: [],
      emits: [],
      status: 'active',
      sortOrder: 0,
      createdAt: null,
      updatedAt: null,
    };
    let sessionId = '';
    try {
      const session = await upsertSession({
        title: `Sandbox: ${sandbox.name}`,
        updatedBy: 'expert-builder',
      });
      sessionId = session.id;
      let reply = '';
      let failure = '';
      await runResearchTurn({
        session,
        userText: message,
        expert: sandbox,
        emit: (event) => {
          if (event.type === 'message' && event.message.role === 'assistant') {
            reply = event.message.content;
          }
          if (event.type === 'error') failure = event.error;
        },
      });
      if (failure) {
        return NextResponse.json({ ok: false, error: failure }, { status: 502 });
      }
      return NextResponse.json({ ok: true, reply });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : 'sandbox failed' },
        { status: 500 },
      );
    } finally {
      if (sessionId) {
        try {
          await deleteSession(sessionId);
        } catch {
          /* a leaked sandbox row is bookkeeping, never a failed test-drive */
        }
      }
    }
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: 'slug is required' },
      { status: 400 },
    );
  }

  const strList = (v: unknown): string[] | undefined =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === 'string' && !!s.trim())
      : undefined;

  try {
    const expert = await upsertExpert({
      id:
        typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null,
      slug,
      ...(body.name !== undefined
        ? { name: typeof body.name === 'string' ? body.name : '' }
        : {}),
      ...(body.tagline !== undefined
        ? { tagline: typeof body.tagline === 'string' ? body.tagline : '' }
        : {}),
      ...(body.glyph !== undefined
        ? { glyph: typeof body.glyph === 'string' ? body.glyph : '' }
        : {}),
      ...(body.persona !== undefined
        ? { persona: typeof body.persona === 'string' ? body.persona : '' }
        : {}),
      ...(body.model !== undefined
        ? { model: typeof body.model === 'string' ? body.model : '' }
        : {}),
      ...(body.tools !== undefined ? { tools: strList(body.tools) } : {}),
      ...(body.artifactTypes !== undefined
        ? { artifactTypes: strList(body.artifactTypes) }
        : {}),
      ...(body.accepts !== undefined ? { accepts: strList(body.accepts) } : {}),
      ...(body.emits !== undefined ? { emits: strList(body.emits) } : {}),
      ...(body.status !== undefined
        ? { status: body.status === 'archived' ? 'archived' : 'active' }
        : {}),
      ...(typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
        ? { sortOrder: body.sortOrder }
        : {}),
    });
    return NextResponse.json({ ok: true, expert });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'save failed' },
      { status: 500 },
    );
  }
}

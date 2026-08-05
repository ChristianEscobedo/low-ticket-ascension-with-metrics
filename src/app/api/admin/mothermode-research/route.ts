import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  listSessions,
  getSession,
  upsertSession,
  deleteSession,
  listMessages,
  listArtifacts,
  listArtifactVersions,
  upsertArtifact,
  deleteArtifact,
  pinEvidence,
  listEvidence,
  deleteEvidence,
  readCallUsage,
} from '@/lib/mothermode/research/store';
import {
  isResearchArtifactType,
  toResearchArtifactStatus,
  toResearchSessionStatus,
} from '@/lib/mothermode/research/types';
import { normalizeContextRefs } from '@/lib/mothermode/context';
import { normalizeResearchIntake } from '@/lib/mothermode/research/intake';
import {
  collectPhraseItems,
  phraseBankRollup,
} from '@/lib/mothermode/research/phraseBank';
import { distillSessionLearnings } from '@/lib/mothermode/research/distill';
import {
  diffArtifacts,
  reverifySummary,
} from '@/lib/mothermode/research/reverify';
import { runResearchTurn } from '@/lib/mothermode/research/agent/loop';
import { outcomeDigestInstruction } from '@/lib/mothermode/research/outcome';
import {
  embedEvidenceRow,
  backfillEvidenceEmbeddings,
  searchEvidenceSemantically,
} from '@/lib/mothermode/research/embeddings';
export const maxDuration = 300;

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
    // Version history read: GET ?artifactVersions=<artifactId>.
    const versionsFor =
      request.nextUrl.searchParams.get('artifactVersions')?.trim() ?? '';
    if (versionsFor) {
      const versions = await listArtifactVersions(versionsFor);
      return NextResponse.json({ ok: true, versions });
    }
    const sessions = await listSessions();
    return NextResponse.json({ ok: true, sessions });
  }

    // Semantic evidence search (4.7): GET ?id=<sessionId>&evidenceSearch=<q>.
  const evidenceQuery =
    request.nextUrl.searchParams.get('evidenceSearch')?.trim() ?? '';
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'session not found' },
      { status: 404 },
    );
  }
  if (evidenceQuery) {
    const results = await searchEvidenceSemantically({
      sessionId: id,
      query: evidenceQuery,
    });
    return NextResponse.json({ ok: true, results });
  }
  const [messages, artifacts, evidence, usage] = await Promise.all([
    listMessages(id),
    listArtifacts(id),
    listEvidence(id),
    readCallUsage(id),
  ]);
  // The phrase bank (2.3): computed on read over the session's own corpus.
  const phraseBank = phraseBankRollup({
    items: collectPhraseItems({ messages, evidence }),
  });
  return NextResponse.json({
    ok: true,
    session,
    messages,
    artifacts,
    evidence,
    phraseBank,
    usage,
  });
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
        // Hand edits are provenance-stamped 'owner' (agent writes carry the
        // expert slug from the executor).
        createdBy: 'owner',
      });
      return NextResponse.json({ ok: true, artifact });
    }

    if (entity === 'pin-evidence') {
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const evidenceBody = typeof body.body === 'string' ? body.body : '';
      if (!sessionId || !evidenceBody.trim()) {
        return NextResponse.json(
          { ok: false, error: 'sessionId and body are required' },
          { status: 400 },
        );
      }
      const evidence = await pinEvidence({
        sessionId,
        ...(typeof body.artifactId === 'string' && body.artifactId.trim()
          ? { artifactId: body.artifactId.trim() }
          : {}),
        ...(typeof body.offerSlug === 'string'
          ? { offerSlug: body.offerSlug }
          : {}),
        ...(typeof body.kind === 'string' ? { kind: body.kind } : {}),
        body: evidenceBody,
        ...(typeof body.sourceUrl === 'string'
          ? { sourceUrl: body.sourceUrl }
          : {}),
        ...(typeof body.sourceTool === 'string'
          ? { sourceTool: body.sourceTool }
          : {}),
        ...(typeof body.expert === 'string' ? { expert: body.expert } : {}),
        createdBy: 'owner',
      });
      // Semantic lane (4.7): embed the pin, best-effort — never blocks it.
      await embedEvidenceRow({
        evidenceId: evidence.id,
        body: evidence.body,
      }).catch(() => {});
      return NextResponse.json({ ok: true, evidence });
    }

    if (entity === 'embed-evidence') {
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return NextResponse.json(
          { ok: false, error: 'sessionId is required' },
          { status: 400 },
        );
      }
      const embedded = await backfillEvidenceEmbeddings(sessionId);
      return NextResponse.json({ ok: true, embedded });
    }

    if (entity === 'delete-evidence') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        return NextResponse.json(
          { ok: false, error: 'id is required' },
          { status: 400 },
        );
      }
      await deleteEvidence(id);
      return NextResponse.json({ ok: true });
    }

    if (entity === 'reverify') {
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return NextResponse.json(
          { ok: false, error: 'sessionId is required' },
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
      const before = (await listArtifacts(sessionId)).find(
        (a) => a.type === 'research-brief',
      );
      // One fresh research turn, then diff the new brief against the old.
      let turnError = '';
      await runResearchTurn({
        session,
        userText:
          'Re-verify the current research brief: re-check its key claims against FRESH data (reddit and one social source — the 2.4 budget still applies). Note what changed, then save an updated research-brief artifact.',
        emit: (event) => {
          if (event.type === 'error') turnError = event.error;
        },
      });
      if (turnError) {
        return NextResponse.json(
          { ok: false, error: turnError },
          { status: 500 },
        );
      }
      const after = (await listArtifacts(sessionId)).find(
        (a) => a.type === 'research-brief',
      );
      if (!after || (before && after.id === before.id)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'no fresh research-brief landed to diff against',
          },
          { status: 500 },
        );
      }
      const diff = diffArtifacts(before?.markdown ?? '', after.markdown);
      return NextResponse.json({
        ok: true,
        summary: reverifySummary(diff),
        diff,
        artifactId: after.id,
        previousArtifactId: before?.id ?? '',
      });
    }

    if (entity === 'outcome') {
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return NextResponse.json(
          { ok: false, error: 'sessionId is required' },
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
      const parent = (await listArtifacts(sessionId)).find(
        (a) => a.type === 'research-brief',
      );
      // One analyst turn: the outcome digest over our own numbers (4.6).
      let turnError = '';
      await runResearchTurn({
        session,
        userText: outcomeDigestInstruction(session),
        expertSlug: 'analyst',
        emit: (event) => {
          if (event.type === 'error') turnError = event.error;
        },
      });
      if (turnError) {
        return NextResponse.json(
          { ok: false, error: turnError },
          { status: 500 },
        );
      }
      const digest = (await listArtifacts(sessionId)).find(
        (a) => a.type === 'research-brief',
      );
      if (!digest || (parent && digest.id === parent.id)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'no outcome digest landed (the analyst may have refused)',
          },
          { status: 500 },
        );
      }
      // Lineage: the digest's parent is the research that produced the work.
      if (parent) {
        await upsertArtifact({
          id: digest.id,
          sessionId: '',
          parentId: parent.id,
        });
      }
      return NextResponse.json({
        ok: true,
        artifactId: digest.id,
        parentArtifactId: parent?.id ?? '',
      });
    }

    if (entity === 'distill') {
      const sessionId =
        typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        return NextResponse.json(
          { ok: false, error: 'sessionId is required' },
          { status: 400 },
        );
      }
      const learnings = await distillSessionLearnings(sessionId);
      return NextResponse.json({ ok: true, learnings });
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

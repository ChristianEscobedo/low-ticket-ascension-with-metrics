import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { getSession, upsertSession } from '@/lib/mothermode/research/store';
import { runResearchTurn } from '@/lib/mothermode/research/agent/loop';
import { normalizeContextRefs } from '@/lib/mothermode/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Agent turns run model<->tool rounds; the default serverless timeout kills
// them mid-stream (which reads as "nothing happened" on the client).
export const maxDuration = 120;

/**
 * Research Lab chat turn, streamed as Server-Sent Events.
 *
 * Body: { sessionId?, message, model?, offerSlug?, contextRefs? }
 *   - No sessionId: a session is created on the fly (offerSlug/contextRefs
 *     apply) so the first message of a brand-new chat is one round trip.
 *   - model: a TEXT_MODELS id; '' / absent = Auto (server picks by keys).
 *
 * Event stream (one JSON per `data:` line):
 *   {type:'session', session}   first, always
 *   {type:'status', text}       "Thinking." / "Running social_search."
 *   {type:'tool', call}         one per tool call (the reasoning trace)
 *   {type:'artifact', artifact} one per saved artifact
 *   {type:'message', message}   the persisted assistant turn, last
 *   {type:'done'}               stream completed normally
 *   {type:'error', error}       stream failed (terminal)
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

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json(
      { ok: false, error: 'message is required' },
      { status: 400 },
    );
  }
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined;

  // Resolve (or create) the session before streaming starts — the client
  // needs the session id even if the turn itself fails.
  let session = null;
  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (sessionId) {
    session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'session not found' },
        { status: 404 },
      );
    }
  } else {
    try {
      session = await upsertSession({
        title: 'New research',
        offerSlug:
          typeof body.offerSlug === 'string' ? body.offerSlug.trim() : '',
        contextRefs: normalizeContextRefs(body.contextRefs),
        updatedBy: guard.email ?? null,
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Could not create the session.',
        },
        { status: 500 },
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          /* client disconnected mid-turn */
        }
      };
      send({ type: 'session', session });
      try {
        await runResearchTurn({
          session,
          userText: message,
          model,
          updatedBy: guard.email ?? null,
          emit: (event) => send(event as Record<string, unknown>),
        });
      } catch (err) {
        send({
          type: 'error',
          error:
            err instanceof Error ? err.message : 'The research turn failed.',
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

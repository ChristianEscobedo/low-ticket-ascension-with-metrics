/**
 * /api/admin/system-map/chat — the AI chat that SEES the map. The client sends
 * the conversation plus a compact text summary of the current graph (the
 * funnels + their metrics, the edge conversion rates, and the leaks); the
 * model answers grounded in that live picture — "why is the checkout
 * leaking?", "which reel made the most", "what should I fix first".
 *
 * Read-only by construction: no tools, no writes — the chat answers about the
 * graph, and the "draft the fix" action lives on the canvas (the blueprint
 * creator), not here. The gated pattern is untouched: the chat never edits.
 */
import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  callAgentModel,
  type AgentMessage,
} from '@/utils/integrations/research-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `You are the System Map assistant — you can SEE the operator's whole money system as a live graph (the funnels, their pages, the emails each step fires, the tracked links, the content feeding traffic, and the conversion rate on every connection).

Answer questions about it concisely and concretely. Ground every number in the data below — quote the actual figures, never invent one. When something is leaking (a weak edge), name it and the node it lives on, and point at the fix. When asked what to do first, lead with the biggest leak. Keep answers tight — a few sentences, not an essay.

THE CURRENT MAP:
`;

export async function POST(request: Request) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response;

  let body: { messages?: unknown; context?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown; context?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid JSON body' },
      { status: 400 },
    );
  }

  const context = typeof body.context === 'string' ? body.context.slice(0, 6000) : '';
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  // The conversation, plain user/assistant text (the last few turns).
  const messages: AgentMessage[] = rawMessages
    .slice(-12)
    .map((m): AgentMessage | null => {
      if (!m || typeof m !== 'object') return null;
      const rec = m as Record<string, unknown>;
      const content = typeof rec.content === 'string' ? rec.content.trim() : '';
      if (!content) return null;
      return rec.role === 'assistant'
        ? { role: 'assistant', content }
        : { role: 'user', content };
    })
    .filter((m): m is AgentMessage => m !== null);

  if (messages.length === 0) {
    return NextResponse.json(
      { success: false, error: 'A question is required' },
      { status: 400 },
    );
  }

  try {
    const result = await callAgentModel({
      system: SYSTEM + (context || '(the map is empty — no funnels yet)'),
      messages,
      tools: [],
      maxTokens: 1200,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, answer: result.data.text });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Chat failed' },
      { status: 500 },
    );
  }
}

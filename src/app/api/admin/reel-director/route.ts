import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

export const maxDuration = 120;

/**
 * The Director — the agentic editor (Phase 2 of the v2 strategy). You talk to
 * the reel in plain language ("tighten the middle", "the hook is weak, give me
 * three punchier ones") and the Director replies with an answer AND a list of
 * concrete timeline actions for the client to execute.
 *
 * Actions are deliberately the same operations the editor already trusts:
 *   { type: 'trim',     index, trimEndSec }  — cut seconds off a scene's tail
 *   { type: 'remove',   index }              — drop a scene
 *   { type: 'move',     from, to }           — reorder
 *   { type: 'hooks' }                        — reply carries 3 hook variants
 * Everything is validated client-side against the live project before apply;
 * the Director can never touch URLs, audio files, or anything outside
 * trim/remove/move — copy advice goes in `reply`, not in actions.
 */
const SYSTEM = `You are The Director, the editor of a short-form video reel. You see the timeline (scenes with index, name, source runtime, seconds already trimmed from the end) and talk to the human cutting it.

Rules:
- Answer with strict JSON only: { "reply": string, "actions": array }.
- actions may only use: {"type":"trim","index":n,"trimEndSec":x} (x = seconds cut from that scene's END, 0 = full scene), {"type":"remove","index":n}, {"type":"move","from":n,"to":n}.
- Every index must be a real scene index. Never invent scenes. Never discuss URLs.
- When the user asks for hook ideas, put 3 numbered hook lines (≤12 words each, punchy, first-1.5s-of-a-short energy) INSIDE reply, one per line, and return actions: [].
- When asked to tighten/cut, prefer small trims (1–3s) unless told otherwise; never trim a scene below 0.5s remaining.
- reply is plain text, short, direct, no fluff. If nothing to change, actions: [].`;

interface DirectorAction {
  type: string;
  index?: number;
  trimEndSec?: number;
  from?: number;
  to?: number;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 800) : '';
  if (!message) {
    return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
  }
  const clips = Array.isArray(body.clips) ? (body.clips as Record<string, unknown>[]) : [];
  const sceneList = clips
    .slice(0, 24)
    .map((c, i) => {
      const name = typeof c.name === 'string' ? c.name : `scene ${i}`;
      const dur = typeof c.durationSec === 'number' ? c.durationSec : 0;
      const trim = typeof c.trimEndSec === 'number' ? c.trimEndSec : 0;
      return `#${i} "${name}" — ${dur.toFixed(1)}s source, ${trim.toFixed(1)}s already trimmed (${(dur - trim).toFixed(1)}s on screen)`;
    })
    .join('\n');

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `TIMELINE:\n${sceneList || '(empty)'}\n\nHUMAN: ${message}`,
          },
        ],
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (json && (json.error?.message as string)) || `Director failed (${res.status})`,
      );
    }
    const content = json?.choices?.[0]?.message?.content;
    let parsed: { reply?: unknown; actions?: unknown } = {};
    try {
      parsed = JSON.parse(typeof content === 'string' ? content : '{}');
    } catch {
      parsed = { reply: typeof content === 'string' ? content : '', actions: [] };
    }
    const reply = typeof parsed.reply === 'string' ? parsed.reply : '';
    const actions: DirectorAction[] = [];
    for (const a of Array.isArray(parsed.actions) ? parsed.actions : []) {
      const o = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
      const type = typeof o.type === 'string' ? o.type : '';
      if (!['trim', 'remove', 'move'].includes(type)) continue;
      actions.push({
        type,
        index: typeof o.index === 'number' ? Math.floor(o.index) : undefined,
        trimEndSec: typeof o.trimEndSec === 'number' ? o.trimEndSec : undefined,
        from: typeof o.from === 'number' ? Math.floor(o.from) : undefined,
        to: typeof o.to === 'number' ? Math.floor(o.to) : undefined,
      });
    }


    return NextResponse.json({ success: true, reply, actions });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Director failed' },
      { status: 500 },
    );
  }
}

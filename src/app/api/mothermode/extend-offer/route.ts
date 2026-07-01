import { NextRequest, NextResponse } from 'next/server';
import { enrollInSequence } from '@/utils/email/sequences/engine';
import { getSequence } from '@/utils/email/sequences/definitions';

export const dynamic = 'force-dynamic';

/** Sequences a buyer may self-enroll into from a "I need more time" control. */
const SELF_ENROLL_ALLOWED = new Set(['coaching_extension']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "I need more time" handler for the coaching upsell (OTO4). The buyer asks to
 * hold their founding seat; we (re)start the deadline-driven coaching-extension
 * sequence so the engine emails them through the held window and exits them the
 * moment they purchase. Restart is intentional: asking again resets the clock.
 *
 * Best-effort and self-contained. Only the allow-listed sequence can be started
 * this way, so the endpoint cannot be used to enroll arbitrary recipients into
 * other flows.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; name?: unknown; sequenceId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON body' },
      { status: 400 }
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : null;
  const sequenceId =
    typeof body.sequenceId === 'string' && body.sequenceId.trim()
      ? body.sequenceId.trim()
      : 'coaching_extension';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'a valid email is required' },
      { status: 400 }
    );
  }
  if (!SELF_ENROLL_ALLOWED.has(sequenceId) || !getSequence(sequenceId)) {
    return NextResponse.json(
      { ok: false, error: 'unknown sequence' },
      { status: 400 }
    );
  }

  const result = await enrollInSequence({
    sequenceId,
    email,
    name,
    restart: true,
  });

  if (!result.ok) {
    // Not configured / DB error: tell the client it could not be held rather
    // than implying their seat is reserved.
    return NextResponse.json(
      { ok: false, error: result.reason ?? 'could not extend the offer' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, deadlineAt: result.deadlineAt ?? null });
}

/**
 * Gate notifications (the trust spine): when a run pauses for a human
 * decision, the owner HEARS about it — a run waiting silently is a run
 * abandoned. Email via Resend when the channel is configured
 * (RESEND_API_KEY + RECEIPT_FROM_EMAIL + GATE_NOTIFY_EMAIL); a documented
 * no-op otherwise — a notification channel never blocks the run it
 * announces. Server-only (raw fetch, no new dependency).
 */

export interface GateNotificationInput {
  recipeName: string;
  /** The gate prompt, e.g. `review "The Offload Map" — approve to continue`. */
  stepNote: string;
  runId: string;
  sessionId: string;
}

export async function sendGateNotification(
  input: GateNotificationInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECEIPT_FROM_EMAIL;
  const to = process.env.GATE_NOTIFY_EMAIL;
  if (!apiKey || !from || !to) return;
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Your yes is needed: ${input.recipeName}`,
        text: [
          `The play "${input.recipeName}" is paused at a gate.`,
          '',
          input.stepNote,
          '',
          `Approve or cancel it: ${baseUrl}/admin/recipes`,
          `Watch it in the chat: ${baseUrl}/admin/research?session=${input.sessionId}&run=${input.runId}`,
        ].join('\n'),
      }),
    });
  } catch {
    /* a notification never blocks the run it announces */
  }
}

// Pluggable email provider interface. Add a new provider by implementing
// `EmailProvider.send` and wiring it into `getEmailProvider`. The receipt
// module talks only to this interface so swapping providers is a config
// change rather than a code change at call sites.
import { getEmailProviderConfig } from '@/utils/integrations/runtime-config';

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  bcc?: string[] | null;
}

export interface EmailSendResult {
  ok: boolean;
  status?: number;
  detail?: string;
  /** Provider-side message id (Resend `id`, Postmark `MessageID`) when returned. */
  messageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Resolve the configured provider. An enabled in-app `email` integration wins,
 * otherwise the `RECEIPT_PROVIDER` / `RESEND_API_KEY` / `POSTMARK_API_TOKEN`
 * env vars. Returns null when no provider is configured (caller no-ops).
 */
export async function getEmailProvider(): Promise<EmailProvider | null> {
  const cfg = await getEmailProviderConfig();

  if (cfg.choice === 'postmark') {
    if (!cfg.postmarkToken) return null;
    return createPostmarkProvider(cfg.postmarkToken, cfg.postmarkStream);
  }

  // Default: Resend
  if (!cfg.resendKey) return null;
  return createResendProvider(cfg.resendKey);
}

export function createResendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    async send(message) {
      const body: Record<string, unknown> = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text
      };
      if (message.replyTo) body.reply_to = message.replyTo;
      if (message.bcc && message.bcc.length > 0) body.bcc = message.bcc;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return { ok: false, status: res.status, detail };
      }
      const json = (await res.json().catch(() => null)) as { id?: string } | null;
      return { ok: true, status: res.status, messageId: json?.id };
    }
  };
}

export function createPostmarkProvider(
  token: string,
  postmarkStream?: string
): EmailProvider {
  const stream =
    postmarkStream?.trim() ||
    process.env.RECEIPT_POSTMARK_STREAM?.trim() ||
    'outbound';
  return {
    name: 'postmark',
    async send(message) {
      const body: Record<string, unknown> = {
        From: message.from,
        To: message.to.join(','),
        Subject: message.subject,
        HtmlBody: message.html,
        TextBody: message.text,
        MessageStream: stream
      };
      if (message.replyTo) body.ReplyTo = message.replyTo;
      if (message.bcc && message.bcc.length > 0) {
        body.Bcc = message.bcc.join(',');
      }
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-Postmark-Server-Token': token
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return { ok: false, status: res.status, detail };
      }
      const json = (await res
        .json()
        .catch(() => null)) as { MessageID?: string } | null;
      return { ok: true, status: res.status, messageId: json?.MessageID };
    }
  };
}

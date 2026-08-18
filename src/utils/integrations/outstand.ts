/**
 * Outstand (outstand.so) — the unified social-publishing client. Reads the API
 * key stored in the `integrations` table by the admin Integrations page, and
 * publishes or schedules a post across the connected social accounts. One key
 * covers X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube, Pinterest,
 * and more. Server-only: never import this from a browser bundle.
 *
 * Endpoint:
 *   POST https://api.outstand.so/v1/posts/   -> publish/schedule a post
 *   Authorization: Bearer <api_key>
 */
import { getIntegration } from '@/utils/integrations/store';
import type { OutstandConfig } from '@/utils/integrations/types';

const BASE = 'https://api.outstand.so';

export interface OutstandPublishInput {
  /** The post text. */
  content: string;
  /** Absolute http(s) media URLs; non-absolute values are dropped. */
  mediaUrls?: string[];
  /**
   * The accounts to post to — an account id, a network name ('x',
   * 'instagram', 'linkedin', …), or a username. The piece's platform maps to
   * the network name.
   */
  accounts: string[];
  /** ISO 8601. When present (and future) the post is scheduled; else now. */
  scheduledAt?: string;
}

export type OutstandResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** Read the stored Outstand key, or null when the integration is unset. */
async function outstandKey(): Promise<string | null> {
  const row = await getIntegration<OutstandConfig>('outstand');
  const apiKey = row?.config?.api_key?.trim();
  if (!row?.enabled || !apiKey) return null;
  return apiKey;
}

/** True when Outstand is connected — the publishing surfaces check this. */
export async function outstandConnected(): Promise<boolean> {
  return (await outstandKey()) !== null;
}

/** Publish (now) or schedule a post across the chosen accounts. */
export async function outstandPublish(
  input: OutstandPublishInput,
): Promise<OutstandResult<{ id?: string; scheduled: boolean; url?: string }>> {
  const apiKey = await outstandKey();
  if (!apiKey) {
    return { ok: false, status: 503, error: 'Outstand is not connected' };
  }
  if (!input.content.trim() || input.accounts.length === 0) {
    return { ok: false, status: 400, error: 'Content and at least one account are required' };
  }

  // Outstand wants media as { url, filename } — the url from a prior upload.
  // The piece's rendered media rides as a public URL; the filename derives.
  const media = (input.mediaUrls ?? [])
    .filter((u) => /^https?:\/\//i.test(u))
    .map((url) => ({ url, filename: url.split('/').pop()?.split('?')[0] || 'media' }));

  const container: Record<string, unknown> = { content: input.content };
  if (media.length > 0) container.media = media;

  const body: Record<string, unknown> = {
    containers: [container],
    accounts: input.accounts,
  };
  if (input.scheduledAt) body.scheduledAt = input.scheduledAt;

  try {
    const res = await fetch(`${BASE}/v1/posts/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (json?.message as string) || (json?.error as string) || `Outstand post ${res.status}`;
      return { ok: false, status: res.status, error: msg };
    }
    const post = (json.post ?? json) as Record<string, unknown>;
    const id = post?.id ? String(post.id) : undefined;
    const url = typeof post?.url === 'string' ? (post.url as string) : undefined;
    // A future scheduledAt means Outstand will fire it; otherwise it's live.
    const scheduled = Boolean(
      input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now(),
    );
    return { ok: true, data: { id, scheduled, url } };
  } catch (err) {
    console.error('outstandPublish failed', err);
    return { ok: false, status: 502, error: 'Could not reach Outstand' };
  }
}

/**
 * GoHighLevel (LeadConnector) Social Planner client. Reuses the GHL credentials
 * already stored in the `integrations` table by the admin Integrations page, so
 * the content hub's Schedule tab can list connected social accounts and publish
 * or schedule posts. Server-only: never import this from a browser bundle.
 *
 * Endpoints (version 2021-07-28):
 *   GET  /social-media-posting/:locationId/accounts  -> connected accounts
 *   POST /social-media-posting/:locationId/posts     -> create/schedule a post
 */
import { getIntegration } from '@/utils/integrations/store';
import type { GhlConfig } from '@/utils/integrations/types';

const BASE = 'https://services.leadconnectorhq.com';

/** A connected social account as the Schedule tab needs it. */
export interface SocialAccount {
  id: string;
  name: string;
  platform: string;
  avatar?: string;
}

export interface CreatePostInput {
  accountIds: string[];
  summary: string;
  /** Absolute http(s) media URLs; non-absolute values are dropped. */
  mediaUrls?: string[];
  /** ISO timestamp. When present the post is scheduled; otherwise published. */
  scheduleDate?: string;
  /** Native post type. */
  type?: 'post' | 'story' | 'reel';
}

export type SocialResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** Read the stored GHL credentials, or null when the integration is unset. */
async function ghlCreds(): Promise<{ apiKey: string; locationId: string } | null> {
  const row = await getIntegration<GhlConfig>('ghl');
  const apiKey = row?.config?.api_key?.trim();
  const locationId = row?.config?.location_id?.trim();
  if (!row?.enabled || !apiKey || !locationId) return null;
  return { apiKey, locationId };
}

function headers(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    version: '2021-07-28',
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

/** Pull a usable account list out of GHL's (somewhat loose) response shape. */
function normalizeAccounts(payload: unknown): SocialAccount[] {
  const raw =
    (payload as { accounts?: unknown })?.accounts ??
    (payload as { results?: unknown })?.results ??
    [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const o = a as Record<string, unknown>;
      const id = String(o.id ?? o._id ?? o.accountId ?? '');
      if (!id) return null;
      return {
        id,
        name: String(o.name ?? o.username ?? o.platform ?? 'Account'),
        platform: String(o.platform ?? o.type ?? 'social').toLowerCase(),
        avatar: typeof o.avatar === 'string' ? o.avatar : undefined,
      } as SocialAccount;
    })
    .filter((a): a is SocialAccount => a !== null);
}

/** List the social accounts connected to the configured GHL location. */
export async function listSocialAccounts(): Promise<SocialResult<SocialAccount[]>> {
  const creds = await ghlCreds();
  if (!creds) return { ok: false, status: 503, error: 'GoHighLevel is not connected' };
  try {
    const res = await fetch(
      `${BASE}/social-media-posting/${creds.locationId}/accounts`,
      { headers: headers(creds.apiKey), cache: 'no-store' }
    );
    if (!res.ok) {
      return { ok: false, status: res.status, error: `GHL accounts ${res.status}` };
    }
    return { ok: true, data: normalizeAccounts(await res.json()) };
  } catch (err) {
    console.error('listSocialAccounts failed', err);
    return { ok: false, status: 502, error: 'Could not reach GoHighLevel' };
  }
}

/** Create (publish now) or schedule a post across the chosen accounts. */
export async function createSocialPost(
  input: CreatePostInput
): Promise<SocialResult<{ id?: string; scheduled: boolean }>> {
  const creds = await ghlCreds();
  if (!creds) return { ok: false, status: 503, error: 'GoHighLevel is not connected' };

  const media = (input.mediaUrls ?? [])
    .filter((u) => /^https?:\/\//i.test(u))
    .map((url) => ({ url }));

  const body: Record<string, unknown> = {
    accountIds: input.accountIds,
    summary: input.summary,
    type: input.type ?? 'post',
    status: input.scheduleDate ? 'scheduled' : 'published',
  };
  if (input.scheduleDate) body.scheduleDate = input.scheduleDate;
  if (media.length > 0) body.media = media;

  try {
    const res = await fetch(
      `${BASE}/social-media-posting/${creds.locationId}/posts`,
      { method: 'POST', headers: headers(creds.apiKey), body: JSON.stringify(body) }
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (json?.message as string) || (json?.error as string) || `GHL post ${res.status}`;
      return { ok: false, status: res.status, error: msg };
    }
    const post = (json.post ?? json) as Record<string, unknown>;
    const id = post?.id ? String(post.id) : post?._id ? String(post._id) : undefined;
    return { ok: true, data: { id, scheduled: Boolean(input.scheduleDate) } };
  } catch (err) {
    console.error('createSocialPost failed', err);
    return { ok: false, status: 502, error: 'Could not reach GoHighLevel' };
  }
}

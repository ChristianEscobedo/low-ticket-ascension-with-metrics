/**
 * muapi talking-head avatar client (server-only) — OmniHuman-1-class model:
 * a character reference image + an audio file → a lip-synced clip. Shares
 * muapi's model-slug-in-path contract with the Seedance client
 * (muapi-seedance.ts):
 *   submit  POST {base}/api/v1/{model}                 -> { request_id }
 *   poll    GET  {base}/api/v1/predictions/{id}/result -> { status, outputs }
 *
 * Env:
 *   MUAPI_API_KEY            required (shared with the Seedance pipeline).
 *   MUAPI_BASE_URL           defaults to https://api.muapi.ai.
 *   MUAPI_AVATAR_MODEL       the talking-head slug (default `omnihuman-1`) —
 *                            verify against the live catalog; flip the env
 *                            var, not the source.
 *   MUAPI_AVATAR_AUDIO_FIELD request-body key for the audio URL (default
 *                            `audio_url`) and MUAPI_AVATAR_IMAGE_FIELD for
 *                            the reference image (default `image_url`) — a
 *                            schema revision needs no code change.
 *
 * The AI Clone cost table prices this model (CLONE_COSTS.avatarPerSec in
 * src/lib/mothermode/reel/clone.ts) — update BOTH from the live dashboard.
 * Never import this from a browser bundle.
 */

import type { SeedanceResult, SeedanceStatus } from './muapi-seedance';

/** Inputs for one talking-head render. */
export interface MuapiAvatarInput {
  /** Public http(s) URL of the character reference (@1 — the locked sheet). */
  imageUrl: string;
  /** Public http(s) URL of the beat's audio (ElevenLabs mp3). */
  audioUrl: string;
  /** Direction: framing + delivery + the look bible, verbatim. */
  prompt: string;
  /** Target seconds of output (the beat's grid slot). */
  durationSec?: number;
  /** Optional model override; falls back to MUAPI_AVATAR_MODEL. */
  model?: string;
}

function baseUrl(): string {
  return (process.env.MUAPI_BASE_URL || 'https://api.muapi.ai').replace(/\/+$/, '');
}

function avatarModel(): string {
  return process.env.MUAPI_AVATAR_MODEL?.trim() || 'omnihuman-1';
}

function audioField(): string {
  return process.env.MUAPI_AVATAR_AUDIO_FIELD?.trim() || 'audio_url';
}

function imageField(): string {
  return process.env.MUAPI_AVATAR_IMAGE_FIELD?.trim() || 'image_url';
}

function pollTimeoutMs(): number {
  const n = Number(process.env.MUAPI_POLL_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 600000;
}

function pollIntervalMs(): number {
  const n = Number(process.env.MUAPI_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

function authHeaders(key: string): Record<string, string> {
  return {
    authorization: `Bearer ${key}`,
    'x-api-key': key,
    'content-type': 'application/json',
  };
}

/** True when the shared muapi key is present. */
export function isMuapiAvatarConfigured(): boolean {
  return !!process.env.MUAPI_API_KEY?.trim();
}

/** Pull a task id out of muapi's (few) response shapes. */
function readTaskId(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const j = json as Record<string, any>;
  return (
    (typeof j.request_id === 'string' && j.request_id) ||
    (typeof j.task_id === 'string' && j.task_id) ||
    (typeof j.id === 'string' && j.id) ||
    (typeof j.data?.request_id === 'string' && j.data.request_id) ||
    (typeof j.data?.id === 'string' && j.data.id) ||
    ''
  );
}

/** muapi is FastAPI: flatten detail[] / string fields into one message. */
function readErrorMessage(json: unknown, status: number): string {
  const j = (json ?? {}) as Record<string, any>;
  const detail = j.detail ?? j.error?.detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (!d || typeof d !== 'object') return String(d);
        const loc = Array.isArray(d.loc) ? d.loc.join('.') : d.loc;
        return [loc, d.msg].filter(Boolean).join(': ');
      })
      .filter(Boolean);
    if (parts.length) return `muapi avatar (${status}): ${parts.join('; ')}`;
  }
  if (typeof detail === 'string' && detail.trim())
    return `muapi avatar (${status}): ${detail}`;
  const msg =
    (typeof j.error?.message === 'string' && j.error.message) ||
    (typeof j.error === 'string' && j.error) ||
    (typeof j.message === 'string' && j.message) ||
    '';
  if (msg) return `muapi avatar (${status}): ${msg}`;
  return `muapi avatar request failed (${status})`;
}

function readStatus(json: unknown): SeedanceStatus['status'] {
  const j = (json ?? {}) as Record<string, any>;
  const raw = String(j.status ?? j.state ?? j.data?.status ?? '').toLowerCase();
  if (['succeeded', 'success', 'completed', 'complete', 'done', 'finished'].includes(raw))
    return 'succeeded';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(raw)) return 'failed';
  if (['processing', 'running', 'in_progress', 'started'].includes(raw)) return 'processing';
  return 'pending';
}

function readVideoUrl(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const j = json as Record<string, any>;
  const candidates = [
    j.video_url,
    j.url,
    j.output?.url,
    j.data?.video_url,
    Array.isArray(j.outputs)
      ? typeof j.outputs[0] === 'string'
        ? j.outputs[0]
        : j.outputs[0]?.url
      : undefined,
    Array.isArray(j.data?.outputs)
      ? typeof j.data.outputs[0] === 'string'
        ? j.data.outputs[0]
        : j.data.outputs[0]?.url
      : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return '';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Render one talking-head clip: submit + poll until succeeded/failed/timeout.
 * Returns muapi's (temporary) hosted URL — callers re-host to our storage
 * before persisting.
 */
export async function renderMuapiAvatar(
  input: MuapiAvatarInput,
): Promise<SeedanceResult<{ taskId: string; videoUrl: string }>> {
  const key = process.env.MUAPI_API_KEY?.trim();
  if (!key) return { ok: false, status: 501, error: 'MUAPI_API_KEY is not configured' };
  if (!/^https?:\/\//i.test(input.imageUrl || '')) {
    return { ok: false, status: 400, error: 'A public reference image URL is required' };
  }
  if (!/^https?:\/\//i.test(input.audioUrl || '')) {
    return { ok: false, status: 400, error: 'A public audio URL is required' };
  }

  const slug = input.model?.trim() || avatarModel();
  let submitRes: Response;
  try {
    submitRes = await fetch(`${baseUrl()}/api/v1/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({
        // The field keys are env-configurable so a schema revision is a var
        // flip, not a deploy.
        [imageField()]: input.imageUrl,
        [audioField()]: input.audioUrl,
        prompt: input.prompt,
        ...(typeof input.durationSec === 'number' && input.durationSec > 0
          ? { duration: Math.round(input.durationSec) }
          : {}),
      }),
    });
  } catch {
    return { ok: false, status: 502, error: 'Could not reach muapi' };
  }

  const submitJson = (await submitRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!submitRes.ok) {
    return {
      ok: false,
      status: submitRes.status,
      error: readErrorMessage(submitJson, submitRes.status),
    };
  }
  const taskId = readTaskId(submitJson);
  if (!taskId) return { ok: false, status: 502, error: 'muapi returned no task id' };

  const deadline = Date.now() + pollTimeoutMs();
  const interval = pollIntervalMs();
  await sleep(Math.min(interval, 2000));

  while (Date.now() < deadline) {
    let stRes: Response;
    try {
      stRes = await fetch(
        `${baseUrl()}/api/v1/predictions/${encodeURIComponent(taskId)}/result`,
        { method: 'GET', headers: authHeaders(key) },
      );
    } catch {
      return { ok: false, status: 502, error: 'Could not reach muapi' };
    }
    const st = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!stRes.ok) {
      return { ok: false, status: stRes.status, error: readErrorMessage(st, stRes.status) };
    }
    const status = readStatus(st);
    if (status === 'succeeded') {
      const videoUrl = readVideoUrl(st);
      if (!videoUrl) return { ok: false, status: 502, error: 'Avatar render finished without a video URL' };
      return { ok: true, data: { taskId, videoUrl } };
    }
    if (status === 'failed') {
      return { ok: false, status: 502, error: readErrorMessage(st, 502) };
    }
    await sleep(interval);
  }
  return { ok: false, status: 504, error: 'Avatar render timed out' };
}

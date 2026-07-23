/**
 * Seedance image-to-video renderer via MUAPI (server-only). Turns a storyboard
 * contact-sheet frame (a public image URL) plus a composed Reel Director prompt
 * into a cinematic clip. MUAPI runs the render asynchronously: we submit a task,
 * then poll until it completes, fails, or the timeout elapses.
 *
 * All config is env-driven so a model bump needs no code change:
 *   MUAPI_API_KEY          required — the pipeline is a clear "not configured"
 *                          state without it.
 *   MUAPI_BASE_URL         defaults to https://api.muapi.ai
 *   MUAPI_SEEDANCE_MODEL   defaults to seedance-1.0
 *   MUAPI_POLL_TIMEOUT_MS  defaults to 180000 (3 min)
 *   MUAPI_POLL_INTERVAL_MS defaults to 3000
 *
 * The response parsing is intentionally defensive: MUAPI's task/status/output
 * field names are read from a few common shapes so a minor API revision does not
 * break rendering. Never import this from a browser bundle.
 */

export type SeedanceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/** A submitted render task. */
export interface SeedanceTask {
  taskId: string;
}

/** The live status of a render task. */
export interface SeedanceStatus {
  taskId: string;
  /** Normalized lifecycle state. */
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  /** Public video URL once succeeded. */
  videoUrl?: string;
  /** Provider error message when failed. */
  error?: string;
}

/** Inputs for a single clip render. */
export interface SeedanceRenderInput {
  /** The composed Reel Director prompt for this clip. */
  prompt: string;
  /** Public http(s) URL of the storyboard frame to animate. */
  imageUrl: string;
  /** Clip aspect ratio, e.g. "9:16". Defaults to 9:16. */
  aspectRatio?: string;
  /** Clip duration in seconds (model-dependent; typically 5-10). */
  durationSec?: number;
  /** Optional deterministic seed. */
  seed?: number;
}

function baseUrl(): string {
  return (process.env.MUAPI_BASE_URL || 'https://api.muapi.ai').replace(/\/+$/, '');
}

function model(): string {
  return process.env.MUAPI_SEEDANCE_MODEL || 'seedance-1.0';
}

function pollTimeoutMs(): number {
  const n = Number(process.env.MUAPI_POLL_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 180000;
}

function pollIntervalMs(): number {
  const n = Number(process.env.MUAPI_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** True when a key is present so callers can render a "not configured" state. */
export function isSeedanceConfigured(): boolean {
  return !!process.env.MUAPI_API_KEY?.trim();
}

function authHeaders(key: string): Record<string, string> {
  return {
    authorization: `Bearer ${key}`,
    'x-api-key': key,
    'content-type': 'application/json',
  };
}

/** Pull a task id out of a few common response shapes. */
function readTaskId(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const j = json as Record<string, any>;
  return (
    (typeof j.task_id === 'string' && j.task_id) ||
    (typeof j.taskId === 'string' && j.taskId) ||
    (typeof j.id === 'string' && j.id) ||
    (typeof j.data?.task_id === 'string' && j.data.task_id) ||
    (typeof j.data?.id === 'string' && j.data.id) ||
    ''
  );
}

/** Normalize the many possible status strings into our four states. */
function readStatus(json: unknown): SeedanceStatus['status'] {
  const j = (json ?? {}) as Record<string, any>;
  const raw = String(
    j.status ?? j.state ?? j.data?.status ?? j.data?.state ?? '',
  ).toLowerCase();
  if (['succeeded', 'success', 'completed', 'complete', 'done', 'finished'].includes(raw))
    return 'succeeded';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(raw)) return 'failed';
  if (['processing', 'running', 'in_progress', 'started'].includes(raw))
    return 'processing';
  return 'pending';
}

/** Pull a video URL out of a few common output shapes. */
function readVideoUrl(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const j = json as Record<string, any>;
  const candidates = [
    j.video_url,
    j.videoUrl,
    j.url,
    j.output?.video_url,
    j.output?.url,
    j.data?.video_url,
    j.data?.url,
    Array.isArray(j.output) ? j.output[0]?.url : undefined,
    Array.isArray(j.outputs) ? j.outputs[0]?.url : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return '';
}

/**
 * Submit a Seedance image-to-video render. Returns a task id to poll. Does not
 * wait for completion.
 */
export async function submitSeedanceRender(
  input: SeedanceRenderInput,
): Promise<SeedanceResult<SeedanceTask>> {
  const key = process.env.MUAPI_API_KEY?.trim();
  if (!key)
    return { ok: false, status: 501, error: 'MUAPI_API_KEY is not configured' };
  if (!input.prompt?.trim())
    return { ok: false, status: 400, error: 'A prompt is required' };
  if (!/^https?:\/\//i.test(input.imageUrl || ''))
    return { ok: false, status: 400, error: 'A public image URL is required' };

  try {
    const res = await fetch(`${baseUrl()}/v1/video/generations`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({
        model: model(),
        prompt: input.prompt,
        image_url: input.imageUrl,
        aspect_ratio: input.aspectRatio || '9:16',
        duration: input.durationSec ?? 5,
        ...(typeof input.seed === 'number' ? { seed: Math.round(input.seed) } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (json as any)?.error?.message ||
        (json as any)?.message ||
        `MUAPI submit failed (${res.status})`;
      return { ok: false, status: res.status, error: msg };
    }
    const taskId = readTaskId(json);
    if (!taskId)
      return { ok: false, status: 502, error: 'MUAPI returned no task id' };
    return { ok: true, data: { taskId } };
  } catch {
    return { ok: false, status: 502, error: 'Could not reach MUAPI' };
  }
}

/** Fetch the current status of a render task. */
export async function getSeedanceStatus(
  taskId: string,
): Promise<SeedanceResult<SeedanceStatus>> {
  const key = process.env.MUAPI_API_KEY?.trim();
  if (!key)
    return { ok: false, status: 501, error: 'MUAPI_API_KEY is not configured' };
  if (!taskId?.trim())
    return { ok: false, status: 400, error: 'A task id is required' };
  try {
    const res = await fetch(
      `${baseUrl()}/v1/video/generations/${encodeURIComponent(taskId)}`,
      { method: 'GET', headers: authHeaders(key) },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (json as any)?.error?.message ||
        (json as any)?.message ||
        `MUAPI status failed (${res.status})`;
      return { ok: false, status: res.status, error: msg };
    }
    const status = readStatus(json);
    return {
      ok: true,
      data: {
        taskId,
        status,
        videoUrl: status === 'succeeded' ? readVideoUrl(json) : undefined,
        error:
          status === 'failed'
            ? String(
                (json as any)?.error?.message ||
                  (json as any)?.error ||
                  (json as any)?.message ||
                  'render failed',
              )
            : undefined,
      },
    };
  } catch {
    return { ok: false, status: 502, error: 'Could not reach MUAPI' };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit a render and poll until it succeeds, fails, or the timeout elapses.
 * Returns the final public video URL on success. Suitable for a single API
 * request handler that awaits the finished clip.
 */
export async function renderSeedanceClip(
  input: SeedanceRenderInput,
): Promise<SeedanceResult<{ taskId: string; videoUrl: string }>> {
  const submitted = await submitSeedanceRender(input);
  if (!submitted.ok) return submitted;
  const { taskId } = submitted.data;

  const deadline = Date.now() + pollTimeoutMs();
  const interval = pollIntervalMs();
  // Give the task a moment before the first poll.
  await sleep(Math.min(interval, 2000));

  while (Date.now() < deadline) {
    const status = await getSeedanceStatus(taskId);
    if (!status.ok) return status;
    if (status.data.status === 'succeeded') {
      if (!status.data.videoUrl)
        return { ok: false, status: 502, error: 'Render finished without a video URL' };
      return { ok: true, data: { taskId, videoUrl: status.data.videoUrl } };
    }
    if (status.data.status === 'failed') {
      return {
        ok: false,
        status: 502,
        error: status.data.error || 'Seedance render failed',
      };
    }
    await sleep(interval);
  }
  return {
    ok: false,
    status: 504,
    error: 'Seedance render timed out; poll the task id later',
  };
}

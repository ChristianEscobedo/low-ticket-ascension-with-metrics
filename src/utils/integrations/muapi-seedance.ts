/**
 * Seedance image-to-video renderer via MUAPI (server-only). Turns a storyboard
 * contact-sheet frame (a public image URL) plus a composed Reel Director prompt
 * into a cinematic clip. MUAPI runs the render asynchronously: we submit a task,
 * then poll until it completes, fails, or the timeout elapses.
 *
 * MUAPI's contract (muapi.ai) is model-slug-in-path, not an OpenAI-style single
 * endpoint:
 *   submit  POST {base}/api/v1/{model}                 -> { request_id }
 *   poll    GET  {base}/api/v1/predictions/{id}/result -> { status, outputs }
 * Auth is the `x-api-key` header. The model slug (e.g.
 * "seedance-2-vip-omni-reference-1080p") is the path segment.
 *
 * All config is env-driven so a model bump needs no code change:
 *   MUAPI_API_KEY          required — the pipeline is a clear "not configured"
 *                          state without it.
 *   MUAPI_BASE_URL         defaults to https://api.muapi.ai
 *   MUAPI_SEEDANCE_MODEL   defaults to seedance-2-vip-omni-reference-1080p (used
 *                          as the path segment). This is the cheapest Seedance
 *                          tier and supports omni-reference stills.
 *   MUAPI_POLL_TIMEOUT_MS  defaults to 600000 (10 min) — Seedance renders are
 *                          slow, so the blocking path waits generously.

 *   MUAPI_POLL_INTERVAL_MS defaults to 3000
 *   MUAPI_SEEDANCE_REF_FIELD
 *                          request-body key for the omni-reference image array
 *                          (defaults to "reference_images"). Omni-reference
 *                          models accept extra character/prop stills the prompt
 *                          addresses as @image1, @image2, @character, etc. The
 *                          field name lives in env so a schema revision needs no
 *                          code change — flip the var, not the source.

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
  /**
   * Optional per-render model override. Falls back to MUAPI_SEEDANCE_MODEL /
   * the built-in default when empty, so the UI selector can pick a model
   * without touching env.
   */
  model?: string;
  /**
   * Optional ordered list of public http(s) reference-image URLs for
   * omni-reference models (character sheets, prop stills, wardrobe). The prompt
   * addresses these by position — `@image1` is the first entry, `@image2` the
   * second, and so on; a `@character` alias can point at whichever slot holds
   * the character sheet. Sent under the MUAPI_SEEDANCE_REF_FIELD key. Ignored
   * (harmlessly) by models that do not support references.
   */
  referenceImages?: string[];
}


function baseUrl(): string {
  return (process.env.MUAPI_BASE_URL || 'https://api.muapi.ai').replace(/\/+$/, '');
}

function model(): string {
  // Cheapest Seedance tier and omni-reference capable — the recommended default.
  return process.env.MUAPI_SEEDANCE_MODEL || 'seedance-2-vip-omni-reference-1080p';
}

function pollTimeoutMs(): number {
  const n = Number(process.env.MUAPI_POLL_TIMEOUT_MS);
  // 10 min default: Seedance renders routinely run several minutes.
  return Number.isFinite(n) && n > 0 ? n : 600000;
}


function pollIntervalMs(): number {
  const n = Number(process.env.MUAPI_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

function refField(): string {
  return process.env.MUAPI_SEEDANCE_REF_FIELD?.trim() || 'reference_images';
}

/**
 * The single images-array key the omni-reference models want. MUAPI aliases
 * both `image_url` and `reference_images` to the model's `image` param, so
 * sending BOTH is a 422 ("Duplicate parameter: 'image'"). When references
 * exist we merge everything into ONE array under this key — start frame
 * first, then the refs, de-duplicated, order preserved (the prompt's
 * @image1/@image2 addressing reads this order). Env-overridable.
 */
function imageField(): string {
  return process.env.MUAPI_SEEDANCE_IMAGE_FIELD?.trim() || 'image';
}

/** Keep only well-formed public http(s) URLs, de-duplicated, order preserved. */
function cleanReferenceImages(urls?: string[]): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const url = typeof u === 'string' ? u.trim() : '';
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
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
    (typeof j.request_id === 'string' && j.request_id) ||
    (typeof j.task_id === 'string' && j.task_id) ||
    (typeof j.taskId === 'string' && j.taskId) ||
    (typeof j.id === 'string' && j.id) ||
    (typeof j.data?.request_id === 'string' && j.data.request_id) ||
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
    Array.isArray(j.output)
      ? typeof j.output[0] === 'string'
        ? j.output[0]
        : j.output[0]?.url
      : undefined,
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

/**
 * Extract a human-readable error out of MUAPI's several failure shapes. MUAPI is
 * FastAPI-based, so validation failures (422) arrive as a `detail` array of
 * `{ loc, msg, type }` objects — not the `error.message` / `message` an
 * OpenAI-style client expects. We flatten `detail` (array or string) first, then
 * fall back to the common string fields, so a bad field surfaces its actual name
 * (e.g. "body.duration: input should be a valid string") instead of a bare
 * status code.
 */
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
    if (parts.length) return `MUAPI (${status}): ${parts.join('; ')}`;
  }
  if (typeof detail === 'string' && detail.trim())
    return `MUAPI (${status}): ${detail}`;
  const msg =
    (typeof j.error?.message === 'string' && j.error.message) ||
    (typeof j.error === 'string' && j.error) ||
    (typeof j.message === 'string' && j.message) ||
    '';
  if (msg) return `MUAPI (${status}): ${msg}`;
  return `MUAPI request failed (${status})`;
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

  const slug = input.model?.trim() || model();
  const references = cleanReferenceImages(input.referenceImages);
  // THE DUPLICATE-'image' FIX: with references, the start frame + refs go in
  // ONE array (start frame first — @image1), never image_url + a second list.
  const merged = references.length
    ? Array.from(new Set([input.imageUrl, ...references]))
    : [];
  try {
    const res = await fetch(`${baseUrl()}/api/v1/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio || '9:16',
        duration: input.durationSec ?? 5,
        ...(typeof input.seed === 'number' ? { seed: Math.round(input.seed) } : {}),
        ...(merged.length
          ? { [imageField()]: merged }
          : { image_url: input.imageUrl }),
      }),
    });


    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: readErrorMessage(json, res.status),
      };
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
      `${baseUrl()}/api/v1/predictions/${encodeURIComponent(taskId)}/result`,
      { method: 'GET', headers: authHeaders(key) },
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: readErrorMessage(json, res.status),
      };
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

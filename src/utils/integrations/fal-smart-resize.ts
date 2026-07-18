/**
 * fal.ai smart-resize client (server-only).
 * https://fal.ai/models/fal-ai/smart-resize
 *
 * Queue API: submit → poll status → fetch result.
 * Auth: Authorization: Key $FAL_KEY
 */
import type { AiResult } from './openai-content';

const FAL_QUEUE = 'https://queue.fal.run';
const ENDPOINT = 'fal-ai/smart-resize';

export type FalResolution = '1K' | '2K' | '4K';
export type FalOutputFormat = 'jpeg' | 'png' | 'webp';
export type FalSafetyTolerance = '1' | '2' | '3' | '4' | '5' | '6';

/** Full SmartResizeInput surface from fal OpenAPI. */
export interface SmartResizeInput {
  /** Public URL of the source image. */
  image_url: string;
  /** Target dimensions as "WxH", 1–10 items. */
  target_sizes: string[];
  /** Extra instruction for nano-banana-pro (max 5000). Empty = preserve. */
  prompt?: string;
  /** Variants per size, 1–4. Default 1. */
  num_images_per_size?: number;
  /** Internal tier hint. Default 1K. */
  resolution?: FalResolution;
  /** Output format. Default png. */
  output_format?: FalOutputFormat;
  /** Safety filter 1–6. Default 4. */
  safety_tolerance?: FalSafetyTolerance;
  /** Optional seed shared across sizes. */
  seed?: number | null;
  /** When true, fal may return data URIs (we still prefer CDN URLs). */
  sync_mode?: boolean;
}

export interface SmartResizeImageFile {
  url: string;
  content_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface SmartResizeResultRow {
  images: SmartResizeImageFile[];
  description: string;
  width: number;
  height: number;
  aspect_ratio: string;
  resolution: string;
}

export interface SmartResizeOutput {
  images: SmartResizeImageFile[];
  description: string;
  results: SmartResizeResultRow[];
}

async function falKey(): Promise<string | null> {
  const k = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
  return k || null;
}

function authHeaders(key: string): HeadersInit {
  return {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
}

function normalizeInput(input: SmartResizeInput): SmartResizeInput | { error: string } {
  const image_url = input.image_url?.trim();
  if (!image_url) return { error: 'image_url is required' };
  if (!/^https?:\/\//i.test(image_url) && !image_url.startsWith('data:')) {
    return { error: 'image_url must be an http(s) or data URL' };
  }
  const sizes = (input.target_sizes ?? [])
    .map((s) => s.trim().toLowerCase().replace('×', 'x'))
    .filter((s) => /^\d{2,5}x\d{2,5}$/.test(s))
    .slice(0, 10);
  if (!sizes.length) return { error: 'At least one valid target size (WxH) is required' };

  const num = Math.max(1, Math.min(4, Math.round(input.num_images_per_size ?? 1)));
  const resolution: FalResolution =
    input.resolution === '2K' || input.resolution === '4K' ? input.resolution : '1K';
  const output_format: FalOutputFormat =
    input.output_format === 'jpeg' || input.output_format === 'webp'
      ? input.output_format
      : 'png';
  const safety =
    typeof input.safety_tolerance === 'string' &&
    ['1', '2', '3', '4', '5', '6'].includes(input.safety_tolerance)
      ? (input.safety_tolerance as FalSafetyTolerance)
      : '4';
  const prompt = (input.prompt ?? '').slice(0, 5000);
  const seed =
    typeof input.seed === 'number' && Number.isFinite(input.seed)
      ? Math.round(input.seed)
      : input.seed === null
        ? null
        : undefined;

  return {
    image_url,
    target_sizes: sizes,
    prompt,
    num_images_per_size: num,
    resolution,
    output_format,
    safety_tolerance: safety,
    ...(seed !== undefined ? { seed } : {}),
    sync_mode: input.sync_mode === true,
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Run smart-resize via the fal queue. Polls until COMPLETED or timeout.
 */
export async function runSmartResize(
  input: SmartResizeInput,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<AiResult<SmartResizeOutput>> {
  const key = await falKey();
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: 'FAL_KEY is not configured. Add it to the environment to enable smart resize.',
    };
  }

  const body = normalizeInput(input);
  if ('error' in body) {
    return { ok: false, status: 400, error: body.error };
  }

  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const pollMs = opts?.pollMs ?? 1500;
  const started = Date.now();

  let submitRes: Response;
  try {
    submitRes = await fetch(`${FAL_QUEUE}/${ENDPOINT}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : 'fal submit failed',
    };
  }

  const submitJson = (await submitRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  // Some fal deployments return the result inline when already complete.
  if (submitRes.ok && Array.isArray(submitJson.images)) {
    return { ok: true, data: submitJson as unknown as SmartResizeOutput };
  }

  if (!submitRes.ok) {
    const msg =
      typeof submitJson.detail === 'string'
        ? submitJson.detail
        : typeof submitJson.error === 'string'
          ? submitJson.error
          : `fal submit failed (${submitRes.status})`;
    return { ok: false, status: submitRes.status >= 400 ? submitRes.status : 502, error: msg };
  }

  const requestId =
    typeof submitJson.request_id === 'string' ? submitJson.request_id : '';
  if (!requestId) {
    return { ok: false, status: 502, error: 'fal did not return a request_id' };
  }

  const statusUrl =
    typeof submitJson.status_url === 'string'
      ? submitJson.status_url
      : `${FAL_QUEUE}/${ENDPOINT}/requests/${requestId}/status`;
  const resultUrl =
    typeof submitJson.response_url === 'string'
      ? submitJson.response_url
      : `${FAL_QUEUE}/${ENDPOINT}/requests/${requestId}`;

  while (Date.now() - started < timeoutMs) {
    let stRes: Response;
    try {
      stRes = await fetch(statusUrl, { headers: authHeaders(key) });
    } catch (e) {
      return {
        ok: false,
        status: 502,
        error: e instanceof Error ? e.message : 'fal status poll failed',
      };
    }
    const st = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
    const status = typeof st.status === 'string' ? st.status : '';

    if (status === 'COMPLETED') {
      let rRes: Response;
      try {
        rRes = await fetch(resultUrl, { headers: authHeaders(key) });
      } catch (e) {
        return {
          ok: false,
          status: 502,
          error: e instanceof Error ? e.message : 'fal result fetch failed',
        };
      }
      const result = (await rRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!rRes.ok) {
        const msg =
          typeof result.detail === 'string'
            ? result.detail
            : `fal result failed (${rRes.status})`;
        return { ok: false, status: 502, error: msg };
      }
      if (!Array.isArray(result.images)) {
        return { ok: false, status: 502, error: 'fal returned no images' };
      }
      return { ok: true, data: result as unknown as SmartResizeOutput };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        ok: false,
        status: 502,
        error: `fal job ${status.toLowerCase()}`,
      };
    }

    await sleep(pollMs);
  }

  return { ok: false, status: 504, error: 'fal smart-resize timed out' };
}

/**
 * Ensure an image is a public http(s) URL for fal. Data URLs must be hosted
 * first by the caller (hostGeneratedImage); this only validates.
 */
export function assertPublicImageUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

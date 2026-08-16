/**
 * fal.ai video background-removal client (server-only) — removes the background
 * from the speaker in a video, returning a cutout of just the subject. That
 * cutout is the foreground layer for the "caption behind the speaker" look:
 * original clip → caption → cutout on top, so the speaker occludes the words.
 *
 * DEFAULT MODEL: bria/video/background-removal/v3 — the cheaper, cost-effective
 * option. Its `auto_zoom` crops the output to the smallest rectangle the
 * subject stays inside for the whole video (the subject fills the frame), and
 * `output_container_and_codec: 'mp4_h264'` returns an mp4. (The pixelcut
 * pixelcut/video-background-removal model is the webm/alpha alternative — set
 * FAL_BG_REMOVE_ENDPOINT to switch.)
 *
 * Same queue lifecycle as the other fal clients (submit → poll → fetch).
 * Endpoint overridable via FAL_BG_REMOVE_ENDPOINT. Auth: `Authorization: Key $FAL_KEY`.
 */
import type { AiResult } from './openai-content';

const FAL_QUEUE = 'https://queue.fal.run';

/**
 * The background-removal model catalog — cheapest first. `bria` is the DEFAULT
 * (the cost-effective option): mp4 output + `auto_zoom` crops to the subject.
 * `pixelcut` is the webm/alpha alternative. The editor's model picker reads this.
 */
export const BG_REMOVE_MODELS = [
  { id: 'bria', endpoint: 'bria/video/background-removal/v3', label: 'Bria v3 · cheapest (mp4 + auto-zoom)' },
  { id: 'pixelcut', endpoint: 'pixelcut/video-background-removal', label: 'Pixelcut (webm · alpha)' },
] as const;
export type BgRemoveModelId = (typeof BG_REMOVE_MODELS)[number]['id'];

function endpoint(model?: string): string {
  const fromEnv = process.env.FAL_BG_REMOVE_ENDPOINT?.trim();
  if (fromEnv) return fromEnv;
  const found = BG_REMOVE_MODELS.find((m) => m.id === model);
  return (found ?? BG_REMOVE_MODELS[0]).endpoint;
}

function falKey(): string | null {
  return process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim() || null;
}

function authHeaders(key: string): HeadersInit {
  return {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  };
}

/** The background-removal settings surface (bria/video/background-removal/v3). */
export interface BgRemoveSettings {
  /**
   * AUTO-ZOOM: when true, bria crops the output to the smallest rectangle the
   * subject stays inside for the whole video — the subject fills the frame.
   * Default true (the punchy, subject-forward look the caption-behind-speaker
   * stack wants).
   */
  autoZoom?: boolean;
  /** Output container/codec. 'mp4_h264' (default) — the bria mp4 output. */
  outputFormat?: 'mp4_h264' | 'mp4_h265' | 'webm_vp9' | 'mov_proresks';
  /** A solid background color (bria background_color) — the chroma-key fallback. */
  backgroundColor?: string;
  /** The model — default 'bria' (the cheapest). See BG_REMOVE_MODELS. */
  model?: BgRemoveModelId | string;
}

/** Build the bria payload. */
export function buildBgRemovePayload(
  videoUrl: string,
  settings: BgRemoveSettings = {},
): Record<string, unknown> {
  return {
    video_url: videoUrl,
    auto_zoom: settings.autoZoom ?? true,
    output_container_and_codec: settings.outputFormat ?? 'mp4_h264',
    ...(settings.backgroundColor ? { background_color: settings.backgroundColor } : {}),
  };
}

/** The best error message out of fal's (varied) error shapes. */
function falErrorMessage(json: unknown, fallback: string): string {
  const j = json as Record<string, any>;
  const detail = j?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => (typeof d === 'string' ? d : (d as Record<string, unknown>)?.msg))
      .filter((s): s is string => typeof s === 'string' && !!s);
    if (parts.length) return parts.join('; ');
  }
  if (typeof j?.error === 'string' && j.error.trim()) return j.error;
  if (typeof j?.message === 'string' && j.message.trim()) return j.message;
  return fallback;
}

/** Pull the cutout video URL out of fal's (varied) result shapes. */
function readVideoUrl(json: unknown): string {
  const j = json as Record<string, any>;
  const candidates = [
    j?.video?.url,
    j?.video_url,
    j?.url,
    j?.output?.video?.url,
    j?.output?.url,
    j?.data?.video?.url,
  ];
  for (const u of candidates) {
    if (typeof u === 'string' && /^https?:\/\//i.test(u)) return u;
  }
  return '';
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Remove the background from a video via the fal queue. Submits
 * { video_url, background, output_format }, polls until COMPLETED (or timeout),
 * and returns the transparent cutout clip URL. Mirrors the other fal clients.
 */
export async function removeVideoBackground(
  videoUrl: string,
  settings: BgRemoveSettings = {},
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<AiResult<{ videoUrl: string; contentType: string }>> {
  const key = falKey();
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: 'FAL_KEY is not configured. Add it to the environment to enable background removal.',
    };
  }
  if (!/^https?:\/\//i.test(videoUrl)) {
    return { ok: false, status: 400, error: 'A public video URL is required.' };
  }

  const timeoutMs = opts?.timeoutMs ?? 300_000;
  const pollMs = opts?.pollMs ?? 2000;
  const started = Date.now();
  const ep = endpoint(settings.model);

  let submitRes: Response;
  try {
    submitRes = await fetch(`${FAL_QUEUE}/${ep}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(buildBgRemovePayload(videoUrl, settings)),
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : 'fal bg-remove submit failed',
    };
  }

  const submitJson = (await submitRes.json().catch(() => ({}))) as Record<string, unknown>;

  const inlineUrl = readVideoUrl(submitJson);
  if (submitRes.ok && inlineUrl) {
    return { ok: true, data: { videoUrl: inlineUrl, contentType: 'video/webm' } };
  }

  if (!submitRes.ok) {
    const msg = falErrorMessage(submitJson, `fal bg-remove submit failed (${submitRes.status})`);
    return { ok: false, status: submitRes.status >= 400 ? submitRes.status : 502, error: msg };
  }

  const requestId = typeof submitJson.request_id === 'string' ? submitJson.request_id : '';
  if (!requestId) {
    return { ok: false, status: 502, error: 'fal did not return a request_id' };
  }

  const statusUrl =
    typeof submitJson.status_url === 'string'
      ? submitJson.status_url
      : `${FAL_QUEUE}/${endpoint()}/requests/${requestId}/status`;
  const resultUrl =
    typeof submitJson.response_url === 'string'
      ? submitJson.response_url
      : `${FAL_QUEUE}/${endpoint()}/requests/${requestId}`;

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
        const msg = falErrorMessage(result, `fal bg-remove result failed (${rRes.status})`);
        return { ok: false, status: 502, error: msg };
      }
      const out = readVideoUrl(result);
      if (!out) {
        return { ok: false, status: 502, error: 'fal returned no cutout video' };
      }
      const contentType =
        typeof (result as Record<string, any>)?.video?.content_type === 'string'
          ? (result as Record<string, any>).video.content_type
          : 'video/webm';
      return { ok: true, data: { videoUrl: out, contentType } };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        ok: false,
        status: 502,
        error: falErrorMessage(st, `fal bg-remove job ${status.toLowerCase()}`),
      };
    }

    await sleep(pollMs);
  }

  return { ok: false, status: 504, error: 'fal background removal timed out' };
}

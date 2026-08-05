/**
 * fal.ai veed/subtitles client (server-only) — "fancy subtitles": word-timed
 * subtitle burn-in with styled karaoke (word-by-word) or full-line captions.
 * Same queue lifecycle as the ffmpeg compose client (submit → poll → fetch).
 * Endpoint overridable via FAL_VEED_ENDPOINT. Auth: `Authorization: Key $FAL_KEY`.
 *
 * The settings surface is passed through verbatim (snake_cased into the veed
 * `style` object) so new veed style fields ride along without a client bump.
 */
import type { AiResult } from './openai-content';

const FAL_QUEUE = 'https://queue.fal.run';

function endpoint(): string {
  return process.env.FAL_VEED_ENDPOINT?.trim() || 'veed/subtitles';
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

/** The full veed/subtitles settings surface (all optional, veed defaults apply). */
export interface VeedSubtitleSettings {
  /** 'word' = karaoke word-by-word, 'line' = full caption lines. */
  subtitleType?: 'word' | 'line';
  /** Font family (any Google-font name veed knows). */
  font?: string;
  /** Caption size in px at the output resolution. */
  fontSize?: number;
  /** Text color (#rrggbb). */
  fontColor?: string;
  /** Caption block color (#rrggbb). */
  backgroundColor?: string;
  /** Caption block opacity 0–1. */
  backgroundOpacity?: number;
  /** Where the captions sit on the frame. */
  position?: 'top' | 'center' | 'bottom';
  /** Text outline color (#rrggbb). */
  outlineColor?: string;
  /** Text outline width in px. */
  outlineWidth?: number;
  /** A VEED preset id (basic tier 1×: simple/beans/… or dynamic tier 2×: glass/glide/backdrop…). */
  preset?: string;
  /** Output resolution tier: '1080p' (1×) or '4k' (2×). */
  resolution?: '1080p' | '4k';
  /** Translate the subtitles into a BCP-47 target language (renders in that language). */
  translationLanguage?: string;
  /** Brand-aware transcription: up to 100 words/names ASR should never mishear. */
  customVocabulary?: string[];
  /** Provide your own SRT (raw text or URL) to skip auto-transcription. */
  srt?: string;
}

/** Build the veed payload (camelCase settings → snake_case style object). */
export function buildVeedSubtitlePayload(
  videoUrl: string,
  settings: VeedSubtitleSettings = {},
): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  if (settings.font) style.font = settings.font;
  if (settings.fontSize != null) style.font_size = settings.fontSize;
  if (settings.fontColor) style.font_color = settings.fontColor;
  if (settings.backgroundColor) style.background_color = settings.backgroundColor;
  if (settings.backgroundOpacity != null) style.background_opacity = settings.backgroundOpacity;
  if (settings.position) style.position = settings.position;
  if (settings.outlineColor) style.outline_color = settings.outlineColor;
  if (settings.outlineWidth != null) style.outline_width = settings.outlineWidth;
  if (settings.preset) style.preset = settings.preset;
  const out: Record<string, unknown> = {
    video_url: videoUrl,
    subtitle_type: settings.subtitleType ?? 'word',
    ...(Object.keys(style).length ? { style } : {}),
  };
  if (settings.resolution) out.resolution = settings.resolution;
  if (settings.translationLanguage?.trim()) out.translation_language = settings.translationLanguage.trim();
  if (settings.customVocabulary && settings.customVocabulary.length > 0) {
    out.custom_vocabulary = settings.customVocabulary.slice(0, 100);
  }
  if (settings.srt?.trim()) out.srt = settings.srt.trim();
  return out;
}

/**
 * Turn a fal error body into something a human can act on.
 *
 * fal runs FastAPI, so a 422 comes back as `detail: [{loc, msg, type}, ...]`
 * — an ARRAY, not a string. Reading only the string form (which is what the
 * 500/503 shapes use) silently discarded every validation error and left the
 * caller staring at "fal veed result failed (422)" with no idea which field
 * was rejected. Handle both shapes and name the offending field.
 */
function falErrorMessage(json: Record<string, unknown>, fallback: string): string {
  const detail = json.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        const o = d as Record<string, unknown>;
        const msg = typeof o?.msg === 'string' ? o.msg : '';
        // loc is like ["body", "video_url"] — the last segment is the field.
        const loc = Array.isArray(o?.loc) ? o.loc.filter((s) => typeof s === 'string') : [];
        const field = loc.length ? String(loc[loc.length - 1]) : '';
        if (msg && field) return `${field}: ${msg}`;
        return msg || field;
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (typeof json.error === 'string' && json.error.trim()) return json.error;
  if (typeof json.message === 'string' && json.message.trim()) return json.message;
  return fallback;
}

/** Pull the rendered video URL out of fal's (varied) result shapes. */
function readVideoUrl(json: unknown): string {
  const j = json as Record<string, any>;
  const candidates = [
    j?.video_url,
    j?.video?.url,
    j?.url,
    j?.output?.url,
    j?.output?.video?.url,
    j?.output?.video_url,
    j?.data?.video?.url,
    j?.data?.video_url,
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
 * Burn fancy subtitles into a video via the fal queue. Submits
 * { video_url, subtitle_type, style? }, polls until COMPLETED (or timeout),
 * and returns the rendered clip URL. Mirrors the compose lifecycle exactly.
 */
export async function veedSubtitles(
  videoUrl: string,
  settings: VeedSubtitleSettings = {},
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<AiResult<{ videoUrl: string }>> {
  const key = falKey();
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: 'FAL_KEY is not configured. Add it to the environment to enable fancy subtitles.',
    };
  }
  if (!/^https?:\/\//i.test(videoUrl)) {
    return { ok: false, status: 400, error: 'A public video URL is required.' };
  }

  const timeoutMs = opts?.timeoutMs ?? 300_000;
  const pollMs = opts?.pollMs ?? 2000;
  const started = Date.now();

  let submitRes: Response;
  try {
    submitRes = await fetch(`${FAL_QUEUE}/${endpoint()}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(buildVeedSubtitlePayload(videoUrl, settings)),
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : 'fal veed submit failed',
    };
  }

  const submitJson = (await submitRes.json().catch(() => ({}))) as Record<string, unknown>;

  const inlineUrl = readVideoUrl(submitJson);
  if (submitRes.ok && inlineUrl) {
    return { ok: true, data: { videoUrl: inlineUrl } };
  }

  if (!submitRes.ok) {
    const msg = falErrorMessage(submitJson, `fal veed submit failed (${submitRes.status})`);
    return {
      ok: false,
      status: submitRes.status >= 400 ? submitRes.status : 502,
      error: msg,
    };
  }

  const requestId =
    typeof submitJson.request_id === 'string' ? submitJson.request_id : '';
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
        const msg = falErrorMessage(result, `fal veed result failed (${rRes.status})`);
        return { ok: false, status: 502, error: msg };
      }
      const out = readVideoUrl(result);
      if (!out) {
        return { ok: false, status: 502, error: 'fal returned no subtitled video' };
      }
      return { ok: true, data: { videoUrl: out } };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      // The status payload usually carries the reason the job died. Dropping
      // it left "fal veed job failed" as the only clue.
      return {
        ok: false,
        status: 502,
        error: falErrorMessage(st, `fal veed job ${status.toLowerCase()}`),
      };
    }

    await sleep(pollMs);
  }

  return { ok: false, status: 504, error: 'fal fancy subtitles timed out' };
}

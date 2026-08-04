/**
 * fal.ai ffmpeg compose client (server-only). Stitches a piece's rendered
 * Seedance board clips into one reel, optionally laying a voiceover track over
 * the whole cut. Uses the same queue submit → poll → fetch pattern as the
 * smart-resize client, and re-uses the AiResult shape.
 *
 * The endpoint defaults to fal's `fal-ai/ffmpeg-api/compose` (a timeline "tracks"
 * model: a video track whose keyframes are the clips laid end to end, plus an
 * optional audio track for the voiceover). Override with FAL_FFMPEG_ENDPOINT if
 * a different compose deployment is preferred. Auth: `Authorization: Key $FAL_KEY`.
 */
import type { AiResult } from './openai-content';

const FAL_QUEUE = 'https://queue.fal.run';

/** The compose endpoint path, env-tunable for alternate deployments. */
function endpoint(): string {
  return process.env.FAL_FFMPEG_ENDPOINT?.trim() || 'fal-ai/ffmpeg-api/compose';
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

/** One ordered, timed source clip to stitch. */
export interface AssembleClip {
  /** Public http(s) URL of the rendered clip. */
  url: string;
  /** Clip runtime in seconds. */
  durationSec: number;
}

/** Inputs for a single reel assembly. */
export interface AssembleReelInput {
  /** Ordered source clips, laid end to end. */
  clips: AssembleClip[];
  /** Optional voiceover track laid over the full cut (hosted URL). */
  audioUrl?: string;
}

/** True when a FAL key is present so the assembler can run. */
export function isReelAssemblyConfigured(): boolean {
  return !!falKey();
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim());
}

/** Round to 3 decimals so timeline timestamps stay tidy. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Build the compose "tracks" payload: a single video track whose keyframes are
 * the clips laid sequentially, plus (when a voiceover is present) one audio
 * track spanning the full runtime. Exported for unit testing.
 */
export function buildComposePayload(
  input: AssembleReelInput,
): Record<string, unknown> {
  let cursor = 0;
  const videoKeyframes = input.clips.map((c) => {
    const dur = Math.max(0.1, c.durationSec);
    const kf = { url: c.url, timestamp: round3(cursor), duration: round3(dur) };
    cursor += dur;
    return kf;
  });
  const tracks: Record<string, unknown>[] = [
    { id: 'video', type: 'video', keyframes: videoKeyframes },
  ];
  if (input.audioUrl) {
    tracks.push({
      id: 'voiceover',
      type: 'audio',
      keyframes: [
        { url: input.audioUrl, timestamp: 0, duration: round3(cursor) },
      ],
    });
  }
  return { tracks };
}

/** Pull the composed video URL out of fal's (varied) result shapes. */
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
 * Compose a pre-built tracks payload via the fal queue. This is the low-level
 * variant for callers whose timeline does not fit AssembleReelInput (per-clip
 * trims, audio offsets) — e.g. the Reel Studio, which builds its own payload
 * with buildStudioComposePayload. Same queue lifecycle as assembleReel.
 */
export async function assembleTracks(
  body: Record<string, unknown>,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<AiResult<{ videoUrl: string }>> {
  const key = falKey();
  if (!key) {
    return {
      ok: false,
      status: 503,
      error:
        'FAL_KEY is not configured. Add it to the environment to enable reel assembly.',
    };
  }

  const timeoutMs = opts?.timeoutMs ?? 300_000;
  const pollMs = opts?.pollMs ?? 2000;

  const started = Date.now();

  let submitRes: Response;
  try {
    submitRes = await fetch(`${FAL_QUEUE}/${endpoint()}`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : 'fal compose submit failed',
    };
  }

  const submitJson = (await submitRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  // Some deployments return the result inline when already complete.
  const inlineUrl = readVideoUrl(submitJson);
  if (submitRes.ok && inlineUrl) {
    return { ok: true, data: { videoUrl: inlineUrl } };
  }

  if (!submitRes.ok) {
    const msg =
      typeof submitJson.detail === 'string'
        ? submitJson.detail
        : typeof submitJson.error === 'string'
          ? submitJson.error
          : `fal compose submit failed (${submitRes.status})`;
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
      const result = (await rRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!rRes.ok) {
        const msg =
          typeof result.detail === 'string'
            ? result.detail
            : `fal compose result failed (${rRes.status})`;
        return { ok: false, status: 502, error: msg };
      }
      const videoUrl = readVideoUrl(result);
      if (!videoUrl) {
        return { ok: false, status: 502, error: 'fal returned no composed video' };
      }
      return { ok: true, data: { videoUrl } };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        ok: false,
        status: 502,
        error: `fal compose job ${status.toLowerCase()}`,
      };
    }

    await sleep(pollMs);
  }

  return { ok: false, status: 504, error: 'fal reel assembly timed out' };
}

/**
 * Compose the reel via the fal queue. Submits the tracks payload, polls until
 * COMPLETED (or timeout), and returns the composed clip URL. Mirrors the
 * smart-resize lifecycle exactly so behavior is predictable.
 */
export async function assembleReel(
  input: AssembleReelInput,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<AiResult<{ videoUrl: string }>> {
  const clips = (input.clips ?? []).filter(
    (c) => c && isHttpUrl(c.url) && typeof c.durationSec === 'number',
  );
  if (clips.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'At least one rendered clip URL is required to assemble a reel.',
    };
  }

  const body = buildComposePayload({
    clips,
    audioUrl: isHttpUrl(input.audioUrl) ? input.audioUrl!.trim() : undefined,
  });

  return assembleTracks(body, opts);
}



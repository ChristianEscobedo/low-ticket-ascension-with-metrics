/**
 * Browser-side client for the Seedance render pipeline. Wraps the admin-gated
 * /api/mothermode/content/seedance route: submit an image-to-video render, then
 * poll its task until the provider finishes and our route hands back a hosted
 * (re-hosted to Supabase) clip URL. Pure network glue — no React, no state — so
 * the Reel Director panel can drive it and persist results through reviewClient.
 */

const ENDPOINT = '/api/mothermode/content/seedance';

/** Normalized lifecycle the route reports back for a task. */
export type SeedanceTaskStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

/** Shape of a submit/poll response from the route. */
interface SeedanceResponse {
  ok: boolean;
  taskId?: string;
  status?: SeedanceTaskStatus;
  videoUrl?: string;
  error?: string;
}

/** Inputs for a single clip render. */
export interface SeedanceSubmitInput {
  /** The fully composed Seedance prompt for this board. */
  prompt: string;
  /** Public still URL to animate (the board's rendered frame). */
  imageUrl: string;
  /** Aspect ratio hint ("9:16", "16:9", "1:1"). */
  aspectRatio?: string;
  /** Clip length in seconds. */
  durationSec?: number;
  /** Optional deterministic seed. */
  seed?: number;
  /** Optional model override; empty falls back to the server default. */
  model?: string;
}

async function post(body: Record<string, unknown>): Promise<SeedanceResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as SeedanceResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Render request failed (${res.status})`);
  }
  return json;
}

/** Submit a non-blocking render. Returns the taskId to poll. */
export async function submitSeedanceRender(
  input: SeedanceSubmitInput,
): Promise<string> {
  const json = await post({ ...input });
  if (!json.taskId) throw new Error('The render did not return a task id');
  return json.taskId;
}

/** Poll one task once. Returns the current status and (on success) hosted URL. */
export async function pollSeedanceTask(
  taskId: string,
): Promise<{ status: SeedanceTaskStatus; videoUrl?: string; error?: string }> {
  const res = await fetch(
    `${ENDPOINT}?taskId=${encodeURIComponent(taskId)}`,
  );
  const json = (await res.json().catch(() => ({}))) as SeedanceResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Poll failed (${res.status})`);
  }
  return {
    status: json.status ?? 'processing',
    videoUrl: json.videoUrl,
    error: json.error,
  };
}

/** Sleep helper for the poll loop. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit a render and poll to completion, resolving with the hosted clip URL.
 * Calls onStatus on each transition so the UI can reflect progress. Throws on a
 * failed render, a task error, or exceeding maxWaitMs.
 */
export async function renderSeedanceClip(
  input: SeedanceSubmitInput,
  opts: {
    intervalMs?: number;
    maxWaitMs?: number;
    onStatus?: (status: SeedanceTaskStatus) => void;
  } = {},
): Promise<string> {
  // Seedance renders routinely run several minutes; poll patiently and wait up
  // to 12 minutes before giving up, well past the typical finish time.
  const intervalMs = opts.intervalMs ?? 6000;
  const maxWaitMs = opts.maxWaitMs ?? 12 * 60 * 1000;


  const taskId = await submitSeedanceRender(input);
  opts.onStatus?.('pending');

  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await sleep(intervalMs);
    const result = await pollSeedanceTask(taskId);
    opts.onStatus?.(result.status);
    if (result.status === 'succeeded') {
      if (!result.videoUrl) {
        throw new Error('Render finished but returned no video URL');
      }
      return result.videoUrl;
    }
    if (result.status === 'failed') {
      throw new Error(result.error || 'The render failed');
    }
  }
  throw new Error(
    'Still rendering after 12 minutes — Seedance is taking longer than usual. ' +
      'Your credits were still spent on this task; leave the tab open and try ' +
      'Re-render, or check MUAPI for task ' +
      taskId +
      '.',
  );
}



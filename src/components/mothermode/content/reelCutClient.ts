/**
 * Browser-side client for the final reel assembly. Wraps the admin-gated
 * /api/mothermode/content/reel-cut route: send the ordered, timed board clips
 * (plus an optional voiceover track) and get back a hosted (re-hosted to
 * Supabase) reel URL. The route stitches synchronously and blocks until done,
 * so this is a single request — pure network glue, no React, no state — that the
 * Reel Director panel drives and persists through reviewClient.
 */
import type { ReelClip } from '@/lib/mothermode/content/reelAssembly';

const ENDPOINT = '/api/mothermode/content/reel-cut';

/** Inputs for one assembly request. */
export interface AssembleReelCutInput {
  /** Ordered source clips (board index / url / duration). */
  clips: ReelClip[];
  /** Optional voiceover track laid over the full cut (hosted URL). */
  audioUrl?: string;
}

/** What the route hands back on a finished assembly. */
export interface AssembleReelCutResult {
  /** Hosted URL of the assembled reel. */
  videoUrl: string;
  /** Total runtime in seconds. */
  durationSec: number;
}

interface ReelCutResponse {
  ok: boolean;
  status?: string;
  videoUrl?: string;
  durationSec?: number;
  error?: string;
}

/**
 * Submit the clips for assembly and resolve with the hosted reel URL. Throws a
 * clear Error on any failure (not configured, provider error, host failure) so
 * the panel can surface it.
 */
export async function assembleReelCut(
  input: AssembleReelCutInput,
): Promise<AssembleReelCutResult> {
  const clips = (input.clips ?? []).map((c) => ({
    url: c.url,
    durationSec: c.durationSec,
  }));
  if (clips.length === 0) {
    throw new Error('There are no rendered clips to assemble.');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clips, audioUrl: input.audioUrl }),
  });
  const json = (await res.json().catch(() => ({}))) as ReelCutResponse;
  if (!res.ok || !json.ok || !json.videoUrl) {
    throw new Error(json.error || `Reel assembly failed (${res.status})`);
  }
  return {
    videoUrl: json.videoUrl,
    durationSec:
      typeof json.durationSec === 'number' ? json.durationSec : 0,
  };
}

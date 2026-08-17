/**
 * Pexels (api.pexels.com) — the stock b-roll source for the Reel Studio.
 * Search Pexels VIDEOS → a portrait/HD clip lands as a scene or an overlay,
 * no Seedance render, no upload. Free API, no attribution required.
 *
 * Free API key from https://www.pexels.com/api — set PEXELS_API_KEY. The key
 * stays server-side (the /api/admin/reel-broll route reads it); it never
 * ships to the client.
 */

const BASE = 'https://api.pexels.com/videos';

export type PexelsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** One normalized b-roll clip — never the raw Pexels payload. */
export interface PexelsClip {
  id: string;
  /** The clip's runtime, seconds. */
  durationSec: number;
  width: number;
  height: number;
  /** The best portrait/HD file's direct URL — the clip's `url` on the timeline. */
  videoUrl: string;
  /** The poster image (the picker's thumbnail). */
  thumbUrl: string;
}

function pexelsKey(): string | null {
  const k = process.env.PEXELS_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

/** Pick the best video file: prefer HD, the tallest frame ≤ 1920 (a reel is
 *  1080×1920 — a 4K file is wasted bandwidth on the worker). */
function bestVideoFile(files: unknown): { link: string; width: number; height: number } | null {
  const list = (Array.isArray(files) ? files : []) as Record<string, unknown>[];
  const usable = list.filter(
    (f) => typeof f?.link === 'string' && Number(f?.height) > 0,
  );
  if (!usable.length) return null;
  const hd = usable.filter((f) => f.quality === 'hd');
  const pool = hd.length ? hd : usable;
  // The tallest frame ≤ 1920; else the smallest above (never a 4K monster).
  const under = pool.filter((f) => Number(f.height) <= 1920);
  const pick = (under.length ? under : pool).sort(
    (a, b) =>
      (under.length ? Number(b.height) - Number(a.height) : Number(a.height) - Number(b.height)),
  )[0];
  return {
    link: pick.link as string,
    width: Number(pick.width) || 0,
    height: Number(pick.height) || 0,
  };
}

/** Normalize one Pexels video object → the house shape (null if unusable). */
export function normalizePexelsClip(raw: unknown): PexelsClip | null {
  const r = raw as Record<string, unknown> | null;
  const id = r?.id != null ? String(r.id) : null;
  if (!id) return null;
  const file = bestVideoFile(r?.video_files);
  if (!file) return null;
  return {
    id,
    durationSec: Math.max(0, Math.round(Number(r?.duration) || 0)),
    width: file.width,
    height: file.height,
    videoUrl: file.link,
    thumbUrl: typeof r?.image === 'string' ? (r.image as string) : '',
  };
}

/**
 * Search Pexels videos (stock b-roll). Returns the normalized list, or a
 * clear error — a missing key says "add PEXELS_API_KEY", never a cryptic 401.
 */
export async function searchPexelsVideos(
  query: string,
  opts?: { limit?: number; orientation?: 'portrait' | 'landscape' | 'square' },
): Promise<PexelsResult<{ clips: PexelsClip[] }>> {
  const key = pexelsKey();
  if (!key) {
    return {
      ok: false,
      error:
        'PEXELS_API_KEY is not set — add a free key from https://www.pexels.com/api to .env.local.',
      status: 500,
    };
  }
  const q = (query ?? '').trim();
  if (!q) return { ok: false, error: 'A search term is required.', status: 400 };
  const params = new URLSearchParams({
    query: q,
    per_page: String(Math.max(1, Math.min(40, opts?.limit ?? 24))),
    orientation: opts?.orientation ?? 'portrait',
    size: 'medium',
  });
  try {
    const res = await fetch(`${BASE}/search?${params}`, {
      headers: { accept: 'application/json', authorization: key },
    });
    if (!res.ok) {
      return { ok: false, error: `Pexels failed (${res.status}).`, status: res.status };
    }
    const json = (await res.json()) as { videos?: unknown[] };
    const clips = (Array.isArray(json?.videos) ? json.videos : [])
      .map(normalizePexelsClip)
      .filter((c): c is PexelsClip => !!c && c.durationSec > 0);
    if (clips.length === 0) {
      return { ok: false, error: `No b-roll matched "${q}".`, status: 404 };
    }
    return { ok: true, data: { clips } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Pexels request failed',
      status: 502,
    };
  }
}

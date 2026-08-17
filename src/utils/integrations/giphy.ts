/**
 * GIPHY (api.giphy.com) — the sticker/glyph source for the Reel Studio's
 * media-cue fly-ins. The STICKER endpoint returns transparent-background
 * WebP/GIFs (the reaction sticker, the emphasis glyph), which drop onto the
 * overlay lane as a media cue — the cue renders an <img> (alpha is free), and
 * an animated GIF rides the <Gif> branch (frame-driven, so preview === render).
 *
 * Free API key from https://developers.giphy.com — set GIPHY_API_KEY. The key
 * stays server-side (the /api/admin/reel-stickers route reads it); it never
 * ships to the client.
 */

const BASE = 'https://api.giphy.com/v1';

export type GiphyResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** One normalized sticker — never the raw GIPHY payload. */
export interface GiphySticker {
  id: string;
  title: string;
  /** A static first-frame still (transparent) — the <img> render. */
  stillUrl: string;
  /** The animated GIF (transparent) — the <Gif> render. */
  gifUrl: string;
  /** The animated WebP (transparent, smaller) — preferred when supported. */
  webpUrl: string;
  width: number;
  height: number;
}

function giphyKey(): string | null {
  const k = process.env.GIPHY_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

/** Normalize one GIPHY sticker object → the house shape (null if unusable). */
export function normalizeGiphySticker(raw: unknown): GiphySticker | null {
  const r = raw as Record<string, unknown> | null;
  const id = typeof r?.id === 'string' ? (r.id as string) : null;
  if (!id) return null;
  const images = (r?.images ?? {}) as Record<string, Record<string, unknown>>;
  const original = images.original ?? {};
  // The best STATIC frame: original_still is full-res; fixed_width_still is
  // the 200px fallback. The still is what the cue's <img> renders (in sync in
  // preview + render) until the animated <Gif> branch lands.
  const still = images.original_still ?? images.fixed_width_still ?? images.preview ?? {};
  const stillUrl = typeof still.url === 'string' ? (still.url as string) : null;
  const gifUrl = typeof original.url === 'string' ? (original.url as string) : null;
  const webpUrl = typeof original.webp === 'string' ? (original.webp as string) : null;
  if (!stillUrl && !gifUrl) return null;
  const title =
    typeof r?.title === 'string' && (r.title as string).trim()
      ? (r.title as string).trim()
      : 'Sticker';
  return {
    id,
    title,
    stillUrl: stillUrl ?? (gifUrl as string),
    gifUrl: gifUrl ?? (stillUrl as string),
    webpUrl: webpUrl ?? gifUrl ?? (stillUrl as string),
    width: Number(original.width) || Number(still.width) || 0,
    height: Number(original.height) || Number(still.height) || 0,
  };
}

/**
 * Search GIPHY stickers (transparent-background glyphs). Returns the
 * normalized list, or a clear error — a missing key says "add GIPHY_API_KEY",
 * never a cryptic 401.
 */
export async function searchGiphyStickers(
  query: string,
  opts?: { limit?: number },
): Promise<GiphyResult<{ stickers: GiphySticker[] }>> {
  const key = giphyKey();
  if (!key) {
    return {
      ok: false,
      error:
        'GIPHY_API_KEY is not set — add a free key from https://developers.giphy.com to .env.local.',
      status: 500,
    };
  }
  const q = (query ?? '').trim();
  if (!q) return { ok: false, error: 'A search term is required.', status: 400 };
  const params = new URLSearchParams({
    api_key: key,
    q,
    limit: String(Math.max(1, Math.min(50, opts?.limit ?? 24))),
    rating: 'pg-13',
  });
  try {
    const res = await fetch(`${BASE}/stickers/search?${params}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `GIPHY failed (${res.status}).`, status: res.status };
    }
    const json = (await res.json()) as { data?: unknown[] };
    const stickers = (Array.isArray(json?.data) ? json.data : [])
      .map(normalizeGiphySticker)
      .filter((s): s is GiphySticker => !!s);
    if (stickers.length === 0) {
      return { ok: false, error: `No stickers matched "${q}".`, status: 404 };
    }
    return { ok: true, data: { stickers } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'GIPHY request failed',
      status: 502,
    };
  }
}

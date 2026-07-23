import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  assembleReel,
  isReelAssemblyConfigured,
  type AssembleClip,
} from '@/utils/integrations/fal-ffmpeg';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A compose job stitches several clips and can run a couple of minutes; give
// the blocking request room to poll to completion before responding.
export const maxDuration = 300;

/** The "not configured" message surfaced as a clear 400. */
const NOT_CONFIGURED =
  'Reel assembly is not configured. Add FAL_KEY (and optionally FAL_FFMPEG_ENDPOINT) to enable stitching board clips into a final reel.';

/**
 * Download the composed clip and re-host it in our own Storage bucket so the URL
 * is stable, same-origin, and survives the provider expiring its temp links.
 */
async function rehostVideo(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Could not download the assembled reel (${res.status})`);
  }
  const contentType = res.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadVideoBuffer(buffer, contentType);
}

/** Coerce a finite, positive number, else the fallback. */
function readDuration(v: unknown, fallback = 5): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Read + validate the ordered clip list from the body. Accepts
 * `[{ url, durationSec }]`, keeping only public http(s) URLs. Returns an empty
 * array when nothing usable is present so the caller surfaces a clear 400.
 */
function readClips(v: unknown): AssembleClip[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const url = typeof (item as any).url === 'string' ? (item as any).url.trim() : '';
      if (!/^https?:\/\//i.test(url)) return null;
      return { url, durationSec: readDuration((item as any).durationSec) };
    })
    .filter((c): c is AssembleClip => c !== null);
}

/**
 * Assemble a piece's rendered board clips into one reel. Admin-only, blocking:
 * submit the compose job, poll to completion, re-host the result, and return the
 * hosted `videoUrl` in one round trip.
 *
 * Body: { clips: [{ url, durationSec }], audioUrl? }.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  if (!isReelAssemblyConfigured()) {
    return NextResponse.json({ ok: false, error: NOT_CONFIGURED }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Expected a JSON body' },
      { status: 400 },
    );
  }

  const clips = readClips(body.clips);
  if (clips.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'At least one rendered clip URL is required.' },
      { status: 400 },
    );
  }
  const audioUrl =
    typeof body.audioUrl === 'string' && /^https?:\/\//i.test(body.audioUrl.trim())
      ? body.audioUrl.trim()
      : undefined;

  try {
    const rendered = await assembleReel({ clips, audioUrl });
    if (!rendered.ok) {
      return NextResponse.json(
        { ok: false, error: rendered.error },
        { status: rendered.status },
      );
    }
    const hosted = await rehostVideo(rendered.data.videoUrl);
    const durationSec = clips.reduce((sum, c) => sum + c.durationSec, 0);
    return NextResponse.json({
      ok: true,
      status: 'done',
      videoUrl: hosted,
      durationSec,
    });
  } catch (err) {
    console.error('[mothermode/content/reel-cut] assembly failed', err);
    const msg = err instanceof Error ? err.message : 'Reel assembly failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

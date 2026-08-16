import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { removeVideoBackground, type BgRemoveSettings } from '@/utils/integrations/fal-bg-remove';
import { trimRemoteClip } from '@/utils/integrations/ffmpeg-worker';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

/**
 * POST { videoUrl, fromSec?, toSec?, autoZoom?, model? } — remove the background
 * from a video's subject via fal (default bria/video/background-removal/v3, the
 * cost-effective model), then re-host the cutout into our storage (fal URLs are
 * signed and expire).
 *
 * THE WINDOW: fromSec/toSec trim the clip to just the selected span BEFORE the
 * removal (the ffmpeg worker re-cuts it) — the bria model caps at 60s, so a
 * longer clip must process a window, not the whole thing. The cutout then covers
 * exactly that window on the timeline.
 *
 * Returns { url, contentType } — the transparent cutout clip. The editor saves
 * it onto the project as a `cutouts[]` entry (clipId + fromSec/toSec window),
 * which the render plan stacks ABOVE the captions — the "caption behind the
 * speaker" look.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  if (!/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ success: false, error: 'videoUrl is required' }, { status: 400 });
  }

  const settings: BgRemoveSettings = {
    ...(typeof body.autoZoom === 'boolean' ? { autoZoom: body.autoZoom } : {}),
    ...(typeof body.backgroundColor === 'string' && body.backgroundColor.trim()
      ? { backgroundColor: body.backgroundColor.trim() }
      : {}),
    ...(typeof body.model === 'string' && body.model.trim() ? { model: body.model.trim() } : {}),
  };

  // THE WINDOW: trim the clip to the selected span BEFORE the removal — the
  // bria model caps at 60s, so a longer clip must process a window. The ffmpeg
  // worker re-cuts it; the cutout then covers exactly that window.
  let sourceUrl = videoUrl;
  const fromSec = typeof body.fromSec === 'number' && body.fromSec >= 0 ? body.fromSec : null;
  const toSec = typeof body.toSec === 'number' && body.toSec > (fromSec ?? 0) ? body.toSec : null;
  if (fromSec != null && toSec != null) {
    try {
      const trimmed = await trimRemoteClip({ url: videoUrl, inSec: fromSec, durSec: toSec - fromSec });
      sourceUrl = await uploadVideoBuffer(trimmed, 'video/mp4', 'reel-bg-remove-window');
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Could not trim the window: ${err instanceof Error ? err.message : 'trim failed'}` },
        { status: 502 },
      );
    }
  }

  const result = await removeVideoBackground(sourceUrl, settings);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status >= 400 ? result.status : 502 },
    );
  }

  // Re-host the cutout — fal URLs are signed and expire, so download + upload
  // into our storage before returning.
  try {
    const res = await fetch(result.data.videoUrl);
    if (!res.ok) throw new Error(`cutout download failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const url = await uploadVideoBuffer(buf, result.data.contentType || 'video/mp4', 'reel-bg-remove');
    return NextResponse.json({ success: true, url, contentType: result.data.contentType });
  } catch (err) {
    // Fall back to the fal URL if the re-host fails — better a expiring link
    // than a lost render.
    return NextResponse.json({
      success: true,
      url: result.data.videoUrl,
      contentType: result.data.contentType,
      rehost: 'failed',
      rehostError: err instanceof Error ? err.message : 're-host failed',
    });
  }
}

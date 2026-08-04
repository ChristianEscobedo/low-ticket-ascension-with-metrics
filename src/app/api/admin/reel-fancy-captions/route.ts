import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { veedSubtitles, type VeedSubtitleSettings } from '@/utils/integrations/fal-veed';
import { burnAssCaptions, ffmpegCaptionCapabilities } from '@/utils/integrations/ffmpeg-worker';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';
import type { ReelWord } from '@/lib/mothermode/reel/types';
import type { AssCaptionStyle } from '@/lib/mothermode/reel/assCaptions';

/**
 * POST { videoUrl, settings? } — burn "fancy subtitles" into a video via
 * veed/subtitles (word-timed karaoke or full-line captions), then re-host the
 * render into our storage (fal URLs are signed and expire).
 *
 * POST { videoUrl, words, free: true, style? } — THE FREE PATH: burn the same
 * karaoke look with our own ffmpeg worker (ASS \k sweep — no fal, no cost).
 */
export const maxDuration = 300;

/** GET — the capability probe: can this ffmpeg build burn subtitles? */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;
  const caps = await ffmpegCaptionCapabilities();
  return NextResponse.json({ success: true, ...caps });
}

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

  // THE FREE PATH — ffmpeg ASS karaoke burn (no fal, no cost).
  if (body.free === true) {
    const words = Array.isArray(body.words) ? (body.words as ReelWord[]) : [];
    if (words.length === 0) {
      return NextResponse.json(
        { success: false, error: 'words[] is required for the free burn (transcribe the scene first)' },
        { status: 400 },
      );
    }
    const style = (body.style ?? {}) as AssCaptionStyle;
    try {
      const buf = await burnAssCaptions({ url: videoUrl, words, style });
      const url = await uploadVideoBuffer(buf, 'video/mp4', 'reel-fancy-captions-free');
      return NextResponse.json({ success: true, url, path: 'ffmpeg-ass' });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Free burn failed' },
        { status: 500 },
      );
    }
  }

  const settings = (body.settings ?? {}) as VeedSubtitleSettings;
  const result = await veedSubtitles(videoUrl, settings);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  try {
    const dl = await fetch(result.data.videoUrl);
    if (!dl.ok) throw new Error(`download failed (${dl.status})`);
    const buf = Buffer.from(await dl.arrayBuffer());
    const url = await uploadVideoBuffer(buf, 'video/mp4', 'reel-fancy-captions');
    return NextResponse.json({ success: true, url, sourceUrl: result.data.videoUrl, path: 'veed' });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Re-host failed' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { extractSpriteBuffer } from '@/utils/integrations/ffmpeg-worker';

export const maxDuration = 120;

/**
 * R4 sprite sheets. GET ?url=<public clip URL>&dur=<seconds>&frames=4 → ONE
 * tiled JPEG (frames×1 at 160px per cell), edge-cached for a day. The
 * filmstrip slices it client-side with CSS background-position — 4× fewer
 * requests than per-frame thumbnails.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = (request.nextUrl.searchParams.get('url') || '').trim();
  const dur = Number(request.nextUrl.searchParams.get('dur') || '0');
  const frames = Number(request.nextUrl.searchParams.get('frames') || '4');
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
  }
  if (!(Number.isFinite(dur) && dur > 0.2)) {
    return NextResponse.json(
      { success: false, error: 'dur (seconds) is required for the frame spread' },
      { status: 400 },
    );
  }
  try {
    const jpg = await extractSpriteBuffer({
      url,
      durSec: dur,
      frames: Number.isFinite(frames) ? frames : 4,
    });
    return new NextResponse(new Uint8Array(jpg), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Sprite failed' },
      { status: 500 },
    );
  }
}

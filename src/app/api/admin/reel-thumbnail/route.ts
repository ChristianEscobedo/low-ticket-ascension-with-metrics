import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { extractFrameBuffer } from '@/utils/integrations/ffmpeg-worker';

export const maxDuration = 120;

/**
 * Server-side strip thumbnails. GET ?url=<public clip URL>&t=<seconds> → a
 * small JPEG, cached at the browser edge for a day (immutable — same URL+time
 * always yields the same frame). Replaces the client-side `<video #t=>`
 * thumbnail trick, which costs a range request and a decoder per thumbnail
 * per render and gets brutal on long reels.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const url = (request.nextUrl.searchParams.get('url') || '').trim();
  const t = Number(request.nextUrl.searchParams.get('t') || '0.5');
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
  }
  try {
    const jpg = await extractFrameBuffer({ url, atSec: Number.isFinite(t) ? t : 0.5 });
    return new NextResponse(new Uint8Array(jpg), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Thumbnail failed' },
      { status: 500 },
    );
  }
}

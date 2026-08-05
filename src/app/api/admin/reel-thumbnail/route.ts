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
    const message = err instanceof Error ? err.message : 'Thumbnail failed';

    // Distinguish a MISSING BINARY from a bad clip. `extractFrameBuffer`
    // shells out to ffmpeg; when the runtime has no binary, resolveFfmpegPath()
    // falls through to a bare 'ffmpeg' on PATH and execFile ENOENTs. That will
    // fail identically for every thumbnail forever, so reporting it as a 500
    // ("something went wrong, try again") is actively misleading — the strip
    // retries a hopeless call per frame per clip and floods the console.
    //
    // 503 + Retry-After says "this capability is unavailable", which is the
    // truth, and the message names the fix instead of leaking a spawn trace.
    if (/ENOENT|spawn|not recognized/i.test(message)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Thumbnails need an ffmpeg binary, and none is available in this runtime. ' +
            'Set FFMPEG_PATH, or install @ffmpeg-installer/ffmpeg so the platform binary ships with the bundle.',
          code: 'ffmpeg_unavailable',
        },
        { status: 503, headers: { 'retry-after': '3600' } },
      );
    }

    // A real per-clip failure (unreadable source, bad seek, CDN 403). Transient
    // and clip-specific, so 502 and let the caller retry this one.
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}



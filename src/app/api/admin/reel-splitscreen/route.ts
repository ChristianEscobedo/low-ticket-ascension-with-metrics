import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { composeSplitScreenRemote } from '@/utils/integrations/ffmpeg-worker';
import { uploadVideoBuffer } from '@/utils/mothermode/storage';

export const maxDuration = 300;

/**
 * R4 split-screen reaction. POST { mainUrl, reactionUrl } → the composed
 * 1080×1920 MP4 (main on top two-thirds, reaction cam bottom third), hosted.
 * The client inserts the returned URL as a scene; nothing here touches the
 * timeline (the page owns that).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const mainUrl = typeof body.mainUrl === 'string' ? body.mainUrl.trim() : '';
  const reactionUrl = typeof body.reactionUrl === 'string' ? body.reactionUrl.trim() : '';
  if (!/^https?:\/\//i.test(mainUrl) || !/^https?:\/\//i.test(reactionUrl)) {
    return NextResponse.json(
      { success: false, error: 'mainUrl and reactionUrl are required (public http(s)).' },
      { status: 400 },
    );
  }
  try {
    const buf = await composeSplitScreenRemote({ mainUrl, reactionUrl });
    const url = await uploadVideoBuffer(buf, 'video/mp4', 'reel-splitscreen');
    return NextResponse.json({ success: true, url });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Split-screen failed' },
      { status: 500 },
    );
  }
}

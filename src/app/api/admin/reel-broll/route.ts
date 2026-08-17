import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { searchPexelsVideos } from '@/utils/integrations/pexels';

/**
 * Pexels b-roll search for the Reel Studio. The Pexels key stays server-side
 * (PEXELS_API_KEY); the client gets the normalized clip list.
 *
 * GET /api/admin/reel-broll?q=money → { success, clips: PexelsClip[] }
 */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const q = request.nextUrl.searchParams.get('q') ?? '';
  const r = await searchPexelsVideos(q, { limit: 24, orientation: 'portrait' });
  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: r.error },
      { status: r.status },
    );
  }
  return NextResponse.json({ success: true, clips: r.data.clips });
}

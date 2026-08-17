import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { searchGiphyStickers } from '@/utils/integrations/giphy';

/**
 * GIPHY sticker search for the Reel Studio's sticker picker. The GIPHY key
 * stays server-side (GIPHY_API_KEY); the client gets the normalized list.
 *
 * GET /api/admin/reel-stickers?q=fire → { success, stickers: GiphySticker[] }
 */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const q = request.nextUrl.searchParams.get('q') ?? '';
  const r = await searchGiphyStickers(q, { limit: 24 });
  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: r.error },
      { status: r.status },
    );
  }
  return NextResponse.json({ success: true, stickers: r.data.stickers });
}

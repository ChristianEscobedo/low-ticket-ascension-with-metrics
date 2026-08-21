import { NextResponse } from 'next/server';
import { searchLottieFiles } from '@/utils/integrations/lottiefiles';

export const dynamic = 'force-dynamic';

/** GET ?q=fireworks — search the public LottieFiles animation library. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ success: false, error: 'Missing q' }, { status: 400 });
  try {
    const results = await searchLottieFiles(q);
    return NextResponse.json({ success: true, results });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Lottie search failed' },
      { status: 502 },
    );
  }
}

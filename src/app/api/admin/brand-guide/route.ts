import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The confidential brand guide lives outside public/ so it is never web-served.
// This route streams it inline to confirmed admins only. Kept relative to the
// project root; next.config.mjs force-includes the file in the serverless
// bundle so the read succeeds on Vercel.
const PDF_PATH = path.join(
  process.cwd(),
  'private',
  'brand',
  'mothermode-brand-system.pdf'
);

/**
 * GET: admin-only. Streams the confidential MotherMode brand system PDF inline.
 * Non-admins get 401/403 from the guard. Caching is disabled so the file is
 * never stored by shared caches.
 */
export async function GET() {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const file = await readFile(PDF_PATH);
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="mothermode-brand-system.pdf"',
        'Cache-Control': 'private, no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('[admin/brand-guide] read failed:', error);
    return NextResponse.json(
      { success: false, error: 'Brand guide is unavailable' },
      { status: 404 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import {
  ALLOWED_VIDEO_MIMES,
  uploadVideoBuffer,
} from '@/utils/mothermode/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Max final-cut size accepted by the content hub (100 MB). */
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Upload a final-cut video for a content piece. Admin-only. Accepts multipart
 * form data with a single `file` field (mp4/webm/mov). Returns the hosted
 * public URL so the client can store it on the piece's review state.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Expected multipart form data' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'A video file is required' },
      { status: 400 },
    );
  }

  const mime = (file.type || 'video/mp4').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_VIDEO_MIMES.includes(mime)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported video type (${mime || 'unknown'}). Use mp4, webm, or mov.`,
      },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { ok: false, error: 'The video file is empty' },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'Video must be 100 MB or smaller' },
      { status: 400 },
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await uploadVideoBuffer(buf, mime);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[mothermode/content/video] upload failed', err);
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

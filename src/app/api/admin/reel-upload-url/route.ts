import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media';

/**
 * Signed direct-to-storage upload for Reel Studio footage.
 *
 * The old path read the file as a base64 data-URL through the JSON body —
 * which triples size, dies on the platform request cap, and then still hits
 * the bucket's per-file limit (the "object exceeded the maximum allowed
 * size" error). This route just mints a signed upload URL; the browser PUTs
 * the raw file straight to Supabase. No server body, no base64, no request
 * cap — the only limit left is the bucket's (see 20261121000000).
 *
 * POST { ext?, contentType?, kind? } → { success, signedUrl, publicUrl }
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

  const kind =
    body.kind === 'audio' ? 'audio' : body.kind === 'image' ? 'image' : 'video';
  const ext =
    typeof body.ext === 'string' && /^[a-z0-9]{2,5}$/i.test(body.ext)
      ? body.ext.toLowerCase()
      : kind === 'audio'
        ? 'mp3'
        : kind === 'image'
          ? 'png'
          : 'mp4';
  const contentType =
    typeof body.contentType === 'string' && body.contentType.length < 100
      ? body.contentType
      : undefined;

  const path = `reel-studio/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });


  if (error || !data?.signedUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          (error?.message || 'Could not create an upload URL') +
          ' — check the bucket file size limit (supabase/migrations/20261121000000_media_bucket_video_limit.sql).',
      },
      { status: 500 },
    );
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Bucket name is overridable via env so deployments can choose a different
// storage bucket without code edits. Default matches the course admin
// convention. Create the bucket as public in the Supabase dashboard.
const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media';

/**
 * POST: Upload a base64 image to Supabase Storage and return its public URL.
 * Body: { base64Image: string, folder?: string }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const body = await request.json();
    const { base64Image, folder = 'course-thumbnails' } = body;

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: 'base64Image is required' },
        { status: 400 }
      );
    }

    const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Invalid base64 format' },
        { status: 400 }
      );
    }

    const mimeType = match[1];
    const binaryData = Buffer.from(match[2], 'base64');

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    const ext = extMap[mimeType] || 'png';

    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `${folder}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, binaryData, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[upload-thumbnail] Upload failed:', uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (error) {
    console.error('[upload-thumbnail] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 500 }
    );
  }
}

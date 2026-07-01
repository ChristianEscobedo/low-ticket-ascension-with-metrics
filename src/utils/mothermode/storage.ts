/**
 * Server-only image hosting for MotherMode. Uploads a base64 data-URL to the
 * shared Supabase Storage bucket and returns its public http(s) URL. Generated
 * images are hosted immediately so they can be rendered, saved, and posted to
 * GoHighLevel, which only accepts public URLs (never data-URLs). Uses the
 * service role, so this must never be imported from a browser bundle.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Same public bucket convention as the course thumbnail uploader.
const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Upload a data-URL image to Storage and return its public URL. Throws on an
 * invalid data-URL or a failed upload so callers can surface a clear message.
 */
export async function uploadImageDataUrl(
  dataUrl: string,
  folder = 'mothermode-ai',
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid base64 format');
  const mimeType = match[1];
  const binary = Buffer.from(match[2], 'base64');
  const ext = EXT_BY_MIME[mimeType] || 'png';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, binary, { contentType: mimeType, cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Host a freshly generated image best-effort: upload it and return the public
 * URL, but if hosting is unavailable fall back to the original data-URL so image
 * generation never hard-fails. Only the hosted form is GoHighLevel-postable.
 */
export async function hostGeneratedImage(dataUrl: string): Promise<string> {
  try {
    return await uploadImageDataUrl(dataUrl);
  } catch (err) {
    console.warn('[mothermode] image hosting failed, returning data-URL:', err);
    return dataUrl;
  }
}

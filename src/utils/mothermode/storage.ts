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

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
};

/** Allowed video MIME types for final-cut uploads. */
export const ALLOWED_VIDEO_MIMES = Object.keys(VIDEO_EXT_BY_MIME);

/**
 * Upload a raw video buffer to Storage and return its public URL. Used for
 * final-cut reel/video uploads from the content hub. Throws on failure.
 */
export async function uploadVideoBuffer(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  folder = 'mothermode-video',
): Promise<string> {
  const mime = mimeType.split(';')[0]?.trim().toLowerCase() || 'video/mp4';
  if (!ALLOWED_VIDEO_MIMES.includes(mime)) {
    throw new Error(`Unsupported video type: ${mime}`);
  }
  const ext = VIDEO_EXT_BY_MIME[mime] || 'mp4';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}


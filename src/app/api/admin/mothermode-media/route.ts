import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { requireAdminRoute } from '@/utils/courses/admin-route-guard';
import { isOfferMediaSlot } from '@/lib/mothermode/offerMediaSlots';
import { uploadImageDataUrl } from '@/utils/mothermode/storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// Offer media lands in its own folder within the shared public bucket.
const FOLDER = 'mothermode-offers';

/**
 * GET: admin-only. Returns the published media for an offer, keyed by slot. A
 * 200 also tells the client editor the viewer is an admin; non-admins get
 * 401/403 and the editor stays hidden.
 * Query: ?slug=offer-slug
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
  }

  // A confirmed admin always gets a 200 so the editor shows. If the read fails
  // (for example the migration has not run yet), return empty media rather than
  // an error; saving will surface the real problem with a clear message.
  const { data, error } = await (supabase as any)
    .from('mothermode_offer_media')
    .select('slot, url')
    .eq('slug', slug);
  if (error) {
    console.warn('[mothermode-media] read failed:', error.message);
    return NextResponse.json({ success: true, admin: true, media: {} });
  }

  const media: Record<string, string> = {};
  for (const row of (data as { slot: string; url: string }[]) ?? []) {
    media[row.slot] = row.url;
  }
  return NextResponse.json({ success: true, admin: true, media });
}

/**
 * POST: admin-only. Publish an image for a slot, by pasted link or upload.
 * Body: { slug, slot, url?, base64Image? }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  try {
    const { slug, slot, url, base64Image } = await request.json();
    if (!slug || !slot || !isOfferMediaSlot(slot)) {
      return NextResponse.json(
        { success: false, error: 'slug and a valid slot are required' },
        { status: 400 },
      );
    }

    let finalUrl: string | undefined = typeof url === 'string' ? url.trim() : undefined;
    if (base64Image) finalUrl = await uploadImageDataUrl(base64Image, FOLDER);
    if (!finalUrl) {
      return NextResponse.json(
        { success: false, error: 'Provide a url or an uploaded image' },
        { status: 400 },
      );
    }

    const { error } = await (supabase as any)
      .from('mothermode_offer_media')
      .upsert(
        { slug, slot, url: finalUrl, updated_by: guard.email, updated_at: new Date().toISOString() },
        { onConflict: 'slug,slot' },
      );
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    revalidatePath(`/mothermode/${slug}`);
    return NextResponse.json({ success: true, url: finalUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE: admin-only. Remove a published image so the slot falls back to its
 * catalog default placeholder.
 * Query: ?slug=offer-slug&slot=mockup
 */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if (!guard.ok) return guard.response!;

  const slug = request.nextUrl.searchParams.get('slug');
  const slot = request.nextUrl.searchParams.get('slot');
  if (!slug || !slot) {
    return NextResponse.json({ success: false, error: 'slug and slot are required' }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .from('mothermode_offer_media')
    .delete()
    .eq('slug', slug)
    .eq('slot', slot);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath(`/mothermode/${slug}`);
  return NextResponse.json({ success: true });
}

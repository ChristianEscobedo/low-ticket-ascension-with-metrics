import { createClient } from '@supabase/supabase-js';
import { isOfferMediaSlot, type OfferMedia } from './offerMediaSlots';

// Anon, cookie-free client. Published media is public (RLS allows anon SELECT),
// so reading it this way keeps the sales page cacheable rather than forcing it
// into per-request dynamic rendering.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

export {
  OFFER_MEDIA_SLOTS,
  isOfferMediaSlot,
  type OfferMediaSlot,
  type OfferMedia,
} from './offerMediaSlots';

/**
 * Read the published image overrides for one offer, keyed by slot. Returns an
 * empty object when nothing is published, the table is absent, or Supabase is
 * not configured, so the page always renders with its catalog defaults.
 */
export async function getPublishedOfferMedia(
  slug: string,
): Promise<Partial<OfferMedia>> {
  try {
    const { data, error } = await (supabase as any)
      .from('mothermode_offer_media')
      .select('slot, url')
      .eq('slug', slug);

    if (error || !data) return {};

    const media: Partial<OfferMedia> = {};
    for (const row of data as { slot: string; url: string }[]) {
      if (row.url && isOfferMediaSlot(row.slot)) {
        media[row.slot] = row.url;
      }
    }
    return media;
  } catch {
    return {};
  }
}

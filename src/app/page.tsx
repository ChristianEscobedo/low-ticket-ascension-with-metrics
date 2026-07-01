import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOffer } from '@/lib/mothermode/offers';
import { getPublishedOfferMedia } from '@/lib/mothermode/offerMedia';
import { MotherModeSalesPage } from '@/components/mothermode/MotherModeSalesPage';
import { OfferMediaEditor } from '@/components/mothermode/parts/OfferMediaEditor';

// The flagship $7 front-end offer is the app's front page.
const FLAGSHIP_SLUG = 'brain-dump-system';

// Re-render on a short interval so admin image edits propagate to buyers. The
// admin API also calls revalidatePath after each write for near-instant updates.
export const revalidate = 60;

export function generateMetadata(): Metadata {
  const offer = getOffer(FLAGSHIP_SLUG);
  if (!offer) return { title: 'MotherMode' };
  return {
    title: `${offer.name} | MotherMode`,
    description: offer.tagline,
  };
}

/**
 * Home route. Renders the flagship resource pack as the front page, with any
 * admin-published images merged over the catalog defaults.
 */
export default async function HomePage() {
  const offer = getOffer(FLAGSHIP_SLUG);
  if (!offer || !offer.ready) notFound();

  const published = await getPublishedOfferMedia(offer.slug);
  const merged = { ...offer, media: { ...offer.media, ...published } };

  return (
    <>
      <MotherModeSalesPage offer={merged} />
      <OfferMediaEditor slug={offer.slug} />
    </>
  );
}

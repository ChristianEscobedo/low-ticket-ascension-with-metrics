import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOffer, allOfferSlugs } from '@/lib/mothermode/offers';
import { getPublishedOfferMedia } from '@/lib/mothermode/offerMedia';
import { MotherModeSalesPage } from '@/components/mothermode/MotherModeSalesPage';
import { OfferMediaEditor } from '@/components/mothermode/parts/OfferMediaEditor';

interface OfferPageProps {
  params: { slug: string };
}

// Re-render on a short interval so admin image edits propagate to buyers. The
// admin API also calls revalidatePath after each write for near-instant updates.
export const revalidate = 60;

/** Pre-render every catalog offer at build time. */
export function generateStaticParams() {
  return allOfferSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: OfferPageProps): Metadata {
  const offer = getOffer(params.slug);
  if (!offer) return { title: 'MotherMode' };
  return {
    title: `${offer.name} | MotherMode`,
    description: offer.tagline,
  };
}

/**
 * The single dynamic route for every front-end resource pack. The slug selects
 * the offer; the sales page renders entirely from its catalog entry, with any
 * admin-published images merged over the catalog defaults.
 */
export default async function OfferPage({ params }: OfferPageProps) {
  const offer = getOffer(params.slug);
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

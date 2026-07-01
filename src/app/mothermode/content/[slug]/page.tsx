import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOffer, allOfferSlugs } from '@/lib/mothermode/offers';
import { ROUTES } from '@/lib/mothermode/brand';
import { ContentHub } from '@/components/mothermode/content/ContentHub';

interface OfferContentPageProps {
  params: { slug: string };
}

/** Pre-render a content hub for every catalog offer at build time. */
export function generateStaticParams() {
  return allOfferSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: OfferContentPageProps): Metadata {
  const offer = getOffer(params.slug);
  if (!offer) return { title: 'MotherMode' };
  return { title: `${offer.name} content | MotherMode` };
}

// Per-offer view of the internal content hub. The library is shared across
// offers; passing the offer reroutes every copied CTA to that offer's sales
// page. Not part of the buyer-facing funnel.
export default function OfferContentRoute({ params }: OfferContentPageProps) {
  const offer = getOffer(params.slug);
  if (!offer) notFound();

  return (
    <ContentHub
      offerName={offer.name}
      offerUrl={`${ROUTES.offerBase}/${offer.slug}`}
      offerSlug={offer.slug}
    />
  );
}

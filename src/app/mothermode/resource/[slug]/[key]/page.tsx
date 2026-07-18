import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getOffer } from '@/lib/mothermode/offers';
import { resolveDeliverable } from '@/lib/mothermode/deliverables/resolve';
import { DELIVERABLE_CATALOG } from '@/lib/mothermode/deliverables/index';
import { ResourceDocument } from '@/components/mothermode/parts/ResourceDocument';

interface ResourcePageProps {
  params: { slug: string; key: string };
}

// Re-render on a short interval so admin edits to a resource propagate to
// buyers quickly. The admin API also revalidates this path on save.
export const revalidate = 60;

/** Pre-render every registered resource document at build time. */
export function generateStaticParams() {
  return DELIVERABLE_CATALOG.map((doc) => ({ slug: doc.slug, key: doc.key }));
}

export async function generateMetadata({
  params,
}: ResourcePageProps): Promise<Metadata> {
  const offer = getOffer(params.slug);
  const doc = await resolveDeliverable(params.slug, params.key);
  if (!offer || !doc) return { title: 'MotherMode' };
  return {
    title: `${doc.title} | ${offer.name}`,
    description: doc.subtitle,
  };
}

/**
 * The single dynamic route every purchased resource opens into. The
 * (slug, key) pair selects the document; the delivery page renders the
 * published DB override when present, else the code default, inside the
 * shared branded document shell.
 */
export default async function ResourcePage({ params }: ResourcePageProps) {
  const offer = getOffer(params.slug);
  if (!offer) notFound();

  const doc = await resolveDeliverable(params.slug, params.key);
  if (!doc) notFound();

  return (
    <ResourceDocument doc={doc} offerName={offer.name} offerSlug={offer.slug} />
  );
}

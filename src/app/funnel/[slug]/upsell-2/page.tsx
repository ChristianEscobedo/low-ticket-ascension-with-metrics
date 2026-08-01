import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import UpsellPage from '@/components/mothermode/sales/UpsellPage';
import GatedPage from '@/components/mothermode/personalize/GatedPage';

interface Props {
  params: { slug: string };
  searchParams: { pp?: string };
}


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const funnel = await getFunnelBySlug(params.slug);
    if (!funnel) return { title: 'Special Offer | MotherMode' };
    return {
      title: `${funnel.upsell2.headline || 'Special Offer'} | MotherMode`,
      description: funnel.upsell2.subheadline || undefined,
    };
  } catch {
    return { title: 'Special Offer | MotherMode' };
  }
}

/**
 * OTO2 — editable funnel upsell driven by funnel.upsell2 JSON.
 * Renders the exact MotherMode OTO layout with admin hover-to-edit.
 */
export default async function FunnelUpsell2Route({ params, searchParams }: Props) {
  const { funnel, isAdmin, gated } = await loadSalesFunnelPage(params.slug, undefined, {
    pp: searchParams?.pp,
  });
  if (gated) return <GatedPage />;
  return <UpsellPage funnel={funnel} upsellKey="upsell2" isAdmin={isAdmin} />;
}



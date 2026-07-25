import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import UpsellPage from '@/components/mothermode/sales/UpsellPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const funnel = await getFunnelBySlug(params.slug);
    if (!funnel) return { title: 'Special Offer | MotherMode' };
    return {
      title: `${funnel.upsell1.headline || 'Special Offer'} | MotherMode`,
      description: funnel.upsell1.subheadline || undefined,
    };
  } catch {
    return { title: 'Special Offer | MotherMode' };
  }
}

/**
 * OTO1 — editable funnel upsell driven by funnel.upsell1 JSON.
 * Renders the exact MotherMode OTO layout with admin hover-to-edit.
 */
export default async function FunnelUpsell1Route({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug, 'upsell_yes');
  return <UpsellPage funnel={funnel} upsellKey="upsell1" isAdmin={isAdmin} />;
}

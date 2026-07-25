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
      title: `${funnel.upsell3.headline || 'Special Offer'} | MotherMode`,
      description: funnel.upsell3.subheadline || undefined,
    };
  } catch {
    return { title: 'Special Offer | MotherMode' };
  }
}

/**
 * OTO3 — editable funnel upsell driven by funnel.upsell3 JSON.
 * Renders the exact MotherMode OTO layout with admin hover-to-edit.
 */
export default async function FunnelUpsell3Route({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug);
  return <UpsellPage funnel={funnel} upsellKey="upsell3" isAdmin={isAdmin} />;
}

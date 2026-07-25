import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import CheckoutPage from '@/components/mothermode/sales/CheckoutPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const funnel = await getFunnelBySlug(params.slug);
    if (!funnel) return { title: 'Checkout | MotherMode' };
    return {
      title: `${funnel.checkout.headline || 'Checkout'} | MotherMode`,
      description: funnel.checkout.subheadline || undefined,
    };
  } catch {
    return { title: 'Checkout | MotherMode' };
  }
}

/**
 * Editable checkout step driven by funnel.checkout JSON.
 * Uses the funnel builder checkout UI (inline-editable for admins).
 * Continues into the funnel OTO ladder after checkout start.
 */
export default async function FunnelCheckoutRoute({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug);
  return <CheckoutPage funnel={funnel} isAdmin={isAdmin} />;
}

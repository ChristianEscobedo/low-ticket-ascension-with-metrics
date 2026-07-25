import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import SalesPage from '@/components/mothermode/sales/SalesPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const funnel = await getFunnelBySlug(params.slug);
    if (!funnel) return { title: 'MotherMode' };
    return {
      title: `${funnel.sales.headline || funnel.name} | MotherMode`,
      description: funnel.sales.subheadline || undefined,
    };
  } catch {
    return { title: 'MotherMode' };
  }
}

/**
 * Editable long-form sales page driven by funnel.sales JSON.
 * Admins get the floating Edit page toolbar (same pattern as optin).
 */
export default async function FunnelSalesRoute({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug, 'sales_view');
  return <SalesPage funnel={funnel} isAdmin={isAdmin} />;
}

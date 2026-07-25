import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import SalesOptinPage from '@/components/mothermode/sales/SalesOptinPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await getFunnelBySlug(params.slug);
  if (!funnel) return { title: 'MotherMode' };
  const title = funnel.optin.magnetTitle || funnel.name || 'MotherMode';
  return {
    title: `${title} | MotherMode`,
    description: funnel.optin.subheadline || funnel.optin.magnetDescription || undefined,
  };
}

export default async function FunnelOptinRoute({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug, 'view');
  return <SalesOptinPage funnel={funnel} isAdmin={isAdmin} />;
}

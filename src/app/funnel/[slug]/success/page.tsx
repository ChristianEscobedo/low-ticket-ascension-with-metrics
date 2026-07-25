import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import SuccessPage from '@/components/mothermode/sales/SuccessPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await getFunnelBySlug(params.slug);
  if (!funnel) return { title: 'MotherMode' };
  return {
    title: `${funnel.success.headline || 'Success'} | MotherMode`,
    description: funnel.success.subheadline || undefined,
  };
}

export default async function FunnelSuccessRoute({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug, 'success_view');
  return <SuccessPage funnel={funnel} isAdmin={isAdmin} />;
}

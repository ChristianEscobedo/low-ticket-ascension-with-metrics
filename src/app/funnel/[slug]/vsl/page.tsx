import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import VslPage from '@/components/mothermode/sales/VslPage';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await getFunnelBySlug(params.slug);
  if (!funnel) return { title: 'MotherMode' };
  return {
    title: `${funnel.vsl.headline || funnel.name} | MotherMode`,
    description: funnel.vsl.subheadline || undefined,
  };
}

export default async function FunnelVslRoute({ params }: Props) {
  const { funnel, isAdmin } = await loadSalesFunnelPage(params.slug, 'vsl_view');
  return <VslPage funnel={funnel} isAdmin={isAdmin} />;
}

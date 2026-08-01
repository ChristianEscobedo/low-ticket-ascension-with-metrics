import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import AccessPage from '@/components/mothermode/sales/AccessPage';
import GatedPage from '@/components/mothermode/personalize/GatedPage';

interface Props {
  params: { slug: string };
  searchParams: { pp?: string };
}


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await getFunnelBySlug(params.slug);
  if (!funnel) return { title: 'MotherMode' };
  return {
    title: `${funnel.access.headline || 'Access'} | MotherMode`,
    description: funnel.access.subheadline || undefined,
  };
}

export default async function FunnelAccessRoute({ params, searchParams }: Props) {
  const { funnel, isAdmin, gated } = await loadSalesFunnelPage(params.slug, 'access_view', {
    pp: searchParams?.pp,
  });
  if (gated) return <GatedPage />;
  return <AccessPage funnel={funnel} isAdmin={isAdmin} />;
}



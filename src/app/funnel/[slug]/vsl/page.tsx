import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import VslPage from '@/components/mothermode/sales/VslPage';
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
    title: `${funnel.vsl.headline || funnel.name} | MotherMode`,
    description: funnel.vsl.subheadline || undefined,
  };
}

export default async function FunnelVslRoute({ params, searchParams }: Props) {
  const { funnel, isAdmin, gated } = await loadSalesFunnelPage(params.slug, 'vsl_view', {
    pp: searchParams?.pp,
  });
  if (gated) return <GatedPage />;
  return <VslPage funnel={funnel} isAdmin={isAdmin} />;
}



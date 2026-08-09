import type { Metadata } from 'next';
import { getFunnelBySlug } from '@/lib/mothermode/sales/store';
import { loadSalesFunnelPage } from '@/lib/mothermode/sales/loadFunnelPage';
import SuccessPage from '@/components/mothermode/sales/SuccessPage';
import GatedPage from '@/components/mothermode/personalize/GatedPage';
import {
  assignmentsToDeliveryCards,
  listAssignmentsForFunnel,
} from '@/lib/mothermode/sales/productAssignments';

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
    title: `${funnel.success.headline || 'Success'} | MotherMode`,
    description: funnel.success.subheadline || undefined,
  };
}

export default async function FunnelSuccessRoute({ params, searchParams }: Props) {
  const { funnel, isAdmin, gated } = await loadSalesFunnelPage(params.slug, 'success_view', {
    pp: searchParams?.pp,
  });
  if (gated) return <GatedPage />;
  // Merge assignment-derived delivery cards (products tab) with the manually
  // authored ones; manual cards win on duplicate href.
  try {
    const assignments = await listAssignmentsForFunnel(funnel.slug);
    const derived = assignmentsToDeliveryCards(assignments);
    if (derived.length > 0) {
      const seen = new Set(funnel.success.deliveryCards.map((c) => c.href));
      funnel.success = {
        ...funnel.success,
        deliveryCards: [
          ...funnel.success.deliveryCards,
          ...derived.filter((c) => !seen.has(c.href)),
        ],
      };
    }
  } catch {
    /* assignments are additive — never block the page */
  }
  return <SuccessPage funnel={funnel} isAdmin={isAdmin} />;
}



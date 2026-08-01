import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getFunnelBySlug,
  getPublishedFunnelBySlug,
  incrementFunnelViews,
  recordOptinEvent,
} from '@/lib/mothermode/optin/store';

import OptinPage from '@/components/mothermode/optin/OptinPage';
import GatedPage from '@/components/mothermode/personalize/GatedPage';
import { resolveOptinPersonalization } from '@/lib/mothermode/personalize/resolve';
import { isAdminEmail } from '@/utils/courses/access';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

interface Props {
  params: { slug: string };
  searchParams: { pp?: string };
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

/**
 * Public optin page. Published funnels are open to everyone. Drafts are
 * visible only to signed-in admins so you can preview before publish.
 */
export default async function OptinSlugPage({ params, searchParams }: Props) {

  let funnel = await getPublishedFunnelBySlug(params.slug);
  let isAdmin = false;

  if (!funnel) {
    const draft = await getFunnelBySlug(params.slug);
    if (draft) {
      try {
        const supabase = createClient();
        const user = await getUser(supabase);
        if (user && isAdminEmail(user.email ?? null)) {
          funnel = draft;
          isAdmin = true;
        }
      } catch {
        /* not admin */
      }
    }
  }

  if (!funnel) notFound();

  // Personalization resolves BEFORE events fire so a gated-out visitor never
  // inflates the stats of an offer they never saw. Admins always see base
  // content (inline editor stability).
  if (!isAdmin) {
    try {
      const resolved = await resolveOptinPersonalization(funnel, searchParams?.pp);
      funnel = resolved.funnel;
      if (resolved.gated) return <GatedPage />;
    } catch (err) {
      console.error('[optin/slug] personalization resolve failed:', err);
    }
  }

  // Fire-and-forget view bump (don't block render).
  void incrementFunnelViews(funnel.id);
  void recordOptinEvent({ funnelId: funnel.id, eventType: 'view' });

  return <OptinPage funnel={funnel} isAdmin={isAdmin} />;

}




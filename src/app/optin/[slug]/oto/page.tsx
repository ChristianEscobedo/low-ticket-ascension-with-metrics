import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getFunnelBySlug,
  getPublishedFunnelBySlug,
} from '@/lib/mothermode/optin/store';
import OptinOtoPage from '@/components/mothermode/optin/OptinOtoPage';
import { isAdminEmail } from '@/utils/courses/access';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

interface Props {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await getFunnelBySlug(params.slug);
  if (!funnel) return { title: 'MotherMode' };
  return {
    title: `${funnel.oto.headline || 'Special offer'} | MotherMode`,
    description: funnel.oto.subheadline || undefined,
  };
}

export default async function OptinOtoRoute({ params }: Props) {
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
  return <OptinOtoPage funnel={funnel} isAdmin={isAdmin} />;
}



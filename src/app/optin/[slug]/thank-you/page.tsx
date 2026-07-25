import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getFunnelBySlug,
  getPublishedFunnelBySlug,
} from '@/lib/mothermode/optin/store';
import OptinThankYouPage from '@/components/mothermode/optin/OptinThankYouPage';
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
    title: `${funnel.thankyou.headline || 'Thank you'} | MotherMode`,
    description: funnel.thankyou.subheadline || undefined,
  };
}

export default async function OptinThankYouRoute({ params }: Props) {
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
  return <OptinThankYouPage funnel={funnel} isAdmin={isAdmin} />;
}



import { notFound } from 'next/navigation';
import {
  getFunnelBySlug,
  getPublishedFunnelBySlug,
  incrementFunnelViews,
  recordSalesEvent,
} from '@/lib/mothermode/sales/store';
import type { SalesEventType, SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { isAdminEmail } from '@/utils/courses/access';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

/**
 * Shared loader for public sales funnel pages.
 * Published funnels are open. Drafts are admin-preview only.
 */
export async function loadSalesFunnelPage(
  slug: string,
  eventType?: SalesEventType,
): Promise<{ funnel: SalesFunnelRecord; isAdmin: boolean }> {
  let funnel: SalesFunnelRecord | null = null;
  let isAdmin = false;

  try {
    funnel = await getPublishedFunnelBySlug(slug);
  } catch (err) {
    console.error('[loadSalesFunnelPage] published lookup failed:', err);
  }

  // Always try draft lookup for admin preview (and as fallback if published query failed).
  if (!funnel) {
    try {
      const draft = await getFunnelBySlug(slug);
      if (draft) {
        try {
          const supabase = createClient();
          const user = await getUser(supabase);
          if (user && isAdminEmail(user.email ?? null)) {
            funnel = draft;
            isAdmin = true;
          } else if (draft.status === 'published') {
            // Published row may have been missed by the published-only query.
            funnel = draft;
          }
        } catch (err) {
          // Cookie/auth unavailable — still allow published drafts through.
          if (draft.status === 'published') {
            funnel = draft;
          } else {
            console.error('[loadSalesFunnelPage] admin check failed:', err);
          }
        }
      }
    } catch (err) {
      console.error('[loadSalesFunnelPage] draft lookup failed:', err);
    }
  } else {
    // Published funnel: still detect admin so inline edit toolbar appears.
    try {
      const supabase = createClient();
      const user = await getUser(supabase);
      if (user && isAdminEmail(user.email ?? null)) {
        isAdmin = true;
        // Prefer latest draft content for admins (includes unsaved-status published edits).
        const latest = await getFunnelBySlug(slug);
        if (latest) funnel = latest;
      }
    } catch {
      /* public visitor */
    }
  }

  if (!funnel) notFound();

  if (eventType === 'view') {
    void incrementFunnelViews(funnel.id);
  }
  if (eventType) {
    void recordSalesEvent({ funnelId: funnel.id, eventType });
  }

  return { funnel, isAdmin };
}



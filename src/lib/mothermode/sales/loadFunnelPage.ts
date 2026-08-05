import { notFound } from 'next/navigation';
import {
  getFunnelBySlug,
  getPublishedFunnelBySlug,
  incrementFunnelViews,
  recordSalesEvent,
} from '@/lib/mothermode/sales/store';
import type { SalesEventType, SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { resolveSalesPersonalization } from '@/lib/mothermode/personalize/resolve';
import { isAdminEmail } from '@/utils/courses/access';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export interface LoadedSalesFunnelPage {
  funnel: SalesFunnelRecord;
  isAdmin: boolean;
  /** True when personalization is in gated mode and no valid ?pp= token was
   *  supplied — the route must render the decoy, NOT the offer. */
  gated: boolean;
  /** True when the returned funnel has AI-personalized copy merged in. */
  personalized: boolean;
  /** AI intent segment when personalized (admin debugging surface). */
  segment: string;
}

/**
 * Shared loader for public sales funnel pages.
 * Published funnels are open. Drafts are admin-preview only.
 *
 * Pass the `?pp=` query value via `opts.pp`: when the funnel has
 * personalization enabled, a valid token swaps in that lead's cached AI copy
 * before render (server-side hydration — zero client flicker). Admins always
 * get base content so the inline editor stays stable.
 */
export async function loadSalesFunnelPage(
  slug: string,
  eventType?: SalesEventType,
  opts?: { pp?: string | null },
): Promise<LoadedSalesFunnelPage> {

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

  // Personalization resolves BEFORE events fire so a gated-out visitor never
  // inflates the view counts of an offer they never saw. Admins skip it
  // entirely: the inline editor must always see base content.
  let gated = false;
  let personalized = false;
  let segment = '';
  if (!isAdmin) {
    try {
      const resolved = await resolveSalesPersonalization(funnel, opts?.pp);
      funnel = resolved.funnel;
      gated = resolved.gated;
      personalized = resolved.personalized;
      segment = resolved.segment;
    } catch (err) {
      // Soft-fail to the generic page: personalization can never 500 a
      // public funnel route.
      console.error('[loadSalesFunnelPage] personalization resolve failed:', err);
    }
  }

  if (gated) {
    return { funnel, isAdmin, gated, personalized, segment };
  }

  if (eventType === 'view') {
    void incrementFunnelViews(funnel.id);
  }
  if (eventType) {
    void recordSalesEvent({ funnelId: funnel.id, eventType });
  }

  return { funnel, isAdmin, gated, personalized, segment };
}




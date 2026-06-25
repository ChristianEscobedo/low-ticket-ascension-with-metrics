import { createClient } from '@supabase/supabase-js';

// Service-role client scoped to this module. Mirrors the pattern in
// src/utils/supabase/admin.ts — never import this from a browser bundle.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const parseAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = parseAdminEmails();
  return allow.length > 0 && allow.includes(email.toLowerCase());
}

export interface CourseAccessEntry {
  course_id: string;
  access_type: 'purchase' | 'subscription' | 'license' | 'gift' | 'admin';
  granted_at: string;
  source: 'direct' | 'product' | 'admin';
}

/**
 * Resolve every course a user can access. Sources:
 *   1. Admin emails → all published courses
 *   2. user_course_access rows (direct grants from license/admin/gift)
 *   3. product_course_assignments joined to funnel_purchases.customer_email
 *   4. product_course_assignments joined to active subscriptions.price→product
 */
export async function getUserCourseAccess(
  userId: string | null,
  email: string | null
): Promise<CourseAccessEntry[]> {
  const accessMap = new Map<string, CourseAccessEntry>();

  if (isAdminEmail(email)) {
    const { data: allCourses } = await (supabase as any)
      .from('courses')
      .select('id')
      .eq('is_published', true);
    for (const c of (allCourses as { id: string }[] | null) ?? []) {
      accessMap.set(c.id, {
        course_id: c.id,
        access_type: 'admin',
        granted_at: new Date().toISOString(),
        source: 'admin'
      });
    }
    return Array.from(accessMap.values());
  }

  if (userId) {
    const nowIso = new Date().toISOString();
    const { data: direct } = await (supabase as any)
      .from('user_course_access')
      .select('course_id, access_type, granted_at, expires_at')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    for (const a of (direct as any[] | null) ?? []) {
      accessMap.set(a.course_id, {
        course_id: a.course_id,
        access_type: a.access_type,
        granted_at: a.granted_at,
        source: 'direct'
      });
    }
  }

  if (email) {
    const { data: purchases } = await (supabase as any)
      .from('funnel_purchases')
      .select('product_id, created_at')
      .eq('customer_email', email.toLowerCase())
      .eq('status', 'succeeded')
      .not('product_id', 'is', null);

    const productIds = Array.from(
      new Set(((purchases as any[] | null) ?? []).map((p) => p.product_id).filter(Boolean))
    );

    if (productIds.length > 0) {
      const { data: bridges } = await (supabase as any)
        .from('product_course_assignments')
        .select('product_id, course_id')
        .in('product_id', productIds);
      const purchaseByProduct = new Map<string, string>();
      for (const p of (purchases as any[] | null) ?? []) {
        if (p.product_id && !purchaseByProduct.has(p.product_id)) {
          purchaseByProduct.set(p.product_id, p.created_at);
        }
      }
      for (const b of (bridges as { product_id: string; course_id: string }[] | null) ?? []) {
        if (!accessMap.has(b.course_id)) {
          accessMap.set(b.course_id, {
            course_id: b.course_id,
            access_type: 'purchase',
            granted_at: purchaseByProduct.get(b.product_id) ?? new Date().toISOString(),
            source: 'product'
          });
        }
      }
    }
  }

  if (userId) {
    const { data: subs } = await (supabase as any)
      .from('subscriptions')
      .select('created, prices(product_id)')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active']);

    const subProductIds = Array.from(
      new Set(
        ((subs as any[] | null) ?? [])
          .map((s) => s?.prices?.product_id)
          .filter(Boolean)
      )
    );
    if (subProductIds.length > 0) {
      const { data: bridges } = await (supabase as any)
        .from('product_course_assignments')
        .select('product_id, course_id')
        .in('product_id', subProductIds);
      for (const b of (bridges as { product_id: string; course_id: string }[] | null) ?? []) {
        if (!accessMap.has(b.course_id)) {
          accessMap.set(b.course_id, {
            course_id: b.course_id,
            access_type: 'subscription',
            granted_at: new Date().toISOString(),
            source: 'product'
          });
        }
      }
    }
  }

  return Array.from(accessMap.values());
}

export async function userHasCourseAccess(
  userId: string | null,
  email: string | null,
  courseId: string
): Promise<boolean> {
  const access = await getUserCourseAccess(userId, email);
  return access.some((a) => a.course_id === courseId);
}

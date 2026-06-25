import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client built lazily — supabase-js >=2.108 validates the url
// at construction, which would throw at module-import time in any test or
// build context that hasn't loaded NEXT_PUBLIC_SUPABASE_URL yet.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

interface GrantArgs {
  productId: string | null | undefined;
  customerEmail: string | null | undefined;
  accessType?: 'purchase' | 'subscription' | 'gift';
}

/**
 * Resolve the courses bridged to a Stripe product (via
 * product_course_assignments) and, if the buyer already has an auth user,
 * upsert a row into user_course_access for each course.
 *
 * No-ops cleanly when:
 *  - productId / email is missing (anonymous / metadata-less charge)
 *  - the product isn't mapped to any course
 *  - the buyer hasn't created their account yet — in that case read-time
 *    access still works because getUserCourseAccess joins on
 *    funnel_purchases.customer_email
 *
 * Idempotent thanks to user_course_access UNIQUE(user_id, course_id).
 */
export async function grantCoursesForPurchase({
  productId,
  customerEmail,
  accessType = 'purchase'
}: GrantArgs): Promise<{ granted: number; reason?: string }> {
  if (!productId) return { granted: 0, reason: 'no product_id on purchase' };
  if (!customerEmail) return { granted: 0, reason: 'no customer_email on purchase' };

  const supabase = getSupabase();
  const { data: assignments, error: assignError } = await (supabase as any)
    .from('product_course_assignments')
    .select('course_id')
    .eq('product_id', productId);

  if (assignError) {
    console.error('[grantCoursesForPurchase] assignment lookup error:', assignError);
    return { granted: 0, reason: assignError.message };
  }

  const courseIds = ((assignments as { course_id: string }[] | null) ?? [])
    .map((a) => a.course_id)
    .filter(Boolean);

  if (courseIds.length === 0) {
    return { granted: 0, reason: 'no course mapped to product' };
  }

  // Find the auth user matching the buyer's email. Service-role only.
  const { data: usersList } = await (supabase as any).auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  const match = ((usersList?.users as { id: string; email?: string | null }[] | undefined) ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === customerEmail.toLowerCase()
  );

  if (!match) {
    return {
      granted: 0,
      reason: 'no auth user yet — read-time fallback will cover this on signup'
    };
  }

  const nowIso = new Date().toISOString();
  const rows = courseIds.map((courseId) => ({
    user_id: match.id,
    course_id: courseId,
    access_type: accessType,
    granted_at: nowIso
  }));

  const { error: upsertError } = await (supabase as any)
    .from('user_course_access')
    .upsert(rows, { onConflict: 'user_id,course_id' });

  if (upsertError) {
    console.error('[grantCoursesForPurchase] upsert error:', upsertError);
    return { granted: 0, reason: upsertError.message };
  }

  return { granted: rows.length };
}

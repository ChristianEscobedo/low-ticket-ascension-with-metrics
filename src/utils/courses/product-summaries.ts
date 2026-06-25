import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client — lazy so module import never throws on missing env.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

export interface ProductCourseSummary {
  id: string;
  title: string;
  short_description: string | null;
  thumbnail_url: string | null;
}

/**
 * For each Stripe product id, return the list of published courses bundled
 * with it via `product_course_assignments`. Best-effort: returns an empty map
 * on any error so the pricing page never breaks.
 */
export async function getProductCourseSummaries(
  productIds: string[]
): Promise<Record<string, ProductCourseSummary[]>> {
  if (!productIds.length) return {};
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {};
  }

  const supabase = getSupabase();

  const { data: assignments, error: assignErr } = await (supabase as any)
    .from('product_course_assignments')
    .select('product_id, course_id')
    .in('product_id', productIds);

  if (assignErr || !assignments?.length) return {};

  const courseIds = Array.from(
    new Set((assignments as { course_id: string }[]).map((a) => a.course_id))
  );

  const { data: courses } = await (supabase as any)
    .from('courses')
    .select('id, title, short_description, thumbnail_url')
    .in('id', courseIds)
    .eq('is_published', true);

  const courseById = new Map<string, ProductCourseSummary>();
  for (const c of (courses as ProductCourseSummary[] | null) ?? []) {
    courseById.set(c.id, c);
  }

  const result: Record<string, ProductCourseSummary[]> = {};
  for (const a of assignments as { product_id: string; course_id: string }[]) {
    const course = courseById.get(a.course_id);
    if (!course) continue;
    if (!result[a.product_id]) result[a.product_id] = [];
    result[a.product_id].push(course);
  }
  return result;
}

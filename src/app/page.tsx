import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/server';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';
import { getProductCourseSummaries } from '@/utils/courses/product-summaries';
import { getUserCourseAccess } from '@/utils/courses/access';

export default async function PricingPage() {
  const supabase = createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(supabase),
    getProducts(supabase),
    getSubscription(supabase)
  ]);

  const productIds = (products ?? []).map((p) => p.id);
  const [courseSummariesByProduct, accessRows] = await Promise.all([
    getProductCourseSummaries(productIds),
    user
      ? getUserCourseAccess(user.id, user.email ?? null)
      : Promise.resolve([])
  ]);
  const accessibleCourseIds = accessRows.map((r) => r.course_id);

  return (
    <Pricing
      user={user}
      products={products ?? []}
      subscription={subscription}
      courseSummariesByProduct={courseSummariesByProduct}
      accessibleCourseIds={accessibleCourseIds}
    />
  );
}

'use client';

// No-op stub for the optional course-access UI component referenced by the
// /millionaire-mindshift/success page. Guide section 3 lists this as safe-to-
// stub on day one; the success page already renders fine without it. Replace
// with the real implementation when /api/product-courses is wired.

interface CourseAccessLinksProps {
  productId: string;
  productType: 'low_ticket_offer' | 'reseller_kit';
  heading?: string;
  accentColor?: string;
}

export default function CourseAccessLinks(_props: CourseAccessLinksProps) {
  return null;
}

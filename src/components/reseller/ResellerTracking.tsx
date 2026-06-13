'use client';

// No-op stub for the optional reseller/affiliate pixel component referenced by
// MillionaireMindshiftSalesPage + MillionaireMindshiftVSLPage. Funnel-transfer
// guide section 3 lists this as safe-to-stub on day one. Replace with the real
// tracking implementation when you wire affiliate pixels.

interface ResellerTrackingProps {
  resellerId?: string;
  pageType?: 'sales' | 'checkout' | 'upsell' | 'upsell2' | 'upsell3' | 'success';
  facebookPixelId?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  pinterestTagId?: string;
  customHeadCode?: string;
  customBodyStartCode?: string;
  customBodyEndCode?: string;
  trackingEnabled?: boolean;
}

export function ResellerTracking(_props: ResellerTrackingProps) {
  return null;
}

export default ResellerTracking;

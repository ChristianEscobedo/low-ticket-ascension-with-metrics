'use client';

import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import { motherModeCoaching } from '@/lib/mothermode/ascension';

// OTO4: the founding coaching year. Final step. Either path lands on the
// delivery page, which reads the recorded purchases.
export default function MotherModeUpsell4Route() {
  return (
    <MotherModeUpsellPage
      offer={motherModeCoaching}
      recordOnAccept={{ coaching: true }}
      acceptRedirect="/mothermode/success"
      declineRedirect="/mothermode/success"
      extendSequenceId="coaching_extension"
    />
  );
}

'use client';

import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import { osAnnualUpgrade } from '@/lib/mothermode/ascension';

// OTO2: upgrade the OS membership from monthly to the founding year. Either
// path continues to the Redesign Vault.
export default function MotherModeUpsell2Route() {
  return (
    <MotherModeUpsellPage
      offer={osAnnualUpgrade}
      recordOnAccept={{ os: true, osInterval: 'annual' }}
      acceptRedirect="/mothermode/upsell-3"
      declineRedirect="/mothermode/upsell-3"
    />
  );
}

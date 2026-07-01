'use client';

import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import { redesignVault } from '@/lib/mothermode/ascension';

// OTO3: the Redesign Vault, a one-time purchase of every system. Either path
// continues to the coaching invitation.
export default function MotherModeUpsell3Route() {
  return (
    <MotherModeUpsellPage
      offer={redesignVault}
      recordOnAccept={{ vault: true }}
      acceptRedirect="/mothermode/upsell-4"
      declineRedirect="/mothermode/upsell-4"
    />
  );
}

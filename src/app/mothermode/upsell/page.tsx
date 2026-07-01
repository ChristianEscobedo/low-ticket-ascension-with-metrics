'use client';

import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import { mothermodeOS } from '@/lib/mothermode/ascension';

// OTO1: the MotherMode OS membership (monthly). Accepting offers the annual
// upgrade next; declining skips straight to the Redesign Vault.
export default function MotherModeUpsellRoute() {
  return (
    <MotherModeUpsellPage
      offer={mothermodeOS}
      recordOnAccept={{ os: true, osInterval: 'monthly' }}
      acceptRedirect="/mothermode/upsell-2"
      declineRedirect="/mothermode/upsell-3"
      finalizeFrontEnd
    />
  );
}

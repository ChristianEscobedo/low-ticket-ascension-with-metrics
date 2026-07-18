'use client';

import { useEffect, useState } from 'react';
import { STORAGE } from '@/lib/mothermode/brand';
import { readPurchases } from '@/lib/mothermode/purchases';

/**
 * The self-reported email that scopes a buyer's data on interactive resource
 * documents. This funnel has no login, so the email is cached in
 * localStorage the first time it is captured, either from the checkout
 * purchase record or typed directly into a resource page's EmailGate.
 */
export function useBuyerEmail(): [string, (email: string) => void] {
  const [email, setEmailState] = useState('');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE.buyerEmail);
      if (stored) {
        setEmailState(stored);
        return;
      }
      const purchase = readPurchases();
      if (purchase.email) {
        setEmailState(purchase.email);
        window.localStorage.setItem(STORAGE.buyerEmail, purchase.email);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function setEmail(next: string) {
    const trimmed = next.trim();
    setEmailState(trimmed);
    try {
      window.localStorage.setItem(STORAGE.buyerEmail, trimmed);
    } catch {
      /* localStorage unavailable */
    }
  }

  return [email, setEmail];
}

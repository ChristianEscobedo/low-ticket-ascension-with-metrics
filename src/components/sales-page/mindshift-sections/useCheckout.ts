'use client';

import { useCallback } from 'react';
import { CHECKOUT_PATH, REF_STORAGE_KEY } from './constants';

export function useCheckoutNav() {
  return useCallback(() => {
    const ref = typeof window !== 'undefined' ? localStorage.getItem(REF_STORAGE_KEY) : null;
    window.location.href = ref
      ? `${CHECKOUT_PATH}?ref=${encodeURIComponent(ref)}`
      : CHECKOUT_PATH;
  }, []);
}

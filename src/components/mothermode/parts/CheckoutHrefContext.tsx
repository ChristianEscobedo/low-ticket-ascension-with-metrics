'use client';

import React, { createContext, useContext } from 'react';

/**
 * Optional checkout path override for funnel-builder pages.
 * When set, CheckoutButton navigates here instead of /mothermode/checkout.
 */
const CheckoutHrefContext = createContext<string | undefined>(undefined);

export function CheckoutHrefProvider({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <CheckoutHrefContext.Provider value={href}>
      {children}
    </CheckoutHrefContext.Provider>
  );
}

export function useCheckoutHref(): string | undefined {
  return useContext(CheckoutHrefContext);
}

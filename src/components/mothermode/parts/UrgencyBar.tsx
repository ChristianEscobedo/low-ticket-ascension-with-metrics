'use client';

import React from 'react';
import { MmEditable } from '@/components/mothermode/sales/SalesPageEditContext';

interface UrgencyBarProps {
  category: string;
  /** Editable urgency / founding-price line (maps to sales.ctaSubtext). */
  urgencyText?: string;
}

/**
 * Slim top bar. Founding-price framing, calm tone. The brand sells from
 * possibility, not fear, so this states a fact rather than threatens a loss.
 */
export const UrgencyBar: React.FC<UrgencyBarProps> = ({
  category,
  urgencyText = 'Founding price, for the first 100 mothers.',
}) => {
  return (
    <div className="sticky top-0 z-50 bg-mode text-bone">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center text-xs font-medium tracking-wide sm:text-sm">
        <span className="hidden h-1.5 w-1.5 rounded-full bg-brass sm:inline-block" />
        <span className="uppercase tracking-[0.18em] text-bone/70">
          <MmEditable field="category" as="span" onDark>
            {category}
          </MmEditable>
        </span>
        <span className="text-bone/40">/</span>
        <MmEditable
          field="ctaSubtext"
          as="span"
          onDark
          className="text-bone/90 px-1"
        >
          {urgencyText}
        </MmEditable>
      </div>
    </div>
  );
};


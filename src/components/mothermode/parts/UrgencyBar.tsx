'use client';

import React from 'react';

interface UrgencyBarProps {
  category: string;
}

/**
 * Slim top bar. Founding-price framing, calm tone. The brand sells from
 * possibility, not fear, so this states a fact rather than threatens a loss.
 */
export const UrgencyBar: React.FC<UrgencyBarProps> = ({ category }) => {
  return (
    <div className="sticky top-0 z-50 bg-mode text-bone">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center text-xs font-medium tracking-wide sm:text-sm">
        <span className="hidden h-1.5 w-1.5 rounded-full bg-brass sm:inline-block" />
        <span className="uppercase tracking-[0.18em] text-bone/70">
          {category}
        </span>
        <span className="text-bone/40">/</span>
        <span className="text-bone/90">Founding price, for the first 100 mothers.</span>
      </div>
    </div>
  );
};

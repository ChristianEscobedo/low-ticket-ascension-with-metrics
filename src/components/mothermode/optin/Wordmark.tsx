'use client';

import React from 'react';
import { useSalesPageEdit } from '@/components/mothermode/sales/SalesPageEditContext';

/**
 * Shared MotherMode wordmark used on optin / oto / thank-you / funnel pages.
 *
 * In funnel edit mode the brand name is hover-editable and saves to
 * `footer.brandLine` (shared chrome across the funnel). Catalog pages
 * render the static default with no edit chrome.
 */
export const OptinWordmark: React.FC<{
  /** Override brand text. Defaults to footer.brandLine or "MotherMode". */
  brandName?: string;
  className?: string;
}> = ({ brandName, className = '' }) => {
  const edit = useSalesPageEdit();
  const fromFooter =
    (edit?.draft as { footer?: { brandLine?: string } } | undefined)?.footer
      ?.brandLine || '';
  // Prefer a short brand — if footer brandLine is a long tagline, fall back.
  const resolved =
    brandName ||
    (fromFooter && fromFooter.length <= 24 ? fromFooter : '') ||
    'MotherMode';

  const letter = (resolved.trim()[0] || 'M').toUpperCase();

  const nameEl = (() => {
    if (edit?.isEditMode) {
      return (
        <span
          className="cursor-pointer rounded px-1 text-sm font-semibold uppercase tracking-[0.28em] text-ink outline-dashed outline-1 outline-transparent transition-all hover:bg-mode/[0.04] hover:outline-mode/50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            edit.openEdit(e, 'footer.brandLine', resolved, false);
          }}
          title="Click to edit brand"
        >
          {resolved}
        </span>
      );
    }
    if (resolved === 'MotherMode') {
      return (
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
          Mother<span className="text-mode">Mode</span>
        </span>
      );
    }
    // Keep Mode accent when brand ends with Mode
    if (/mode$/i.test(resolved)) {
      const base = resolved.replace(/mode$/i, '');
      return (
        <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
          {base}
          <span className="text-mode">Mode</span>
        </span>
      );
    }
    return (
      <span className="text-sm font-semibold uppercase tracking-[0.28em] text-ink">
        {resolved}
      </span>
    );
  })();

  return (
    <div
      className={`mb-8 flex items-center justify-center gap-3 ${className}`.trim()}
    >
      <div className="h-px w-10 bg-ink/15" />
      <div className="inline-flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mode font-display text-base font-semibold text-bone">
          {letter}
        </span>
        {nameEl}
      </div>
      <div className="h-px w-10 bg-ink/15" />
    </div>
  );
};

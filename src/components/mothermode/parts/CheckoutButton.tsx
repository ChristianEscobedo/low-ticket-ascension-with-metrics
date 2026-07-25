'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ROUTES, STORAGE } from '@/lib/mothermode/brand';
import {
  MmEditButton,
  useSalesPageEdit,
} from '@/components/mothermode/sales/SalesPageEditContext';
import { useCheckoutHref } from './CheckoutHrefContext';




interface CheckoutButtonProps {
  slug: string;
  label: string;
  /** Visual weight. `solid` = aubergine fill, `ghost` = outline on bone. */
  variant?: 'solid' | 'ghost';
  className?: string;
  /**
   * Optional absolute path override (e.g. `/funnel/my-slug/checkout`).
   * When set, skips the default `/mothermode/checkout?offer=` route.
   */
  href?: string;
}

/**
 * Navigates to the MotherMode checkout for a given offer, forwarding any
 * affiliate ref captured in localStorage. The single CTA used across the page.
 */
export const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  slug,
  label,
  variant = 'solid',
  className = '',
  href,
}) => {
  const contextHref = useCheckoutHref();
  const pageEdit = useSalesPageEdit();
  const targetHref = href || contextHref;
  const goToCheckout = () => {
    // Never navigate while admin is editing the funnel page
    if (pageEdit?.isEditMode) return;
    const ref =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE.ref) : null;

    if (targetHref) {
      window.location.href = ref
        ? `${targetHref}${targetHref.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`
        : targetHref;
      return;
    }
    const base = `${ROUTES.checkout}?offer=${encodeURIComponent(slug)}`;
    window.location.href = ref ? `${base}&ref=${encodeURIComponent(ref)}` : base;
  };



  const base =
    'group inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold tracking-tight transition-colors duration-200';
  const styles =
    variant === 'solid'
      ? 'bg-mode text-bone hover:bg-mode-deep'
      : 'border border-ink/20 text-ink hover:border-ink/40 hover:bg-ink/[0.03]';

  return (
    <MmEditButton
      field="ctaText"
      value={label}
      onClick={goToCheckout}
      onDark={variant === 'solid'}
      className={`${base} ${styles} ${className}`}
    >
      {label || (pageEdit?.isEditMode ? 'Button text…' : '')}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </MmEditButton>
  );
};


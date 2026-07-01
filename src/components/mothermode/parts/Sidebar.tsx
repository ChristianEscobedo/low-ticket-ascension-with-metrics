'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/lib/mothermode/format';
import { CheckoutButton } from './CheckoutButton';

interface SidebarProps {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  originalPriceCents: number;
  insideCount: number;
  guaranteeTitle: string;
}

/** Sticky offer card. Price, what is included, one CTA, the guarantee. */
export const Sidebar: React.FC<SidebarProps> = ({
  slug,
  name,
  category,
  priceCents,
  originalPriceCents,
  insideCount,
  guaranteeTitle,
}) => {
  const [time, setTime] = useState({ h: 23, m: 47, s: 12 });

  useEffect(() => {
    const id = setInterval(() => {
      setTime((p) => {
        if (p.s > 0) return { ...p, s: p.s - 1 };
        if (p.m > 0) return { ...p, m: p.m - 1, s: 59 };
        if (p.h > 0) return { h: p.h - 1, m: 59, s: 59 };
        return p;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const savings = originalPriceCents - priceCents;
  const cell = (v: number, label: string) => (
    <div className="text-center">
      <div className="rounded-md border border-ink/10 bg-bone py-1.5 text-lg font-semibold tabular-nums text-ink">
        {v.toString().padStart(2, '0')}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-ink/40">{label}</div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/60 p-6 shadow-sm backdrop-blur-sm sm:p-7">
      <div className="mb-5 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-mode">{category}</div>
        <div className="mt-1 font-display text-2xl leading-snug text-ink">{name}</div>
        <div className="mt-1 text-sm text-ink/50">{insideCount} resources. Yours instantly.</div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {cell(time.h, 'Hrs')}
        {cell(time.m, 'Min')}
        {cell(time.s, 'Sec')}
      </div>
      <p className="mb-5 text-center text-xs text-ink/45">Founding price holds while the timer runs.</p>

      <div className="mb-6 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-4xl text-ink">{formatPrice(priceCents)}</span>
          <span className="text-base text-ink/40 line-through">{formatPrice(originalPriceCents)}</span>
        </div>
        <div className="mt-1 text-sm font-medium text-mode">
          You save {formatPrice(savings)} today
        </div>
      </div>

      <CheckoutButton slug={slug} label="Get instant access" className="w-full" />

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs text-ink/50">
          <Lock className="h-3.5 w-3.5 text-mode" />
          <span>Secure checkout. Instant digital delivery.</span>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-brass/30 bg-brass/[0.06] p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brass" />
          <div className="text-xs text-ink/70">
            <span className="font-semibold text-ink">{guaranteeTitle}.</span> 14 days, no friction.
          </div>
        </div>
      </div>
    </div>
  );
};

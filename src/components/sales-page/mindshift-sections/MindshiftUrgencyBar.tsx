'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { useCheckoutNav } from './useCheckout';
import { TIMER_STORAGE_KEY } from './constants';

export const MindshiftUrgencyBar: React.FC = () => {
  const goToCheckout = useCheckoutNav();
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [timerEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('timer') !== 'off';
  });

  useEffect(() => {
    if (!timerEnabled) return;
    let endTime = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!endTime) {
      const end = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(TIMER_STORAGE_KEY, end.toString());
      endTime = end.toString();
    }
    const targetTime = parseInt(endTime);
    const update = () => {
      const diff = Math.max(0, targetTime - Date.now());
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timerEnabled]);

  if (!timerEnabled) return null;

  return (
    <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-amber-200/20 py-3 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/80 hidden sm:block">
            Founding Price Ends In
          </span>
          <div className="flex items-center gap-1.5">
            <div className="bg-white/[0.04] border border-amber-200/15 rounded-md px-2.5 py-1 min-w-[40px] text-center">
              <span className="text-base md:text-lg font-black text-amber-200 tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</span>
            </div>
            <span className="text-amber-200/40 font-black">:</span>
            <div className="bg-white/[0.04] border border-amber-200/15 rounded-md px-2.5 py-1 min-w-[40px] text-center">
              <span className="text-base md:text-lg font-black text-amber-200 tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</span>
            </div>
            <span className="text-amber-200/40 font-black">:</span>
            <div className="bg-white/[0.04] border border-amber-200/15 rounded-md px-2.5 py-1 min-w-[40px] text-center">
              <span className="text-base md:text-lg font-black text-amber-200 tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToCheckout}
            className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-black font-bold px-4 py-2 rounded-md text-sm uppercase tracking-wide hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-shadow"
          >
            Get Access →
          </button>
          <Link
            href="/auth"
            className="hidden sm:flex items-center gap-1.5 border border-white/10 hover:border-amber-200/30 text-white/80 hover:text-white font-semibold px-3 py-2 rounded-md text-sm transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

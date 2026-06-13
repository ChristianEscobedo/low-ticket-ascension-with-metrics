'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { CheckCircle, Sparkles, Mail, Video, BookOpen, Infinity as InfinityIcon, AlertCircle, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import CourseAccessLinks from '@/components/shared/CourseAccessLinks';
import { parsePurchaseQuery, readPurchases, writePurchases, type MindshiftPurchases } from '@/lib/mindshift/purchases';

type Accent = 'amber' | 'violet' | 'emerald' | 'rose';

const ACCENT: Record<Accent, { border: string; glow: string; chip: string; text: string; gradient: string }> = {
  amber:   { border: 'border-amber-500/40',   glow: 'shadow-[0_0_30px_rgba(251,191,36,0.10)]',  chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',   text: 'text-amber-300',  gradient: 'from-amber-300 to-amber-600' },
  violet:  { border: 'border-violet-500/40',  glow: 'shadow-[0_0_30px_rgba(167,139,250,0.10)]', chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30', text: 'text-violet-300', gradient: 'from-violet-300 to-violet-600' },
  emerald: { border: 'border-emerald-500/40', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.10)]',  chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', text: 'text-emerald-300', gradient: 'from-emerald-300 to-emerald-600' },
  rose:    { border: 'border-rose-500/40',    glow: 'shadow-[0_0_30px_rgba(244,114,182,0.10)]', chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30',     text: 'text-rose-300',   gradient: 'from-rose-300 to-rose-600' },
};

interface DeliveryItem {
  key: string;
  show: boolean;
  accent: Accent;
  tag: string;
  title: string;
  subtitle: string;
  bullets: string[];
  showCourseLinks?: boolean;
}

function buildDeliveryItems(p: MindshiftPurchases): DeliveryItem[] {
  const isAnnual = p.clearingRoomInterval === 'annual';
  const clearingRoomBullets = [
    'Weekly Live Clearing Room Hot-Seat',
    '“Find Your #1 Ceiling” Onboarding',
    'The Clearing Room Vault',
    'Private Members Community + Pods',
    'Submit-A-Block Priority',
    'Monthly Live AMA With Christian & Amber',
    'The Partner Pass — bring your spouse/partner free',
    ...(isAnnual ? ['Private 1:1 Custom Block Clearing Session ($500 value)'] : []),
  ];
  return [
    {
      key: 'fe',
      show: p.fe,
      accent: 'amber',
      tag: 'Core Program',
      title: 'Millionaire Mindshift — The Subconscious Reset Method™',
      subtitle: '5 modules · 30 embodiment audios · 14-day "Feel the Shift" guarantee',
      bullets: [
        'Module 1 — The Identity Audit',
        'Module 2 — The Muscle-Testing Protocol',
        'Module 3 — The Clearing Sequence',
        'Module 4 — Installing the New Identity',
        'Module 5 — The Daily Congruence Practice',
      ],
      showCourseLinks: true,
    },
    {
      key: 'bump_money_blocks_vault',
      show: p.bumps.includes('money_blocks_vault'),
      accent: 'emerald',
      tag: 'Order Bump',
      title: 'The Subconscious Money Blocks Vault',
      subtitle: '12 done-for-you clearings for the beliefs that cap your income',
      bullets: [
        'A ready-to-run clearing for each of the 12 most common income ceilings',
        'Play any sequence on demand the moment a block surfaces',
        'Instant lifetime access in your members area',
      ],
    },
    {
      key: 'bump_seven_deadly_sins_loa',
      show: p.bumps.includes('seven_deadly_sins_loa'),
      accent: 'rose',
      tag: 'Order Bump',
      title: 'The Seven Deadly Sins Of The Law Of Attraction',
      subtitle: 'The 7 conscious-side patterns that quietly repel what you say you want — plus the 4-session Wealth Archive',
      bullets: [
        'Seven Deadly Sins training (envy · greed · pride · …)',
        'Wealth Archive Pt 1 — Money | Debt',
        'Wealth Archive Pt 2 — Self Love (Unlocking The Inner Genius)',
        'Wealth Archive Pt 3 — Movement Feedback 1',
        'Wealth Archive Pt 4 — Wealth-Session Movement Feedback 6-23-21',
      ],
    },
    {
      key: 'clearingRoom',
      show: p.clearingRoom,
      accent: 'amber',
      tag: isAnnual ? 'Membership · Annual' : 'Membership · Monthly',
      title: 'The Clearing Room — Founding Membership',
      subtitle: isAnnual
        ? 'Founding annual seat · weekly live clearing · founding rate locked for life'
        : 'Founding monthly seat · weekly live clearing · cancel anytime',
      bullets: clearingRoomBullets,
    },
    {
      key: 'quantumLibrary',
      show: p.quantumLibrary,
      accent: 'violet',
      tag: 'Lifetime Library',
      title: 'Quantum Entrepreneur — The Full Reprogramming Library',
      subtitle: '5 modules · 26+ sessions · lifetime access + all future updates',
      bullets: [
        'Module 1 — Subconscious Mind Deep Dive',
        'Module 2 — Wealth Reprogramming Sessions',
        'Module 3 — Brain Optimization Tracks',
        'Module 4 — Conscious Mind & Law Of Attraction',
        'Module 5 — Quantum Bonus Vault',
        'Lifetime access + all future additions',
      ],
    },
    {
      key: 'buildDeposit',
      show: p.buildDeposit,
      accent: 'emerald',
      tag: 'Spot Secured · Done-For-You Build',
      title: 'Your Done-For-You Build Spot Is Locked In',
      subtitle: 'Your $500 deposit is in and comes off your first payment · onboarding call next',
      bullets: [
        'Watch your inbox for your onboarding call booking link',
        'We build your offer, positioning, funnel, ads, and copy',
        '90 days of optimizing plus private mindset sessions',
        'Your $2,000 join-now discount is held for you',
      ],
    },
  ];
}

function MindshiftSuccessContent() {
  const searchParams = useSearchParams();
  // session_id / payment_intent reserved for downstream entitlement verification
  searchParams.get('session_id');
  searchParams.get('payment_intent');
  const [isLoading, setIsLoading] = useState(true);
  const [purchases, setPurchases] = useState<MindshiftPurchases | null>(null);

  // Merge any inbound query params (e.g. direct success-from-OTO2 redirects),
  // then read the consolidated state out of localStorage.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const incoming = parsePurchaseQuery(window.location.search);
      if (incoming.fe || (incoming.bumps && incoming.bumps.length > 0)) {
        writePurchases(incoming);
      }
      setPurchases(readPurchases());
    }
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !purchases) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">Activating Your Access…</p>
        </div>
      </div>
    );
  }

  const items = buildDeliveryItems(purchases).filter((i) => i.show);
  const hasAnything = items.length > 0;
  const firstName = purchases.firstName?.trim();

  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
      </div>

      <div className="relative z-10 bg-black/80 backdrop-blur-sm py-5 text-center border-b border-amber-500/10">
        <div className="inline-flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-lg">M</div>
          <span className="text-amber-100 font-bold tracking-[0.35em] text-sm uppercase">Millionaire Mindshift</span>
        </div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-amber-300 to-amber-600 rounded-full mx-auto flex items-center justify-center shadow-[0_0_60px_rgba(251,191,36,0.4)] mb-8">
            <CheckCircle className="w-12 h-12 text-black" />
          </div>
          <p className="text-amber-300 font-bold text-sm uppercase tracking-[0.3em] mb-4">
            {hasAnything ? "You're In. The Rewire Starts Now." : 'Order Received'}
          </p>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[0.95] tracking-tight">
            <span className="block text-white">{firstName ? `Welcome, ${firstName},` : 'Welcome To The'}</span>
            <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              {firstName ? 'to the Mindshift' : 'Mindshift'}
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-xl mx-auto leading-relaxed">
            {hasAnything
              ? 'Your access has been activated. Login details land in your inbox within the next 2 minutes.'
              : 'We couldn\u2019t detect a purchase on this device. If you just paid, check your inbox \u2014 your access link is on its way.'}
          </p>
        </div>

        {/* Empty state */}
        {!hasAnything && (
          <div className="bg-white/[0.03] border border-amber-500/30 rounded-2xl p-8 mb-8 text-center">
            <AlertCircle className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <p className="text-gray-300">
              Nothing to deliver on this screen yet. If your receipt didn&apos;t arrive in 5 minutes, email{' '}
              <a href="mailto:support@example.com" className="text-amber-300 hover:underline">support@example.com</a>{' '}
              with your order number.
            </p>
          </div>
        )}

        {/* Delivery cards */}
        <div className="space-y-6 mb-10">
          {items.map((item) => {
            const a = ACCENT[item.accent];
            return (
              <div key={item.key} className={`bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur border-2 ${a.border} rounded-2xl p-8 ${a.glow}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-black flex-shrink-0`}>
                      {item.key === 'clearingRoom' ? (
                        <Video className="w-6 h-6" />
                      ) : item.key === 'quantumLibrary' ? (
                        <InfinityIcon className="w-6 h-6" />
                      ) : item.key === 'buildDeposit' ? (
                        <Rocket className="w-6 h-6" />
                      ) : (
                        <BookOpen className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <span className={`inline-block text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${a.chip} mb-1.5`}>{item.tag}</span>
                      <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{item.title}</h2>
                    </div>
                  </div>
                  <CheckCircle className={`w-6 h-6 ${a.text} flex-shrink-0 mt-1`} />
                </div>
                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{item.subtitle}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
                  {item.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-2 text-sm text-gray-300">
                      <Sparkles className={`w-3.5 h-3.5 ${a.text} mt-1 flex-shrink-0`} />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                {item.showCourseLinks && (
                  <div className="mt-6 pt-6 border-t border-white/[0.06]">
                    <CourseAccessLinks productId="millionaire-mindshift" productType="reseller_kit" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mb-8">
          <Link
            href="/millionaire-mindshift/access"
            className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-black font-black py-5 px-10 rounded-xl text-xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <Sparkles className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Open My Members Area</span>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            <Mail className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Login link also sent to your email.
          </p>
        </div>

        <p className="text-gray-600 text-center text-sm">
          Questions? Email{' '}
          <a href="mailto:support@example.com" className="text-amber-300 hover:underline">
            support@example.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function MillionaireMindshiftSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">Loading…</p>
        </div>
      </div>
    }>
      <MindshiftSuccessContent />
    </Suspense>
  );
}

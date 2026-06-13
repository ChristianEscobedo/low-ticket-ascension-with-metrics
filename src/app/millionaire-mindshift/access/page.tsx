'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle, Circle, PlayCircle, Headphones, FileText, BookOpen,
  Users, CalendarCheck, ExternalLink, Sparkles, Mail, Rocket, Infinity as InfinityIcon,
} from 'lucide-react';
import { parsePurchaseQuery, readPurchases, writePurchases, type MindshiftPurchases } from '@/lib/mindshift/purchases';

// Real delivery URLs go here. Until each one is live it points at '#'.
const LINKS = {
  welcomeVideo: '',                 // TODO: orientation video (MP4/HLS)
  membersArea: '#',                 // TODO: course / members area home
  audios: '#',                      // TODO: 30 daily congruence audios
  identityWorkbook: '#',            // TODO: Identity Audit workbook PDF
  moneyBlocksVault: '#',            // TODO: Money Blocks Vault library
  sevenSins: '#',                   // TODO: Seven Deadly Sins + Wealth Archive
  clearingRoomLive: '#',            // TODO: weekly Clearing Room Zoom
  community: '#',                   // TODO: private community + pods
  clearingVault: '#',              // TODO: Clearing Room vault
  oneToOneBooking: '#',             // TODO: 1:1 custom block clearing booking
  quantumLibrary: '#',              // TODO: Quantum Entrepreneur library
  buildCall: '#',                   // TODO: Done-For-You Build onboarding call calendar
  support: 'mailto:support@example.com',
};

type Accent = 'amber' | 'violet' | 'emerald' | 'rose';
type ResType = 'video' | 'audio' | 'pdf' | 'course' | 'community' | 'call';

interface ResItem { label: string; sub?: string; type: ResType; href: string; cta?: string }
interface ResGroup { key: string; show: boolean; accent: Accent; tag: string; title: string; items: ResItem[] }
interface Step { id: string; title: string; desc: string; href?: string; cta?: string }

const ACCENT: Record<Accent, { border: string; glow: string; chip: string; text: string; gradient: string }> = {
  amber:   { border: 'border-amber-500/40',   glow: 'shadow-[0_0_30px_rgba(251,191,36,0.10)]',  chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',   text: 'text-amber-300',  gradient: 'from-amber-300 to-amber-600' },
  violet:  { border: 'border-violet-500/40',  glow: 'shadow-[0_0_30px_rgba(167,139,250,0.10)]', chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30', text: 'text-violet-300', gradient: 'from-violet-300 to-violet-600' },
  emerald: { border: 'border-emerald-500/40', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.10)]',  chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', text: 'text-emerald-300', gradient: 'from-emerald-300 to-emerald-600' },
  rose:    { border: 'border-rose-500/40',    glow: 'shadow-[0_0_30px_rgba(244,114,182,0.10)]', chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30',     text: 'text-rose-300',   gradient: 'from-rose-300 to-rose-600' },
};

const RES_ICON: Record<ResType, React.ReactNode> = {
  video: <PlayCircle className="w-5 h-5" />,
  audio: <Headphones className="w-5 h-5" />,
  pdf: <FileText className="w-5 h-5" />,
  course: <BookOpen className="w-5 h-5" />,
  community: <Users className="w-5 h-5" />,
  call: <CalendarCheck className="w-5 h-5" />,
};

function buildResourceGroups(p: MindshiftPurchases): ResGroup[] {
  const isAnnual = p.clearingRoomInterval === 'annual';
  return [
    {
      key: 'fe', show: p.fe, accent: 'amber', tag: 'Core Program',
      title: 'The Subconscious Reset Method™',
      items: [
        { label: 'Module 1 - The Identity Audit', sub: 'Find the belief capping your income', type: 'course', href: LINKS.membersArea, cta: 'Start' },
        { label: 'Modules 2-5', sub: 'Test, Clear, Install, and the Daily Practice', type: 'course', href: LINKS.membersArea, cta: 'Open' },
        { label: '30 Daily Congruence Audios', sub: 'One short audio a day to lock in the new wiring', type: 'audio', href: LINKS.audios, cta: 'Listen' },
        { label: 'The Identity Audit Workbook', sub: 'Print it and work along with Module 1', type: 'pdf', href: LINKS.identityWorkbook, cta: 'Download' },
      ],
    },
    {
      key: 'money_blocks_vault', show: p.bumps.includes('money_blocks_vault'), accent: 'emerald', tag: 'Order Bump',
      title: 'The Subconscious Money Blocks Vault',
      items: [
        { label: '12 Done-For-You Clearings', sub: 'Play one the moment a money block shows up', type: 'audio', href: LINKS.moneyBlocksVault, cta: 'Open Vault' },
      ],
    },
    {
      key: 'seven_deadly_sins_loa', show: p.bumps.includes('seven_deadly_sins_loa'), accent: 'rose', tag: 'Order Bump',
      title: 'Seven Deadly Sins Of The Law Of Attraction',
      items: [
        { label: 'Seven Deadly Sins Training', sub: 'The 7 patterns that quietly repel what you want', type: 'video', href: LINKS.sevenSins, cta: 'Watch' },
        { label: 'The 4-Part Wealth Archive', sub: 'Money, Debt, Self Love, and movement feedback', type: 'audio', href: LINKS.sevenSins, cta: 'Open' },
      ],
    },
    {
      key: 'clearingRoom', show: p.clearingRoom, accent: 'amber', tag: isAnnual ? 'Membership · Annual' : 'Membership · Monthly',
      title: 'The Clearing Room',
      items: [
        { label: 'Weekly Live Clearing Room', sub: 'Your hot-seat clearing call each week', type: 'call', href: LINKS.clearingRoomLive, cta: 'Get Times' },
        { label: 'Private Community + Pods', sub: 'Your people, your accountability', type: 'community', href: LINKS.community, cta: 'Join' },
        { label: 'The Clearing Room Vault', sub: 'Every past session, ready to replay', type: 'video', href: LINKS.clearingVault, cta: 'Browse' },
        ...(isAnnual ? [{ label: 'Private 1:1 Custom Block Clearing', sub: 'Your bonus annual session ($500 value)', type: 'call' as ResType, href: LINKS.oneToOneBooking, cta: 'Book' }] : []),
      ],
    },
    {
      key: 'quantumLibrary', show: p.quantumLibrary, accent: 'violet', tag: 'Lifetime Library',
      title: 'Quantum Entrepreneur Library',
      items: [
        { label: 'The Full Reprogramming Library', sub: '5 modules · 26+ sessions · lifetime access', type: 'course', href: LINKS.quantumLibrary, cta: 'Open' },
      ],
    },
    {
      key: 'buildDeposit', show: p.buildDeposit, accent: 'emerald', tag: 'Done-For-You Build',
      title: 'Your Build Spot Is Secured',
      items: [
        { label: 'Book Your Onboarding Call', sub: 'We map your offer, funnel, ads, and copy', type: 'call', href: LINKS.buildCall, cta: 'Book Call' },
      ],
    },
  ];
}

function buildOnboarding(p: MindshiftPurchases): Step[] {
  const steps: Step[] = [
    { id: 'welcome', title: 'Watch your welcome video', desc: 'A short orientation so you know exactly where to start.' },
  ];
  if (p.fe) {
    steps.push({ id: 'module1', title: 'Start Module 1: The Identity Audit', desc: 'Find the one belief quietly capping your income.', href: LINKS.membersArea, cta: 'Start Module 1' });
    steps.push({ id: 'audios', title: 'Load your daily audios', desc: 'Put the 30 audios on your phone and play one a day.', href: LINKS.audios, cta: 'Get Audios' });
  }
  if (p.clearingRoom) {
    steps.push({ id: 'community', title: 'Join the private community', desc: 'Introduce yourself and grab your weekly call times.', href: LINKS.community, cta: 'Join Now' });
  }
  if (p.buildDeposit) {
    steps.push({ id: 'buildcall', title: 'Book your build onboarding call', desc: 'Lock the time so we can start building for you.', href: LINKS.buildCall, cta: 'Book Call' });
  }
  return steps;
}

const STEPS_DONE_KEY = 'mindshift_onboarding_done';

function MindshiftAccessContent() {
  const [purchases, setPurchases] = useState<MindshiftPurchases | null>(null);
  const [done, setDone] = useState<string[]>([]);

  // Merge any inbound success params, then read consolidated state + checklist.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const incoming = parsePurchaseQuery(window.location.search);
    if (incoming.fe || (incoming.bumps && incoming.bumps.length > 0)) writePurchases(incoming);
    setPurchases(readPurchases());
    try {
      const raw = localStorage.getItem(STEPS_DONE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const toggleStep = (id: string) =>
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(STEPS_DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const groups = useMemo(() => (purchases ? buildResourceGroups(purchases).filter((g) => g.show) : []), [purchases]);
  const steps = useMemo(() => (purchases ? buildOnboarding(purchases) : []), [purchases]);

  if (!purchases) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">Loading your access…</p>
        </div>
      </div>
    );
  }

  const firstName = purchases.firstName?.trim();
  const hasAnything = groups.length > 0;
  const completed = steps.filter((s) => done.includes(s.id)).length;
  const stepPct = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
      </div>

      {/* Brand bar */}
      <div className="relative z-10 bg-black/80 backdrop-blur-sm py-5 text-center border-b border-amber-500/10">
        <div className="inline-flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-black font-black text-lg">M</div>
          <span className="text-amber-100 font-bold tracking-[0.35em] text-sm uppercase">Millionaire Mindshift</span>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-14">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-amber-300 font-bold text-sm uppercase tracking-[0.3em] mb-4">Your Members Area</p>
          <h1 className="text-4xl md:text-6xl font-black mb-5 leading-[0.98] tracking-tight">
            <span className="block text-white">{firstName ? `Welcome in, ${firstName}.` : 'Welcome in.'}</span>
            <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent">Everything you unlocked is below.</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">Start with the welcome video, work the quick checklist, then dive into your resources.</p>
        </div>

        {/* Welcome video */}
        <div className="mb-12">
          <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] rounded-2xl p-2">
            {LINKS.welcomeVideo ? (
              <video src={LINKS.welcomeVideo} controls className="w-full aspect-video rounded-xl bg-black" />
            ) : (
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <PlayCircle className="w-10 h-10 text-amber-300" />
                  </div>
                  <div className="text-lg font-semibold text-white">Welcome &amp; Orientation</div>
                  <div className="text-sm">Your start-here video lands here</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Onboarding checklist */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl md:text-3xl font-black text-white">Start Here</h2>
            <span className="text-sm text-amber-300 font-semibold tabular-nums">{completed}/{steps.length} done</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500" style={{ width: `${stepPct}%` }} />
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => {
              const isDone = done.includes(step.id);
              return (
                <div key={step.id} className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${isDone ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <button onClick={() => toggleStep(step.id)} aria-label="Toggle step" className="flex-shrink-0">
                    {isDone ? <CheckCircle className="w-7 h-7 text-amber-300" /> : <Circle className="w-7 h-7 text-gray-600 hover:text-amber-300 transition-colors" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`font-bold ${isDone ? 'text-amber-100' : 'text-white'}`}>
                      <span className="text-amber-400/70 mr-2 tabular-nums">{String(i + 1).padStart(2, '0')}</span>{step.title}
                    </div>
                    <div className="text-sm text-gray-500">{step.desc}</div>
                  </div>
                  {step.href && (
                    <a href={step.href} className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/10 transition-colors">
                      {step.cta || 'Open'} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {!hasAnything && (
          <div className="bg-white/[0.03] border border-amber-500/30 rounded-2xl p-8 mb-10 text-center">
            <p className="text-gray-300">We could not detect a purchase on this device. If you just paid, check your inbox for your access link, or email{' '}
              <a href={LINKS.support} className="text-amber-300 hover:underline">support@example.com</a>.</p>
          </div>
        )}

        {/* Resource groups */}
        <div className="space-y-6 mb-12">
          {groups.map((g) => {
            const a = ACCENT[g.accent];
            return (
              <div key={g.key} className={`bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur border-2 ${a.border} rounded-2xl p-6 md:p-8 ${a.glow}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-black flex-shrink-0`}>
                    {g.key === 'quantumLibrary' ? <InfinityIcon className="w-6 h-6" /> : g.key === 'buildDeposit' ? <Rocket className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div>
                    <span className={`inline-block text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${a.chip} mb-1`}>{g.tag}</span>
                    <h3 className="text-lg md:text-xl font-bold text-white leading-tight">{g.title}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  {g.items.map((item) => (
                    <a key={item.label} href={item.href} className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-white/15 hover:bg-white/[0.04] transition-colors">
                      <span className={`flex-shrink-0 ${a.text}`}>{RES_ICON[item.type]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white text-sm md:text-base">{item.label}</div>
                        {item.sub && <div className="text-xs text-gray-500">{item.sub}</div>}
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border ${a.chip} px-3 py-1.5 text-xs font-bold transition-colors`}>
                        {item.cta || 'Open'} <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            <Mail className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Your login link was also emailed to you.
          </p>
          <p className="text-gray-600 text-sm">
            Need a hand? Email{' '}
            <a href={LINKS.support} className="text-amber-300 hover:underline">support@example.com</a>
          </p>
          <div className="mt-6">
            <Link href="/millionaire-mindshift/success" className="text-xs text-gray-600 hover:text-amber-200 transition-colors inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> View order summary
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MillionaireMindshiftAccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-200/70 text-sm tracking-wide uppercase">Loading…</p>
        </div>
      </div>
    }>
      <MindshiftAccessContent />
    </Suspense>
  );
}

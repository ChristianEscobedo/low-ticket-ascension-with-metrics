'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Shield, Sparkles, Play } from 'lucide-react';
import { OneClickCheckoutModal } from '@/components/checkout/OneClickCheckoutModal';
import { writePurchases } from '@/lib/mindshift/purchases';

const SUCCESS_REDIRECT = '/millionaire-mindshift/upsell-4';
const DECLINE_REDIRECT = '/millionaire-mindshift/upsell-4';

export const MillionaireMindshiftUpsell3Page: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 15, seconds: 0 });
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        clearInterval(timer);
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcceptOffer = () => setShowCheckoutModal(true);
  const handleDeclineOffer = () => { window.location.href = DECLINE_REDIRECT; };
  const handleCheckoutSuccess = () => {
    writePurchases({ quantumLibrary: true });
    setShowCheckoutModal(false);
    window.location.href = SUCCESS_REDIRECT;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Timer */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-center py-4 text-white">
        <div className="flex items-center justify-center space-x-2">
          <Clock className="w-5 h-5" />
          <span className="font-bold tabular-nums">
            FINAL UPGRADE: {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')} Remaining
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(167,139,250,0.22) 1px, transparent 0)', backgroundSize: '25px 25px' }}></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          {/* Headline */}
          <div className="text-center mb-14">
            <p className="text-violet-300 font-bold text-sm md:text-base mb-6 uppercase tracking-[0.25em]">
              💎 ONE FINAL UPGRADE — REPROGRAM THE 95% 💎
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tight">
              <span className="block text-white">Unlock The Full</span>
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-200 bg-clip-text text-transparent" style={{ WebkitTextStroke: '0.5px rgba(167,139,250,0.2)' }}>
                Quantum Entrepreneur
              </span>
              <span className="block text-white">Reprogramming Library</span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-white mb-4">
              The Deep-Dive Extension To Millionaire Mindshift
            </p>
            <h2 className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
              Lifetime access to every reprogramming session, miracle meditation, brain-optimization track &amp; bonus training — the full library that rewires the <span className="text-violet-300 font-bold">95% your conscious mind never sees</span>.
            </h2>
          </div>

          {/* Video Section */}
          <div className="mb-8">
            <div className="bg-white/5 border-2 border-violet-500/40 shadow-[0_0_20px_rgba(167,139,250,0.12)] rounded-2xl p-2">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                <div className="text-center text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-violet-500/20 rounded-full flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                    <Play className="w-10 h-10 text-violet-300 ml-1" />
                  </div>
                  <div className="text-lg font-semibold mb-2 text-white">Watch: A Tour Inside The Quantum Entrepreneur Library</div>
                  <div className="text-sm">5 modules · 26+ sessions, meditations &amp; trainings — see what&apos;s actually inside</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mb-14">
            <button
              onClick={handleAcceptOffer}
              className="group relative bg-gradient-to-r from-violet-400 via-violet-500 to-fuchsia-500 hover:from-violet-300 hover:via-violet-400 hover:to-fuchsia-400 text-white font-black py-5 px-10 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(167,139,250,0.4)] hover:shadow-[0_0_50px_rgba(167,139,250,0.55)] flex items-center justify-center mx-auto overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <CheckCircle className="w-7 h-7 mr-3" />
              YES — Unlock Quantum Entrepreneur For $297
            </button>
            <p className="text-sm text-violet-300/90 mt-4 font-semibold tracking-wide">
              ⚠️ This is the only time the full library is offered at this price.
            </p>
          </div>

          {/* Letter */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-white text-2xl font-bold">One more thing before you go…</p>
              <p className="text-gray-300">
                You just unlocked the Mindshift protocol — the core sequence to surface and clear a belief.
              </p>
              <p className="text-gray-300">
                But here&apos;s what I&apos;ve learned watching <span className="font-bold text-white">thousands</span> of entrepreneurs run this work over the last several years:
              </p>
              <p className="text-gray-300 border-l-2 border-violet-400 pl-6 italic">
                The conscious mind is <span className="font-bold text-violet-300 not-italic">5% of the show</span>. The other 95% — the subconscious — is what actually decides what you let yourself receive, charge, build, and become.
              </p>
              <p className="text-gray-300">
                Mindshift cracks the surface. But to rewire the operating system underneath — the deep wealth beliefs, the safety patterns, the brain&apos;s default settings — you need the <span className="font-bold text-white">full reprogramming library</span>, on tap, for life.
              </p>
              <p className="text-gray-300">
                That&apos;s what <span className="font-bold text-violet-300">Quantum Entrepreneur</span> is. 26+ sessions, meditations, and trainings designed to reprogram the 95% — at your own pace, on repeat, for as long as you need them.
              </p>
              <p className="text-gray-300">
                Run a session before bed for 30 days. Listen to a miracle meditation on a walk. Drop the wealth-belief track on the school run. The wiring changes <span className="font-bold text-white">because the inputs change</span>.
              </p>
            </div>
          </div>

          {/* The Opportunity Section */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-10">
              <span className="bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">
                The Subconscious Runs The 95%
              </span>
              <span className="block text-white text-2xl md:text-3xl mt-3">Conscious Effort Will Never Outwork It…</span>
            </h2>

            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-gray-300">
                You can read every business book, hit every Monday strategy session, and stack productivity systems on top of productivity systems — and still hit the <span className="font-bold text-white">exact same income ceiling</span>. Why?
              </p>
              <p className="text-gray-300">
                Because the subconscious is running an older, deeper program — one wired in long before you decided to build a business. Wealth-beliefs. Safety-patterns. Self-sabotage scripts. <span className="font-bold text-violet-300">Until those get reprogrammed, nothing else moves</span>.
              </p>
              <p className="text-gray-300">
                Quantum Entrepreneur is the full library — every session, meditation, and brain-optimization track I&apos;ve built to do exactly that. <span className="font-bold text-white">On tap. For life. On repeat.</span>
              </p>
              <div className="bg-white/5 border border-violet-500/20 rounded-xl p-6 space-y-3">
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-violet-300 mr-3 flex-shrink-0" /> No more &ldquo;why does this keep happening?&rdquo; — name the script, run the reprogramming track on it.</p>
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-violet-300 mr-3 flex-shrink-0" /> No more endless journaling — the sessions do the surfacing &amp; the clearing for you.</p>
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-violet-300 mr-3 flex-shrink-0" /> No more &ldquo;is this even working?&rdquo; — muscle-test before and after, every session has a built-in check.</p>
              </div>
              <p className="text-gray-300">
                Press play. Let the track run. <span className="font-bold text-violet-300">The 95% does the work for you.</span>
              </p>
            </div>
          </div>

          {/* What's inside */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-violet-300 font-bold text-sm uppercase tracking-[0.25em] mb-3">WHAT&apos;S INSIDE THE LIBRARY</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">The Quantum Entrepreneur Library</h2>
              <p className="text-gray-400 mt-3 text-lg">5 modules · 26+ sessions, meditations &amp; trainings · lifetime access</p>
            </div>

            <div className="relative">
              <div className="bg-white/[0.03] backdrop-blur-sm border border-violet-500/20 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(167,139,250,0.08)]">
                <div className="bg-gradient-to-r from-violet-500/10 via-fuchsia-300/10 to-violet-500/10 border-b border-violet-500/20 px-6 py-4 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Module</span>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Value</span>
                </div>

                {[
                  { emoji: '🧠', title: 'Module 1 — Subconscious Mind Deep Dive', desc: 'Quantum Awakening · What Really Runs The Show · Muscle Testing 101 · Miracle Meditations (Beaming, Amber, Christian).', value: '$497' },
                  { emoji: '💰', title: 'Module 2 — Wealth Reprogramming Sessions', desc: 'Wealth Beliefs Pts 1–3 · Abundance · Success · Expanding Wealth · Commitment · I AM / Being.', value: '$997' },
                  { emoji: '⚡', title: 'Module 3 — Brain Optimization', desc: '3 dedicated tracks to optimize focus, processing speed &amp; default mode — listen on repeat.', value: '$397' },
                  { emoji: '🌌', title: 'Module 4 — Conscious Mind &amp; Law Of Attraction', desc: 'Aligned Action Protocol · Conscious Permission Practice · Identity Bridge Work — the conscious-side half that makes the subconscious rewire stick.', value: '$297' },
                  { emoji: '🎁', title: 'Module 5 — Quantum Bonus Vault', desc: 'Quantum Field Deep Dive (slow down time) · Smart Goals · Financial Thermostats · Trauma Clearing · Proper Structures 1 &amp; 2 (MIT-level thinking).', value: '$997' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-6 py-5 ${i < 4 ? 'border-b border-white/[0.06]' : ''} hover:bg-white/[0.02] transition-colors`}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-base md:text-lg">{item.title}</div>
                        <div className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: item.desc }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-violet-300 font-black text-lg">{item.value}</span>
                    </div>
                  </div>
                ))}

                {/* Lifetime access row — highlighted */}
                <div className="border-t border-violet-500/30 bg-violet-500/[0.06] px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">♾️</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-base md:text-lg">Lifetime Access + All Future Updates</div>
                      <div className="text-sm text-violet-300/80">Every new session, meditation &amp; bonus added to the library — yours, forever, at no extra cost</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="text-violet-300 font-black text-lg">INCLUDED</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 px-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-gray-500 text-sm uppercase tracking-wider font-bold">Total Value:</span>
                  <span className="text-2xl font-black text-white line-through decoration-red-500/60 decoration-2">$3,185</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-gray-500 text-sm uppercase tracking-wider font-bold">Today:</span>
                  <span className="text-4xl font-black bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent">$297</span>
                </div>
              </div>
            </div>
          </div>

          {/* Why */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-10">
              <span className="text-violet-300">Why Reprogram The Subconscious?</span>
            </h2>
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-gray-300">
                The subconscious runs on <span className="font-bold text-white">repetition + state</span> — not logic. That&apos;s why a single &ldquo;aha&rdquo; never sticks: the old wiring fires the next time you&apos;re tired, triggered, or trying to charge more.
              </p>
              <p className="text-gray-300">
                Every session in this library is engineered to drop you into a <span className="font-bold text-violet-300">theta-adjacent state</span> and feed the subconscious the new pattern — wealth, abundance, safety, being seen — with enough repetition that the new wiring becomes the default.
              </p>
              <p className="text-gray-300">
                You don&apos;t have to &ldquo;believe&rdquo; it the first time. You don&apos;t have to journal it. You press play, let the track run, muscle-test before &amp; after, and <span className="font-bold text-white">watch the answer flip</span>.
              </p>
              <p className="text-gray-300 text-2xl font-bold text-center py-4">
                That&apos;s not affirmations. <span className="text-violet-300">That&apos;s an operating-system swap.</span>
              </p>
            </div>
          </div>

          {/* Module by module */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-8 text-white">
              The 5-Module Curriculum Map
            </h2>
            <div className="space-y-4">
              {[
                { week: 'Module 1', icon: '🧠', title: 'Subconscious Mind Deep Dive', desc: 'Quantum Awakening · Understanding What Runs The Show · Muscle Testing 101 · 3 Miracle Meditations (Beaming, Amber, Christian) for quantum connection, focus &amp; surrender.' },
                { week: 'Module 2', icon: '💰', title: 'Wealth Reprogramming Sessions', desc: 'Wealth Beliefs Pts 1–3 · Abundance · Success · Expanding Wealth · Commitment · I AM / Being — the full money-OS rewrite, on tap, on repeat.' },
                { week: 'Module 3', icon: '⚡', title: 'Brain Optimization', desc: '3 dedicated tracks to upgrade focus, processing speed &amp; default-mode network. Listen passively while you work, walk, or sleep.' },
                { week: 'Module 4', icon: '🌌', title: 'Conscious Mind &amp; Law Of Attraction', desc: 'Aligned Action Protocol · Conscious Permission Practice · Identity Bridge Work — how the conscious 5% stops sabotaging the subconscious rewire and lets the new wiring actually run your day.' },
                { week: 'Module 5', icon: '🎁', title: 'Quantum Bonus Vault', desc: 'Quantum Field Deep Dive (slow down time) · Smart Goals (Quantum Shift Method) · Financial Thermostats · Trauma Clearing for Entrepreneurs · Proper Structures 1 &amp; 2 (MIT-level &ldquo;what to think vs. how to think&rdquo;).' },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-violet-500/20 rounded-xl p-6 flex items-start gap-5 hover:border-violet-500/40 transition-colors">
                  <div className="text-4xl flex-shrink-0">{item.icon}</div>
                  <div className="flex-1">
                    <div className="text-xs text-violet-300 font-bold uppercase tracking-wider mb-1">{item.week}</div>
                    <div className="text-xl font-black text-white mb-2">{item.title}</div>
                    <div className="text-base text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.desc }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* See What's Possible */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-3 text-white">
              See A Sample Reprogramming Session 👇
            </h2>
            <p className="text-center text-gray-400 mb-6 text-lg">
              A 5-minute clip from the Wealth Beliefs Pt 1 track — same theta-state structure used across all 26+ sessions.
            </p>
            <div className="bg-white/5 border-2 border-violet-500/40 shadow-[0_0_20px_rgba(167,139,250,0.12)] rounded-2xl p-2">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                <div className="text-center text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-3 bg-violet-500/20 rounded-full flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                    <Play className="w-8 h-8 text-violet-300 ml-1" />
                  </div>
                  <div className="text-base font-semibold text-white">Sample: Wealth Beliefs Pt 1</div>
                  <div className="text-xs mt-1">Press play · muscle-test before &amp; after · watch the answer flip</div>
                </div>
              </div>
            </div>
          </div>

          {/* Member Wins Proof — Muscle-test before/after */}
          <div className="mb-14 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-violet-300 font-bold text-sm uppercase tracking-[0.25em] mb-3">🪞 BEFORE / AFTER PROOF</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">
                Watch The Subconscious Flip
              </h2>
              <p className="text-lg text-gray-400 mt-4 max-w-2xl mx-auto">
                Real muscle-test responses captured before vs. after a single reprogramming session — same person, same statement, body says the opposite.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Video Demo */}
              <div className="bg-white/5 border-2 border-violet-500/40 shadow-[0_0_20px_rgba(167,139,250,0.12)] rounded-2xl p-2">
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                  <div className="text-center text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-3 bg-violet-500/20 rounded-full flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                      <Play className="w-8 h-8 text-violet-300 ml-1" />
                    </div>
                    <div className="text-base font-semibold text-white">Muscle Test: Before vs After</div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-500 mt-2 pb-1">🎬 Watch the arm response reverse live</p>
              </div>

              {/* Muscle-test panels — 2 statement pairs */}
              <div className="space-y-4">
                {/* Pair 1 — Wealth */}
                <div className="bg-white/5 border border-violet-500/20 rounded-xl p-3">
                  <p className="text-[11px] text-violet-300/80 text-center font-semibold mb-2 uppercase tracking-wider">Statement: &ldquo;I am wealthy&rdquo;</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 text-center font-semibold">Before</p>
                      <div className="aspect-square rounded-lg border border-white/10 bg-gradient-to-br from-red-900/40 via-gray-900 to-red-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">💪⬇️</div>
                          <div className="text-xs text-red-300/80 font-semibold">Arm goes weak</div>
                          <div className="text-[10px] text-gray-500 mt-1">Subconscious rejects it</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-violet-300 uppercase tracking-wider mb-1.5 text-center font-semibold">✨ After</p>
                      <div className="aspect-square rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-gray-900 to-fuchsia-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">💪✅</div>
                          <div className="text-xs text-violet-200 font-semibold">Arm locks strong</div>
                          <div className="text-[10px] text-gray-500 mt-1">New wiring registered</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pair 2 — Receiving */}
                <div className="bg-white/5 border border-violet-500/20 rounded-xl p-3">
                  <p className="text-[11px] text-violet-300/80 text-center font-semibold mb-2 uppercase tracking-wider">Statement: &ldquo;I deserve to receive more&rdquo;</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 text-center font-semibold">Before</p>
                      <div className="aspect-square rounded-lg border border-white/10 bg-gradient-to-br from-red-900/40 via-gray-900 to-red-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">💪⬇️</div>
                          <div className="text-xs text-red-300/80 font-semibold">Arm drops instantly</div>
                          <div className="text-[10px] text-gray-500 mt-1">Old script still firing</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-violet-300 uppercase tracking-wider mb-1.5 text-center font-semibold">✨ After</p>
                      <div className="aspect-square rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-900/30 via-gray-900 to-fuchsia-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">💪✅</div>
                          <div className="text-xs text-violet-200 font-semibold">Arm holds firm</div>
                          <div className="text-[10px] text-gray-500 mt-1">Receiving capacity online</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center mb-14">
            <div className="bg-white/5 border-2 border-violet-500/40 shadow-[0_0_40px_rgba(167,139,250,0.18)] rounded-2xl p-10">
              <p className="text-sm text-violet-300 font-bold uppercase tracking-[0.2em] mb-6">
                One-Time Investment — Lifetime Library Access
              </p>
              <div className="text-lg text-gray-400 mb-2">
                Library value: <span className="font-bold text-red-400 line-through">$3,185</span>
              </div>
              <div className="text-lg text-gray-400 mb-8">Your price today:</div>
              <div className="text-3xl font-bold text-gray-600 line-through mb-1">$997</div>
              <div className="text-7xl md:text-8xl font-black bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent mb-2">$297</div>
              <p className="text-lg text-violet-300 font-bold mb-8">
                5 modules + 26+ sessions + all future additions — only on this page.
              </p>

              <div className="space-y-4 max-w-md mx-auto">
                <button
                  onClick={handleAcceptOffer}
                  className="group relative w-full bg-gradient-to-r from-violet-400 via-violet-500 to-fuchsia-500 hover:from-violet-300 hover:via-violet-400 hover:to-fuchsia-400 text-white font-black py-6 px-8 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_30px_rgba(167,139,250,0.4)] hover:shadow-[0_0_50px_rgba(167,139,250,0.55)] flex items-center justify-center overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <Sparkles className="w-7 h-7 mr-3" />
                  YES — Unlock Quantum Entrepreneur
                </button>
                <button
                  onClick={handleDeclineOffer}
                  className="w-full text-gray-600 hover:text-gray-400 text-sm py-4 px-6 transition-all duration-300"
                >
                  No thanks, take me to my purchase
                </button>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-8 text-white">
              What Comes Out Of A Reprogrammed Subconscious
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { stat: '4 weeks', label: 'Biggest cash week of her career — Sarah J.', sub: 'Ran the Wealth Beliefs trio nightly for 3 weeks.' },
                { stat: '14 mo', label: 'Broke a 14-month plateau — Maya R.', sub: 'Abundance + Expanding Wealth tracks shifted the receiving block.' },
                { stat: '3x', label: 'Raised her rates without flinching — Priya M.', sub: 'Muscle test on &ldquo;I deserve more&rdquo; flipped after session 4.' },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-violet-500/20 rounded-xl p-6 text-center hover:border-violet-500/40 transition-colors">
                  <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-violet-300 to-fuchsia-400 bg-clip-text text-transparent mb-2">{item.stat}</div>
                  <div className="font-bold text-white text-sm mb-1">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Choice */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-white text-2xl font-bold">
                Two paths from here:
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-red-400">Path A:</span> Run Mindshift alone and work the conscious 5%. The surface beliefs crack — but the deeper wealth, safety, and self-sabotage scripts in the subconscious 95% stay intact, and the old default creeps back the next time you&apos;re tired or triggered.
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-violet-300">Path B:</span> Add the full Quantum Entrepreneur library. Reprogram the 95% on tap — wealth, abundance, success, safety, brain optimization — until <span className="font-bold text-white">the new operating system is the default</span>.
              </p>
              <p className="text-gray-400 italic">
                One path edits the surface. The other rewrites the source code.
              </p>
              <p className="text-gray-300">
                This is the only time the full library is offered at $297. It moves to $997 the next time it&apos;s released standalone.
              </p>
            </div>
          </div>

          {/* Guarantee */}
          <div className="text-center mb-8">
            <div className="bg-white/5 border border-violet-500/30 rounded-xl p-8">
              <Shield className="w-14 h-14 text-violet-300 mx-auto mb-4" />
              <h4 className="text-2xl font-bold mb-3">14-Day &ldquo;Feel the Shift&rdquo; Guarantee</h4>
              <p className="text-gray-400 max-w-lg mx-auto">
                Run any 3 reprogramming sessions in the first 14 days. Muscle-test before &amp; after. If your body doesn&apos;t register a measurable shift, email us — full refund, no questions, sessions yours to keep.
              </p>
            </div>
          </div>
        </div>
      </div>

      <OneClickCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        productName="Quantum Entrepreneur Library"
        productPrice="$297"
        productAmount={29700}
        originalPrice="$997"
        guaranteeDays={14}
        productId="mindshift_quantum_entrepreneur"
        paymentMetadata={{ type: 'mindshift_upsell_3', page_type: 'oto3', parent_product: 'millionaire_mindshift' }}
        features={[
          { name: 'Module 1 — Subconscious Mind Deep Dive', value: '$497' },
          { name: 'Module 2 — Wealth Reprogramming Sessions', value: '$997' },
          { name: 'Module 3 — Brain Optimization Tracks', value: '$397' },
          { name: 'Module 4 — Conscious Mind & Law Of Attraction', value: '$297' },
          { name: 'Module 5 — Quantum Bonus Vault', value: '$997' },
          { name: 'Lifetime Access + All Future Updates', value: 'INCLUDED' },
        ]}
        onSuccess={handleCheckoutSuccess}
        colorTheme="violet"
        subtitle="One-time payment · Lifetime access · 26+ sessions"
      />
    </div>
  );
};
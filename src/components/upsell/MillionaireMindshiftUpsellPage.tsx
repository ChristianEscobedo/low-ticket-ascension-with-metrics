'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Shield, Play } from 'lucide-react';
import { OneClickCheckoutModal } from '@/components/checkout/OneClickCheckoutModal';
import { parsePurchaseQuery, writePurchases } from '@/lib/mindshift/purchases';

// Accepted → offer the annual upgrade. Declined → skip the upgrade, go to OTO3.
const ACCEPT_REDIRECT = '/millionaire-mindshift/upsell-2';
const DECLINE_REDIRECT = '/millionaire-mindshift/upsell-3';

export const MillionaireMindshiftUpsellPage: React.FC = () => {
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

  // Finalize FE + bumps from the checkout redirect query string.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const incoming = parsePurchaseQuery(window.location.search);
    if (incoming.fe || (incoming.bumps && incoming.bumps.length > 0)) {
      writePurchases(incoming);
    }
  }, []);

  // The subscription modal redirects to Stripe Checkout and returns here with
  // ?checkout=success — record the membership and advance to the annual upgrade.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      writePurchases({ clearingRoom: true, clearingRoomInterval: 'monthly' });
      window.location.href = ACCEPT_REDIRECT;
    }
  }, []);

  const handleAcceptOffer = () => setShowCheckoutModal(true);
  const handleDeclineOffer = () => { window.location.href = DECLINE_REDIRECT; };
  const handleCheckoutSuccess = () => {
    writePurchases({ clearingRoom: true, clearingRoomInterval: 'monthly' });
    setShowCheckoutModal(false);
    window.location.href = ACCEPT_REDIRECT;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Timer Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-center py-4 text-black">
        <div className="flex items-center justify-center space-x-2">
          <Clock className="w-5 h-5" />
          <span className="font-bold tabular-nums">
            FOUNDING RATE EXPIRES IN {String(timeLeft.minutes).padStart(2, '0')}:
            {String(timeLeft.seconds).padStart(2, '0')} Remaining
          </span>
        </div>
      </div>

      {/* Dot Pattern Background */}
      <div className="relative">
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)`,
            backgroundSize: '25px 25px'
          }}></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          {/* Main Headline */}
          <div className="text-center mb-14">
            <p className="text-amber-300 font-bold text-sm md:text-base mb-6 uppercase tracking-[0.25em]">
              ⚡ WAIT — YOUR FOUNDING SEAT IS OPEN ⚡
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tight">
              <span className="block text-white">Now Step Into</span>
              <span className="block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent" style={{ WebkitTextStroke: '0.5px rgba(251,191,36,0.2)' }}>
                The Clearing Room
              </span>
              <span className="block text-white">Live With Us Every Week</span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-white mb-4">
              The Weekly Live Room Where The Ceiling Actually Moves
            </p>
            <h2 className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
              You just learned to clear the blocks you can <span className="text-white font-bold">see</span>. This is where we clear the ones you <span className="text-amber-300 font-bold">can&apos;t</span> — live with Christian &amp; Amber, every week, until the new wiring is who you are.
            </h2>
          </div>

          {/* Video Section */}
          <div className="mb-8">
            <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] rounded-2xl p-2">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                <div className="text-center text-gray-400">
                  <div className="w-20 h-20 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <Play className="w-10 h-10 text-amber-300 ml-1" />
                  </div>
                  <div className="text-lg font-semibold mb-2 text-white">Watch: Inside The Clearing Room</div>
                  <div className="text-sm">See a real weekly hot-seat &mdash; block surfaced, cleared, body-confirmed &mdash; live on the call</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA After Video */}
          <div className="text-center mb-14">
            <button
              onClick={handleAcceptOffer}
              className="group relative bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-black font-black py-5 px-10 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center mx-auto overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <CheckCircle className="w-7 h-7 mr-3" />
              YES! Join The Clearing Room — $97/mo
            </button>
            <p className="text-sm text-amber-300/90 mt-4 font-semibold tracking-wide">
              ⚠️ This page disappears when the timer hits zero — you won&apos;t see this again.
            </p>
          </div>

          {/* Personal Letter */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-white text-2xl font-bold">
                Hey — welcome in. 🎉
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-amber-300">Christian &amp; Amber Escobedo</span> here…
              </p>
              <p className="text-gray-300">
                You just grabbed <span className="font-bold text-white">Millionaire Mindshift</span> — so you now own the protocol. You can Surface &rarr; Test &rarr; Clear &rarr; Install on every block you can <em>see</em>.
              </p>
              <p className="text-gray-300">
                Here&apos;s what surfaces next for every single person who runs this work alone: <span className="font-bold text-amber-300">the block under the block</span>. The ceiling beneath the ceiling. The wiring your own nervous system is too close to see.
              </p>
              <p className="text-gray-300">
                You can&apos;t objectively muscle-test your <em>own</em> deepest pattern. And the moment you clear one belief, another quietly takes its place. That&apos;s not failure — <span className="font-bold text-white">that&apos;s the work</span>. It&apos;s just not work you can finish alone.
              </p>
              <p className="text-gray-300">
                That&apos;s what <span className="font-bold text-amber-300">The Clearing Room</span> is for. Every week we go live, you bring whatever&apos;s surfacing, and we run the protocol <span className="font-bold text-white">on you</span> — with trained eyes in the room catching the blind spot you&apos;d never find solo.
              </p>
              <p className="text-gray-300">
                One member ran her own clearings for a month and stalled. She brought the real block to the room on a Wednesday, we cleared it live in 9 minutes — and she had the <span className="font-bold text-amber-300">biggest cash week of her career</span> that Friday. <span className="text-xs text-gray-500 block mt-1">(Individual result. Not typical. Results vary.)</span>
              </p>
              <p className="text-gray-300">
                We&apos;re opening the <span className="font-bold text-white">founding cohort</span> right now — and you&apos;re invited <span className="font-bold text-amber-300">at the lowest price this room will ever be</span>.
              </p>
            </div>
          </div>

          {/* The Opportunity Section */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-10">
              <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                The Blocks You Can See Aren&apos;t
              </span>
              <span className="block text-white text-2xl md:text-3xl mt-3">The Ones Holding The Ceiling Down…</span>
            </h2>

            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-gray-300">
                Everyone wants the breakthrough — the $25K month, the rate said out loud without flinching, the launch held open without the shame collapse. The protocol gets you there on the blocks you can <span className="font-bold text-white">name</span>.
              </p>
              <p className="text-gray-300">
                But the blocks that actually cap your income are the ones you <em>can&apos;t</em> name — because they live in your blind spot. You can&apos;t see your own face without a mirror, and you can&apos;t muscle-test the pattern your body has spent years protecting.
              </p>
              <p className="text-gray-300">
                The Clearing Room is the mirror. Every week, trained eyes catch the <span className="font-bold text-white">block under the block</span>, run the clearing on you live, and confirm the shift in your body before you leave the call.
              </p>
              <div className="bg-white/5 border border-amber-500/20 rounded-xl p-6 space-y-3">
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-amber-300 mr-3 flex-shrink-0" /> No more whack-a-mole — we find the root pattern, not the surface one.</p>
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-amber-300 mr-3 flex-shrink-0" /> No more solo guessing — you get muscle-tested and witnessed, live.</p>
                <p className="text-gray-400 flex items-center"><CheckCircle className="w-5 h-5 text-amber-300 mr-3 flex-shrink-0" /> No more &ldquo;did it work?&rdquo; — you feel the shift on the call, every week.</p>
              </div>
              <p className="text-gray-300">
                You show up, bring what&apos;s surfacing, and <span className="font-bold text-amber-300">walk out of every room more wired than you walked in</span>.
              </p>
            </div>
          </div>

          {/* Offer Breakdown */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-amber-300 font-bold text-sm uppercase tracking-[0.25em] mb-3">EVERYTHING INCLUDED — EVERY MONTH</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">
                Your Founding Membership
              </h2>
            </div>

            <div className="relative">
              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(251,191,36,0.08)]">
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-300/10 to-amber-500/10 border-b border-white/10 px-6 py-4 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">What You Get</span>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Value</span>
                </div>

                {[
                  { emoji: '🎯', title: '“Find Your #1 Ceiling” Onboarding', desc: 'Live guided diagnostic in week one — your first clearing, fast', value: '$297' },
                  { emoji: '🗄️', title: 'The Clearing Room Vault', desc: 'Every past hot-seat, searchable by belief — grows every month', value: '$497' },
                  { emoji: '👥', title: 'Private Members Community + Pods', desc: 'Daily congruence check-ins + accountability pods', value: '$197/mo' },
                  { emoji: '📨', title: 'Submit-A-Block Priority', desc: 'Drop a block to be run on the next call even if you miss it live', value: '$97/mo' },
                  { emoji: '🎙️', title: 'Monthly Live AMA With Christian & Amber', desc: 'Direct access — ask us anything, answered live', value: '$297/mo' },
                  { emoji: '💞', title: 'The Partner Pass', desc: 'Bring your spouse or business partner free — clear money blocks together', value: '$97/mo' },
                ].map((item, index) => (
                  <div key={index} className={`flex items-center justify-between px-6 py-5 ${index < 5 ? 'border-b border-white/[0.06]' : ''} hover:bg-white/[0.02] transition-colors`}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-base md:text-lg truncate">{item.title}</div>
                        <div className="text-sm text-gray-500 truncate">{item.desc}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-amber-300 font-black text-lg">{item.value}</span>
                    </div>
                  </div>
                ))}

                {/* Core training row — highlighted */}
                <div className="border-t border-amber-500/30 bg-amber-500/[0.06] px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">🔁</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-base md:text-lg">Weekly Live Clearing Room (Hot-Seat)</div>
                      <div className="text-sm text-amber-300/80">Every week, live with us — small group, the room itself</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="text-amber-300 font-black text-lg">INCLUDED</span>
                  </div>
                </div>
              </div>

              {/* Total + Price */}
              <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 px-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-gray-500 text-sm uppercase tracking-wider font-bold">Value Every Month:</span>
                  <span className="text-2xl font-black text-white line-through decoration-red-500/60 decoration-2">$1,579/mo</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-gray-500 text-sm uppercase tracking-wider font-bold">Founding Rate:</span>
                  <span className="text-4xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">$97/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Why This Matters Section */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-10">
              <span className="text-amber-300">Think About This…</span>
            </h2>

            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-gray-300">
                <span className="font-bold text-white">Identity-level work</span> is the only thing that moves the income ceiling for founders, coaches, and consultants who&apos;ve already solved strategy and skill. The block is in the body — and the deepest blocks hide in the blind spot.
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-white">Millionaire Mindshift</span> gave you the protocol. <span className="font-bold text-amber-300">The Clearing Room</span> gives you the trained eyes — <span className="font-bold text-amber-300">every single week</span> — so the wiring doesn&apos;t just shift once. It keeps shifting as each new layer surfaces.
              </p>
              <p className="text-gray-300">
                This is how a technique becomes an identity. Not one breakthrough — <span className="font-bold text-white">a weekly practice of clearing</span>, witnessed and confirmed, until operating from the new ceiling is simply who you are.
              </p>
              <p className="text-gray-300 text-2xl font-bold text-center py-4">
                Surface it. Clear it. <span className="text-amber-300">Every single week.</span>
              </p>
            </div>
          </div>

          {/* Who This Is For Grid */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-8 text-white">
              Who&apos;s In The Room?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { emoji: '👩‍💼', title: 'Coaches & Consultants', desc: 'Premium-priced experts hitting a quiet ceiling on what they&apos;ll let themselves charge', price: '$5K → $25K months' },
                { emoji: '🏢', title: 'Agency Owners', desc: 'Scaling past the &ldquo;I have to be on every call&rdquo; identity — wiring delegation safety', price: '$15K → $60K months' },
                { emoji: '📚', title: 'Course & Info Creators', desc: 'Holding the launch open without the post-launch shame collapse', price: '$20K → $100K launches' },
                { emoji: '👥', title: 'Service Founders', desc: 'Stuck under $20K/mo for 18+ months despite knowing every &ldquo;strategy&rdquo;', price: 'Ceiling breaks in &lt;30 days' },
              ].map((item, index) => (
                <div key={index} className="bg-white/5 border border-amber-500/20 rounded-xl p-6 text-center hover:border-amber-500/40 transition-colors">
                  <div className="text-3xl mb-3">{item.emoji}</div>
                  <div className="font-bold text-white mb-1">{item.title}</div>
                  <div className="text-sm text-gray-400 mb-2" dangerouslySetInnerHTML={{ __html: item.desc }} />
                  <div className="text-amber-300 font-bold text-sm" dangerouslySetInnerHTML={{ __html: item.price }} />
                </div>
              ))}
            </div>
          </div>

          {/* See What's Possible */}
          <div className="mb-14 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-black text-center mb-3 text-white">
              See A Real Clearing Room Hot-Seat 👇
            </h2>
            <p className="text-center text-gray-400 mb-6 text-lg">
              A 4-minute clip from a recent weekly room — block surfaced, cleared, and body-confirmed, live.
            </p>
            <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] rounded-2xl p-2">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                <div className="text-center text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <Play className="w-8 h-8 text-amber-300 ml-1" />
                  </div>
                  <div className="text-base font-semibold text-white">Sample Hotseat Clip</div>
                  <div className="text-xs mt-1">Block surfaced → cleared in 4 min</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bonus Use Case — Before/After Proof */}
          <div className="mb-14 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-amber-300 font-bold text-sm uppercase tracking-[0.25em] mb-3">🪞 BEFORE / AFTER PROOF</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">
                Watch The Block Actually Move
              </h2>
              <p className="text-lg text-gray-400 mt-4 max-w-2xl mx-auto">
                Real muscle-test reads from real members — before the clearing vs. after, captured live on the call.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Video Demo */}
              <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] rounded-2xl p-2">
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center cursor-pointer group">
                  <div className="text-center text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                      <Play className="w-8 h-8 text-amber-300 ml-1" />
                    </div>
                    <div className="text-base font-semibold text-white">Live Clearing Demo</div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-500 mt-2 pb-1">🎬 Watch the clearing in action</p>
              </div>

              {/* Image Grid — 2 Before→After pairs */}
              <div className="space-y-4">
                {/* Pair 1 */}
                <div className="bg-white/5 border border-amber-500/20 rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 text-center font-semibold">Before</p>
                      <div className="aspect-square rounded-lg border border-white/10 bg-gradient-to-br from-red-900/40 via-gray-900 to-red-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">😣</div>
                          <div className="text-xs text-red-300/80 font-semibold">&ldquo;Money isn&apos;t safe&rdquo;</div>
                          <div className="text-[10px] text-gray-500 mt-1">Arm goes weak</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-amber-300 uppercase tracking-wider mb-1.5 text-center font-semibold">✨ After</p>
                      <div className="aspect-square rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-900/30 via-gray-900 to-amber-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">🙂</div>
                          <div className="text-xs text-amber-200 font-semibold">&ldquo;Money is safe for me&rdquo;</div>
                          <div className="text-[10px] text-gray-500 mt-1">Arm stays strong</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pair 2 */}
                <div className="bg-white/5 border border-amber-500/20 rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 text-center font-semibold">Before</p>
                      <div className="aspect-square rounded-lg border border-white/10 bg-gradient-to-br from-red-900/40 via-gray-900 to-red-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">😟</div>
                          <div className="text-xs text-red-300/80 font-semibold">&ldquo;I&apos;ll be punished if I&apos;m rich&rdquo;</div>
                          <div className="text-[10px] text-gray-500 mt-1">Throat tightens</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-amber-300 uppercase tracking-wider mb-1.5 text-center font-semibold">✨ After</p>
                      <div className="aspect-square rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-900/30 via-gray-900 to-amber-950/30 flex items-center justify-center">
                        <div className="text-center px-3">
                          <div className="text-3xl mb-1">😌</div>
                          <div className="text-xs text-amber-200 font-semibold">&ldquo;I am safe to be seen and paid&rdquo;</div>
                          <div className="text-[10px] text-gray-500 mt-1">Body lands</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="text-center mb-14">
            <div className="bg-white/5 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(251,191,36,0.15)] rounded-2xl p-10">
              <p className="text-sm text-amber-300 font-bold uppercase tracking-[0.2em] mb-6">
                Founding Membership — Locked For Life
              </p>
              <div className="text-lg text-gray-400 mb-2">
                Regular membership: <span className="font-bold text-red-400 line-through">$197/mo</span>
              </div>
              <div className="text-lg text-gray-400 mb-8">
                Your founding rate today:
              </div>
              <div className="text-3xl font-bold text-gray-600 line-through mb-1">$197/mo</div>
              <div className="text-7xl md:text-8xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent mb-2">$97<span className="text-3xl md:text-4xl">/mo</span></div>
              <p className="text-lg text-amber-300 font-bold mb-8">
                Weekly live clearing + full vault + community + AMA — and your founding rate never goes up, even when we raise it for everyone else.
              </p>

              <div className="space-y-4 max-w-md mx-auto">
                <button
                  onClick={handleAcceptOffer}
                  className="group relative w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-black font-black py-6 px-8 rounded-xl text-xl md:text-2xl transition-all duration-300 transform hover:scale-[1.02] shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:shadow-[0_0_50px_rgba(251,191,36,0.5)] flex items-center justify-center overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <CheckCircle className="w-7 h-7 mr-3" />
                  YES — Join The Clearing Room
                </button>

                <button
                  onClick={handleDeclineOffer}
                  className="w-full text-gray-600 hover:text-gray-400 text-sm py-4 px-6 transition-all duration-300"
                >
                  No thanks, I&apos;ll keep clearing on my own
                </button>
              </div>
            </div>
          </div>

          {/* Final Choice */}
          <div className="mb-14 max-w-3xl mx-auto">
            <div className="text-left space-y-6 text-lg md:text-xl leading-relaxed">
              <p className="text-white text-2xl font-bold">
                Two paths from here:
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-red-400">Path A:</span> Run the protocol solo. It works — on the blocks you can see. But the blind-spot blocks stay hidden, the whack-a-mole continues, and the ceiling quietly resets the next time life gets loud.
              </p>
              <p className="text-gray-300">
                <span className="font-bold text-amber-300">Path B:</span> Step into the room. Every week we catch the block you <span className="font-bold text-white">can&apos;t</span>, run the clearing on you live, and confirm it in your body — until the new ceiling is simply your baseline.
              </p>
              <p className="text-gray-400 italic">
                One path clears what you can see. The other clears what&apos;s actually holding you down.
              </p>
              <p className="text-gray-300">
                Your founding rate disappears when you leave this page. Cancel anytime — keep every recording you&apos;ve downloaded.
              </p>
            </div>
          </div>

          {/* Guarantee */}
          <div className="text-center mb-8">
            <div className="bg-white/5 border border-amber-500/30 rounded-xl p-8">
              <Shield className="w-14 h-14 text-amber-300 mx-auto mb-4" />
              <h4 className="text-2xl font-bold mb-3">14-Day &ldquo;Feel the Shift&rdquo; Guarantee</h4>
              <p className="text-gray-400 max-w-lg mx-auto">
                Join the next live room. Take your hot-seat. If you don&apos;t physically feel a block move on the call, email us inside 14 days and we refund your first month in full — and anything you&apos;ve downloaded is yours to keep.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-Click Checkout Modal */}
      <OneClickCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        productName="The Clearing Room — Founding Membership"
        productPrice="$97"
        productAmount={9700}
        originalPrice="$197"
        guaranteeDays={14}
        billingType="subscription"
        subscriptionInterval="monthly"
        productId="mindshift_clearing_room"
        paymentMetadata={{ type: 'mindshift_upsell_1', page_type: 'oto1', parent_product: 'millionaire_mindshift', plan: 'clearing_room_monthly' }}
        features={[
          { name: 'Weekly Live Clearing Room Hot-Seat (INCLUDED)' },
          { name: '“Find Your #1 Ceiling” Onboarding ($297 value)' },
          { name: 'The Clearing Room Vault ($497 value)' },
          { name: 'Private Members Community + Pods ($197/mo value)' },
          { name: 'Submit-A-Block Priority ($97/mo value)' },
          { name: 'Monthly Live AMA With Christian & Amber ($297/mo value)' },
          { name: 'The Partner Pass ($97/mo value)' },
        ]}
        onSuccess={handleCheckoutSuccess}
        colorTheme="amber"
        subtitle="Billed monthly · Founding rate locked for life · Cancel anytime"
      />
    </div>
  );
};

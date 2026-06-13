'use client';

import React from 'react';
import { TrendingUp, Network, Layers } from 'lucide-react';

export const MindshiftWhatIsSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-4">The Mechanism</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent leading-tight mb-4">
            What Is The Millionaire Mindshift Protocol?
          </h2>
        </div>

        {/* Mechanism overview visual */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
            <img
              src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a283e4204ddd90284778a5a.png"
              alt="The Millionaire Mindshift Protocol &mdash; mechanism overview"
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* Struggle-vs-ease asymmetry hook (moved from hero) */}
        <div className="space-y-5 text-lg md:text-xl text-gray-300 leading-relaxed mb-12 max-w-3xl mx-auto">
          <p>
            Two people. <span className="text-white font-semibold">Same strategy. Same industry. Same hours in the day.</span>
          </p>
          <p>
            One builds a million-dollar business in 18 months and makes it look effortless. The other grinds for a decade and stays stuck at six figures.
          </p>
          <p>
            The difference isn&rsquo;t talent, tactics, or hustle &mdash; it&rsquo;s the{' '}
            <span className="text-amber-200 font-semibold">subconscious belief OS</span> quietly running every decision they make.
          </p>
          <p className="pt-2">
            The <span className="text-amber-200 font-semibold">Millionaire Mindshift Protocol</span> is the measurable 4-step process &mdash;{' '}
            <span className="text-white font-semibold">Surface &rarr; Test &rarr; Clear &rarr; Install</span> &mdash; that uninstalls the inherited &ldquo;middle-class&rdquo; wiring and installs the same belief patterns measurable in self-made millionaires and multi-millionaires. No affirmations. No 30-day journals. Just the wiring &mdash; installed at the nervous-system level &mdash;{' '}
            <span className="text-amber-200 font-medium">in under 10 minutes per belief</span>.
          </p>
        </div>

        {/* Stylized mechanism graphic (no external image) */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-gradient-to-br from-amber-200/10 via-black to-amber-300/5 p-10 md:p-14">
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(251,191,36,0.18) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70 mb-2">Conscious Mind</div>
                <div className="text-3xl md:text-4xl font-black text-white">5%</div>
                <div className="text-gray-400 mt-1">where mindset work happens</div>
              </div>
              <div className="flex items-center justify-center">
                <TrendingUp className="w-10 h-10 text-amber-200" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70 mb-2">Subconscious Mind</div>
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">95%</div>
                <div className="text-gray-400 mt-1">where the ceiling actually lives</div>
              </div>
            </div>
          </div>
        </div>

        {/* Flowing body copy */}
        <div className="space-y-6 text-lg text-white leading-relaxed mb-12">
          <p>
            The same <span className="text-amber-200 font-semibold">identity-rewire protocol</span> that high-achieving coaches, consultants, and founders are now using to break through income ceilings they&rsquo;ve been hitting for years&hellip;
          </p>
          <p>
            &hellip;And in turn, hold the wins their body would have collapsed under six months ago&hellip;
          </p>
          <p>
            &hellip;All without another funnel, another offer, another launch, or another 3-month mindset program that surfaces the wound and never clears it&hellip;
          </p>
          <p>
            &hellip;And best of all &mdash; <span className="text-white font-semibold">without losing the people you love along the way</span>.
          </p>
          <p>Here&rsquo;s what the protocol actually does:</p>
          <p>
            Surface the exact subconscious belief capping your income in 90 seconds&hellip;<br />
            Clear it at the <span className="text-amber-200 font-semibold">nervous-system level</span> instead of talking around it for months&hellip;<br />
            Install a new identity your body actually holds as true&hellip;<br />
            Move the income ceiling because the identity moved first&hellip;<br />
            Repeat for every block that surfaces (5&ndash;10 min per pass)&hellip;
          </p>
          <p>
            Imagine seeing the Stripe notification roll in and feeling <span className="text-white font-semibold">expansion instead of contraction</span> in your body. No shrinking. No self-sabotage. No quiet ceiling.
          </p>
          <p>
            With the Millionaire Mindshift protocol, you&rsquo;ll have a step-by-step method to make this your reality.
          </p>
          <p>
            Whether you&rsquo;re a coach hitting your first six-figure year or a founder breaking through to seven, this works because it touches the wiring underneath the strategy.
          </p>
        </div>

        {/* Mindset hacks vs. identity rewiring comparison */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
            <img
              src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2836d57fc0b68efc4f4850.png"
              alt="Mindset hacks vs. identity rewiring &mdash; the shortcut comparison"
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* Stylized framework graphic */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-gradient-to-br from-black via-gray-950 to-black p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-amber-200">
                <Network className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-[0.25em]">How It Works</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white mt-3">Strategy sits on top of identity.</h3>
              <p className="text-gray-400 mt-2">Move the identity. The strategy finally works.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Strategy', sub: 'funnels, offers, tactics' },
                { label: 'Skill', sub: 'sales, content, delivery' },
                { label: 'Identity', sub: 'what your body believes is safe' },
              ].map((row, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-5 text-center ${
                    i === 2 ? 'border-amber-200/40 bg-amber-200/[0.04]' : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className={`text-sm font-bold uppercase tracking-[0.2em] mb-2 ${i === 2 ? 'text-amber-200' : 'text-gray-500'}`}>
                    Layer {i + 1}
                  </div>
                  <div className="text-xl font-black text-white">{row.label}</div>
                  <div className="text-sm text-gray-400 mt-1">{row.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why Identity Beats Mindset */}
        <div className="mb-12">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-center leading-tight mb-8">
            <span className="text-white">Why Rewiring</span>{' '}
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">Identity</span>{' '}
            <span className="text-white">Beats Another Course or Strategy</span>
          </h3>

          <div className="space-y-6 text-lg text-gray-200 leading-[1.85]">
            <p>
              Most high achievers default to the same playbook &mdash; <span className="text-white font-semibold">read another book, do another course, journal harder, manifest louder</span>. But here&rsquo;s the problem: mindset work happens in the conscious mind. The block lives in the subconscious. You&rsquo;re scrubbing the wrong floor.
            </p>
            <p>
              <span className="font-bold bg-gradient-to-r from-amber-200 to-amber-300 bg-clip-text text-transparent">Identity rewiring</span> flips the entire model. Instead of trying to think your way out of a body-level pattern, you go straight to the <span className="text-white font-semibold">nervous system that&rsquo;s actually running the show</span> &mdash; surface the belief, clear it, install the new one. Done.
            </p>
            <p>Unlike traditional mindset work, identity rewiring is:</p>
            <p>
              <span className="font-bold text-white">Measurable, Not Vague</span> &mdash; Muscle testing gives you a yes/no answer in seconds.<br />
              <span className="font-bold text-white">Fast, Not Months</span> &mdash; Full protocol runs in 5&ndash;10 minutes. Per block.<br />
              <span className="font-bold text-white">Somatic, Not Cerebral</span> &mdash; The body releases what the mind cannot.<br />
              <span className="font-bold text-white">Repeatable Forever</span> &mdash; Learn it once. Run it on every future ceiling.
            </p>
            <p>
              While most people are stuck reading their fifteenth mindset book and journaling around the same loop, <span className="text-white font-semibold">Mindshift practitioners are clearing the actual block in under 10 minutes</span> &mdash; and watching the ceiling move within weeks.
            </p>
          </div>

          <div className="mt-8">
            <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
              <img
                src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a28430bbcef8d4f9fa1eedf.png"
                alt="Mindshift practitioners clearing the actual block in under 10 minutes"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>

        {/* Bottom callout */}
        <div className="rounded-2xl border border-amber-200/30 bg-gradient-to-br from-amber-200/[0.06] to-transparent p-8 text-center">
          <Layers className="w-8 h-8 text-amber-200 mx-auto mb-3" />
          <p className="text-xl md:text-2xl font-bold text-white leading-snug">
            You don&rsquo;t need a new strategy. <span className="text-amber-200">You need a new identity to run it from.</span>
          </p>
        </div>
      </div>
    </section>
  );
};

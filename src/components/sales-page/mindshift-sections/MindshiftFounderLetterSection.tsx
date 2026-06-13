'use client';

import React from 'react';

export const MindshiftFounderLetterSection: React.FC = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-4xl mx-auto">
        {/* Dark Letter Card with Gold Pinstripe */}
        <div className="bg-white/[0.03] rounded-3xl shadow-2xl border-2 border-amber-200/30 shadow-[0_0_30px_rgba(251,191,36,0.08)] overflow-hidden">

          {/* Letter Header with founder photo */}
          <div className="bg-white/[0.03] px-8 md:px-14 pt-10 pb-6 border-b border-white/10">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-amber-200/30 shadow-lg flex-shrink-0">
                <img
                  src="https://storage.googleapis.com/msgsndr/FnedsjhvL9EqG9Eyjhep/media/6987ae6b0708e42e296dacde.jpg"
                  alt="Christian Ray Escobedo — Co-creator of the Millionaire Mindshift Protocol"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center md:text-left">
                <p className="text-sm font-semibold text-amber-200 uppercase tracking-wider mb-1">A Letter From The Founders</p>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                  We Thought Our Strategy Was Broken. <span className="text-amber-200">Turns Out Our Subconscious Was.</span> Here&rsquo;s What Finally Moved The Ceiling&hellip;
                </h2>
                <p className="text-sm text-gray-400 mt-2">Christian &amp; Amber Escobedo &mdash; Co-creators of the Millionaire Mindshift Protocol</p>
              </div>
            </div>
          </div>

          {/* Letter Body */}
          <div className="px-8 md:px-14 py-10 space-y-6 text-[17px] text-gray-300 leading-[1.9] font-[Georgia,serif]">

            {/* Subheadline */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans">
              The Hidden Income Ceiling Nobody Was Talking About&hellip;
            </h3>

            {/* Warning box */}
            <div className="bg-red-500/10 border-l-4 border-red-500 p-5 rounded-r-lg">
              <p className="text-red-300 font-semibold text-base leading-relaxed">
                <span className="font-black">WARNING:</span> If you&rsquo;re a coach, consultant, or founder who has done &ldquo;all the mindset work&rdquo; and is <em>still</em> hitting the same income ceiling, what you&rsquo;re about to read will either explain the last three years of your life&hellip; or be the most frustrating thing you&rsquo;ve ever heard.
              </p>
            </div>

            <p className="text-gray-400 italic">Dear Fellow High Achiever,</p>

            <p>
              If you&rsquo;re anything like the hundreds of high-performing entrepreneurs we&rsquo;ve worked with, you&rsquo;re probably feeling it already&hellip;
            </p>

            <p>
              That quiet, gnawing sense that something underneath your business isn&rsquo;t moving. You have the strategy. You have the skill. You have the offers. You&rsquo;ve done the courses, read the books, hired the coaches.
            </p>

            <p className="font-semibold text-white">
              And yet the same income ceiling keeps showing up. Different month, same number.
            </p>

            <ul className="space-y-3 pl-2">
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold text-xl leading-none mt-0.5">•</span>
                <span>You overdeliver, then <strong className="text-white">quietly resent your clients</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold text-xl leading-none mt-0.5">•</span>
                <span>You launch, hit a number, then <strong className="text-white">sabotage the next month</strong> without knowing why</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold text-xl leading-none mt-0.5">•</span>
                <span>You hold back your real voice because <strong className="text-white">&ldquo;what if I lose them?&rdquo;</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold text-xl leading-none mt-0.5">•</span>
                <span>You keep adjusting the strategy, trying to <strong className="text-white">outrun the discomfort</strong> underneath</span>
              </li>
            </ul>

            {/* We Know section */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans pt-4">
              We Know &mdash; Because We Lived It For Years&hellip;
            </h3>

            <p>
              For most of our career as operators, the strategy was <strong className="text-white">objectively excellent</strong>. The offer was solid. The delivery was sharp. The funnels converted.
            </p>

            <p>And every time we got close to the next level, <strong className="text-white">something inside us would pull the brake</strong>.</p>

            <p>We&rsquo;d hit a $25K month&hellip; then have a $9K month right after.</p>

            <p className="font-semibold text-white">In reality?</p>

            <p>We had a subconscious ceiling we didn&rsquo;t even know existed.</p>

            {/* Pull quote */}
            <blockquote className="border-l-4 border-amber-200 pl-6 py-3 my-8 bg-amber-200/[0.06] rounded-r-lg">
              <p className="text-lg italic text-gray-200 font-medium">
                &ldquo;We were running the right strategy through the wrong nervous system. No tactic on earth was going to fix that.&rdquo;
              </p>
            </blockquote>

            {/* Then We Noticed */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans pt-4">
              Then We Noticed Something About The Clients Who Actually Broke Through&hellip;
            </h3>

            <p>
              While we were running &ldquo;every mindset modality we could find,&rdquo; we started paying close attention to the entrepreneurs who were <strong className="text-white">actually breaking through</strong> &mdash; not the ones who looked good on Instagram, but the ones whose Stripe dashboards quietly doubled.
            </p>

            <blockquote className="border-l-4 border-amber-200 pl-6 py-3 my-8 bg-amber-200/[0.06] rounded-r-lg">
              <p className="text-lg italic text-gray-200 font-medium">
                &ldquo;Every single one of them had cleared something at the body level. Not the mind level. The body level.&rdquo;
              </p>
            </blockquote>

            <p className="font-semibold text-white">The pattern was undeniable:</p>

            <div className="bg-white/[0.03] rounded-xl p-6 space-y-3 border border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-amber-200 font-bold">→</span>
                <span>The ones who broke through <strong className="text-white">stopped reading</strong> and started somatic work</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-200 font-bold">→</span>
                <span>They cleared inherited money beliefs <strong className="text-white">at the nervous-system level</strong></span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-200 font-bold">→</span>
                <span>They stopped trying to <strong className="text-white">think their way out</strong> of patterns the body was running</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-200 font-bold">→</span>
                <span>And the income shifts started showing up <strong className="text-white">within weeks</strong>, not years</span>
              </div>
            </div>

            <p>
              They had all made the same shift &mdash; from <strong className="text-white">mindset work to identity rewiring</strong>.
            </p>

            {/* The Insight */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans pt-4">
              The 90-Second Discovery That Changed Everything
            </h3>

            <p>
              Here&rsquo;s what we realized: <strong className="text-white">muscle testing</strong> &mdash; a measurable neuromuscular response used by chiropractors and applied kinesiologists for decades &mdash; could be turned into a <span className="text-amber-200 font-semibold">precision instrument for money beliefs</span>.
            </p>

            <ul className="space-y-3 pl-2">
              <li className="flex items-start gap-3">
                <span className="text-amber-200 font-bold text-xl leading-none mt-0.5">✓</span>
                <span><strong className="text-white">Measurable:</strong> A yes/no answer in seconds &mdash; no guessing</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-200 font-bold text-xl leading-none mt-0.5">✓</span>
                <span><strong className="text-white">Self-Testing:</strong> No partner, no practitioner, no $300/hr session</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-200 font-bold text-xl leading-none mt-0.5">✓</span>
                <span><strong className="text-white">Body-Led:</strong> Bypasses the conscious story-mind completely</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-200 font-bold text-xl leading-none mt-0.5">✓</span>
                <span><strong className="text-white">Repeatable:</strong> Run it once. Run it forever. On every future ceiling.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-200 font-bold text-xl leading-none mt-0.5">✓</span>
                <span><strong className="text-white">Fast:</strong> 5&ndash;10 minutes per block, not 6 months in therapy</span>
              </li>
            </ul>

            <p className="font-semibold text-white text-lg pt-2">But there was one big problem&hellip;</p>

            <p className="text-xl font-bold text-white text-center py-2">
              Nobody had stitched it together into a step-by-step protocol entrepreneurs could actually run.
            </p>

            {/* Building the protocol */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans pt-4">
              So We Built One. Then We Tested It On Ourselves For 18 Months&hellip;
            </h3>

            <p>
              We ran the protocol on every income belief we could find. <strong className="text-white">Wealth = abandonment.</strong> <strong className="text-white">Success = target.</strong> <strong className="text-white">Money = selfish.</strong> Each one cleared in under 10 minutes. Each one moved something we could feel.
            </p>

            <p>
              Within six months our income did something it had never done before &mdash; it <strong className="text-amber-200">stopped collapsing after a good month</strong>. The ceiling moved. And we noticed we weren&rsquo;t white-knuckling it. The body was just&hellip; allowing it.
            </p>

            <p>So we started running it with private clients.</p>

            {/* Founder pull quote */}
            <blockquote className="border-l-4 border-amber-200 pl-6 py-3 my-8 bg-amber-200/[0.06] rounded-r-lg">
              <p className="text-base italic text-gray-200 font-medium">
                &ldquo;One client &mdash; same offer, same audience, same strategy &mdash; ran the protocol on a Sunday night. By Friday she&rsquo;d done <strong className="text-amber-200 not-italic">$72,500</strong>. Her biggest week ever. Nothing in her business had changed. Only the identity holding it.&rdquo;
              </p>
              <p className="text-[11px] text-gray-500 mt-3 not-italic">
                Individual client result. Atypical &mdash; your outcome depends on your situation, effort, and market. The Subconscious Reset Method&trade; is a protocol, not an income guarantee.
              </p>
            </blockquote>

            <p>
              That was the moment we knew this couldn&rsquo;t stay a private-client-only protocol. The people quietly hitting their income ceiling deserved the actual <em>tool</em> &mdash; not another book about the ceiling.
            </p>

            {/* Results box */}
            <div className="bg-amber-200/[0.06] rounded-xl p-6 border border-amber-200/30 my-8">
              <h4 className="text-lg font-black text-white font-sans mb-3">In the months since, the protocol has helped clients:</h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-3">
                  <span className="text-amber-200 font-bold text-lg leading-none mt-0.5">✓</span>
                  <span className="text-gray-200">Break income ceilings they&rsquo;d been hitting for <strong className="text-white">2&ndash;5+ years</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-200 font-bold text-lg leading-none mt-0.5">✓</span>
                  <span className="text-gray-200">Hold visibility <strong className="text-white">without the post-launch shame spiral</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-200 font-bold text-lg leading-none mt-0.5">✓</span>
                  <span className="text-gray-200">Charge premium <strong className="text-white">without the stomach-drop</strong> before quoting the price</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-200 font-bold text-lg leading-none mt-0.5">✓</span>
                  <span className="text-gray-200">Receive a $25K+ week <strong className="text-white">without immediately sabotaging the next one</strong></span>
                </li>
              </ul>
            </div>

            {/* New model callout */}
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight font-sans">
              The Best Part? You Already Have The Strategy.
            </h3>

            <p>
              You don&rsquo;t need a new funnel. You don&rsquo;t need a new offer. You don&rsquo;t need a new niche.
            </p>

            <p>
              You need the <strong className="text-white">version of you that can hold what your strategy is already capable of producing</strong>. That&rsquo;s the entire game.
            </p>

            <blockquote className="border-l-4 border-amber-200 pl-6 py-3 my-8 bg-amber-200/[0.06] rounded-r-lg">
              <p className="text-lg italic text-gray-200 font-medium">
                &ldquo;Your strategy isn&rsquo;t broken. Your subconscious blueprint is just out of date.&rdquo;
              </p>
            </blockquote>

            {/* System callout */}
            <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 rounded-xl p-6 md:p-8 text-white my-8 border border-amber-200/30">
              <p className="text-sm font-semibold text-amber-200 uppercase tracking-wider mb-2">The System Behind It All</p>
              <h4 className="text-xl md:text-2xl font-black mb-3">The Subconscious Reset Method&trade;</h4>
              <p className="text-gray-300 leading-relaxed">
                The exact <strong className="text-white">4-step protocol</strong> &mdash; Surface &rarr; Test &rarr; Clear &rarr; Install &mdash; that surfaces the ceiling belief, clears it at the nervous-system level, and installs the version of you that can finally hold the income you&rsquo;ve been chasing. It&rsquo;s the engine behind every breakthrough on this page.
              </p>
            </div>

            <p>
              That&rsquo;s why we built <strong className="text-white">Millionaire Mindshift</strong> &mdash; so you can skip the years of mindset books that never moved the needle, the bypassy retreats, the surface-level affirmations&hellip; and go straight to the protocol that actually rewires the identity underneath.
            </p>

            <p>Everything we learned &mdash; the protocol, the audios, the prompts, the live calls &mdash; it&rsquo;s all inside.</p>

            {/* Signature */}
            <div className="pt-8 border-t border-white/10 mt-8">
              <p className="text-gray-400 italic mb-4">To the version of you that&rsquo;s ready to hold it,</p>
              <p className="text-xl font-black text-white font-sans">Christian &amp; Amber Escobedo</p>
              <p className="text-sm text-gray-400">Co-creators of the Millionaire Mindshift Protocol</p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

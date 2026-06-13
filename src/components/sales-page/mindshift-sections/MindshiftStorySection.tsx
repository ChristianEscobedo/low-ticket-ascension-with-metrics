'use client';

import React from 'react';

export const MindshiftStorySection: React.FC = () => {
  return (
    <section className="py-8">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">Our Story</p>
      <h2 className="text-3xl md:text-5xl font-black mb-10 leading-[1.15]">
        We hit 7 figures &mdash; and the ceiling{' '}
        <span className="bg-gradient-to-r from-amber-200 to-amber-300 bg-clip-text text-transparent">moved up to meet us</span>.
      </h2>

      <div className="space-y-6 text-lg md:text-xl text-gray-300 leading-relaxed font-light">
        <p>
          We&rsquo;re <span className="text-white font-semibold">Christian and Amber Escobedo</span> &mdash; husband and wife, business partners, and the two people who spent the better part of a decade trying to out-strategize a ceiling neither of us could name.
        </p>
      </div>

      {/* Christian + Amber portrait beat */}
      <div className="my-10">
        <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
          <img
            src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a286a1cbd661f13c10639bb.png"
            alt="Christian and Amber Escobedo &mdash; husband-and-wife operators behind The Subconscious Reset Method"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </div>

      <div className="space-y-6 text-lg md:text-xl text-gray-300 leading-relaxed font-light">
        <p>
          We crossed seven figures and braced for the relief everyone promised would be on the other side. <span className="text-white font-medium">It never came.</span> The number on the dashboard moved &mdash; and the exact same tightness, the exact same self-sabotage cycle, the exact same &ldquo;why is this still hard?&rdquo; voice showed back up at the next zero. The ceiling didn&rsquo;t break. It just relocated.
        </p>
        <p>
          On paper, the inputs were identical to the peers scaling past us. <span className="text-white font-medium">Same offer. Same funnel. Same content cadence. Same hours in the day.</span> Different result. We&rsquo;d hit a number, hover there for a quarter, and watch the line refuse to move &mdash; even when the strategy was, by every measurable signal, working.
        </p>
        <p>
          So we did what every driven operator does. <span className="text-white font-medium">We blamed the strategy.</span> Bought more courses. Hired more coaches. Read every mindset book on the shelf. Journaled harder. Tried louder affirmations. Rebuilt the funnel. Repositioned the offer. Changed the niche.
        </p>
        <p className="text-gray-400">
          Each pivot bought a week of dopamine and ended in the same spiral. Nothing moved the line.
        </p>
        <p className="text-2xl md:text-3xl font-bold text-white pt-2">
          Until we stopped optimizing the output &mdash; and looked at{' '}
          <span className="text-amber-200">the operating system.</span>
        </p>
      </div>

      {/* The operating-system reveal &mdash; visual anchor */}
      <div className="my-10">
        <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
          <img
            src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a286125bb09e3b139a1cb5d.png"
            alt="The subconscious belief OS running underneath the strategy"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </div>

      <div className="space-y-6 text-lg md:text-xl text-gray-300 leading-relaxed font-light">
        <p className="text-2xl md:text-3xl font-bold text-white pt-2">
          That&rsquo;s when we found it &mdash; <span className="text-amber-200">the wiring underneath the strategy.</span>
        </p>
        <p>
          The strategy was never the bottleneck. The <span className="text-white font-semibold">subconscious belief OS</span> running it was. And no amount of conscious effort &mdash; no book, no coach, no funnel rebuild &mdash; was ever going to clear a body-level program written in a part of the system that conscious effort can&rsquo;t reach.
        </p>
        <p>
          So we built one that could. Over 18 months of working with somatic practitioners, applied-kinesiology protocols, and our own ceiling, we engineered what&rsquo;s now{' '}
          <span className="text-amber-200 font-semibold">The Subconscious Reset Method&trade;</span> &mdash; a four-step loop: <span className="text-white font-semibold">Surface &rarr; Test &rarr; Clear &rarr; Install</span>.
        </p>
        <p>
          The first time we ran it on our own ceiling, we broke through in <span className="text-white font-medium">weeks &mdash; not years</span>. Same strategy. Same offer. Same hours. <span className="text-white font-medium">Different OS running underneath it.</span>
        </p>
        <p>
          Then we started running the protocol with private clients. The pattern repeated every single time. <span className="text-white font-medium">Rapid acceleration the moment the wiring shifted &mdash; with the strategy they already had.</span>
        </p>
        <p className="border-l-2 border-amber-200/40 pl-6 text-gray-300">
          One client &mdash; a coach who&rsquo;d been parked at the same monthly number for 18 months &mdash; doubled her best month in 60 days without changing her offer or her funnel. Another stopped self-sabotaging the week before every six-figure jump. A third finally raised prices she&rsquo;d been &ldquo;working up the nerve to raise&rdquo; for two years. <span className="italic text-gray-400">Same playbook they&rsquo;d already been running. The identity running it is what changed.</span>
        </p>
        <p className="pt-2">
          That&rsquo;s what this page is about &mdash; the exact protocol we used on ourselves, then refined with clients, that turns &ldquo;why is this so hard for me?&rdquo; into{' '}
          <span className="text-amber-200 font-semibold">&ldquo;why didn&rsquo;t I do this years ago?&rdquo;</span>
        </p>
      </div>
    </section>
  );
};

'use client';

import React from 'react';

export const MindshiftWhyMindsetFailsSection: React.FC = () => {
  return (
    <section className="py-16">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6 text-center">The Operating System</p>
      <h2 className="text-3xl md:text-5xl font-black mb-12 leading-[1.15] text-center">
        Mindset alone doesn&rsquo;t <span className="bg-gradient-to-r from-amber-200 to-amber-300 bg-clip-text text-transparent">rewire</span> you.
      </h2>

      <div className="space-y-6 text-lg text-gray-300 leading-relaxed font-light max-w-3xl mx-auto">
        <p>
          Mindset work lives in the conscious mind. The block lives in the subconscious. Two different floors of the same building &mdash; and most personal-development content is busy scrubbing the wrong one.
        </p>
        <p>It doesn&rsquo;t clear the subconscious programs that quietly run the show:</p>
        <ul className="space-y-3 pl-6 border-l border-amber-200/20">
          <li className="text-white">&ldquo;I don&rsquo;t deserve this.&rdquo;</li>
          <li className="text-white">&ldquo;I&rsquo;m not good enough.&rdquo;</li>
          <li className="text-white">&ldquo;People like me don&rsquo;t win like that.&rdquo;</li>
          <li className="text-white">&ldquo;If I get too successful, I&rsquo;ll lose everything.&rdquo;</li>
        </ul>

        <div className="pt-4">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
            <img
              src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2864d1bd661f13c105b371.png"
              alt="Conscious mind vs. subconscious &mdash; why mindset work doesn&rsquo;t clear the block"
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        </div>

        <p className="pt-2">
          You can&rsquo;t out-strategize those beliefs. They&rsquo;re older than the strategy, louder than the strategy, and they get the last vote on every decision your nervous system signs off on. <span className="text-white font-medium">You will sabotage the very thing you&rsquo;ve built &mdash; on schedule, every time.</span>
        </p>
        <p>
          That&rsquo;s why we stopped trying to fix the business. New funnel. New offer. New niche. New positioning. New pricing. Every pivot bought a burst of dopamine &mdash; followed by the same spiral of doubt, the same self-sabotage, the same ceiling.
        </p>
        <p>
          The ceiling wasn&rsquo;t in the offer. It wasn&rsquo;t in the funnel. It wasn&rsquo;t in the niche. <span className="text-white font-medium">It was in the operator running all three.</span>
        </p>
        <p className="text-2xl md:text-3xl font-bold text-white pt-4 text-center">
          Until we stopped optimizing the output &mdash;{' '}
          <span className="text-amber-200">and looked at the operating system.</span>
        </p>
      </div>
    </section>
  );
};

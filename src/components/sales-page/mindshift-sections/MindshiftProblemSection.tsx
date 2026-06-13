'use client';

import React from 'react';
import { PROBLEMS } from './constants';

export const MindshiftProblemSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">The Hidden Cost</p>
        <h2 className="text-3xl md:text-5xl font-black leading-[1.15] mb-6">
          Sound familiar?
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          These aren&rsquo;t personality flaws. They&rsquo;re symptoms of a subconscious operating system that learned &mdash; long before you started a business &mdash; that visibility, money, and being seen come at a price.
        </p>
      </div>

      <div className="mb-12 max-w-3xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
          <img
            src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a28682fbd661f13c106007c.png"
            alt="Subconscious symptoms &mdash; the patterns that show up before you notice them"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </div>

      <ul className="space-y-4 mb-12">
        {PROBLEMS.map((p, i) => (
          <li
            key={i}
            className="group flex items-start gap-4 bg-white/[0.02] border border-white/10 hover:border-amber-200/30 rounded-xl px-6 py-5 transition-colors"
          >
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-200 mt-3 group-hover:shadow-[0_0_10px_rgba(251,191,36,0.5)] transition-shadow" />
            <span className="text-lg text-gray-200">{p}</span>
          </li>
        ))}
      </ul>

      <p className="text-center text-xl md:text-2xl text-gray-400 italic">
        You tell yourself you&rsquo;re just &ldquo;working on your mindset.&rdquo;
        <br className="hidden md:block" />
        <span className="text-white font-medium not-italic"> But your body doesn&rsquo;t believe a word of it.</span>
      </p>
    </section>
  );
};

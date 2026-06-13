'use client';

import React from 'react';
import { Quote } from 'lucide-react';
import { TESTIMONIALS } from './constants';

export const MindshiftCaseStudySection: React.FC = () => {
  const supporting = TESTIMONIALS.filter((t) => !t.real);

  return (
    <section className="py-20">
      <div className="relative bg-gradient-to-br from-amber-200/[0.04] to-transparent border border-amber-200/20 rounded-3xl p-8 md:p-14 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/[0.05] blur-3xl rounded-full pointer-events-none" />
        <Quote className="w-12 h-12 text-amber-200/40 mb-6" />
        <blockquote className="relative z-10">
          <p className="text-2xl md:text-4xl font-bold text-white leading-tight mb-8">
            She didn&rsquo;t change her offer.
            <br />
            <span className="text-amber-200">She ran The Subconscious Reset Method&trade;.</span>
            <br />
            And had the <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">biggest cash week of her career</span> &mdash;
            without a single new tactic.
          </p>
          <footer className="flex items-center gap-4 pt-6 border-t border-white/10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200/20 to-amber-200/5 border border-amber-200/30 flex items-center justify-center text-amber-200 font-black text-lg">
              M
            </div>
            <div>
              <p className="font-bold text-white">Marleen</p>
              <p className="text-sm text-gray-400">Coach &middot; individual client result &mdash; not typical, results vary</p>
            </div>
          </footer>
        </blockquote>
      </div>

      {/* Supporting testimonials (placeholder set — see MILLIONAIRE_MINDSHIFT_FUNNEL.md §10) */}
      <div className="grid md:grid-cols-2 gap-5 mt-10">
        {supporting.map((t, i) => (
          <div
            key={i}
            className="relative bg-white/[0.02] border border-white/10 rounded-2xl p-7 hover:border-amber-200/20 transition-colors"
          >
            {/* TODO: replace with real Mindshift testimonial before paid traffic */}
            <Quote className="w-6 h-6 text-amber-200/30 mb-4" />
            <p className="text-gray-300 leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
              <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-200/80 font-bold text-sm">
                {t.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

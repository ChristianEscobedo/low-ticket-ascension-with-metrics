'use client';

import React from 'react';
import { MODULES, BONUSES, TESTIMONIALS } from './constants';

export const MindshiftContentSidebar: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Gold accent bar */}
      <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-300 rounded-full" />

      {/* Section 1: What's Inside the Mini Course */}
      <div className="bg-white/[0.03] border-2 border-amber-200/30 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.08)]">
        <div className="bg-gradient-to-r from-amber-200 to-amber-300 px-5 py-4">
          <h3 className="text-black font-black text-lg text-center leading-tight">
            What&rsquo;s Inside the Mini Course
          </h3>
        </div>
        <div className="p-5 space-y-5">
          {MODULES.map((m) => (
            <div key={m.number} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <h4 className="font-bold text-white text-sm mb-1 underline decoration-amber-200/30 underline-offset-2">
                MODULE {m.number}: {m.title.toUpperCase()}
              </h4>
              <p className="text-gray-400 text-xs leading-relaxed mb-1">
                - {m.description}
              </p>
              <p className="text-amber-200 text-xs font-medium italic">
                All Explained In Module {m.number}
              </p>
            </div>
          ))}
          <p className="text-white font-bold text-sm text-center pt-2">
            ~90 minutes total &middot; The protocol takes 5&ndash;10 min.
          </p>
        </div>
      </div>

      {/* Section 2: Included Bonuses */}
      <div className="bg-white/[0.03] border-2 border-amber-200/30 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.08)]">
        <div className="bg-gradient-to-r from-amber-200 to-amber-300 px-5 py-4">
          <h3 className="text-black font-black text-lg text-center leading-tight">
            Included Bonuses
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {BONUSES.map((bonus) => (
            <div key={bonus.number} className="flex gap-3 items-start">
              <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-amber-200/20 to-amber-300/10 border border-amber-200/20 flex items-center justify-center text-amber-200 text-lg font-bold">
                {bonus.number}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-xs leading-tight mb-0.5">
                  {bonus.number}&ndash; {bonus.title}
                </h4>
                <p className="text-gray-400 text-[11px] leading-snug">
                  {bonus.description}
                </p>
                <p className="text-amber-200/80 text-[11px] font-bold mt-1">
                  Value: {bonus.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Testimonials */}
      <div className="bg-white/[0.03] border-2 border-amber-200/30 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.08)]">
        <div className="bg-gradient-to-r from-amber-200 to-amber-300 px-5 py-4">
          <h3 className="text-black font-black text-lg text-center leading-tight">
            What Others Are Saying
          </h3>
        </div>
        <div className="p-5 space-y-4">
          {TESTIMONIALS.map((testimonial, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="text-white text-xs font-bold">{testimonial.name}</div>
                  <div className="text-gray-500 text-[10px]">{testimonial.role}</div>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-amber-200 text-[10px]">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-300 text-[11px] leading-snug italic">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

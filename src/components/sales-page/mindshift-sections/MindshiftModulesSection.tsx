'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { MODULES } from './constants';

export const MindshiftModulesSection: React.FC = () => {
  return (
    <section className="py-20">
      <div className="text-center mb-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">Inside The Mini Course</p>
        <h2 className="text-3xl md:text-5xl font-black leading-[1.15]">
          Five modules. <span className="text-amber-200">One identity rewire.</span>
        </h2>
        <p className="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
          ~90 minutes of video. The protocol itself takes 5&ndash;10 minutes once you&rsquo;ve learned it.
        </p>
      </div>

      <div className="space-y-3 max-w-5xl mx-auto">
        {MODULES.map((m) => (
          <div
            key={m.number}
            className="group flex items-start gap-6 bg-white/[0.02] border border-white/10 hover:border-amber-200/30 rounded-2xl px-6 md:px-8 py-6 transition-colors"
          >
            <div className="flex-shrink-0 w-14 h-14 rounded-xl border border-amber-200/30 bg-gradient-to-br from-amber-200/10 to-transparent flex items-center justify-center">
              <span className="text-xl font-black text-amber-200 tabular-nums">{String(m.number).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-white mb-1.5">{m.title}</h3>
              <p className="text-gray-400 leading-relaxed">{m.description}</p>
            </div>
            <CheckCircle className="hidden md:block flex-shrink-0 w-5 h-5 text-amber-200/40 group-hover:text-amber-200 transition-colors mt-2" />
          </div>
        ))}
      </div>
    </section>
  );
};

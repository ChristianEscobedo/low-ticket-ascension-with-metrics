'use client';

import React from 'react';
import { BELIEFS } from './constants';

export const MindshiftBeliefRevealSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">The Real Ceiling</p>
        <h2 className="text-3xl md:text-5xl font-black leading-[1.15] mb-6">
          You don&rsquo;t rise to the level of your goals.{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
            You rise &mdash; or fall &mdash; to the level of your identity.
          </span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Every entrepreneur stuck at a ceiling has two belief sets running in parallel &mdash; the one they&rsquo;d say out loud, and the one their body is actually voting with. Here&rsquo;s the split most never get to see.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 mb-10">
        <div className="bg-black p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-6">What you tell yourself</p>
          <ul className="space-y-4">
            {BELIEFS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-300">
                <span className="text-amber-200/60 font-bold mt-0.5">✓</span>
                <span>{b.conscious}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-black p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200 mb-6">What&rsquo;s actually running</p>
          <ul className="space-y-4">
            {BELIEFS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-white font-medium">
                <span className="text-red-400/70 font-bold mt-0.5">✗</span>
                <span>{b.subconscious}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-center text-lg text-gray-400 italic leading-relaxed">
        These beliefs weren&rsquo;t born from logic. They were wired into your system when you were too young to choose.
        Passed down in glances, comments, dynamics, trauma, silence.
      </p>
    </section>
  );
};

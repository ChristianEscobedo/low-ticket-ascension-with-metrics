'use client';

import React from 'react';
import { METHOD_STEPS } from './constants';

export const MindshiftSolutionSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">The Method</p>
        <h2 className="text-3xl md:text-5xl font-black leading-[1.15] mb-6">
          Here&rsquo;s how{' '}
          <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
            Millionaire Mindshift
          </span>{' '}
          actually works
        </h2>
        <p className="text-lg text-gray-400">
          Not journaling. Not vision boarding. Not hoping your inner child suddenly feels safe.
          <span className="text-white"> Clean rewiring at the level where it actually counts.</span>
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-5 text-lg text-gray-300 leading-relaxed mb-12">
        <p>
          The protocol runs on a four-step loop &mdash;{' '}
          <span className="text-white font-semibold">Surface &rarr; Test &rarr; Clear &rarr; Install</span>{' '}
          &mdash; the same sequence trained therapists use to dismantle subconscious blocks, stripped of the jargon and re-engineered for entrepreneurs running real businesses.
        </p>
        <p>
          You <span className="text-white font-semibold">surface</span> the belief that&rsquo;s gating the next level. You <span className="text-white font-semibold">test</span> it on the body so you know it&rsquo;s actually there &mdash; not a story you&rsquo;re telling yourself. You <span className="text-white font-semibold">clear</span> the charge until the body stops bracing. Then you <span className="text-white font-semibold">install</span> the replacement pattern the same way.
        </p>
        <p>
          One pass takes <span className="text-amber-200 font-semibold">five to ten minutes</span>. The shift is felt, not imagined. And once you&rsquo;ve run it on the first block, you have a repeatable tool for every ceiling that comes after it.
        </p>
      </div>

      <div className="mb-12">
        <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 bg-white/[0.02] shadow-[0_0_30px_rgba(251,191,36,0.06)]">
          <img
            src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a2843b12f56d3ac846452a4.png"
            alt="The four-step Subconscious Reset loop &mdash; Surface, Test, Clear, Install"
            className="w-full h-auto block"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {METHOD_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="group relative bg-white/[0.02] border border-white/10 hover:border-amber-200/30 rounded-2xl p-7 transition-all duration-300 hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-200/15 to-amber-200/5 border border-amber-200/30 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-shadow">
                    <Icon className="w-5 h-5 text-amber-200" />
                  </div>
                  <div className="text-center mt-3 text-xs font-bold text-amber-200/60 tracking-[0.2em] uppercase">
                    Step {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-black text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xl md:text-2xl text-gray-300 italic mt-12">
        It&rsquo;s not about becoming confident.
        <br />
        <span className="text-white font-bold not-italic">It&rsquo;s about becoming <span className="text-amber-200">congruent</span>.</span>
      </p>
    </section>
  );
};

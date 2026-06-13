'use client';

import React from 'react';
import { Shield } from 'lucide-react';

export const MindshiftGuaranteeSection: React.FC = () => {
  return (
    <section className="relative border-t border-white/5 bg-gradient-to-b from-black via-gray-950/40 to-black">
      <div className="max-w-3xl mx-auto px-4 py-24">
        <div className="relative bg-white/[0.02] border border-amber-200/20 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-200/[0.06] blur-3xl rounded-full" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-200/20 to-amber-200/5 border border-amber-200/40 mb-6">
              <Shield className="w-7 h-7 text-amber-200" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-4">14-Day Promise</p>
            <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
              The <span className="text-amber-200">&ldquo;Feel the Shift&rdquo;</span> Guarantee
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed max-w-xl mx-auto mb-4">
              Do the muscle-testing protocol once. If you don&rsquo;t <em>physically feel</em> a shift in the belief you cleared within 14 days,
              email us and we&rsquo;ll refund every cent.
            </p>
            <p className="text-base text-gray-500 italic">
              No &ldquo;watch the whole thing first&rdquo; hoops. No questions.
              <br />
              <span className="text-white not-italic font-medium">The work either lands in your body &mdash; or you don&rsquo;t pay for it.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

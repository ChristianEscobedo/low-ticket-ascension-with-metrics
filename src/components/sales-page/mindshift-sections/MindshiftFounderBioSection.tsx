'use client';

import React from 'react';
import { Briefcase, Compass, Code2, Users } from 'lucide-react';

interface CredItem {
  icon: typeof Briefcase;
  title: string;
  body: string;
}

const CREDS: CredItem[] = [
  {
    icon: Briefcase,
    title: 'A decade running real businesses through the same ceiling',
    body: 'Husband-and-wife operators \u2014 we spent most of a decade scaling a high-ticket coaching practice, working with hundreds of clients between $3K and $35K, and hitting the exact subconscious ceiling this protocol was built to clear.',
  },
  {
    icon: Compass,
    title: '18 months stress-testing the protocol on ourselves',
    body: 'Before running it with a single client, we ran the Surface \u2192 Test \u2192 Clear \u2192 Install protocol on every income belief we could surface in our own bodies \u2014 inherited money beliefs, success-as-target, the upper-limit wave after every good month.',
  },
  {
    icon: Users,
    title: 'Now we run it with high-performing founders, coaches, and consultants',
    body: 'The Subconscious Reset Method\u2122 has since been run with hundreds of operators \u2014 from first-six-figure coaches to mid-seven-figure agency owners \u2014 all working the same wiring underneath the strategy they already had.',
  },
  {
    icon: Code2,
    title: 'Mass.New \u2014 the SaaS portfolio that proves the rewire',
    body: 'After clearing our own ceiling, we replaced the coaching business with a portfolio of simple SaaS products. The income held \u2014 because the identity underneath held first. That\u2019s the entire point of this work.',
  },
];

export const MindshiftFounderBioSection: React.FC = () => {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="rounded-3xl border-2 border-amber-200/30 bg-white/[0.03] shadow-[0_0_30px_rgba(251,191,36,0.08)] overflow-hidden">
          {/* Header */}
          <div className="px-8 md:px-12 pt-10 pb-8 border-b border-white/10 bg-gradient-to-br from-amber-200/[0.04] to-transparent">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-7">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-4 border-amber-200/30 shadow-lg flex-shrink-0">
                <img
                  src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a28596dbb09e3b139a0ed3f.jpg"
                  alt="Christian &amp; Amber Escobedo &mdash; Co-creators of the Subconscious Reset Method"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center md:text-left flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-3">Who&rsquo;s teaching this</p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-3">
                  Meet{' '}
                  <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
                    Christian &amp; Amber Escobedo
                  </span>
                </h2>
                <p className="text-base md:text-lg text-gray-300 leading-relaxed">
                  Husband-and-wife operators. Behind Mass.New. Co-creators of <span className="text-amber-200 font-semibold">The Subconscious Reset Method&trade;</span> &mdash; the 4-step protocol we built to clear our own income ceiling, then refined with hundreds of high-performing founders, coaches, and consultants.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
                <img
                  src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a284b2fbcef8d4f9fa2d451.png"
                  alt="Christian &amp; Amber Escobedo &mdash; co-creators of The Subconscious Reset Method"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Credibility grid */}
          <div className="px-8 md:px-12 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {CREDS.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.title}
                    className="group bg-white/[0.02] border border-white/10 hover:border-amber-200/30 rounded-2xl p-6 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-200/15 to-amber-200/5 border border-amber-200/30 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(251,191,36,0.18)] transition-shadow">
                        <Icon className="w-5 h-5 text-amber-200" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-black text-white leading-snug mb-1.5">{c.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Closing line */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-base md:text-lg text-gray-300 italic leading-relaxed text-center max-w-3xl mx-auto">
                &ldquo;We&rsquo;re not teaching this from theory. We built this protocol because we needed it &mdash; and we&rsquo;re only handing it to you because it&rsquo;s the same wiring that let us let go of the coaching business our bodies had outgrown, and build the next one without panicking.&rdquo;
              </p>
              <p className="text-sm text-amber-200/80 text-center mt-3 tracking-wide">&mdash; Christian &amp; Amber Escobedo</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

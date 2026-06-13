'use client';

import React from 'react';

const STUCK_BELIEFS: Array<{ belief: string; shows_up: string }> = [
  {
    belief: '&ldquo;If I charge that, they&rsquo;ll leave.&rdquo;',
    shows_up: 'Dropping the price 30 seconds before saying it out loud. Discounting unprompted. Stacking bonuses to justify the number.',
  },
  {
    belief: '&ldquo;If I get too big, I&rsquo;ll be exposed.&rdquo;',
    shows_up: 'Shipping the post, then deleting it. Missing the launch window. Going quiet for a month after a win.',
  },
  {
    belief: '&ldquo;I haven&rsquo;t earned this yet.&rdquo;',
    shows_up: 'Over-delivering on every offer. Refusing referrals. Quietly under-charging the clients you respect most.',
  },
  {
    belief: '&ldquo;If I keep it, I&rsquo;ll lose it.&rdquo;',
    shows_up: 'The post-launch collapse. The self-sabotage 72 hours after the best week of your business. The unexplained spending spike right after a big deposit.',
  },
];

export const MindshiftOldVsNewSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/70 mb-6">Why You&rsquo;re Still Stuck</p>
        <h2 className="text-3xl md:text-5xl font-black leading-[1.15]">
          The beliefs that keep you stuck &mdash;{' '}
          <span className="bg-gradient-to-r from-amber-200 to-amber-300 bg-clip-text text-transparent">no matter what you do</span>.
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mt-6">
          You can swap every variable in the business. The ceiling stays exactly where the belief is.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6 text-lg text-gray-300 leading-relaxed">
        <p>
          You changed the offer. The ceiling held. You changed the funnel. The ceiling held. You hired the coach, read the book, ran the launch, took the retreat. <span className="text-white font-semibold">The ceiling held.</span>
        </p>
        <p>
          That&rsquo;s because none of those changes touched the layer where the ceiling actually lives. Underneath the strategy is a small set of beliefs that survive every external move you make &mdash; and they don&rsquo;t surface as thoughts. <span className="text-white font-medium">They surface as behavior.</span> The quiet decisions your nervous system makes for you, before you ever notice.
        </p>

        <div className="grid grid-cols-1 gap-4 my-8">
          {STUCK_BELIEFS.map((b, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.02] hover:border-amber-200/30 transition-colors p-6"
            >
              <p
                className="text-lg md:text-xl text-white font-semibold mb-2"
                dangerouslySetInnerHTML={{ __html: b.belief }}
              />
              <p className="text-base text-gray-400 leading-relaxed">
                <span className="text-amber-200/80 font-semibold uppercase tracking-wider text-xs mr-2">Shows up as:</span>
                {b.shows_up}
              </p>
            </div>
          ))}
        </div>

        <p>
          None of those behaviors are character flaws. They&rsquo;re the body voting on a belief it formed long before you started the business &mdash; and the body votes <span className="text-white font-medium">louder than the strategy, every single time</span>.
        </p>
        <p>
          That&rsquo;s why the smartest tactic in the world can&rsquo;t outrun a nervous system that&rsquo;s voting against it. You can read every book on the shelf. <span className="text-white font-medium">The beliefs don&rsquo;t move because the beliefs aren&rsquo;t in the book &mdash; they&rsquo;re in the body.</span>
        </p>
        <p className="text-center text-xl md:text-2xl text-white font-bold pt-4 leading-snug">
          That&rsquo;s the ceiling.
          <span className="block mt-2 text-amber-200">That&rsquo;s what we&rsquo;re clearing.</span>
        </p>

        <div className="mt-10">
          <div className="relative rounded-2xl overflow-hidden border border-amber-200/20 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
            <img
              src="https://assets.cdn.filesafe.space/FnedsjhvL9EqG9Eyjhep/media/6a286a767fc0b68efc553403.png"
              alt="The beliefs underneath the strategy &mdash; what keeps the ceiling in place no matter what you change"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

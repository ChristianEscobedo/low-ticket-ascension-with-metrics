import React from 'react';
import { X, Check } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';

// Narrative blocks live inside the left rail of the two-column sales letter, so
// they no longer center themselves. The orchestrator owns width and gutters.
const Block: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <section className={`scroll-mt-24 ${className}`}>{children}</section>;

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
    {children}
  </h2>
);

export const ProblemSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>{offer.problem.heading}</Heading>
    <p className="mt-6 text-xl leading-relaxed text-ink/70">{offer.problem.intro}</p>
    {offer.problem.scene && (
      <p className="mt-8 border-l-2 border-mode/40 pl-5 font-display text-2xl leading-relaxed text-ink">
        {offer.problem.scene}
      </p>
    )}
    <ul className="mt-8 space-y-4">
      {offer.problem.points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-ink/80">
          <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mode" />
          <span className="text-xl leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>
    {offer.problem.cost && (
      <p className="mt-8 text-xl leading-relaxed text-ink/80">{offer.problem.cost}</p>
    )}
  </Block>
);

/** "Why we built this." The origin beat: the reason the thing exists, told
 *  before the thing itself, in the brand's confidante register. */
export const OriginSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  if (!offer.origin) return null;
  return (
    <Block>
      <div className="text-sm uppercase tracking-[0.2em] text-mode">
        {offer.origin.eyebrow}
      </div>
      <div className="mt-3">
        <Heading>{offer.origin.heading}</Heading>
      </div>
      <div className="mt-6 space-y-5">
        {offer.origin.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </div>
    </Block>
  );
};

/** The unique mechanism: why it works when the usual fixes do not. The
 *  centerpiece of the letter, framed as a named principle plus the loop. */
export const MechanismSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const m = offer.mechanism;
  if (!m) return null;
  return (
    <Block className="rounded-2xl border border-mode/25 bg-mode/[0.05] p-7 sm:p-9">
      <div className="text-sm uppercase tracking-[0.2em] text-mode">{m.eyebrow}</div>
      <div className="mt-3">
        <Heading>{m.heading}</Heading>
      </div>
      <p className="mt-6 font-display text-2xl leading-relaxed text-ink">{m.label}</p>
      <div className="mt-5 space-y-5">
        {m.paragraphs.map((p, i) => (
          <p key={i} className="text-xl leading-relaxed text-ink/70">
            {p}
          </p>
        ))}
      </div>
      {m.points && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {m.points.map((pt) => (
            <div
              key={pt.title}
              className="rounded-xl border border-mode/15 bg-bone/70 p-5"
            >
              <div className="font-display text-lg text-mode">{pt.title}</div>
              <p className="mt-1.5 text-base leading-relaxed text-ink/70">
                {pt.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </Block>
  );
};

export const WhatIsSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
    <Heading>{offer.whatIs.heading}</Heading>
    <div className="mt-6 space-y-5">
      {offer.whatIs.paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? 'font-display text-2xl leading-relaxed text-ink'
              : 'text-xl leading-relaxed text-ink/70'
          }
        >
          {p}
        </p>
      ))}
    </div>
  </Block>
);

export const OldVsNewSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => (
  <Block>
    <Heading>There is the way it has been. And there is this.</Heading>
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      <div className="rounded-2xl border border-ink/10 bg-bone p-6">
        <div className="text-sm uppercase tracking-[0.2em] text-ink/40">
          {offer.oldWay.heading}
        </div>
        <ul className="mt-5 space-y-3.5">
          {offer.oldWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/55">
              <X className="mt-1 h-5 w-5 flex-shrink-0 text-mushroom" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-mode/25 bg-mode/[0.04] p-6">
        <div className="text-sm uppercase tracking-[0.2em] text-mode">
          {offer.newWay.heading}
        </div>
        <ul className="mt-5 space-y-3.5">
          {offer.newWay.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-ink/80">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-mode" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Block>
);

export const MethodSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const { steps } = offer.method;
  return (
    <Block className="rounded-2xl border border-ink/10 bg-white/55 p-7 sm:p-9">
      <Heading>{offer.method.heading}</Heading>
      {offer.method.subheading && (
        <p className="mt-6 text-xl leading-relaxed text-ink/70">
          {offer.method.subheading}
        </p>
      )}
      <div className="mt-10 space-y-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.number} className="relative flex items-start gap-5 pb-10 last:pb-0">
              {/* Connecting spine between steps. */}
              {!isLast && (
                <span className="pointer-events-none absolute left-[27px] top-14 bottom-0 w-px bg-mode/15" />
              )}
              <div className="flex flex-shrink-0 flex-col items-center gap-2">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-mode/20 bg-bone">
                  <Icon className="h-5 w-5 text-mode" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-mode font-display text-xs text-bone">
                    {step.number}
                  </span>
                </span>
              </div>
              <div className="flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="font-display text-2xl text-ink">{step.title}</h3>
                  {step.meta && (
                    <span className="inline-flex items-center rounded-full border border-brass/30 bg-brass/[0.07] px-3 py-0.5 text-sm font-medium text-brass">
                      {step.meta}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-lg leading-relaxed text-ink/65">
                  {step.description}
                </p>
                {step.shift && (
                  <p className="mt-3 border-l-2 border-mode/40 pl-4 text-lg italic leading-relaxed text-mode">
                    {step.shift}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {offer.method.closer && (
        <p className="mt-8 border-t border-ink/10 pt-8 font-display text-2xl leading-relaxed text-ink">
          {offer.method.closer}
        </p>
      )}
    </Block>
  );
};

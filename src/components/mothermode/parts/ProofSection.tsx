import React from 'react';
import { PenLine } from 'lucide-react';
import type { MotherModeOffer } from '@/lib/mothermode/types';
import { BRAND, FOUNDER } from '@/lib/mothermode/brand';
import { MediaFrame } from './MediaFrame';

/** A round headshot, or a monogram fallback when no avatar is supplied. */
const Avatar: React.FC<{ name: string; src?: string }> = ({ name, src }) =>
  src ? (
    <img
      src={src}
      alt={name}
      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mode/10 font-display text-base text-mode">
      {name.charAt(0)}
    </span>
  );

export const ProofSection: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  if (offer.proof.length === 0) return null;
  return (
    <section className="border-t border-ink/10 bg-white/40">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <h2 className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Mothers who put some of it down.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {offer.proof.map((p) => (
            <figure
              key={p.name}
              className="flex flex-col rounded-2xl border border-ink/10 bg-bone p-6"
            >
              <blockquote className="flex-1 text-ink/75">
                <p className="text-lg leading-relaxed">{p.quote}</p>
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
                <Avatar name={p.name} src={p.avatar} />
                <div>
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-sm text-ink/45">{p.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * The founder sales letter. The personal, long-form close. Reads from the
 * offer's `founderLetter` block and falls back to the shared FOUNDER.bio so
 * every offer renders something. Portrait pulls from the offer media slot.
 */
export const FounderLetter: React.FC<{ offer: MotherModeOffer }> = ({ offer }) => {
  const letter = offer.founderLetter;
  const eyebrow = letter?.eyebrow ?? 'A letter from the founder';
  const heading = letter?.heading;
  const paragraphs = letter?.paragraphs ?? [...FOUNDER.bio];
  const signoff = letter?.signoff ?? 'With you in it,';

  return (
    <section className="border-t border-ink/10 bg-white/40">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
          <div className="lg:w-[320px] lg:flex-shrink-0">
            <MediaFrame
              src={offer.media?.founderPhoto}
              alt={FOUNDER.name}
              label="Founder portrait"
              hint="900 × 1100"
              aspect="aspect-[4/5]"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2.5 text-sm uppercase tracking-[0.2em] text-mode">
              <PenLine className="h-4 w-4" />
              {eyebrow}
            </div>
            {heading && (
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                {heading}
              </h2>
            )}
            {letter?.greeting && (
              <p className="mt-6 font-display text-2xl leading-relaxed text-mode">
                {letter.greeting}
              </p>
            )}
            <div className="mt-6 space-y-5">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-xl leading-relaxed text-ink/75">
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-9">
              <p className="text-xl text-ink/70">{signoff}</p>
              <div className="mt-2 font-display text-3xl text-ink">{FOUNDER.name}</div>
              <div className="text-base text-ink/45">{FOUNDER.role}</div>
              <p className="mt-4 font-display text-lg italic text-mode">
                {BRAND.generationalLine}
              </p>
            </div>

            {letter?.ps && (
              <p className="mt-9 border-l-2 border-brass/50 bg-brass/[0.05] py-4 pl-5 pr-4 text-lg leading-relaxed text-ink/80">
                {letter.ps}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

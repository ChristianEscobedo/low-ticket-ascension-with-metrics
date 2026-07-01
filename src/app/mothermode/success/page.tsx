'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Mail, ArrowRight } from 'lucide-react';
import { getOffer } from '@/lib/mothermode/offers';
import { ROUTES } from '@/lib/mothermode/brand';
import { readPurchases, type MotherModePurchases } from '@/lib/mothermode/purchases';

/**
 * Post-purchase delivery for the MotherMode funnel. Reads the recorded
 * purchases (front-end pack, bumps, and any OTOs taken) from localStorage,
 * confirms access, and lists everything she now has.
 */
function SuccessContent() {
  const [purchases, setPurchases] = useState<MotherModePurchases | null>(null);

  useEffect(() => {
    setPurchases(readPurchases());
  }, []);

  const offer = getOffer(purchases?.feSlug ?? '');
  const email = purchases?.email;
  const bumpIds = purchases?.bumps ?? [];
  const bumps = offer?.bumps.filter((b) => bumpIds.includes(b.id)) ?? [];

  const ascension = [
    purchases?.os && {
      title: 'The MotherMode OS',
      body:
        purchases.osInterval === 'annual'
          ? 'Your founding year is active. Open the OS, tell it about your kids once, and it starts planning the meals, routines, and grocery list with you.'
          : 'Your founding membership is active. Open the OS, tell it about your kids once, and it starts planning the meals, routines, and grocery list with you.',
    },
    purchases?.vault && {
      title: 'The Redesign Vault',
      body: 'Every system, downloaded and yours to keep. New packs land here automatically.',
    },
    purchases?.coaching && {
      title: 'Your coaching year',
      body: 'Your founding coaching seat is held. We will email your call schedule and the link to your private circle.',
    },
  ].filter(Boolean) as { title: string; body: string }[];

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="border-b border-ink/10 py-5 text-center">
        <span className="font-display text-lg tracking-[0.2em] text-mode">
          MOTHERMODE
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-mode">
          <Check className="h-8 w-8 text-bone" />
        </div>
        <h1 className="font-display text-4xl text-ink sm:text-5xl">
          You are in.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/70">
          You just did the thing most mothers keep putting off.{' '}
          {offer ? `${offer.name} is yours. ` : 'Your order is confirmed. '}
          Your access link is on its way
          {email ? (
            <>
              {' '}to <span className="font-medium text-ink">{email}</span>
            </>
          ) : null}
          .
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-mode/20 bg-mode/[0.04] px-4 py-2 text-sm text-mode">
          <Mail className="h-4 w-4" />
          <span>
            Check your inbox for your login. If it is not there in a minute,
            check spam.
          </span>
        </div>

        {offer && (
          <div className="mt-10 rounded-2xl border border-ink/10 bg-white/70 p-6 text-left shadow-sm sm:p-8">
            <h2 className="mb-4 font-display text-xl text-ink">
              What is now yours
            </h2>
            <ul className="space-y-2.5">
              {offer.inside.items.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-2.5 text-ink/75"
                >
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-mode" />
                  <span>{item.title}</span>
                </li>
              ))}
              {bumps.map((bump) => (
                <li
                  key={bump.id}
                  className="flex items-start gap-2.5 text-ink/75"
                >
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-brass" />
                  <span>{bump.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ascension.length > 0 && (
          <div className="mt-6 space-y-3 text-left">
            {ascension.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl border border-brass/30 bg-mode/[0.04] p-5"
              >
                <Check className="mt-1 h-5 w-5 flex-shrink-0 text-brass" />
                <div>
                  <h3 className="font-display text-lg text-ink">{item.title}</h3>
                  <p className="mt-0.5 leading-relaxed text-ink/70">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!purchases?.os && (
          <div className="mt-8 rounded-2xl border border-brass/30 bg-mode p-6 text-left text-bone sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-bone/60">
              What comes next
            </p>
            <h2 className="mt-2 font-display text-2xl">
              This is the first room of the redesign.
            </h2>
            <p className="mt-2 leading-relaxed text-bone/80">
              Use the pack this weekend. When you are ready for the full system,
              the MotherMode OS is where the whole house gets rebuilt, one room at
              a time.
            </p>
          </div>
        )}

        <Link
          href={ROUTES.offerBase + '/brain-dump-system'}
          className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-mode transition-colors hover:text-mode-deep"
        >
          <span>Browse the rest of the library</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function MotherModeSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone" />}>
      <SuccessContent />
    </Suspense>
  );
}

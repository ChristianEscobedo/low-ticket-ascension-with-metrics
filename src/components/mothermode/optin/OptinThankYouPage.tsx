'use client';

import React from 'react';
import Link from 'next/link';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';
import { OptinWordmark } from './Wordmark';
import {
  Editable,
  InlineEditPopup,
  OptinEditToolbar,
  useOptinInlineEdit,
} from './inlineEdit';
import { OptinFooter } from './OptinFooter';


interface Props {
  funnel: OptinFunnelRecord;
  isAdmin?: boolean;
}

function resolveCtaHref(funnel: OptinFunnelRecord): string {
  const t = funnel.thankyou;
  if (t.ctaHref?.trim()) return t.ctaHref.trim();
  if (funnel.offerSlug) return `/mothermode/${funnel.offerSlug}`;
  if (funnel.deliverableSlug && funnel.deliverableKey) {
    return `/mothermode/resource/${funnel.deliverableSlug}/${funnel.deliverableKey}`;
  }
  return '/mothermode';
}

/** MotherMode thank-you (step 3). Admins get on-page inline edit. */
export default function OptinThankYouPage({ funnel, isAdmin = false }: Props) {
  const edit = useOptinInlineEdit(funnel, 'thankyou', isAdmin);
  const t = edit.draft.thankyou;
  const href = resolveCtaHref(edit.draft);

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-12 text-center sm:pt-16">
        <OptinWordmark />

        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mode/10 text-2xl text-mode">
          ✓
        </div>

        <Editable edit={edit} field="headline" as="h1" className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
          {t.headline || 'You are in.'}
        </Editable>
        {t.subheadline && (
          <Editable edit={edit} field="subheadline" multiline className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            {t.subheadline}
          </Editable>
        )}

        <div className="mt-10">
          <Link
            href={href}
            className="inline-flex rounded-xl bg-mode px-8 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep"
          >
            {t.ctaText || 'Continue'}
          </Link>
        </div>

        {t.secondaryNote && (
          <Editable edit={edit} field="secondaryNote" multiline className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-ink/45">
            {t.secondaryNote}
          </Editable>
        )}
      </div>

      <OptinFooter footer={edit.draft.footer} edit={edit} />
      <OptinEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
    </div>
  );
}



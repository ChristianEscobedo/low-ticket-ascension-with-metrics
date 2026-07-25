'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { OptinFunnelRecord } from '@/lib/mothermode/optin/types';
import { OptinWordmark } from './Wordmark';
import {
  Editable,
  EditableList,
  InlineEditPopup,
  OptinEditToolbar,
  useOptinInlineEdit,
} from './inlineEdit';
import { OptinFooter } from './OptinFooter';
import { MediaBlock } from './MediaBlock';


interface Props {
  funnel: OptinFunnelRecord;
  isAdmin?: boolean;
}

/**
 * MotherMode OTO (step 2). Display + CTA link for Phase 1 (no Stripe charge yet).
 * Admins get on-page inline edit.
 */
export default function OptinOtoPage({ funnel, isAdmin = false }: Props) {
  const router = useRouter();
  const edit = useOptinInlineEdit(funnel, 'oto', isAdmin);
  const o = edit.draft.oto;
  const thankYouPath = `/optin/${funnel.slug}/thank-you`;
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, (o.timerMinutes || 0) * 60),
  );

  useEffect(() => {
    if (!o.enabled) {
      router.replace(thankYouPath);
      return;
    }
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [o.enabled, o.timerMinutes, secondsLeft, router, thankYouPath]);

  async function mark(accepted: boolean) {
    if (typeof window === 'undefined') return;
    let leadId = '';
    try {
      leadId = sessionStorage.getItem(`optin_lead_${funnel.slug}`) || '';
    } catch {
      /* ignore */
    }
    if (!leadId) return;
    try {
      await fetch('/api/optin/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'oto', leadId, accepted }),
      });
    } catch {
      /* non-fatal */
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const yesHref = o.yesHref?.trim() || thankYouPath;

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:pt-16">
        <OptinWordmark />

        <div className="mx-auto max-w-2xl text-center">
          {o.eyebrow && (
            <Editable edit={edit} field="eyebrow" className="mb-4 inline-flex items-center rounded-full border border-brass/30 bg-brass/10 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.16em] text-brass">
              {o.eyebrow}
            </Editable>
          )}
          <Editable edit={edit} field="headline" as="h1" className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            {o.headline || 'One more thing'}
          </Editable>
          {o.subheadline && (
            <Editable edit={edit} field="subheadline" multiline className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              {o.subheadline}
            </Editable>
          )}

          {(o.priceLabel || o.originalPriceLabel) && (
            <div className="mt-8 flex items-baseline justify-center gap-3">
              {o.priceLabel && (
                <Editable edit={edit} field="priceLabel" as="span" className="font-display text-4xl font-semibold text-mode">
                  {o.priceLabel}
                </Editable>
              )}
              {o.originalPriceLabel && (
                <Editable edit={edit} field="originalPriceLabel" as="span" className="text-lg text-ink/40 line-through">
                  {o.originalPriceLabel}
                </Editable>
              )}
            </div>
          )}

          {o.timerMinutes > 0 && (
            <div className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-mode/70">
              Offer holds for {mm}:{ss}
            </div>
          )}

          <MediaBlock
            imageUrl={o.imageUrl}
            videoUrl={o.videoUrl}
            alt={o.headline || 'Offer'}
            className="mx-auto mt-8 max-w-md"
          />
        </div>

        {o.bullets.length > 0 && (
          <EditableList
            edit={edit}
            field="bullets"
            className="mx-auto mt-10 max-w-lg space-y-3.5"
            itemClassName="flex items-start gap-3"
            renderItem={(b) => (
              <>
                <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                  <Check className="h-3 w-3 text-mode" />
                </span>
                <span className="text-base leading-relaxed text-ink/80">{b}</span>
              </>
            )}
          />
        )}

        <div className="mx-auto mt-10 flex max-w-md flex-col gap-3">
          <Link
            href={yesHref}
            onClick={() => void mark(true)}
            className="rounded-xl bg-mode px-5 py-3.5 text-center text-base font-semibold text-bone transition-colors hover:bg-modeDeep"
          >
            {o.ctaYes || 'Yes, I want this'}
          </Link>
          <Link
            href={thankYouPath}
            onClick={() => void mark(false)}
            className="rounded-xl border border-ink/15 bg-white/50 px-5 py-3 text-center text-sm font-medium text-ink/60 transition-colors hover:bg-white hover:text-ink"
          >
            {o.ctaNo || 'No thanks, continue'}
          </Link>
        </div>
      </div>

      <OptinFooter footer={edit.draft.footer} edit={edit} />
      <OptinEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
    </div>
  );
}



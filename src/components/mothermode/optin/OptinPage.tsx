'use client';

import React, { useState } from 'react';
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

function readUtm(): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
} {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  return {
    utmSource: sp.get('utm_source') || undefined,
    utmMedium: sp.get('utm_medium') || undefined,
    utmCampaign: sp.get('utm_campaign') || undefined,
    // utm_content is the planner piece id: which post sent them, not just
    // which channel. Read here or the funnel can never attribute a lead.
    utmContent: sp.get('utm_content') || undefined,
  };
}

/**
 * MotherMode optin (step 1). Editorial Warm layout matching the sales hero.
 * Admins get on-page inline edit via the floating toolbar.
 */
export default function OptinPage({ funnel, isAdmin = false }: Props) {
  const router = useRouter();
  const edit = useOptinInlineEdit(funnel, 'optin', isAdmin);
  const c = edit.draft.optin;
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    setBusy(true);
    try {
      const utm = readUtm();
      const res = await fetch('/api/optin/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: funnel.slug,
          email: email.trim(),
          firstName: c.collectName ? firstName.trim() : undefined,
          website: '', // honeypot — leave empty
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
          ...utm,
        }),

      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Something went wrong. Try again.');
      }
      if (typeof window !== 'undefined' && data.leadId) {
        try {
          sessionStorage.setItem(`optin_lead_${funnel.slug}`, data.leadId);
        } catch {
          /* ignore */
        }
      }
      const step = data.redirectTo === 'oto' ? 'oto' : 'thank-you';
      router.push(`/optin/${funnel.slug}/${step}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:pt-16">
        <OptinWordmark />

        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          {/* Copy column */}
          <div className="text-center lg:text-left">
            {c.badgeText && (
              <div className="mb-5 inline-flex items-center rounded-full border border-mode/25 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.16em] text-mode">
                {c.badgeText}
              </div>
            )}
            {c.eyebrow && (
              <Editable edit={edit} field="eyebrow" className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-mode/80">
                {c.eyebrow}
              </Editable>
            )}
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              <Editable edit={edit} field="headline" as="span">{c.headline}</Editable>
              {c.headlineEmphasis ? (
                <>
                  {' '}
                  <Editable edit={edit} field="headlineEmphasis" as="span" className="italic text-mode">
                    {c.headlineEmphasis}
                  </Editable>
                </>
              ) : null}
              {c.headlineSuffix ? (
                <>
                  {' '}
                  <Editable edit={edit} field="headlineSuffix" as="span">
                    {c.headlineSuffix}
                  </Editable>
                </>
              ) : null}
            </h1>
            {c.subheadline && (
              <Editable edit={edit} field="subheadline" multiline className="mt-6 text-lg leading-relaxed text-ink/70 sm:text-xl">
                {c.subheadline}
              </Editable>
            )}
            {c.audience && (
              <Editable edit={edit} field="audience" multiline className="mt-6 border-t border-mode/15 pt-6 font-display text-lg italic leading-relaxed text-mode">
                {c.audience}
              </Editable>
            )}

            {c.benefits.length > 0 && (
              <EditableList
                edit={edit}
                field="benefits"
                className="mt-8 space-y-3.5 text-left"
                itemClassName="flex items-start gap-3"
                renderItem={(b) => (
                  <>
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                      <Check className="h-3 w-3 text-mode" />
                    </span>
                    <span className="text-base leading-relaxed text-ink/80 sm:text-lg">{b}</span>
                  </>
                )}
              />
            )}
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm sm:p-8">
            {(c.magnetTitle || c.magnetDescription) && (
              <div className="mb-6 border-b border-ink/10 pb-5">
                {c.magnetTitle && (
                  <Editable edit={edit} field="magnetTitle" className="font-display text-xl font-semibold text-ink">
                    {c.magnetTitle}
                  </Editable>
                )}
                {c.magnetDescription && (
                  <Editable edit={edit} field="magnetDescription" multiline className="mt-2 text-sm leading-relaxed text-ink/60">
                    {c.magnetDescription}
                  </Editable>
                )}
              </div>
            )}

            <MediaBlock
              imageUrl={c.coverImageUrl}
              videoUrl={c.heroVideoUrl}
              alt={c.magnetTitle || 'Lead magnet'}
              className="mb-6"
            />

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Honeypot — hidden from humans */}
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="optin-website">Website</label>
                <input
                  id="optin-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  defaultValue=""
                />
              </div>
              {c.collectName && (

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/50">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={c.namePlaceholder || 'First name'}
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none focus:ring-2 focus:ring-mode/15"
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/50">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={c.emailPlaceholder || 'you@email.com'}
                  autoComplete="email"
                  className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none focus:ring-2 focus:ring-mode/15"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-mode px-5 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Sending…' : c.ctaText || 'Send it to me'}
              </button>

              {c.privacyNote && (
                <p className="text-center text-xs leading-relaxed text-ink/45">{c.privacyNote}</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <OptinFooter footer={edit.draft.footer} edit={edit} />
      <OptinEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
    </div>
  );
}



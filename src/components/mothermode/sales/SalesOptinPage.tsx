'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { OptinWordmark } from '@/components/mothermode/optin/Wordmark';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';
import { MediaBlock } from '@/components/mothermode/optin/MediaBlock';
import {
  Editable,
  EditableList,
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
} from './inlineEdit';
import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';


interface Props {
  funnel: SalesFunnelRecord;
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

export default function SalesOptinPage({ funnel, isAdmin = false }: Props) {
  const router = useRouter();
  const edit = useSalesInlineEdit(funnel, 'optin', isAdmin);
  const c = edit.draft.optin;
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: 'coverImageUrl' | 'heroVideoUrl';
    label: string;
  }>(null);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (edit.isEditMode) return;
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    setBusy(true);
    try {
      const utm = readUtm();
      const res = await fetch('/api/funnel/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: funnel.slug,
          email: email.trim(),
          firstName: c.collectName ? firstName.trim() : undefined,
          website: '',
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
          sessionStorage.setItem(`sales_lead_${funnel.slug}`, data.leadId);
        } catch {
          /* ignore */
        }
      }
      router.push(`/funnel/${funnel.slug}/sales`);
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
          <div className="text-center lg:text-left">
            {c.badgeText && (
              <Editable
                edit={edit}
                field="badgeText"
                className="mb-5 inline-flex items-center rounded-full border border-mode/25 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.16em] text-mode"
              >
                {c.badgeText}
              </Editable>
            )}
            {c.eyebrow && (
              <Editable
                edit={edit}
                field="eyebrow"
                className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-mode/80"
              >
                {c.eyebrow}
              </Editable>
            )}
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              <Editable edit={edit} field="headline" as="span">
                {c.headline}
              </Editable>
              {c.headlineEmphasis ? (
                <Editable edit={edit} field="headlineEmphasis" as="span" className="italic text-mode">
                  {' '}
                  {c.headlineEmphasis}
                </Editable>
              ) : null}
              {c.headlineSuffix ? (
                <Editable edit={edit} field="headlineSuffix" as="span">
                  {' '}
                  {c.headlineSuffix}
                </Editable>
              ) : null}
            </h1>
            {c.subheadline && (
              <Editable
                edit={edit}
                field="subheadline"
                multiline
                className="mt-6 text-lg leading-relaxed text-ink/70 sm:text-xl"
              >
                {c.subheadline}
              </Editable>
            )}
            {c.audience && (
              <Editable
                edit={edit}
                field="audience"
                multiline
                className="mt-4 text-base leading-relaxed text-ink/60"
              >
                {c.audience}
              </Editable>
            )}
            <EditableList
              edit={edit}
              field="benefits"
              className="mt-8 space-y-3 text-left"
              renderItem={(b) => (
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                    <Check className="h-3 w-3 text-mode" />
                  </span>
                  <span className="text-base leading-relaxed text-ink/80">{b}</span>
                </div>
              )}
            />
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm sm:p-8">
            {(c.coverImageUrl || c.heroVideoUrl || edit.isEditMode) && (
              <div className="relative mb-6 overflow-hidden rounded-xl">
                {c.coverImageUrl || c.heroVideoUrl ? (
                  <MediaBlock
                    imageUrl={c.coverImageUrl}
                    videoUrl={c.heroVideoUrl}
                    alt={c.magnetTitle || c.headline || 'Lead magnet'}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center border border-dashed border-ink/15 bg-bone/40 text-xs text-ink/45">
                    Add cover image or hero video
                  </div>
                )}
                {edit.isEditMode && (
                  <div className="absolute right-2 top-2 z-10 flex flex-wrap gap-1.5">
                    <MediaStudioTrigger
                      kind="image"
                      label="Cover image"
                      onClick={() =>
                        setMediaStudio({
                          kind: 'image',
                          field: 'coverImageUrl',
                          label: 'Cover image',
                        })
                      }
                    />
                    <MediaStudioTrigger
                      kind="video"
                      label="Hero video"
                      onClick={() =>
                        setMediaStudio({
                          kind: 'video',
                          field: 'heroVideoUrl',
                          label: 'Hero video',
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {c.magnetTitle && (
              <Editable
                edit={edit}
                field="magnetTitle"
                className="mb-2 font-display text-xl font-semibold text-ink"
              >
                {c.magnetTitle}
              </Editable>
            )}
            {c.magnetDescription && (
              <Editable
                edit={edit}
                field="magnetDescription"
                multiline
                className="mb-6 text-sm leading-relaxed text-ink/65"
              >
                {c.magnetDescription}
              </Editable>
            )}
            <form onSubmit={onSubmit} className="space-y-3">
              {c.collectName && (
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={c.namePlaceholder || 'First name'}
                  className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder || 'Email address'}
                className="w-full rounded-xl border border-ink/15 bg-bone/40 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-mode/40 focus:outline-none"
              />
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              {error && <div className="text-sm text-red-600">{error}</div>}
              {edit.isEditMode && (
                <div className="grid gap-1.5 text-left text-[11px] text-ink/50">
                  <Editable edit={edit} field="namePlaceholder">
                    Name placeholder: {c.namePlaceholder || 'First name'}
                  </Editable>
                  <Editable edit={edit} field="emailPlaceholder">
                    Email placeholder: {c.emailPlaceholder || 'Email address'}
                  </Editable>
                  <label className="flex items-center gap-2 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={!!c.collectName}
                      onChange={(e) => edit.setField('collectName', e.target.checked)}
                    />
                    Collect first name
                  </label>
                </div>
              )}
              <button
                type="submit"
                disabled={busy || edit.isEditMode}
                className="w-full rounded-xl bg-mode px-6 py-3.5 text-base font-semibold text-bone transition-colors hover:bg-modeDeep disabled:opacity-50"
              >
                {busy ? (
                  'Sending...'
                ) : (
                  <Editable edit={edit} field="ctaText" as="span">
                    {c.ctaText || 'Get free access'}
                  </Editable>
                )}
              </button>
              {c.privacyNote && (
                <Editable
                  edit={edit}
                  field="privacyNote"
                  className="text-center text-xs leading-relaxed text-ink/45"
                >
                  {c.privacyNote}
                </Editable>
              )}

            </form>
          </div>
        </div>
      </div>
      <OptinFooter footer={edit.draft.footer as any} edit={edit} />
      <SalesEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
      {mediaStudio && (
        <FunnelMediaStudio
          open
          onClose={() => setMediaStudio(null)}
          kind={mediaStudio.kind}
          value={
            mediaStudio.field === 'coverImageUrl'
              ? c.coverImageUrl || ''
              : c.heroVideoUrl || ''
          }
          label={mediaStudio.label}
          hook={c.headline || c.magnetTitle}
          onApply={(url) => {
            edit.setField(mediaStudio.field, url);
            setMediaStudio(null);
          }}
        />
      )}
    </div>
  );
}



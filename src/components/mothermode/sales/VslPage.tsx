'use client';

import { useEffect, useState } from 'react';
import { Check, Play } from 'lucide-react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { BRAND } from '@/lib/mothermode/brand';
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
} from './FunnelMediaStudio';


interface Props {
  funnel: SalesFunnelRecord;
  isAdmin?: boolean;
}

/**
 * Centered VSL page — same Editorial Warm language as the sales page,
 * but single-column (not the 60/40 sales letter split). Video is the hero.
 * CTA can delay-reveal after ctaRevealSeconds.
 */
export default function VslPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'vsl', isAdmin);
  const c = edit.draft.vsl;
  const defaultHref = `/funnel/${funnel.slug}/checkout`;
  const ctaHref = c.ctaHref?.trim() || defaultHref;
  const [revealed, setRevealed] = useState(c.ctaRevealSeconds <= 0);
  const [remaining, setRemaining] = useState(
    c.ctaRevealSeconds > 0 ? c.ctaRevealSeconds : 0,
  );
  const [videoStudioOpen, setVideoStudioOpen] = useState(false);


  useEffect(() => {
    if (c.ctaRevealSeconds <= 0) {
      setRevealed(true);
      setRemaining(0);
      return;
    }
    setRevealed(false);
    setRemaining(c.ctaRevealSeconds);
    const started = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(
        0,
        c.ctaRevealSeconds - Math.floor((Date.now() - started) / 1000),
      );
      setRemaining(left);
      if (left <= 0) {
        setRevealed(true);
        clearInterval(tick);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [c.ctaRevealSeconds]);

  const showCta = revealed || edit.isEditMode;
  const hasVideo = Boolean(c.videoUrl?.trim());

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="border-b border-ink/10 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-center px-4">
          <OptinWordmark />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:pt-16">
        {/* Centered hero copy — sales-page quality, no split rail */}
        <div className="mx-auto max-w-3xl text-center">
          {(c.eyebrow || edit.isEditMode) && (
            <Editable
              edit={edit}
              field="eyebrow"
              className="mb-6 inline-flex items-center rounded-full border border-mode/25 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.16em] text-mode"
            >
              {c.eyebrow || 'Watch this first'}
            </Editable>
          )}

          <Editable
            edit={edit}
            field="headline"
            as="h1"
            className="font-display text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            {c.headline || 'Watch this next'}
          </Editable>

          {(c.subheadline || edit.isEditMode) && (
            <Editable
              edit={edit}
              field="subheadline"
              multiline
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/70 sm:text-xl"
            >
              {c.subheadline ||
                'Before you buy anything, watch this. It explains the system, why it works, and what to do first.'}
            </Editable>
          )}
        </div>

        {/* Centered video player */}
        <div
          className={`mx-auto mt-10 max-w-3xl ${
            c.stickyPlayer ? 'lg:sticky lg:top-6 lg:z-10' : ''
          }`}
        >
          {hasVideo ? (
            <div className="relative">
              <MediaBlock
                videoUrl={c.videoUrl}
                alt={c.headline || 'VSL'}
                className="overflow-hidden rounded-2xl shadow-sm"
              />
              {edit.isEditMode && (
                <div className="absolute right-3 top-3 z-10">
                  <MediaStudioTrigger
                    kind="video"
                    label="Edit VSL video"
                    onClick={() => setVideoStudioOpen(true)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-ink/10 bg-white/60">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(107,78,61,0.14) 1px, transparent 0)',
                  backgroundSize: '22px 22px',
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-mode/30 bg-white/80">
                  <Play className="h-7 w-7 text-mode" fill="currentColor" />
                </span>
                <span className="text-sm font-medium text-ink/70">
                  {edit.isEditMode
                    ? 'Add your VSL with the video studio'
                    : 'Video coming soon'}
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                  YouTube · Vimeo · MP4 · 1280 × 720
                </span>
                {edit.isEditMode && (
                  <div className="mt-2 flex flex-col items-center gap-2">
                    <MediaStudioTrigger
                      kind="video"
                      label="Open video studio"
                      onClick={() => setVideoStudioOpen(true)}
                    />
                    <Editable
                      edit={edit}
                      field="videoUrl"
                      className="max-w-md rounded-lg border border-ink/10 bg-white px-3 py-2 text-left text-xs text-ink/70"
                    >
                      {c.videoUrl || 'https://…'}
                    </Editable>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        {/* What you'll learn — centered checklist */}
        {(c.bullets.length > 0 || edit.isEditMode) && (
          <div className="mx-auto mt-12 max-w-2xl">
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-mode">
              What you will learn
            </p>
            <EditableList
              edit={edit}
              field="bullets"
              className="space-y-3.5 rounded-2xl border border-ink/10 bg-white/70 p-6 sm:p-8"
              renderItem={(b) => (
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mode/10">
                    <Check className="h-3 w-3 text-mode" />
                  </span>
                  <span className="text-base leading-relaxed text-ink/80 sm:text-lg">
                    {b}
                  </span>
                </div>
              )}
            />
          </div>
        )}

        {/* CTA band */}
        <div className="mx-auto mt-12 max-w-xl text-center">
          {showCta ? (
            <>
              <a
                href={edit.isEditMode ? undefined : ctaHref}
                onClick={edit.isEditMode ? (e) => e.preventDefault() : undefined}
                className="inline-flex min-w-[240px] items-center justify-center rounded-xl bg-mode px-8 py-4 text-lg font-semibold text-bone shadow-sm transition-colors hover:bg-modeDeep"
              >
                <Editable edit={edit} field="ctaText" as="span">
                  {c.ctaText || 'Continue to checkout'}
                </Editable>
              </a>
              <p className="mt-4 text-sm italic text-ink/55">
                {BRAND.brandLine} {BRAND.conversionLine}
              </p>
              {edit.isEditMode && (
                <div className="mt-4 space-y-2 text-left text-xs text-ink/55">
                  <Field
                    edit={edit}
                    field="ctaHref"
                    label="CTA href (blank = /checkout)"
                    value={c.ctaHref}
                  />
                  <Field
                    edit={edit}
                    field="ctaRevealSeconds"
                    label="CTA reveal delay (seconds)"
                    value={String(c.ctaRevealSeconds ?? 0)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-mode/20 bg-mode/[0.04] px-6 py-5">
              <p className="text-sm font-medium text-mode">
                Watch a little more — the next step unlocks in {remaining}s
              </p>
              <p className="mt-1 text-xs text-ink/50">
                Stay with the video. The offer opens when you are ready.
              </p>
            </div>
          )}
        </div>
      </div>

      <OptinFooter footer={edit.draft.footer as any} edit={edit} />
      <SalesEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
      <FunnelMediaStudio
        open={videoStudioOpen}
        onClose={() => setVideoStudioOpen(false)}
        kind="video"
        value={c.videoUrl || ''}
        label="VSL video"
        hook={c.headline}
        onApply={(url) => edit.setField('videoUrl', url)}
      />
    </div>
  );
}


function Field({
  edit,
  field,
  label,
  value,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
}) {
  return (
    <label className="block text-xs text-ink">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
        value={value || ''}
        onChange={(e) => edit.setField(field as any, e.target.value)}
      />
    </label>
  );
}

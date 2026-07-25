'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  LifeBuoy,
  Play,
  Users,
} from 'lucide-react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { OptinWordmark } from '@/components/mothermode/optin/Wordmark';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';
import { MediaBlock } from '@/components/mothermode/optin/MediaBlock';
import {
  Editable,
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
 * Members access hub — welcome video, onboarding steps, library links,
 * community + support. Fully editable inline for admins.
 */
export default function AccessPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'access', isAdmin);
  const c = edit.draft.access;
  const [videoStudioOpen, setVideoStudioOpen] = useState(false);
  const hasVideo = Boolean(c.welcomeVideoUrl?.trim());

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="border-b border-ink/10 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-center px-4">
          <OptinWordmark />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12">
        {/* Hero */}
        <div className="text-center">
          {(c.badgeText || edit.isEditMode) && (
            <span className="inline-flex items-center rounded-full border border-mode/20 bg-mode/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-mode">
              <Editable edit={edit} field="badgeText">
                {c.badgeText || 'Members area'}
              </Editable>
            </span>
          )}

          <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            <Editable edit={edit} field="headline">
              {c.headline || 'Welcome to your members area'}
            </Editable>
          </h1>

          {(c.subheadline || edit.isEditMode) && (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink/65">
              <Editable edit={edit} field="subheadline" multiline>
                {c.subheadline || ''}
              </Editable>
            </p>
          )}
        </div>

        {/* Welcome video */}
        {(hasVideo || edit.isEditMode) && (
          <section className="relative mx-auto mt-10 max-w-3xl">
            {hasVideo ? (
              <MediaBlock
                videoUrl={c.welcomeVideoUrl}
                alt="Welcome video"
                className="shadow-sm"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink/15 bg-ink/[0.03] text-ink/40">
                <Play className="h-10 w-10" />
                <span className="text-sm font-medium">No welcome video yet</span>
              </div>
            )}
            {edit.isEditMode && (
              <div className="mt-3 flex justify-center">
                <MediaStudioTrigger
                  kind="video"
                  label="Welcome video"
                  onClick={() => setVideoStudioOpen(true)}
                />
              </div>
            )}
          </section>
        )}

        {/* Onboarding */}
        <section className="mt-16">
          <div className="mb-6">
            {(c.onboardingEyebrow || edit.isEditMode) && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mode">
                <Editable edit={edit} field="onboardingEyebrow">
                  {c.onboardingEyebrow || 'Start here'}
                </Editable>
              </p>
            )}
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
              <Editable edit={edit} field="onboardingHeading">
                {c.onboardingHeading || 'Your first three moves'}
              </Editable>
            </h2>
          </div>

          <ol className="space-y-4">
            {(c.onboardingItems.length > 0
              ? c.onboardingItems
              : edit.isEditMode
                ? [{ title: '', description: '', href: '' }]
                : []
            ).map((item, i) => {
              const body = (
                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mode text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-ink">
                      <Editable edit={edit} field={`onboardingItems.${i}.title`}>
                        {item.title || (edit.isEditMode ? 'Step title' : '')}
                      </Editable>
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink/55">
                      <Editable
                        edit={edit}
                        field={`onboardingItems.${i}.description`}
                        multiline
                      >
                        {item.description || ''}
                      </Editable>
                    </p>
                    {edit.isEditMode && (
                      <label className="mt-2 block text-xs text-ink/45">
                        <span className="font-medium">Href</span>
                        <Editable edit={edit} field={`onboardingItems.${i}.href`}>
                          {item.href || ''}
                        </Editable>
                      </label>
                    )}
                  </div>
                  {!edit.isEditMode && item.href?.trim() && (
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-mode/60" />
                  )}
                </div>
              );

              if (edit.isEditMode || !item.href?.trim()) {
                return (
                  <li
                    key={i}
                    className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"
                  >
                    {body}
                  </li>
                );
              }

              return (
                <li key={i}>
                  <a
                    href={item.href}
                    className="block rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:border-mode/30 hover:shadow-md"
                  >
                    {body}
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Library */}
        <section className="mt-16">
          <div className="mb-6">
            {(c.libraryEyebrow || edit.isEditMode) && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mode">
                <Editable edit={edit} field="libraryEyebrow">
                  {c.libraryEyebrow || 'Your library'}
                </Editable>
              </p>
            )}
            <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
              <BookOpen className="h-5 w-5 text-mode" />
              <Editable edit={edit} field="libraryHeading">
                {c.libraryHeading || 'Everything included'}
              </Editable>
            </h2>
            {(c.libraryIntro || edit.isEditMode) && (
              <p className="mt-2 max-w-xl text-sm text-ink/55">
                <Editable edit={edit} field="libraryIntro" multiline>
                  {c.libraryIntro || ''}
                </Editable>
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(c.deliveryLinks.length > 0
              ? c.deliveryLinks
              : edit.isEditMode
                ? [{ label: '', href: '', description: '' }]
                : []
            ).map((link, i) => {
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      <Editable edit={edit} field={`deliveryLinks.${i}.label`}>
                        {link.label || (edit.isEditMode ? 'Resource name' : '')}
                      </Editable>
                    </h3>
                    {!edit.isEditMode && (
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink/50">
                    <Editable
                      edit={edit}
                      field={`deliveryLinks.${i}.description`}
                      multiline
                    >
                      {link.description || ''}
                    </Editable>
                  </p>
                  {edit.isEditMode && (
                    <label className="mt-2 block text-xs text-ink/45">
                      <span className="font-medium">Href</span>
                      <Editable edit={edit} field={`deliveryLinks.${i}.href`}>
                        {link.href || ''}
                      </Editable>
                    </label>
                  )}
                </>
              );

              if (edit.isEditMode || !link.href?.trim()) {
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm"
                  >
                    {body}
                  </div>
                );
              }

              return (
                <a
                  key={i}
                  href={link.href}
                  className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-mode/30 hover:shadow-md"
                >
                  {body}
                </a>
              );
            })}
          </div>
        </section>

        {/* Community + Support */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-mode/10 text-mode">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">
              {edit.isEditMode ? (
                <Editable edit={edit} field="communityLabel">
                  {c.communityLabel || 'Join the community'}
                </Editable>
              ) : (
                c.communityLabel || 'Join the community'
              )}
            </h3>
            {(c.communityBody || edit.isEditMode) && (
              <p className="mt-2 text-sm leading-relaxed text-ink/55">
                <Editable edit={edit} field="communityBody" multiline>
                  {c.communityBody || ''}
                </Editable>
              </p>
            )}
            {edit.isEditMode ? (
              <label className="mt-3 block text-xs text-ink/45">
                <span className="font-medium">Community href</span>
                <Editable edit={edit} field="communityHref">
                  {c.communityHref || ''}
                </Editable>
              </label>
            ) : c.communityHref?.trim() ? (
              <a
                href={c.communityHref}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mode hover:underline"
              >
                {c.communityLabel || 'Join the community'}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-mode/10 text-mode">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">
              <Editable edit={edit} field="supportHeading">
                {c.supportHeading || 'Need a hand?'}
              </Editable>
            </h3>
            {(c.supportBody || edit.isEditMode) && (
              <p className="mt-2 text-sm leading-relaxed text-ink/55">
                <Editable edit={edit} field="supportBody" multiline>
                  {c.supportBody || ''}
                </Editable>
              </p>
            )}
            <p className="mt-4 text-sm">
              {edit.isEditMode ? (
                <label className="block text-xs text-ink/45">
                  <span className="font-medium">Support email</span>
                  <Editable edit={edit} field="supportEmail">
                    {c.supportEmail || ''}
                  </Editable>
                </label>
              ) : c.supportEmail ? (
                <a
                  href={`mailto:${c.supportEmail}`}
                  className="font-semibold text-mode hover:underline"
                >
                  {c.supportEmail}
                </a>
              ) : null}
            </p>
          </section>
        </div>
      </main>

      <OptinFooter footer={edit.draft.footer as any} edit={edit} />
      <SalesEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
      <FunnelMediaStudio
        open={videoStudioOpen}
        onClose={() => setVideoStudioOpen(false)}
        kind="video"
        value={c.welcomeVideoUrl || ''}
        label="Welcome video"
        hook={c.headline}
        onApply={(url) => edit.setField('welcomeVideoUrl', url)}
      />
    </div>
  );
}

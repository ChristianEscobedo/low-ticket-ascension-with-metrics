'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Mail,
  Play,
  Users,
} from 'lucide-react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { OptinWordmark } from '@/components/mothermode/optin/Wordmark';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';
import {
  Editable,
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
} from './inlineEdit';

interface Props {
  funnel: SalesFunnelRecord;
  isAdmin?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check,
  play: Play,
  download: Download,
  users: Users,
  mail: Mail,
};

/**
 * Post-purchase success page — confirmation, delivery cards, next-step CTA.
 * Fully editable inline for admins (same pattern as VSL / optin).
 */
export default function SuccessPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'success', isAdmin);
  const c = edit.draft.success;
  const defaultHref = `/funnel/${funnel.slug}/access`;
  const ctaHref = c.ctaHref?.trim() || defaultHref;

  return (
    <div className="min-h-screen bg-bone font-sans text-ink antialiased">
      <header className="border-b border-ink/10 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <OptinWordmark />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-12">
        {/* Hero confirmation */}
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-mode/10 text-mode">
            <Check className="h-7 w-7" strokeWidth={2.5} />
          </div>

          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            <Editable edit={edit} field="headline">
              {c.headline || "You're in. Here's what happens next."}
            </Editable>
          </h1>

          {(c.subheadline || edit.isEditMode) && (
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink/65">
              <Editable edit={edit} field="subheadline" multiline>
                {c.subheadline || ''}
              </Editable>
            </p>
          )}

          {(c.purchaseSummary || edit.isEditMode) && (
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink/70 shadow-sm">
              <Editable edit={edit} field="purchaseSummary">
                {c.purchaseSummary || ''}
              </Editable>
            </div>
          )}

          {(c.inboxNote || edit.isEditMode) && (
            <p className="mx-auto mt-4 flex max-w-md items-start justify-center gap-2 text-sm text-ink/50">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-mode" />
              <span>
                <Editable edit={edit} field="inboxNote" multiline>
                  {c.inboxNote || ''}
                </Editable>
              </span>
            </p>
          )}
        </div>

        {/* Delivery cards */}
        <section className="mt-14">
          <div className="mb-6 text-center">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              <Editable edit={edit} field="deliverySectionHeading">
                {c.deliverySectionHeading || 'What is now yours'}
              </Editable>
            </h2>
            {(c.deliverySectionIntro || edit.isEditMode) && (
              <p className="mx-auto mt-2 max-w-lg text-sm text-ink/55">
                <Editable edit={edit} field="deliverySectionIntro" multiline>
                  {c.deliverySectionIntro || ''}
                </Editable>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(c.deliveryCards.length > 0
              ? c.deliveryCards
              : edit.isEditMode
                ? [{ title: '', description: '', href: '', icon: 'check' }]
                : []
            ).map((card, i) => {
              const Icon = ICON_MAP[card.icon] || Check;
              const href = card.href?.trim() || ctaHref;
              const inner = (
                <>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-mode/10 text-mode">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-ink">
                    <Editable edit={edit} field={`deliveryCards.${i}.title`}>
                      {card.title || (edit.isEditMode ? 'Card title' : '')}
                    </Editable>
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
                    <Editable
                      edit={edit}
                      field={`deliveryCards.${i}.description`}
                      multiline
                    >
                      {card.description || ''}
                    </Editable>
                  </p>
                  {edit.isEditMode && (
                    <div className="mt-3 space-y-1 border-t border-ink/5 pt-3 text-left text-xs text-ink/45">
                      <label className="block">
                        <span className="font-medium">Href</span>
                        <Editable edit={edit} field={`deliveryCards.${i}.href`}>
                          {card.href || ''}
                        </Editable>
                      </label>
                      <label className="block">
                        <span className="font-medium">Icon (check/play/download/users/mail)</span>
                        <Editable edit={edit} field={`deliveryCards.${i}.icon`}>
                          {card.icon || 'check'}
                        </Editable>
                      </label>
                    </div>
                  )}
                </>
              );

              if (edit.isEditMode) {
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <a
                  key={i}
                  href={href}
                  className="group rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:border-mode/30 hover:shadow-md"
                >
                  {inner}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mode opacity-0 transition group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" />
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Next step */}
        <section className="mt-14 rounded-2xl border border-mode/15 bg-mode/[0.04] px-6 py-8 text-center sm:px-10">
          {(c.nextEyebrow || edit.isEditMode) && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mode">
              <Editable edit={edit} field="nextEyebrow">
                {c.nextEyebrow || ''}
              </Editable>
            </p>
          )}
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">
            <Editable edit={edit} field="nextHeading">
              {c.nextHeading || 'This is the first room of the redesign.'}
            </Editable>
          </h2>
          {(c.nextBody || edit.isEditMode) && (
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink/60">
              <Editable edit={edit} field="nextBody" multiline>
                {c.nextBody || ''}
              </Editable>
            </p>
          )}

          {edit.isEditMode ? (
            <div className="mt-6 space-y-2 text-left text-xs text-ink/55">
              <label className="block space-y-1">
                <span className="font-medium text-ink/70">CTA label</span>
                <Editable edit={edit} field="ctaText">
                  {c.ctaText || 'Go to my access'}
                </Editable>
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-ink/70">
                  CTA href (blank = /access)
                </span>
                <Editable edit={edit} field="ctaHref">
                  {c.ctaHref || ''}
                </Editable>
              </label>
              <div className="pointer-events-none mt-3 inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-mode px-6 py-3 text-sm font-semibold text-white opacity-70">
                {c.ctaText || 'Go to my access'}
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <a
              href={ctaHref}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-mode px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-mode/90"
            >
              {c.ctaText || 'Go to my access'}
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </section>

        {/* Support note */}
        <div className="mt-10 text-center text-sm text-ink/45">
          {(c.secondaryNote || edit.isEditMode) && (
            <p>
              <Editable edit={edit} field="secondaryNote" multiline>
                {c.secondaryNote || ''}
              </Editable>
            </p>
          )}
          {(c.supportEmail || edit.isEditMode) && (
            <p className="mt-2">
              Support:{' '}
              {edit.isEditMode ? (
                <Editable edit={edit} field="supportEmail">
                  {c.supportEmail || ''}
                </Editable>
              ) : (
                <a
                  href={`mailto:${c.supportEmail}`}
                  className="font-medium text-mode underline-offset-2 hover:underline"
                >
                  {c.supportEmail}
                </a>
              )}
            </p>
          )}
        </div>
      </main>

      <OptinFooter footer={edit.draft.footer as any} edit={edit} />
      <SalesEditToolbar edit={edit} />
      <InlineEditPopup edit={edit} />
    </div>
  );
}

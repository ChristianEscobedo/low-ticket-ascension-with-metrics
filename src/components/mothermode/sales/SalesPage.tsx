'use client';

import { useState } from 'react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { MotherModeSalesPage } from '@/components/mothermode/MotherModeSalesPage';
import { salesContentToOffer } from '@/lib/mothermode/sales/fromOffer';
import {
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
} from './inlineEdit';
import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';
import { SalesPageEditProvider } from './SalesPageEditContext';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';

interface Props {
  funnel: SalesFunnelRecord;
  isAdmin?: boolean;
}

type SalesMediaField = 'heroImageUrl' | 'heroVideoUrl' | 'founderPhotoUrl';

/**
 * Editable sales page that renders the EXACT MotherMode long-form layout
 * (UrgencyBar → Hero → two-column narrative → Inside → Proof → Pricing →
 * Guarantee → FAQ → Founder → Bonus → Final CTA → Footer) while driving
 * every field from funnel.sales JSON.
 *
 * Admins get the floating Edit toolbar + Funnel Media Studio for hero image,
 * hero video, and founder photo.
 */
export default function SalesPage({ funnel, isAdmin = false }: Props) {
  const edit = useSalesInlineEdit(funnel, 'sales', isAdmin);
  const c = edit.draft.sales;
  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: SalesMediaField;
    label: string;
  }>(null);
  const [sheetOpen, setSheetOpen] = useState(true);

  const offer = salesContentToOffer(c, {
    slug: funnel.offerSlug || funnel.slug || 'offer',
    productId: funnel.productId || undefined,
  });

  return (
    <SalesPageEditProvider
      edit={edit}
      openMediaStudio={(req) =>
        setMediaStudio({
          kind: req.kind,
          field: req.field as SalesMediaField,
          label: req.label,
        })
      }
    >
    <div className="relative">

      <MotherModeSalesPage
        offer={offer}
        checkoutHref={`/funnel/${funnel.slug}/checkout`}
        hideFooter
      />
      <OptinFooter footer={edit.draft.footer as any} edit={edit as any} />

      {isAdmin && (
        <>
          <SalesEditToolbar edit={edit} />
          <InlineEditPopup edit={edit} />

          {edit.isEditMode && (
            <div className={`fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-bone/95 text-ink shadow-2xl backdrop-blur ${sheetOpen ? 'max-h-[45vh] overflow-y-auto p-4' : 'p-2'}`}>
              <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Field sheet {sheetOpen ? '' : '· minimized — hover page text to edit'}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/70 hover:border-mode/40 hover:text-mode"
                >
                  {sheetOpen ? 'Minimize' : 'Expand fields'}
                </button>
              </div>
              {sheetOpen && (
              <>
              <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Media
                </span>
                <MediaStudioTrigger
                  kind="image"
                  label="Hero image"
                  onClick={() =>
                    setMediaStudio({
                      kind: 'image',
                      field: 'heroImageUrl',
                      label: 'Hero image / product mockup',
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
                      label: 'Hero / VSL poster video',
                    })
                  }
                />
                <MediaStudioTrigger
                  kind="image"
                  label="Founder photo"
                  onClick={() =>
                    setMediaStudio({
                      kind: 'image',
                      field: 'founderPhotoUrl',
                      label: 'Founder photo',
                    })
                  }
                />
                {(c.heroImageUrl || c.heroVideoUrl || c.founderPhotoUrl) && (
                  <span className="text-[11px] text-ink/45">
                    {[
                      c.heroImageUrl && 'hero image set',
                      c.heroVideoUrl && 'hero video set',
                      c.founderPhotoUrl && 'founder photo set',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>

              <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field edit={edit} field="eyebrow" label="Hero eyebrow" value={c.eyebrow} />
                <Field edit={edit} field="headline" label="Headline" value={c.headline} />
                <Field
                  edit={edit}
                  field="headlineEmphasis"
                  label="Headline emphasis"
                  value={c.headlineEmphasis}
                />
                <Field
                  edit={edit}
                  field="headlineSuffix"
                  label="Headline suffix"
                  value={c.headlineSuffix}
                />
                <Field
                  edit={edit}
                  field="subheadline"
                  label="Subheadline"
                  value={c.subheadline}
                  multiline
                />
                <Field edit={edit} field="audience" label="Audience line" value={c.audience} multiline />
                <Field edit={edit} field="promise" label="Promise" value={c.promise} />
                <Field
                  edit={edit}
                  field="problemHeading"
                  label="Problem heading"
                  value={c.problemHeading}
                />
                <Field
                  edit={edit}
                  field="problemIntro"
                  label="Problem intro"
                  value={c.problemIntro}
                  multiline
                />
                <Field
                  edit={edit}
                  field="problemScene"
                  label="Problem scene"
                  value={c.problemScene}
                  multiline
                />
                <Field
                  edit={edit}
                  field="problemCost"
                  label="Problem cost"
                  value={c.problemCost}
                  multiline
                />
                <Field
                  edit={edit}
                  field="originHeading"
                  label="Origin heading"
                  value={c.originHeading}
                />
                <Field
                  edit={edit}
                  field="whatIsHeading"
                  label="What-is heading"
                  value={c.whatIsHeading}
                />
                <Field
                  edit={edit}
                  field="mechanismHeading"
                  label="Mechanism heading"
                  value={c.mechanismHeading}
                />
                <Field
                  edit={edit}
                  field="mechanismLabel"
                  label="Mechanism label"
                  value={c.mechanismLabel}
                />
                <Field
                  edit={edit}
                  field="insideHeading"
                  label="Inside heading"
                  value={c.insideHeading}
                />
                <Field
                  edit={edit}
                  field="insideSubheading"
                  label="Inside subheading"
                  value={c.insideSubheading}
                />
                <Field
                  edit={edit}
                  field="methodHeading"
                  label="Method heading"
                  value={c.methodHeading}
                />
                <Field edit={edit} field="priceLabel" label="Price" value={c.priceLabel} />
                <Field
                  edit={edit}
                  field="originalPriceLabel"
                  label="Original price"
                  value={c.originalPriceLabel}
                />
                <Field edit={edit} field="ctaText" label="CTA text" value={c.ctaText} />
                <Field edit={edit} field="ctaSubtext" label="CTA subtext" value={c.ctaSubtext} />
                <Field
                  edit={edit}
                  field="guaranteeTitle"
                  label="Guarantee title"
                  value={c.guaranteeTitle}
                />
                <Field
                  edit={edit}
                  field="guaranteeText"
                  label="Guarantee body"
                  value={c.guaranteeText}
                  multiline
                />
                <Field
                  edit={edit}
                  field="finalCtaHeading"
                  label="Final CTA heading"
                  value={c.finalCtaHeading}
                />
                <Field
                  edit={edit}
                  field="finalCtaBody"
                  label="Final CTA body"
                  value={c.finalCtaBody}
                  multiline
                />
                <Field
                  edit={edit}
                  field="founderEyebrow"
                  label="Founder eyebrow"
                  value={c.founderEyebrow}
                />
                <Field
                  edit={edit}
                  field="founderHeading"
                  label="Founder heading"
                  value={c.founderHeading}
                />
                <Field
                  edit={edit}
                  field="founderGreeting"
                  label="Founder greeting"
                  value={c.founderGreeting}
                />
                <Field
                  edit={edit}
                  field="founderSignoff"
                  label="Founder signoff"
                  value={c.founderSignoff}
                />
                <Field
                  edit={edit}
                  field="founderPs"
                  label="Founder P.S."
                  value={c.founderPs}
                  multiline
                />
                <Field
                  edit={edit}
                  field="bonusesEyebrow"
                  label="Bonuses eyebrow"
                  value={c.bonusesEyebrow}
                />
                <Field
                  edit={edit}
                  field="bonusesHeading"
                  label="Bonuses heading"
                  value={c.bonusesHeading}
                />
                <Field
                  edit={edit}
                  field="originEyebrow"
                  label="Origin eyebrow"
                  value={c.originEyebrow}
                />
                <Field
                  edit={edit}
                  field="originHeading"
                  label="Origin heading"
                  value={c.originHeading}
                />
                <Field
                  edit={edit}
                  field="mechanismEyebrow"
                  label="Mechanism eyebrow"
                  value={c.mechanismEyebrow}
                />
                <Field
                  edit={edit}
                  field="name"
                  label="Offer name"
                  value={c.name}
                />
                <Field
                  edit={edit}
                  field="tagline"
                  label="Tagline"
                  value={c.tagline}
                />
                <p className="sm:col-span-2 lg:col-span-3 text-xs text-ink/50">
                  Full founder letter paragraphs, origin/mechanism/inside/method lists, proof,
                  FAQs, bonuses items, and bumps edit in Admin → Sales Funnels → Sales tab (full
                  MotherMode field set), or via AI generate / Load MotherMode defaults. Media
                  studio above sets hero image, hero video, and founder photo. Saving here writes
                  the full sales JSON block.
                </p>
              </div>
              </>
              )}
            </div>
          )}

          {mediaStudio && (
            <FunnelMediaStudio
              open
              onClose={() => setMediaStudio(null)}
              kind={mediaStudio.kind}
              value={(c[mediaStudio.field] as string) || ''}
              label={mediaStudio.label}
              hook={c.headline || c.name || funnel.name}
              onApply={(url) => {
                edit.setField(mediaStudio.field, url);
                setMediaStudio(null);
              }}
            />
          )}
        </>
      )}
    </div>
    </SalesPageEditProvider>
  );
}

function Field({
  edit,
  field,
  label,
  value,
  multiline,
}: {
  edit: ReturnType<typeof useSalesInlineEdit>;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode"
          rows={3}
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode"
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      )}
    </label>
  );
}

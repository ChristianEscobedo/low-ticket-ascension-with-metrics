'use client';

import { useMemo, useState } from 'react';
import type { SalesFunnelRecord } from '@/lib/mothermode/sales/types';
import { upsellContentToAscension } from '@/lib/mothermode/sales/fromAscension';
import { MotherModeUpsellPage } from '@/components/mothermode/upsell/MotherModeUpsellPage';
import {
  InlineEditPopup,
  SalesEditToolbar,
  useSalesInlineEdit,
  Editable,
} from './inlineEdit';
import {
  FunnelMediaStudio,
  MediaStudioTrigger,
  type FunnelMediaKind,
} from './FunnelMediaStudio';
import { SalesPageEditProvider } from './SalesPageEditContext';
import { OptinFooter } from '@/components/mothermode/optin/OptinFooter';

type UpsellKey = 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';

interface Props {
  funnel: SalesFunnelRecord;
  upsellKey?: UpsellKey;
  isAdmin?: boolean;
}

/** Top-level media fields plus nested gallery paths (gallery.0.src). */
type UpsellMediaField = string;

function nextPath(slug: string, key: UpsellKey, funnel: SalesFunnelRecord): string {
  const order: UpsellKey[] = ['upsell1', 'upsell2', 'upsell3', 'upsell4'];
  const idx = order.indexOf(key);
  for (let i = idx + 1; i < order.length; i++) {
    const k = order[i];
    if (funnel[k]?.enabled) {
      if (k === 'upsell1') return `/funnel/${slug}/upsell`;
      if (k === 'upsell2') return `/funnel/${slug}/upsell-2`;
      if (k === 'upsell3') return `/funnel/${slug}/upsell-3`;
      return `/funnel/${slug}/upsell-4`;
    }
  }
  return `/funnel/${slug}/success`;
}

/**
 * Editable upsell page that renders the EXACT MotherMode OTO layout
 * (timer → media → letter → value stack → CTAs → guarantee) while driving
 * every field from funnel.upsellN JSON via upsellContentToAscension.
 *
 * Admins get Funnel Media Studio for image, video, and video poster.
 */
export default function UpsellPage({
  funnel,
  upsellKey = 'upsell1',
  isAdmin = false,
}: Props) {
  const edit = useSalesInlineEdit(funnel, upsellKey, isAdmin);
  const c = edit.draft[upsellKey];
  const [mediaStudio, setMediaStudio] = useState<null | {
    kind: FunnelMediaKind;
    field: UpsellMediaField;
    label: string;
  }>(null);
  const [sheetOpen, setSheetOpen] = useState(true);

  const offer = useMemo(
    () =>
      upsellContentToAscension(c, {
        productIdFallback: funnel.productId || `funnel_${upsellKey}`,
        pageTypeFallback: upsellKey,
      }),
    [c, funnel.productId, upsellKey],
  );

  const acceptRedirect = c.yesHref?.trim() || nextPath(funnel.slug, upsellKey, edit.draft);
  const declineRedirect = nextPath(funnel.slug, upsellKey, edit.draft);

  // Match original MotherMode purchase flags so success/access delivery works.
  const recordOnAccept = useMemo(() => {
    if (upsellKey === 'upsell1') return { os: true as const, osInterval: 'monthly' as const };
    if (upsellKey === 'upsell2') return { os: true as const, osInterval: 'annual' as const };
    if (upsellKey === 'upsell3') return { vault: true as const };
    return { coaching: true as const };
  }, [upsellKey]);


  return (
    <SalesPageEditProvider
      edit={edit}
      openMediaStudio={(req) =>
        setMediaStudio({
          kind: req.kind,
          field: req.field as UpsellMediaField,
          label: req.label,
        })
      }
    >
    <div className="relative">

      <MotherModeUpsellPage
        offer={offer}
        recordOnAccept={recordOnAccept as any}
        acceptRedirect={acceptRedirect}
        declineRedirect={declineRedirect}
        finalizeFrontEnd={upsellKey === 'upsell1'}
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
                  label="Product image"
                  onClick={() =>
                    setMediaStudio({
                      kind: 'image',
                      field: 'imageUrl',
                      label: 'Upsell product image',
                    })
                  }
                />
                <MediaStudioTrigger
                  kind="video"
                  label="Upsell video"
                  onClick={() =>
                    setMediaStudio({
                      kind: 'video',
                      field: 'videoUrl',
                      label: 'Upsell video',
                    })
                  }
                />
                <MediaStudioTrigger
                  kind="image"
                  label="Video poster"
                  onClick={() =>
                    setMediaStudio({
                      kind: 'image',
                      field: 'mediaVideoPoster',
                      label: 'Video poster frame',
                    })
                  }
                />
                {(c.imageUrl || c.videoUrl || c.mediaVideoPoster) && (
                  <span className="text-[11px] text-ink/45">
                    {[
                      c.imageUrl && 'image set',
                      c.videoUrl && 'video set',
                      c.mediaVideoPoster && 'poster set',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>

              <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field edit={edit} field="eyebrow" label="Eyebrow" value={c.eyebrow} />
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
                <Field
                  edit={edit}
                  field="letter"
                  label="Letter (one paragraph per line)"
                  value={(c.letter || []).join('\n')}
                  multiline
                />
                <Field edit={edit} field="priceLabel" label="Price label" value={c.priceLabel} />
                <Field
                  edit={edit}
                  field="originalPriceLabel"
                  label="Original price"
                  value={c.originalPriceLabel}
                />
                <Field edit={edit} field="ctaYes" label="Accept CTA" value={c.ctaYes} />
                <Field edit={edit} field="ctaNo" label="Decline CTA" value={c.ctaNo} />
                <Field
                  edit={edit}
                  field="stackEyebrow"
                  label="Stack eyebrow"
                  value={c.stackEyebrow}
                />
                <Field
                  edit={edit}
                  field="stackHeading"
                  label="Stack heading"
                  value={c.stackHeading}
                />
                <Field
                  edit={edit}
                  field="totalValueLabel"
                  label="Total value"
                  value={c.totalValueLabel}
                />
                <Field edit={edit} field="bigIdea" label="Big idea" value={c.bigIdea} multiline />
                <Field
                  edit={edit}
                  field="guaranteeTitle"
                  label="Guarantee title"
                  value={c.guaranteeTitle}
                />
                <Field
                  edit={edit}
                  field="guaranteeBody"
                  label="Guarantee body"
                  value={c.guaranteeBody}
                  multiline
                />
                <Field edit={edit} field="timerLabel" label="Timer label" value={c.timerLabel} />
                <Field
                  edit={edit}
                  field="productName"
                  label="Product name"
                  value={c.productName}
                />
                <Field
                  edit={edit}
                  field="galleryEyebrow"
                  label="Gallery eyebrow"
                  value={c.galleryEyebrow}
                />
              </div>

              {/* Features quick-edit */}
              <div className="mx-auto mt-4 max-w-6xl space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Value stack features
                </div>
                {(c.features || []).map((f, fi) => (
                  <div
                    key={fi}
                    className="grid gap-2 rounded-lg border border-ink/10 bg-white/60 p-2 sm:grid-cols-3"
                  >
                    <Field
                      edit={edit}
                      field={`features.${fi}.title`}
                      label={`#${fi + 1} title`}
                      value={f.title}
                    />
                    <Field
                      edit={edit}
                      field={`features.${fi}.description`}
                      label="Description"
                      value={f.description}
                      multiline
                    />
                    <Field
                      edit={edit}
                      field={`features.${fi}.value`}
                      label="Value"
                      value={f.value}
                    />
                  </div>
                ))}
                {(c.features || []).length === 0 && (
                  <p className="text-xs text-ink/40">
                    No features yet — add them in Admin → Sales Funnels → Upsell tab, or hover the
                    stack on-page.
                  </p>
                )}
              </div>

              {/* Gallery captions + media triggers */}
              <div className="mx-auto mt-4 max-w-6xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                    Gallery shots
                  </span>
                  {[0, 1, 2].map((gi) => (
                    <MediaStudioTrigger
                      key={gi}
                      kind="image"
                      label={`Shot ${gi + 1}`}
                      onClick={() =>
                        setMediaStudio({
                          kind: 'image',
                          field: `gallery.${gi}.src`,
                          label: `Gallery shot ${gi + 1}`,
                        })
                      }
                    />
                  ))}
                </div>
                {(c.gallery || []).map((g, gi) => (
                  <div
                    key={gi}
                    className="grid gap-2 rounded-lg border border-ink/10 bg-white/60 p-2 sm:grid-cols-2"
                  >
                    <Field
                      edit={edit}
                      field={`gallery.${gi}.caption`}
                      label={`Shot ${gi + 1} caption`}
                      value={g.caption || ''}
                    />
                    <Field
                      edit={edit}
                      field={`gallery.${gi}.alt`}
                      label="Alt text"
                      value={g.alt || ''}
                    />
                  </div>
                ))}
              </div>

              <p className="mx-auto mt-3 max-w-6xl text-xs text-ink/50">
                Production OTO layout (MotherModeUpsellPage). Click gallery frames or Media
                triggers for Funnel Media Studio. Hover any page text while Editing to edit in
                place, then Save.
              </p>

              </>
              )}
            </div>
          )}

          {mediaStudio && (
            <FunnelMediaStudio
              open
              onClose={() => setMediaStudio(null)}
              kind={mediaStudio.kind}
              value={edit.getField(mediaStudio.field)}

              label={mediaStudio.label}
              hook={c.headline || c.productName || funnel.name}
              onApply={(url) => {
                edit.setField(mediaStudio.field, url);
                // Nested gallery.N.src — ensure gallery array slot exists with alt.
                const galleryMatch = /^gallery\.(\d+)\.src$/.exec(
                  mediaStudio.field,
                );
                if (galleryMatch) {
                  const idx = Number(galleryMatch[1]);
                  const gallery = [...(c.gallery || [])];
                  while (gallery.length <= idx) {
                    gallery.push({
                      src: '',
                      alt: `Shot ${gallery.length + 1}`,
                      caption: '',
                      hint: '1080 × 1920',
                    });
                  }
                  gallery[idx] = {
                    ...gallery[idx],
                    src: url,
                    alt: gallery[idx].alt || `Shot ${idx + 1}`,
                  };
                  edit.setField('gallery', gallery);
                }
                // When a video is applied, mark mediaVideo so production layout prefers it.
                if (mediaStudio.field === 'videoUrl' && url) {
                  edit.setField('mediaVideo', true);
                }
                if (mediaStudio.field === 'videoUrl' && !url) {
                  edit.setField('mediaVideo', false);
                }
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
    <label className="block text-xs text-ink">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-ink/60">
        {label}
      </span>
      {multiline ? (
        <textarea
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          rows={3}
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mode focus:ring-2 focus:ring-mode/15"
          value={value || ''}
          onChange={(e) => edit.setField(field as any, e.target.value)}
        />
      )}
    </label>
  );
}

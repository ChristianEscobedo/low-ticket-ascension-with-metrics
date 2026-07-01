'use client';

/**
 * Slide-over for a single content piece. Opens from the right with tabs:
 * Preview renders the post exactly as it lands on its platform; Edit overrides
 * the copy and image locally; Notes captures change requests; Metrics records
 * the performance that feeds the preview's counts; Schedule plans the post; and
 * Amplify multiplies the piece into variants and adaptations. Local edits
 * persist to the review store, keyed by piece id.
 */
import React, { useEffect, useState } from 'react';
import { X as XIcon, Copy, Check } from 'lucide-react';
import {
  pieceToText,
  PLATFORM_LABEL,
  FORMAT_LABEL,
  type ContentPiece,
} from '@/lib/mothermode/content';
import {
  clampIndex,
  reviewImages,
  reviewHooks,
  type PieceEdits,
  type PieceReview,
} from '@/lib/mothermode/content/review';
import {
  loadReviews,
  getReview,
  saveReview,
  setReviewImages,
} from './reviewClient';
import { PlatformPreview, buildView } from './previews/PlatformPreview';
import { EditForm, MetricsForm } from './SheetForms';
import { SchedulePanel } from './SchedulePanel';
import { AmplifyCard } from './AmplifyCard';
import { CompliancePanel } from './CompliancePanel';

type Tab =
  | 'preview'
  | 'edit'
  | 'compliance'
  | 'notes'
  | 'metrics'
  | 'schedule'
  | 'amplify';
const TABS: { id: Tab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'edit', label: 'Edit' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'notes', label: 'Notes' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'amplify', label: 'Amplify' },
];

/**
 * A small chip selector shown above the preview so the reviewer can switch the
 * active hook variant or image frame and see the surface update live.
 */
const Selector: React.FC<{
  label: string;
  items: string[];
  active: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}> = ({ label, items, active, onSelect, compact }) => (
  <div>
    <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
      {label} · {active + 1} of {items.length}
    </span>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`rounded-full border px-3 py-1.5 text-left text-xs transition-colors ${
            i === active
              ? 'border-mode bg-mode/10 font-semibold text-mode'
              : 'border-ink/15 text-ink/65 hover:border-ink/30'
          } ${compact ? '' : 'max-w-[14rem] truncate'}`}
          title={compact ? undefined : item}
        >
          {compact ? item : `${i + 1}. ${item}`}
        </button>
      ))}
    </div>
  </div>
);

export const ContentSheet: React.FC<{
  piece: ContentPiece;
  offerUrl?: string;
  offerSlug: string;
  onClose: () => void;
  /** Receives new pieces from an Amplify full-post or cross-platform run. */
  onGenerated?: (pieces: ContentPiece[]) => void;
}> = ({ piece, offerUrl, offerSlug, onClose, onGenerated }) => {
  const [tab, setTab] = useState<Tab>('preview');
  const [review, setReview] = useState<PieceReview>({});
  const [copied, setCopied] = useState(false);

  // Hydrate from the shared review cache (loaded once per offer), then read this
  // piece's state. Writes update the cache and persist in the background.
  useEffect(() => {
    let active = true;
    void loadReviews(offerSlug).then(() => {
      if (active) setReview(getReview(offerSlug, piece.id));
    });
    return () => {
      active = false;
    };
  }, [offerSlug, piece.id]);

  // Persist a patch; the store returns the merged review so the preview reflects
  // it immediately.
  const apply = (patch: Partial<PieceReview>) =>
    setReview(saveReview(offerSlug, piece.id, patch));
  const applyEdits = (patch: Partial<PieceEdits>) => apply({ edits: patch });

  // The computed view drives the preview, the selectors, and the copy text.
  const view = buildView(piece, review);

  // Image gallery: append a frame/variant and make it active, remove one and
  // reindex, or just switch which is shown (promoting catalog frames first so
  // the choice persists).
  const addImage = (dataUrl: string) => addImages([dataUrl]);
  // Append a batch in one write, reading the freshest cache so several variants
  // generated in parallel never clobber one another.
  const addImages = (urls: string[]) => {
    if (urls.length === 0) return;
    const cur = reviewImages(getReview(offerSlug, piece.id));
    setReview(setReviewImages(offerSlug, piece.id, [...cur, ...urls], cur.length));
  };
  const removeImage = (index: number) => {
    const cur = reviewImages(review);
    const next = cur.filter((_, i) => i !== index);
    const idx = clampIndex(review.imageIndex, cur.length);
    setReview(
      setReviewImages(
        offerSlug,
        piece.id,
        next,
        Math.min(idx, Math.max(0, next.length - 1)),
      ),
    );
  };
  const setImageIndex = (index: number) => {
    if (reviewImages(review).length > 0) apply({ imageIndex: index });
    else setReview(setReviewImages(offerSlug, piece.id, view.images, index));
  };

  // Hook variants: switch the active one, promoting catalog hooks into the
  // edits first so a bare selection still persists.
  const setHookIndex = (index: number) => {
    if (reviewHooks(review.edits).length > 0) applyEdits({ hookIndex: index });
    else applyEdits({ hooks: view.hooks, hookIndex: index });
  };

  // Amplify: append accepted hook/angle variants to the piece's hook list, or
  // replace the body with an accepted version. Both flow through the edits store
  // so the preview reflects them at once.
  const appendHooks = (incoming: string[]) => {
    const base = reviewHooks(review.edits).length > 0 ? reviewHooks(review.edits) : view.hooks;
    const merged = [...base];
    for (const h of incoming) if (h.trim() && !merged.includes(h)) merged.push(h);
    applyEdits({ hooks: merged });
  };
  const useBody = (body: string) => applyEdits({ body });

  const onUploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pieceToText(piece, view.hook, offerUrl));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-bone shadow-2xl">
        <header className="flex items-start gap-3 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-brass">
              {PLATFORM_LABEL[piece.platform]} · {FORMAT_LABEL[piece.format]}
            </p>
            <h2 className="mt-0.5 truncate font-display text-xl text-ink">
              {piece.title}
            </h2>
          </div>
          <button
            onClick={copy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-mode px-3 py-1.5 text-xs font-semibold text-bone hover:bg-mode-deep"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-brass" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-full border border-ink/15 p-1.5 text-ink/60 hover:border-ink/30 hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex gap-1 border-b border-ink/10 px-5 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3.5 py-2 text-sm transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-mode font-semibold text-ink'
                  : 'text-ink/55 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {tab === 'preview' && (
            <div className="space-y-4 py-2">
              {view.hooks.length > 1 && (
                <Selector
                  label="Hook variant"
                  items={view.hooks}
                  active={view.hookIndex}
                  onSelect={setHookIndex}
                />
              )}
              {view.images.length > 1 && (
                <Selector
                  label={
                    piece.format === 'story' ||
                    piece.format === 'carousel' ||
                    piece.format === 'idea'
                      ? 'Frame'
                      : 'Image variant'
                  }
                  items={view.images.map((_, i) => `${i + 1}`)}
                  active={view.imageIndex}
                  onSelect={setImageIndex}
                  compact
                />
              )}
              <div className="flex justify-center">
                <PlatformPreview piece={piece} review={review} />
              </div>
            </div>
          )}
          {tab === 'edit' && (
            <EditForm
              piece={piece}
              review={review}
              onUploadImage={onUploadImage}
              onAddImages={addImages}
              onRemoveImage={removeImage}
              onSetImageIndex={setImageIndex}
              onEditPatch={applyEdits}
            />
          )}
          {tab === 'compliance' && (
            <CompliancePanel
              piece={piece}
              review={review}
              onEditPatch={applyEdits}
            />
          )}
          {tab === 'notes' && (
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink/45">
                Notes for changes (copy or image)
              </span>
              <textarea
                rows={10}
                value={review.notes ?? ''}
                placeholder="e.g. Soften the second hook. Swap the image for something warmer."
                onChange={(e) => apply({ notes: e.target.value || undefined })}
                className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-3 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
              />
            </label>
          )}
          {tab === 'metrics' && (
            <MetricsForm
              piece={piece}
              review={review}
              onMetric={(field, value) => apply({ metrics: { [field]: value } })}
            />
          )}
          {tab === 'schedule' && (
            <SchedulePanel piece={piece} review={review} offerUrl={offerUrl} />
          )}
          {tab === 'amplify' && (
            <AmplifyCard
              piece={piece}
              offerUrl={offerUrl}
              offerSlug={offerSlug}
              onAppendHooks={appendHooks}
              onUseBody={useBody}
              onGenerated={(pieces) => onGenerated?.(pieces)}
            />
          )}
        </div>
      </aside>
    </div>
  );
};

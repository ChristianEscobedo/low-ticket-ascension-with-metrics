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
import { X as XIcon, Copy, Check, Play, Pause } from 'lucide-react';

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
  subscribeReviews,
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

/** How long each frame holds before autoplay advances (ms). */
const FRAME_MS = 3500;


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
  // Preview-only: hide the hook/caption painted on top of the image so it
  // doesn't stack on burned-in type. Defaults on; not persisted.
  const [showHookText, setShowHookText] = useState(true);

  // Preview-only autoplay: multi-frame Stories/Reels/carousels advance on a
  // timer so the preview reads like a live post. `previewIndex` overrides the
  // persisted frame during autoplay without writing to the store; a manual
  // pick pauses autoplay and persists the choice. None of this is persisted.
  const [autoplay, setAutoplay] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Respect the OS "reduce motion" setting — never auto-advance for those users.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  // Reset the local playback state whenever the piece changes.
  useEffect(() => {
    setAutoplay(true);
    setPreviewIndex(null);
    setHovering(false);
  }, [piece.id]);


  // Hydrate + live-subscribe so primary/gallery updates without refresh.

  useEffect(() => {
    let active = true;
    void loadReviews(offerSlug).then(() => {
      if (active) setReview(getReview(offerSlug, piece.id));
    });
    const unsub = subscribeReviews((slug, id, next) => {
      if (active && slug === offerSlug && id === piece.id) setReview(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [offerSlug, piece.id]);


  // Persist a patch; the store returns the merged review so the preview reflects
  // it immediately.
  const apply = (patch: Partial<PieceReview>) =>
    setReview(saveReview(offerSlug, piece.id, patch));
  const applyEdits = (patch: Partial<PieceEdits>) => apply({ edits: patch });

  // The computed view drives the preview, the selectors, and the copy text.
  const view = buildView(piece, review);

  // Autoplay eligibility: multi-frame decks (story/carousel/idea) page through
  // their slides; vertical video surfaces (reels, TikTok) page through image
  // A/B variants. Everything else is static.
  const isDeck =
    piece.format === 'story' ||
    piece.format === 'carousel' ||
    piece.format === 'idea';
  const isVertical = piece.format === 'reel' || piece.platform === 'tiktok';
  const frameCount = isDeck
    ? Math.max(view.images.length, view.slides.length)
    : view.images.length;
  const canAutoplay = (isDeck || isVertical) && frameCount > 1;
  // The frame the preview actually shows: the autoplay override when present,
  // otherwise the persisted choice. Clamped to the live frame count.
  const effectiveIndex = clampIndex(
    previewIndex ?? view.imageIndex,
    Math.max(frameCount, 1),
  );
  // Autoplay runs only on the Preview tab, when eligible, not hovered, and the
  // viewer hasn't asked to reduce motion.
  const running =
    autoplay &&
    canAutoplay &&
    !hovering &&
    !reducedMotion &&
    tab === 'preview';
  // Render the preview against the effective frame without persisting it.
  const previewReview: PieceReview = { ...review, imageIndex: effectiveIndex };

  // Advance the frame on a timer while autoplay is running, looping at the end.
  useEffect(() => {
    if (!running || frameCount <= 1) return;
    const id = window.setInterval(() => {
      setPreviewIndex((cur) => {
        const base = cur ?? view.imageIndex;
        return (base + 1) % frameCount;
      });
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, [running, frameCount, view.imageIndex]);

  // Image gallery: append a frame/variant and make it active, remove one and

  // reindex, or just switch which is shown (promoting catalog frames first so
  // the choice persists).
  const addImage = (dataUrl: string) => addImages([dataUrl]);
  // Append a batch in one write, reading the freshest cache so several variants
  // generated in parallel never clobber one another.
  const addImages = (urls: string[]) => {
    if (urls.length === 0) return;
    // Host any data URLs in the background so gallery stays small + shareable,
    // but optimistically show them immediately.
    const cur = reviewImages(getReview(offerSlug, piece.id));
    const merged = [...cur, ...urls];
    setReview(
      setReviewImages(offerSlug, piece.id, merged, cur.length),
    );
    void (async () => {
      try {
        const { aiHostImage } = await import('./aiClient');
        const hosted = await Promise.all(
          urls.map(async (u) => {
            if (!u.startsWith('data:')) return u;
            try {
              return await aiHostImage(u);
            } catch {
              return u;
            }
          }),
        );
        if (hosted.every((h, i) => h === urls[i])) return;
        const latest = reviewImages(getReview(offerSlug, piece.id));
        let next = [...latest];
        for (let i = 0; i < urls.length; i++) {
          const from = urls[i];
          const to = hosted[i];
          if (from === to) continue;
          const idx = next.indexOf(from);
          if (idx >= 0) next[idx] = to;
        }
        const activeIdx = clampIndex(
          getReview(offerSlug, piece.id).imageIndex,
          next.length,
        );
        setReview(setReviewImages(offerSlug, piece.id, next, activeIdx));
      } catch {
        /* keep data URLs */
      }
    })();
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
    // A/B image set with no gallery yet: promote the catalog frames so the
    // choice persists against the concrete image list.
    else if (view.images.length > 1)
      setReview(setReviewImages(offerSlug, piece.id, view.images, index));
    // Slide-only deck (frames outrun rendered images): just remember which
    // frame is active; buildView clamps it across the slide count.
    else apply({ imageIndex: index });
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
              {frameCount > 1 && (
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Selector
                    label={isDeck ? 'Frame' : 'Image variant'}
                    items={Array.from({ length: frameCount }, (_, i) =>
                      `${i + 1}`,
                    )}
                    active={effectiveIndex}
                    // A manual pick pauses autoplay and persists the choice.
                    onSelect={(i) => {
                      setAutoplay(false);
                      setPreviewIndex(i);
                      setImageIndex(i);
                    }}
                    compact
                  />
                  {canAutoplay && (
                    <button
                      type="button"
                      onClick={() => {
                        // Resume from the frame currently on screen.
                        if (!autoplay) setPreviewIndex(effectiveIndex);
                        setAutoplay((a) => !a);
                      }}
                      aria-pressed={running}
                      title={running ? 'Pause autoplay' : 'Play frames'}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70 hover:border-ink/30 hover:text-ink"
                    >
                      {running ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {running ? 'Pause' : 'Play'}
                    </button>
                  )}
                </div>
              )}

              {(piece.platform === 'tiktok' ||
                piece.format === 'story' ||
                piece.format === 'reel') && (
                <label className="flex items-center gap-2 text-xs text-ink/65">
                  <input
                    type="checkbox"
                    checked={showHookText}
                    onChange={(e) => setShowHookText(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-ink/30 text-mode focus:ring-mode"
                  />
                  Show hook text over image
                  <span className="text-ink/40">
                    (off to preview burned-in type alone)
                  </span>
                </label>
              )}
              {/* Hover/focus pauses autoplay so the reviewer can study a frame. */}
              <div
                className="flex justify-center"
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                onFocusCapture={() => setHovering(true)}
                onBlurCapture={() => setHovering(false)}
              >
                <PlatformPreview
                  piece={piece}
                  review={previewReview}
                  showHookText={showHookText}
                  autoplay={running}
                  frameDurationMs={FRAME_MS}
                />
              </div>

            </div>
          )}

          {tab === 'edit' && (
            <EditForm
              piece={piece}
              review={review}
              offerSlug={offerSlug}
              onUploadImage={onUploadImage}
              onAddImages={addImages}
              onRemoveImage={removeImage}
              onSetImageIndex={setImageIndex}
              onEditPatch={applyEdits}
              onReviewChange={(next) => {
                // Helpers like setReviewVideoScript already persisted; overlay
                // and compliance may pass a full next object — merge via save.
                const cached = getReview(offerSlug, piece.id);
                if (next === cached) {
                  setReview(next);
                  return;
                }
                // Prefer fields that differ from cache so we don't clobber
                // concurrent image gallery writes with a stale review prop.
                setReview(saveReview(offerSlug, piece.id, next));
              }}
            />
          )}


          {tab === 'compliance' && (
            <CompliancePanel
              piece={piece}
              review={review}
              offerSlug={offerSlug}
              onEditPatch={applyEdits}
              onReviewChange={(next) =>
                setReview(
                  saveReview(offerSlug, piece.id, {
                    compliance: next.compliance,
                  }),
                )
              }
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

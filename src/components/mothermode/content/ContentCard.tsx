'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  LayoutGrid,
  Smartphone,
  Film,
  ListOrdered,
  FileText,
  Video,
  Square,
  Pin,
  Sparkles,
  Newspaper,
  Search,
  MessageCircleQuestion,
  ImagePlus,
  Trash2,
  StickyNote,
  Maximize2,
} from 'lucide-react';
import { MediaFrame } from '@/components/mothermode/parts/MediaFrame';
import { PlatformIcon, PLATFORM_BRAND } from './PlatformIcon';
import {
  pieceToText,
  buildImagePrompt,
  FORMAT_LABEL,
  KIND_LABEL,
  PLATFORM_LABEL,
  TONE_LABEL,
  type ContentFormat,
  type ContentPiece,
} from '@/lib/mothermode/content';
import {
  loadReviews,
  getReview,
  saveReview,
  clearReviewImage,
} from './reviewClient';

/** Lucide glyph per native format, for a quick visual read on each card. */
const FORMAT_ICON: Record<ContentFormat, React.ElementType> = {
  feed: Square,
  carousel: LayoutGrid,
  story: Smartphone,
  reel: Film,
  thread: ListOrdered,
  article: FileText,
  video: Video,
  email: Mail,
  pin: Pin,
  idea: Sparkles,
  blog: Newspaper,
  answer: MessageCircleQuestion,
};

/** One marketing piece, rendered as a copy-ready card for internal use. The
 *  optional offerUrl overrides the CTA link a copied piece routes to, so the
 *  same library can point at any offer's sales page. onOpen, when provided,
 *  launches the platform-accurate sheet for previewing, editing, and metrics. */
export const ContentCard: React.FC<{
  piece: ContentPiece;
  offerUrl?: string;
  offerSlug: string;
  onOpen?: () => void;
  /** When set, renders a delete control. Only passed for generated pieces. */
  onDelete?: () => void;
}> = ({ piece, offerUrl, offerSlug, onOpen, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [hookIndex, setHookIndex] = useState(0);
  const [image, setImage] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the shared review state (uploaded image + change notes) from the cache,
  // hydrating it once per offer if needed.
  useEffect(() => {
    let active = true;
    void loadReviews(offerSlug).then(() => {
      if (!active) return;
      const review = getReview(offerSlug, piece.id);
      setImage(review.image);
      setNotes(review.notes ?? '');
    });
    return () => {
      active = false;
    };
  }, [offerSlug, piece.id]);

  const hooks =
    piece.hooks && piece.hooks.length > 0 ? piece.hooks : [piece.hook];
  const activeHook = hooks[hookIndex] ?? piece.hook;
  const hasReview = Boolean(image) || notes.trim().length > 0;
  // Hook-anchored image prompt, rebuilt as the active hook variant changes.
  const imagePrompt = piece.media?.prompt
    ? buildImagePrompt(piece.media.prompt, activeHook)
    : undefined;

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setImage(dataUrl);
      saveReview(offerSlug, piece.id, { image: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setImage(undefined);
    clearReviewImage(offerSlug, piece.id);
  };

  const saveNotes = () => {
    saveReview(offerSlug, piece.id, { notes: notes.trim() || undefined });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1800);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        pieceToText(piece, activeHook, offerUrl),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const copyPrompt = async () => {
    if (!imagePrompt) return;
    try {
      await navigator.clipboard.writeText(imagePrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  };

  const cycleHook = (dir: 1 | -1) =>
    setHookIndex((i) => (i + dir + hooks.length) % hooks.length);

  const FormatIcon = FORMAT_ICON[piece.format];

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-bone p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-md"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: PLATFORM_BRAND[piece.platform] }}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mode px-2.5 py-1 font-semibold text-bone">
          <PlatformIcon platform={piece.platform} className="h-3.5 w-3.5" />
          {PLATFORM_LABEL[piece.platform]}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-2.5 py-1 text-ink/70">
          <FormatIcon className="h-3.5 w-3.5" />
          {FORMAT_LABEL[piece.format]}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            piece.kind === 'ad'
              ? 'bg-brass/20 text-brass'
              : 'bg-mushroom/20 text-ink/60'
          }`}
        >
          {KIND_LABEL[piece.kind]}
        </span>
        {piece.generated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brass/15 px-2 py-1 font-medium text-brass">
            <Sparkles className="h-3 w-3" />
            Generated
          </span>
        )}
        {hasReview && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mode/10 px-2 py-1 font-medium text-mode">
            <StickyNote className="h-3 w-3" />
            Review
          </span>
        )}
        <span className="ml-auto text-ink/45">{TONE_LABEL[piece.tone]}</span>
      </div>

      {(piece.media || image) && (
        <div className="mt-4">
          <MediaFrame
            src={
              image ??
              (piece.media?.type === 'video'
                ? piece.media?.poster
                : piece.media?.src)
            }
            alt={piece.media?.alt ?? piece.title}
            label={piece.media?.type === 'video' ? 'Video' : 'Image'}
            hint={piece.media?.hint}
            aspect={piece.media?.aspect ?? 'aspect-[4/5]'}
            video={piece.media?.type === 'video' && !image}
          />
          {image && (
            <p className="mt-1.5 text-[11px] text-ink/45">
              Custom image added for review.
            </p>
          )}
        </div>
      )}

      <h3 className="mt-4 font-display text-xl leading-snug text-ink">
        {piece.title}
      </h3>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brass">
        {piece.theme}
      </p>

      {piece.email && (
        <div className="mt-3 rounded-xl border border-ink/10 bg-mushroom/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Mail className="h-4 w-4 text-mode" />
            {piece.email.subject}
          </p>
          {piece.email.preheader && (
            <p className="mt-1 text-ink/55">{piece.email.preheader}</p>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink/40">
            {hooks.length > 1 ? `Hook ${hookIndex + 1} of ${hooks.length}` : 'Hook'}
          </span>
          {hooks.length > 1 && (
            <span className="flex items-center gap-1">
              <button
                onClick={() => cycleHook(-1)}
                aria-label="Previous hook"
                className="rounded-full border border-ink/15 p-1 text-ink/55 transition-colors hover:border-ink/30 hover:text-ink"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {hooks.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHookIndex(i)}
                  aria-label={`Hook ${i + 1}`}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === hookIndex ? 'bg-mode' : 'bg-ink/20 hover:bg-ink/40'
                  }`}
                />
              ))}
              <button
                onClick={() => cycleHook(1)}
                aria-label="Next hook"
                className="rounded-full border border-ink/15 p-1 text-ink/55 transition-colors hover:border-ink/30 hover:text-ink"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{activeHook}</p>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-mode px-4 py-2 text-sm font-semibold text-bone transition-colors hover:bg-mode-deep"
        >
          {copied ? (
            <Check className="h-4 w-4 text-brass" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? 'Copied' : 'Copy text'}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/70 transition-colors hover:border-ink/30"
        >
          {open ? 'Hide' : 'View'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {(onOpen || onDelete) && (
          <div className="ml-auto flex items-center gap-2">
            {onOpen && (
              <button
                onClick={onOpen}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/70 transition-colors hover:border-ink/30"
              >
                <Maximize2 className="h-4 w-4" />
                Open
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                aria-label="Delete generated piece"
                className="inline-flex items-center justify-center rounded-full border border-ink/15 p-2 text-ink/55 transition-colors hover:border-ink/30 hover:text-ink"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t border-ink/10 pt-5 text-sm leading-relaxed text-ink/80">
          {piece.ad && (
            <div className="rounded-xl bg-mushroom/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass">
                Ad manager
              </p>
              <p className="mt-2 whitespace-pre-line">{piece.ad.primaryText}</p>
              <p className="mt-2 text-ink/60">
                <strong>Headline:</strong> {piece.ad.headline}
              </p>
              {piece.ad.description && (
                <p className="text-ink/60">
                  <strong>Description:</strong> {piece.ad.description}
                </p>
              )}
              <p className="text-ink/60">
                <strong>Button:</strong> {piece.ad.button}
              </p>
            </div>
          )}

          {hooks.length > 1 && (
            <div className="rounded-xl bg-mushroom/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass">
                Hook variants
              </p>
              <ol className="mt-2 space-y-1.5">
                {hooks.map((h, i) => (
                  <li
                    key={`hk${i}`}
                    className={i === hookIndex ? 'text-ink' : 'text-ink/55'}
                  >
                    <span className="text-brass">{i + 1}.</span> {h}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {imagePrompt && (
            <div className="rounded-xl bg-mushroom/10 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
                  <Sparkles className="h-3.5 w-3.5" />
                  Image prompt (tied to hook {hookIndex + 1})
                </p>
                <button
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-xs text-ink/65 transition-colors hover:border-ink/30 hover:text-ink"
                >
                  {promptCopied ? (
                    <Check className="h-3.5 w-3.5 text-mode" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {promptCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-ink/70">{imagePrompt}</p>
            </div>
          )}

          {piece.body?.map((p, i) => <p key={`b${i}`}>{p}</p>)}

          {piece.tweets && (
            <ol className="space-y-2">
              {piece.tweets.map((t, i) => (
                <li key={`t${i}`} className="flex gap-2">
                  <span className="text-brass">{i + 1}/</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          )}

          {piece.slides && (
            <ol className="space-y-2">
              {piece.slides.map((s, i) => (
                <li key={`s${i}`}>
                  <span className="text-brass">Slide {i + 1}: </span>
                  {s.text}
                  {s.sub && <span className="block text-ink/55">{s.sub}</span>}
                </li>
              ))}
            </ol>
          )}

          {piece.script && (
            <ol className="space-y-3">
              {piece.script.map((b, i) => (
                <li key={`sc${i}`}>
                  <p className="text-xs font-semibold uppercase text-brass">
                    {b.at}
                  </p>
                  {b.onScreen && <p className="text-ink/60">On screen: {b.onScreen}</p>}
                  {b.voiceover && <p>{b.voiceover}</p>}
                </li>
              ))}
            </ol>
          )}

          {piece.caption && (
            <p className="text-ink/60">
              <strong>Caption:</strong> {piece.caption}
            </p>
          )}

          {piece.seo && (
            <div className="rounded-xl border border-ink/10 bg-mushroom/10 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
                <Search className="h-3.5 w-3.5" />
                SEO and AEO
              </p>
              {piece.seo.slug && (
                <p className="mt-2 text-ink/60">
                  <strong>Slug:</strong> /{piece.seo.slug}
                </p>
              )}
              <p className="mt-1 text-ink/60">
                <strong>Meta title:</strong> {piece.seo.metaTitle}
              </p>
              <p className="text-ink/60">
                <strong>Meta description:</strong> {piece.seo.metaDescription}
              </p>
              <p className="mt-1 text-brass">
                {piece.seo.keywords.join(' · ')}
              </p>
              {piece.seo.questions && piece.seo.questions.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Questions answered
                  </p>
                  {piece.seo.questions.map((qa, i) => (
                    <div key={`qa${i}`}>
                      <p className="font-medium text-ink">{qa.q}</p>
                      <p className="text-ink/65">{qa.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="font-medium text-ink">{piece.cta}</p>

          {piece.hashtags && (
            <p className="text-brass">
              {piece.hashtags.map((h) => `#${h}`).join(' ')}
            </p>
          )}

          {piece.visual && (
            <p className="text-xs italic text-ink/45">Visual: {piece.visual}</p>
          )}

          <div className="rounded-xl border border-dashed border-ink/20 bg-white/40 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brass">
              <StickyNote className="h-3.5 w-3.5" />
              Client review
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70 transition-colors hover:border-ink/30"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {image ? 'Replace image' : 'Upload image'}
              </button>
              {image && (
                <button
                  onClick={removeImage}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/60 transition-colors hover:border-ink/30 hover:text-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink/40">
                Notes for changes (copy or image)
              </span>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesSaved(false);
                }}
                onBlur={saveNotes}
                rows={3}
                placeholder="e.g. Soften the second hook. Swap the image for something warmer."
                className="mt-1.5 w-full rounded-lg border border-ink/15 bg-white/70 p-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-mode focus:outline-none"
              />
            </label>

            <div className="mt-2 flex items-center justify-end gap-2">
              {notesSaved && <span className="text-xs text-mode">Saved</span>}
              <button
                onClick={saveNotes}
                className="inline-flex items-center gap-1.5 rounded-full bg-mode px-3 py-1.5 text-xs font-semibold text-bone transition-colors hover:bg-mode-deep"
              >
                <Check className="h-3.5 w-3.5" />
                Save notes
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

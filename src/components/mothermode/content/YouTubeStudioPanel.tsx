'use client';

/**
 * YouTube Studio panel for a content piece: generate an A/B set of titles, an
 * SEO description, search tags, chapter markers, and thumbnail concepts, then
 * render a chosen thumbnail with the image API. Everything persists to the
 * piece's review state so it exports alongside the rest of the content.
 */
import React, { useState } from 'react';
import {
  Youtube,
  Copy,
  Check,
  ImagePlus,
  Loader2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  TONE_LABEL,
  AUTO_MODEL,
  type ContentPiece,
} from '@/lib/mothermode/content';
import {
  chaptersToText,
  youtubeDescriptionText,
  type PieceReview,
  type YouTubeKit,
} from '@/lib/mothermode/content/review';
import {
  setReviewYouTubeKit,
  patchReviewYouTubeKit,
  clearReviewYouTubeKit,
} from './reviewClient';
import { aiGenerateYouTubeKit, aiGenerateImage } from './aiClient';
import {
  useAiAction,
  aiBtnSolid,
  aiBtnGhost,
  Spinner,
  AiError,
  InstructionsInput,
} from './AiControls';

const DURATIONS = [0, 60, 300, 600, 900] as const;
const DURATION_LABEL: Record<number, string> = {
  0: 'Short (no chapters)',
  60: '~1 min',
  300: '~5 min',
  600: '~10 min',
  900: '~15 min',
};

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export const YouTubeStudioPanel: React.FC<{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  /** Optional text model id from the Edit form writer selector. */
  model?: string;
  onReviewChange: (next: PieceReview) => void;
}> = ({ piece, review, offerSlug, model = AUTO_MODEL, onReviewChange }) => {
  const kit = review.youtube;
  const [duration, setDuration] = useState<number>(0);
  const [guides, setGuides] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState<number | null>(null);
  const gen = useAiAction();

  const generate = () =>
    gen.run(async () => {
      // Feed any existing production script VO to inform chapter timing.
      const scriptVo = review.videoScript?.beats
        ?.map((b) => b.voiceover)
        .filter(Boolean);
      const result = await aiGenerateYouTubeKit({
        piece: {
          hook: piece.hook,
          hooks: piece.hooks,
          caption: piece.caption,
          body: piece.body,
          script: scriptVo,
          theme: piece.theme,
          tone: TONE_LABEL[piece.tone],
        },
        durationSec: duration || undefined,
        guides: guides.trim() || undefined,
        model: model || undefined,
      });
      const nextKit: YouTubeKit = {
        titles: result.titles,
        titleIndex: 0,
        description: result.description,
        tags: result.tags,
        chapters: result.chapters,
        thumbnails: result.thumbnails,
        model: result.model,
        generatedAt: new Date().toISOString(),
      };
      onReviewChange(setReviewYouTubeKit(offerSlug, piece.id, nextKit));
    });

  const clear = () => {
    onReviewChange(clearReviewYouTubeKit(offerSlug, piece.id));
  };

  const copy = async (key: string, text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      /* ignore */
    }
  };

  const selectTitle = (index: number) => {
    onReviewChange(patchReviewYouTubeKit(offerSlug, piece.id, { titleIndex: index }));
  };

  const editDescription = (description: string) => {
    onReviewChange(patchReviewYouTubeKit(offerSlug, piece.id, { description }));
  };

  const renderThumbnail = async (index: number) => {
    if (!kit?.thumbnails || thumbBusy !== null) return;
    const thumb = kit.thumbnails[index];
    if (!thumb?.prompt?.trim()) return;
    setThumbBusy(index);
    try {
      // 16:9 landscape render; the "youtube" format hint maps to a wide size.
      const image = await aiGenerateImage(thumb.prompt, 'youtube');
      const thumbnails = kit.thumbnails.map((t, i) =>
        i === index ? { ...t, imageUrl: image } : t,
      );
      onReviewChange(
        patchReviewYouTubeKit(offerSlug, piece.id, { thumbnails }),
      );
    } catch (e) {
      gen.setError(e instanceof Error ? e.message : 'Thumbnail render failed');
    } finally {
      setThumbBusy(null);
    }
  };

  const activeTitle = kit?.titles?.[kit.titleIndex ?? 0] ?? '';
  const fullDescription = youtubeDescriptionText(kit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Youtube className="h-4 w-4 text-[#FF0000]" />
        YouTube Studio
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-600">Runtime</span>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={
                duration === d
                  ? 'rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-400'
              }
            >
              {DURATION_LABEL[d]}
            </button>
          ))}
        </div>
        <InstructionsInput
          value={guides}
          onChange={setGuides}
          placeholder="Optional: target keywords, angle, do/don't…"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={gen.busy}
            className={aiBtnSolid}
          >
            {gen.busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            {kit ? 'Regenerate kit' : 'Generate kit'}
          </button>
          {kit && (
            <button type="button" onClick={clear} className={aiBtnGhost}>
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
        <AiError message={gen.error} />
      </div>

      {kit && (
        <div className="space-y-4">
          {/* Titles */}
          {kit.titles.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Title options
                </h4>
                <button
                  type="button"
                  onClick={() => copy('title', activeTitle)}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  {copied === 'title' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy selected
                </button>
              </div>
              <div className="space-y-1.5">
                {kit.titles.map((t, i) => {
                  const active = (kit.titleIndex ?? 0) === i;
                  return (
                    <label
                      key={i}
                      className={
                        active
                          ? 'flex cursor-pointer items-start gap-2 rounded-md border border-neutral-800 bg-neutral-50 p-2 text-sm'
                          : 'flex cursor-pointer items-start gap-2 rounded-md border border-neutral-200 p-2 text-sm hover:border-neutral-300'
                      }
                    >
                      <input
                        type="radio"
                        name={`yt-title-${piece.id}`}
                        checked={active}
                        onChange={() => selectTitle(i)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 text-neutral-800">{t}</span>
                      <span className="text-[11px] text-neutral-400">
                        {t.length}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Description */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Description
              </h4>
              <button
                type="button"
                onClick={() => copy('desc', fullDescription)}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
              >
                {copied === 'desc' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy (with chapters)
              </button>
            </div>
            <textarea
              value={kit.description}
              onChange={(e) => editDescription(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-neutral-200 p-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none"
            />
          </section>

          {/* Chapters */}
          {kit.chapters && kit.chapters.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Chapters
                </h4>
                <button
                  type="button"
                  onClick={() => copy('chapters', chaptersToText(kit.chapters))}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  {copied === 'chapters' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </button>
              </div>
              <ul className="space-y-1 rounded-md border border-neutral-200 p-2 text-sm">
                {kit.chapters.map((c, i) => (
                  <li key={i} className="flex gap-2 text-neutral-700">
                    <span className="w-12 shrink-0 font-mono text-neutral-400">
                      {fmtClock(c.startSec)}
                    </span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tags */}
          {kit.tags.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Tags
                </h4>
                <button
                  type="button"
                  onClick={() => copy('tags', kit.tags.join(', '))}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  {copied === 'tags' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kit.tags.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Thumbnails */}
          {kit.thumbnails && kit.thumbnails.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Thumbnail concepts
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {kit.thumbnails.map((thumb, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-md border border-neutral-200 p-2"
                  >
                    <div className="aspect-video overflow-hidden rounded bg-neutral-100">
                      {thumb.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb.imageUrl}
                          alt={thumb.concept}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                          16:9 preview
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium text-neutral-700">
                      {thumb.concept}
                    </p>
                    {thumb.overlayText && (
                      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Overlay: {thumb.overlayText}
                      </p>
                    )}
                    <p className="line-clamp-3 text-[11px] text-neutral-400">
                      {thumb.prompt}
                    </p>
                    <button
                      type="button"
                      onClick={() => renderThumbnail(i)}
                      disabled={thumbBusy !== null}
                      className={aiBtnGhost}
                    >
                      {thumbBusy === i ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      {thumb.imageUrl ? 'Re-render' : 'Render'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {kit.model && (
            <p className="text-[11px] text-neutral-400">
              Written by {kit.model}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default YouTubeStudioPanel;

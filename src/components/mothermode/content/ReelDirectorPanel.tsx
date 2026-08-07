'use client';

/**
 * Reel Director panel: turns a rendered storyboard pack into a set of Seedance
 * video clips. For each board it composes the layered cinematic prompt (master
 * meta -> storyboard -> brand -> audio -> negatives) with buildSeedancePrompt,
 * lets the admin fine-tune it, then submits an image-to-video render of the
 * board's still and polls until the hosted clip URL comes back — persisting the
 * prompt, task id, status, and final URL onto the board via reviewClient.
 *
 * The storyboard is always the source of truth: we animate the existing frame,
 * we never regenerate composition here.
 *
 * Rendering is slow (minutes per clip) and costs credits, so the UI is explicit
 * about both: a standing time/cost banner, a live per-board status + elapsed
 * timer while a clip renders, and an estimated per-clip cost that tracks the
 * chosen model.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  Clock,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Scissors,
  Wallet,
} from 'lucide-react';
import {
  buildSeedancePrompt,
  REEL_WRAPPER_LIST,
} from '@/lib/mothermode/content/reelDirector';
import {
  buildReelAssemblyPlan,
  boardsReadyForAssembly,
  boardsRemaining,
  describeWrapper,
} from '@/lib/mothermode/content/reelAssembly';
import type {
  PieceReview,
  StoryboardBoard,
  StoryboardPack,
  ReelWrapper,
} from '@/lib/mothermode/content/review';

import { patchReviewStoryboardBoard, patchReviewReelCut } from './reviewClient';
import { renderSeedanceClip, type SeedanceTaskStatus } from './seedanceClient';
import { assembleReelCut } from './reelCutClient';


/** Aspect ratios the pipeline supports, vertical-first for reels. */
const ASPECT_RATIOS: { id: string; label: string }[] = [
  { id: '9:16', label: '9:16 · Reel' },
  { id: '1:1', label: '1:1 · Square' },
  { id: '16:9', label: '16:9 · Wide' },
];

/** Clip durations Seedance accepts, in seconds. */
const DURATIONS = [3, 5, 8, 10];

/**
 * Seedance models selectable at render time. The value is sent as-is to MUAPI;
 * leave it as one of the slugs MUAPI lists in its model catalog. "" means
 * "use the server default" (MUAPI_SEEDANCE_MODEL).
 *
 * `estUsd` is a rough, editable estimate of the MUAPI charge **per rendered
 * clip** (MUAPI bills a flat amount per generation, not per second) used only
 * to preview cost in the UI — MUAPI bills the real amount. Update these if MUAPI
 * changes pricing. This is a curated shortlist (best quality vs. cost) of the
 * Seedance 2 image-to-video / omni-reference tiers; the VIP Omni Reference
 * 1080p tier is the default because it carries the storyboard still + reference
 * stills for character/prop consistency.
 */
interface SeedanceModel {
  id: string;
  label: string;
  /** Estimated flat USD charge per rendered clip; used only for the UI preview. */
  estUsd: number;
  /** Short note shown next to the option. */
  note?: string;
}

const SEEDANCE_MODELS: SeedanceModel[] = [
  {
    id: 'seedance-2-vip-omni-reference-1080p',
    label: 'SD2 · VIP Omni Reference · 1080p',
    estUsd: 3.38,
    note: 'Recommended · omni-reference',
  },
  {
    id: 'seedance-2-vip-omni-reference-4k',
    label: 'SD2 · VIP Omni Reference · 4K',
    estUsd: 6.75,
    note: 'Premium · omni-reference · 4K',
  },
  {
    id: 'seedance-2-omni-reference-no-video-fast',
    label: 'SD2 · Omni Reference · Fast',
    estUsd: 0.75,
    note: 'Low cost · omni-reference',
  },
  {
    id: 'seedance-2.5-image-to-video',
    label: 'SD2.5 · Image-to-Video · 4K',
    estUsd: 0.6,
    note: 'Best quality · 4K',
  },
  {
    id: 'seedance-2.1-image-to-video',
    label: 'SD2.1 · Image-to-Video · 1080p',
    estUsd: 0.4,
    note: 'Great value',
  },
  {
    id: 'seedance-2-mini-image-to-video',
    label: 'SD2 Mini · Image-to-Video · 720p',
    estUsd: 0.2,
    note: 'Fastest · cheapest',
  },
  { id: '', label: 'Server default', estUsd: 3.38 },
];

/** Look up the selected model's metadata (falls back to the first entry). */
function modelMeta(id: string): SeedanceModel {
  return SEEDANCE_MODELS.find((m) => m.id === id) ?? SEEDANCE_MODELS[0];
}

/** Estimated flat per-clip cost string, e.g. "≈ $0.60". */
function estCost(modelId: string): string {
  return `≈ $${modelMeta(modelId).estUsd.toFixed(2)}`;
}

/** Format elapsed milliseconds as m:ss. */
function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ReelDirectorPanelProps {
  offerSlug: string;
  pieceId: string;
  pack: StoryboardPack;
  /** Notified with the updated review after a board changes, so parents refresh. */
  onReviewChange?: (review: PieceReview) => void;
}

/** Human label for a live render status. */
function liveLabel(status: SeedanceTaskStatus | undefined): string {
  switch (status) {
    case 'pending':
      return 'Queued…';
    case 'processing':
      return 'Rendering…';
    case 'succeeded':
      return 'Finishing…';
    default:
      return 'Working…';
  }
}

/** Human label + tone for a board's render status chip. */
function statusChip(status: StoryboardBoard['videoStatus']): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'rendering':
      return { label: 'Rendering…', className: 'bg-amber-100 text-amber-700' };
    case 'done':
      return { label: 'Rendered', className: 'bg-emerald-100 text-emerald-700' };
    case 'failed':
      return { label: 'Failed', className: 'bg-rose-100 text-rose-700' };
    default:
      return { label: 'Not rendered', className: 'bg-ink/10 text-ink/60' };
  }
}

export default function ReelDirectorPanel({
  offerSlug,
  pieceId,
  pack,
  onReviewChange,
}: ReelDirectorPanelProps) {
  const [wrapper, setWrapper] = useState<ReelWrapper>('silent');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [durationSec, setDurationSec] = useState<number>(5);
  const [model, setModel] = useState<string>(SEEDANCE_MODELS[0].id);

  // Per-board draft prompts (index -> composed/edited prompt text).
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // Per-board transient error, keyed by board index.
  const [errors, setErrors] = useState<Record<number, string>>({});
  // Board indices currently rendering, so we can disable their buttons.
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  // Live provider status per board while a render is in flight.
  const [liveStatus, setLiveStatus] = useState<
    Record<number, SeedanceTaskStatus>
  >({});
  // When each in-flight render started, so we can show an elapsed timer.
  const [startedAt, setStartedAt] = useState<Record<number, number>>({});
  // Ticking clock (updated every second while any render is running).
  const [now, setNow] = useState<number>(() => Date.now());
  // Count of boards whose prompt was just recomposed, for a brief confirmation.
  const [recomposedCount, setRecomposedCount] = useState<number>(0);

  // Final-reel assembly state.
  const [assembling, setAssembling] = useState<boolean>(false);
  const [assembleErr, setAssembleErr] = useState<string>('');
  // Locally tracked assembled reel (mirrors what we persist onto the review).
  const [reelUrl, setReelUrl] = useState<string>('');
  const [reelDuration, setReelDuration] = useState<number>(0);


  const anyBusy = useMemo(
    () => Object.values(busy).some(Boolean),
    [busy],
  );

  // Run a 1s clock only while something is rendering, to drive elapsed timers.
  useEffect(() => {
    if (!anyBusy) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyBusy]);

  // Auto-dismiss the "prompts recomposed" confirmation.
  useEffect(() => {
    if (recomposedCount <= 0) return;
    const t = setTimeout(() => setRecomposedCount(0), 3000);
    return () => clearTimeout(t);
  }, [recomposedCount]);

  const boards = useMemo(
    () => (Array.isArray(pack.boards) ? pack.boards : []),
    [pack.boards],
  );

  /** The composed prompt for a board: the draft if edited, else freshly built. */
  function promptFor(board: StoryboardBoard): string {
    const draft = drafts[board.index];
    if (typeof draft === 'string') return draft;
    if (board.seedancePrompt) return board.seedancePrompt;
    return buildSeedancePrompt({ board, wrapper });
  }

  /** Recompose every board's prompt from the current wrapper (discards edits). */
  function recomposeAll() {
    const next: Record<number, string> = {};
    boards.forEach((b) => {
      next[b.index] = buildSeedancePrompt({ board: b, wrapper });
    });
    setDrafts(next);
    setRecomposedCount(boards.length);
  }

  /** Persist a board patch and bubble the fresh review to the parent. */
  function patchBoard(index: number, patch: Partial<StoryboardBoard>) {
    const review = patchReviewStoryboardBoard(offerSlug, pieceId, index, patch);
    onReviewChange?.(review);
  }

  async function handleRender(board: StoryboardBoard) {
    const imageUrl = board.imageUrl?.trim();
    if (!imageUrl) {
      setErrors((e) => ({
        ...e,
        [board.index]: 'Render this board’s still image first.',
      }));
      return;
    }
    const prompt = promptFor(board).trim();
    if (!prompt) {
      setErrors((e) => ({ ...e, [board.index]: 'Add a prompt to render.' }));
      return;
    }

    setErrors((e) => ({ ...e, [board.index]: '' }));
    setBusy((b) => ({ ...b, [board.index]: true }));
    setStartedAt((s) => ({ ...s, [board.index]: Date.now() }));
    setNow(Date.now());
    setLiveStatus((l) => ({ ...l, [board.index]: 'pending' }));
    patchBoard(board.index, {
      seedancePrompt: prompt,
      videoStatus: 'rendering',
    });

    try {
      const videoUrl = await renderSeedanceClip(
        {
          prompt,
          imageUrl,
          aspectRatio,
          durationSec,
          model: model || undefined,
          // The cast rides every board's render: the storyboard's reference
          // images (a picked character sheet, product stills) go to the
          // omni-reference model in slot order.
          referenceImages: (pack?.referenceImages ?? []).filter(
            (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u),
          ),
        },
        {
          onStatus: (s: SeedanceTaskStatus) => {
            setLiveStatus((l) => ({ ...l, [board.index]: s }));
          },
        },
      );
      patchBoard(board.index, { videoUrl, videoStatus: 'done' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Render failed';
      setErrors((e) => ({ ...e, [board.index]: msg }));
      patchBoard(board.index, { videoStatus: 'failed' });
    } finally {
      setBusy((b) => ({ ...b, [board.index]: false }));
      setLiveStatus((l) => {
        const next = { ...l };
        delete next[board.index];
        return next;
      });
    }
  }

  /** Assemble every rendered board clip into one stitched reel and persist it. */
  async function handleAssemble() {
    setAssembleErr('');
    // The panel is driven by the pack; wrap it as a review for the planner. A
    // voice wrapper needs a combined voiceover on the script, which is surfaced
    // by the planner's own error when it is missing.
    const reviewForPlan: PieceReview = { storyboard: pack };
    const built = buildReelAssemblyPlan(reviewForPlan, wrapper);
    if (!built.ok) {
      setAssembleErr(built.error);
      return;
    }
    setAssembling(true);
    patchReviewReelCut(offerSlug, pieceId, {
      wrapper,
      boardOrder: built.plan.boardOrder,
      status: 'assembling',
    });

    try {
      const result = await assembleReelCut({
        clips: built.plan.clips,
        audioUrl: built.plan.audioUrl,
      });
      setReelUrl(result.videoUrl);
      setReelDuration(result.durationSec || built.plan.durationSec);
      const review = patchReviewReelCut(offerSlug, pieceId, {
        videoUrl: result.videoUrl,
        durationSec: result.durationSec || built.plan.durationSec,
        status: 'done',
      });
      onReviewChange?.(review);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assembly failed';
      setAssembleErr(msg);
      patchReviewReelCut(offerSlug, pieceId, { status: 'failed' });
    } finally {
      setAssembling(false);
    }
  }

  // Assembly readiness, derived from the pack (wrapped as a review).
  const reviewForPlan: PieceReview = useMemo(
    () => ({ storyboard: pack }),
    [pack],
  );
  const allReady = boardsReadyForAssembly(reviewForPlan);
  const remaining = boardsRemaining(reviewForPlan);

  if (boards.length === 0) {
    return (

      <div className="rounded-lg border border-dashed border-ink/20 bg-white/50 px-4 py-8 text-center text-sm text-ink/60">
        <Film className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Generate a storyboard first — the Reel Director animates its frames into
        video clips.
      </div>
    );
  }

  const selected = modelMeta(model);

  return (
    <div className="space-y-4">
      {/* Standing time + cost notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Heads up — video renders take a
          while.</span>{' '}
          Each clip usually takes 2–5 minutes (occasionally longer). Keep this
          tab open until it finishes. Every render spends MUAPI credits, so
          only render boards you intend to use.
        </p>
      </div>

      {/* Global render controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-ink/10 bg-white/60 px-3 py-3">
        <div className="flex items-center gap-2 text-mode">
          <Clapperboard className="h-4 w-4" />
          <span className="text-sm font-medium">Reel Director</span>
        </div>
        <label className="flex flex-col text-[11px] uppercase tracking-wide text-ink/60">
          Audio wrapper
          <select
            className="mt-1 rounded border border-ink/20 bg-white px-2 py-1 text-sm text-ink"
            value={wrapper}
            onChange={(e) => setWrapper(e.target.value as ReelWrapper)}
          >
            {REEL_WRAPPER_LIST.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-wide text-ink/60">
          Aspect ratio
          <select
            className="mt-1 rounded border border-ink/20 bg-white px-2 py-1 text-sm text-ink"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
          >
            {ASPECT_RATIOS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-wide text-ink/60">
          Duration
          <select
            className="mt-1 rounded border border-ink/20 bg-white px-2 py-1 text-sm text-ink"
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col text-[11px] uppercase tracking-wide text-ink/60">
          Model
          <select
            className="mt-1 w-full max-w-[16rem] truncate rounded border border-ink/20 bg-white px-2 py-1 text-sm text-ink"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title={selected.note ? `${selected.label} — ${selected.note}` : selected.label}
          >
            {SEEDANCE_MODELS.map((m) => (
              <option key={m.id || 'default'} value={m.id}>
                {m.label}
                {m.note ? ` — ${m.note}` : ''} · {estCost(m.id)}
              </option>
            ))}
          </select>
        </label>

        {/* Estimated cost per clip for the current model */}
        <div className="flex flex-col text-[11px] uppercase tracking-wide text-ink/60">
          Est. cost / clip
          <span className="mt-1 inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700">
            <Wallet className="h-3.5 w-3.5" />
            {estCost(model)}
          </span>
        </div>

        <button
          type="button"
          onClick={recomposeAll}
          className="ml-auto inline-flex items-center gap-1 rounded border border-ink/20 px-2 py-1 text-xs text-ink/70 hover:bg-ink/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recompose prompts
        </button>
      </div>

      {/* Cost + recompose confirmation line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink/50">
        <span>
          {selected.label} · {estCost(model)} per clip (flat estimate — MUAPI
          bills the actual amount).
        </span>
        {recomposedCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mode/10 px-2 py-0.5 font-medium text-mode">
            <RefreshCw className="h-3 w-3" />
            Recomposed {recomposedCount} prompt
            {recomposedCount === 1 ? '' : 's'} from the “{wrapper}” wrapper —
            edits discarded.
          </span>
        ) : null}
      </div>

      {/* Per-board render cards */}
      <div className="space-y-3">
        {boards.map((board) => {
          const chip = statusChip(board.videoStatus);
          const rendering =
            busy[board.index] || board.videoStatus === 'rendering';
          const err = errors[board.index];
          const started = startedAt[board.index];
          const elapsed = rendering && started ? now - started : 0;
          const live = liveStatus[board.index];
          return (
            <div
              key={board.index}
              className="rounded-lg border border-ink/10 bg-white/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {board.index}. {board.title || 'Untitled board'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${chip.className}`}
                >
                  {chip.label}
                </span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[140px_1fr]">
                {/* Still / rendered clip */}
                <div className="space-y-2">
                  {board.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={board.imageUrl}
                      alt={board.title}
                      className="w-full rounded border border-ink/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded border border-dashed border-ink/20 text-[11px] text-ink/50">
                      No still yet
                    </div>
                  )}
                  {board.videoUrl ? (
                    <video
                      src={board.videoUrl}
                      controls
                      className="w-full rounded border border-mode/30"
                    />
                  ) : null}
                </div>

                {/* Prompt + actions */}
                <div className="space-y-2">
                  <textarea
                    rows={6}
                    className="w-full rounded border border-ink/20 bg-white px-2 py-1 text-xs text-ink"
                    value={promptFor(board)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [board.index]: e.target.value }))
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={rendering || !board.imageUrl}
                      onClick={() => handleRender(board)}
                      className="inline-flex items-center gap-1 rounded bg-mode px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {rendering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {rendering
                        ? `${liveLabel(live)} ${fmtElapsed(elapsed)}`
                        : board.videoUrl
                        ? 'Re-render clip'
                        : `Render clip · ${estCost(model)}`}
                    </button>
                    {rendering ? (
                      <span className="text-[11px] text-ink/50">
                        This can take a few minutes — keep the tab open.
                      </span>
                    ) : null}
                    {err ? (
                      <span className="text-xs text-rose-600">{err}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final reel assembly */}
      <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-mode">
            <Scissors className="h-4 w-4" />
            <span className="text-sm font-medium">Assemble final reel</span>
          </div>
          <span className="text-[11px] text-ink/50">
            {describeWrapper(wrapper)}
          </span>
        </div>

        <p className="mt-1 text-xs text-ink/60">
          Stitches every rendered board clip together in order
          {allReady
            ? ' — all boards are ready.'
            : ` — ${remaining} clip${remaining === 1 ? '' : 's'} still ${
                remaining === 1 ? 'needs' : 'need'
              } a render.`}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={assembling || anyBusy || !allReady}
            onClick={handleAssemble}
            className="inline-flex items-center gap-1 rounded bg-mode px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {assembling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5" />
            )}
            {assembling ? 'Assembling…' : 'Assemble reel'}
          </button>
          {assembling ? (
            <span className="text-[11px] text-ink/50">
              Stitching clips — this can take a minute.
            </span>
          ) : null}
          {assembleErr ? (
            <span className="text-xs text-rose-600">{assembleErr}</span>
          ) : null}
        </div>

        {reelUrl ? (
          <div className="mt-3 space-y-1">
            <video
              src={reelUrl}
              controls
              className="w-full max-w-sm rounded border border-mode/30"
            />
            <p className="text-[11px] text-ink/50">
              Assembled reel{reelDuration ? ` · ${reelDuration}s` : ''}.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}



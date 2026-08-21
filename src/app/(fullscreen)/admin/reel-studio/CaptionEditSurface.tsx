'use client';

/**
 * CaptionEditSurface — the stage overlay stack, extracted from page.tsx
 * (Task 3, the component half). BOTH preview branches mount this with their
 * surface-specific props, so the two copies that used to drift in the page
 * are one component now:
 *
 *   - the Words/Preview pill (Remotion branch only — the edit stage has no pill)
 *   - the edit-shield (Remotion branch only, in Words mode)
 *   - CaptionDragLayer (both branches, in Preview mode)
 *   - WordDragLayer (both branches, in Words mode — `mapGlyphIndex` and the
 *     fxTarget seed differ per surface, preserved exactly)
 *   - the CueDragLayer(s) (identical on both)
 *
 * and `CaptionWordContextMenu` — the right-click word menu mount, which the
 * page renders ONCE at its root (it was never per-branch).
 *
 * PURE EXTRACTION: every className, gate, and handler is the one the page
 * had inline. The caption-edit state + handlers come in as the `edit` prop
 * (the useCaptionEdit return) — this file owns no state of its own.
 */
import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import type {
  ReelClip,
  ReelMediaCue,
  ReelProject,
} from '@/lib/mothermode/reel/types';
import {
  CAPTION_SIZE_DEFAULT,
  type CaptionOverrides,
} from '@/lib/mothermode/reel/captions';
import { freePlaceWordsFrom, WordContextMenu, type WordPlace } from './WordDragLayer';
import {
  planWordIndexFromClipIndex,
  timelineStartOf,
  wordStylePatchToMark,
  type useCaptionEdit,
} from './useCaptionEdit';

const CaptionDragLayer = dynamic(() => import('./CaptionDragLayer'), { ssr: false });
const WordDragLayer = dynamic(() => import('./WordDragLayer'), { ssr: false });
const CueDragLayer = dynamic(() => import('./CueDragLayer'), { ssr: false });

type Edit = ReturnType<typeof useCaptionEdit>;

export interface CaptionEditSurfaceProps {
  surface: 'remotion' | 'stage';
  project: ReelProject;
  currentClip: ReelClip | null;
  /** The stage's clip (the edit branch gates its overlays on ITS captions). */
  stageClip?: ReelClip | null;
  playheadSec: number;
  ccOn: boolean;
  edit: Edit;
  setCaptionOverrides: (patch: Partial<CaptionOverrides>) => Promise<void>;
  setCaptionOverridesLocal: (patch: Partial<CaptionOverrides>) => void;
  /** The media-cue transform box state (owned by the page). */
  cueStyleEditId: string | null;
  setCueStyleEditId: (id: string | null) => void;
  cueDragLocal: { xPct: number; yPct: number; widthPct: number } | null;
  setCueDragLocal: (l: { xPct: number; yPct: number; widthPct: number } | null) => void;
  patchCueStyle: (
    id: string,
    partial: Partial<NonNullable<ReelMediaCue['style']>>,
  ) => Promise<void>;
  cueOnScreen: (cue: ReelMediaCue) => boolean;
}

export function CaptionEditSurface({
  surface,
  project,
  currentClip,
  stageClip = null,
  playheadSec,
  ccOn,
  edit,
  setCaptionOverrides,
  setCaptionOverridesLocal,
  cueStyleEditId,
  setCueStyleEditId,
  cueDragLocal,
  setCueDragLocal,
  patchCueStyle,
  cueOnScreen,
}: CaptionEditSurfaceProps) {
  const {
    wordPlaceLocal,
    wordScaleLocal,
    stackEditMode,
    showAllCardWords,
    fxWords,
    fxTarget,
    setFxMode,
    setFxTarget,
    setFxWords,
    setStackEditMode,
    setShowAllCardWords,
    applyWordMark,
    removeWordPlace,
    toggleWordBehind,
    resetCaptionWords,
    exitStackEdit,
  } = edit;

  // The overlay gate, exactly as each branch had it: the Remotion branch
  // shows overlays when ANY clip has captions; the edit stage gates on the
  // STAGE clip's own captions.
  const overlaysOn =
    surface === 'remotion'
      ? ccOn && Object.values(project.captions ?? {}).some((w) => (w?.length ?? 0) > 0)
      : ccOn && !!stageClip && (project.captions[stageClip.id]?.length ?? 0) > 0;

  // The Words/Preview pill gate (Remotion branch only).
  const pillOn =
    surface === 'remotion' &&
    !!currentClip &&
    (project.captions[currentClip.id] ?? []).length > 0;

  // The WordDragLayer's word list — identical on both branches: the current
  // clip's words, free-placed at the playhead's page, with the live local
  // drag offsets merged in.
  // useMemo: this list feeds the WordDragLayer's measure effect — a fresh
  // array identity per render re-ran it (measure -> setState -> render).
  const dragWords = useMemo(() => {
    if (!currentClip) return [];
    const base = project.captions[currentClip.id] ?? [];
    const clipSec = Math.max(
      0,
      playheadSec -
        timelineStartOf(
          project.clips,
          Math.max(
            0,
            project.clips.findIndex((c) => c.id === currentClip.id),
          ),
        ),
    );
    const list = freePlaceWordsFrom(base, clipSec, {
      xPct: project.captionOverrides?.xPct ?? 50,
      positionPct: project.captionOverrides?.positionPct ?? 12,
      wordsPerRow: project.captionOverrides?.wordsPerRow,
      // "all" widens the grabbable set to the whole current page (the cascade
      // reveal); off = just the on-screen page. Far-away words never box.
      showAll: showAllCardWords,
    }).map((w) => {
      const loc = wordPlaceLocal[w.index];
      const sc = wordScaleLocal[w.index];
      return {
        ...w,
        xPct: loc ? loc.xPct : w.xPct,
        yPct: loc ? loc.yPct : w.yPct,
        scale: typeof sc === 'number' ? sc : w.scale,
      };
    });
    // The SELECTED word always gets its box (the outline + scale handle) —
    // even when freePlaceWordsFrom didn't surface it (not placed yet, or a
    // future word without "all"). Without this the outline "was gone" on the
    // exact word you're dragging. The glyph measuring positions the box.
    if (fxTarget != null && !list.some((w) => w.index === fxTarget)) {
      const w = base[fxTarget];
      if (w) {
        list.push({
          index: fxTarget,
          xPct: w.mark?.xPct ?? 50,
          yPct: w.mark?.yPct ?? 12,
          label: w.word,
          scale: w.mark?.scale,
          anim: w.mark?.anim,
          color: w.mark?.color,
          fx: w.mark?.fx,
          fxColor: w.mark?.fxColor,
          fxColor2: w.mark?.fxColor2,
          ambient: w.mark?.ambient,
          font: w.mark?.font,
          hidden: w.mark?.hidden,
          placed: typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number',
          behind: w.mark?.behind === true,
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClip, project, playheadSec, showAllCardWords, wordPlaceLocal, wordScaleLocal, fxTarget]);

  // Stable identity — an inline closure here re-ran the measure effect on
  // EVERY render (same loop).
  const mapGlyphIndex = useCallback(
    (i: number) =>
      currentClip ? planWordIndexFromClipIndex(project, currentClip.id, i) ?? i : i,
    [project, currentClip],
  );

  return (
    <>
      {/* Free-place stack Edit/Preview — only when card has placed words
          (Remotion branch only — the edit stage has no pill). */}
      {pillOn && (
        <div
          data-stack-edit-toggle
          className="pointer-events-auto absolute right-2 top-2 z-40 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 p-0.5 text-[10px] shadow-lg backdrop-blur"
        >
          <button
            type="button"
            onClick={() => void resetCaptionWords()}
            className="rounded-full px-1.5 py-1 text-[11px] leading-none text-white/50 hover:text-red-300"
            title="Reset caption edits — clear every free-place position + per-word style on this scene, back to the clean theme"
          >
            ↺
          </button>
          <button
            type="button"
            className={
              stackEditMode
                ? 'rounded-full bg-brass px-2.5 py-1 font-semibold text-ink'
                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
            }
            onClick={() => {
              setStackEditMode(true);
              setFxMode(false);
            }}
            title="Words: edit each word on its own — drag to move, corner to scale, right-click for styles"
          >
            Words
          </button>
          <button
            type="button"
            className={
              !stackEditMode
                ? 'rounded-full bg-white/15 px-2.5 py-1 font-semibold text-white'
                : 'rounded-full px-2.5 py-1 text-white/70 hover:text-white'
            }
            onClick={exitStackEdit}
            title="Preview this section with karaoke timing (saves the placement)"
          >
            Preview
          </button>
          {/* Edit mode opt-in: show EVERY word on the card.
              Off (default) = just the on-screen page, same as
              Preview — so Edit no longer scatters the card. */}
          {stackEditMode && (
            <button
              type="button"
              className={
                showAllCardWords
                  ? 'rounded-full bg-violet-500 px-2.5 py-1 font-semibold text-white'
                  : 'rounded-full px-2.5 py-1 text-white/50 hover:text-white'
              }
              onClick={() => setShowAllCardWords((v) => !v)}
              title="Show every word on this card (off = just the words on screen, same as Preview)"
            >
              all
            </button>
          )}
        </div>
      )}

      {overlaysOn && (
        <>
          {/* stack-edit: hide box when free-place */}
          {!stackEditMode && (
            <CaptionDragLayer
              xPct={project.captionOverrides?.xPct ?? 50}
              yPct={project.captionOverrides?.positionPct ?? 12}
              sizePx={project.captionOverrides?.sizePx ?? CAPTION_SIZE_DEFAULT}
              // The box is as tall as the rows the caption wraps to, so the
              // outline tracks the text instead of sitting at a fixed size.
              rows={project.captionOverrides?.rows ?? 1}
              onMove={(x, y) => setCaptionOverridesLocal({ xPct: x, positionPct: y })}
              onCommit={(x, y) => {
                void setCaptionOverrides({ xPct: x, positionPct: y });
              }}
              // Same local/persist split as the move: live while dragging a
              // corner, one write on release. Per-frame writes here would
              // hammer the API for a single resize gesture.
              onResize={(sizePx) => setCaptionOverridesLocal({ sizePx })}
              onResizeCommit={(sizePx) => {
                void setCaptionOverrides({ sizePx });
              }}
            />
          )}
          {stackEditMode && (
            <>
              {/* Blocks click-through to the video/player while placing words
                  (Remotion branch only — the edit stage's own video handles it). */}
              {surface === 'remotion' && (
                <div
                  data-edit-shield
                  className="absolute inset-0 z-[25]"
                  style={{ pointerEvents: 'auto', cursor: 'default' }}
                  onPointerDown={(e) => {
                    // Block the video toggle, but let the press BUBBLE to
                    // the stage container so a word drag still starts.
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              )}
              <WordDragLayer
                words={dragWords}
                selectedIndex={
                  fxWords && fxWords.size === 1 ? Array.from(fxWords)[0] : null
                }
                {...(surface === 'remotion' ? { mapGlyphIndex } : {})}
                onSelect={(index) => {
                  // Select WITHOUT seeking — clicking a word to edit it
                  // must not move the playhead. The word is already on
                  // screen; a seek flips the visible page (Edit shows
                  // just the on-screen page now) and reads as "it jumped
                  // back and showed the words before it".
                  setFxMode(true);
                  if (surface === 'remotion') setFxTarget(index);
                  setFxWords(new Set([index]));
                }}
                onMove={(index, xPct, yPct) => {
                  edit.setWordPlaceLocal((prev) => ({
                    ...prev,
                    [index]: { xPct, yPct },
                  }));
                }}
                onCommit={(index, xPct, yPct) => {
                  edit.setWordPlaceLocal((prev) => {
                    const next = { ...prev };
                    delete next[index];
                    return next;
                  });
                  void applyWordMark(index, { xPct, yPct });
                }}
                onScale={(index, scale) => {
                  edit.setWordScaleLocal((prev) => ({ ...prev, [index]: scale }));
                }}
                onScaleCommit={(index, scale) => {
                  edit.setWordScaleLocal((prev) => {
                    const next = { ...prev };
                    delete next[index];
                    return next;
                  });
                  void applyWordMark(index, { scale });
                }}
                onStyle={(index, partial) => {
                  void applyWordMark(index, wordStylePatchToMark(partial));
                }}
                onRemovePlace={(index) => {
                  if (currentClip) removeWordPlace(currentClip.id, index);
                }}
                onToggleBehind={(index, x, y) => {
                  if (currentClip) toggleWordBehind(currentClip.id, index, x, y);
                }}
              />
            </>
          )}
        </>
      )}

      {/* The media-cue transform box — the caption puck's pattern (overlay
          above the Player, local while dragging, one write on release),
          mounted in BOTH preview branches so the cue is placeable on the
          preview that matches the render. It shows ONLY while the cue's
          image is actually on screen at the playhead. */}
      {(() => {
        // Key on the clip that's ACTUALLY on screen (the stage clip), not the
        // inspector selection — the image flies in on the playing scene, so the
        // drag box has to ride the same one. Keying on the selected clip showed
        // the box on the WRONG scene (and it looked like it "stayed on" when the
        // playhead moved on). stageClip first; currentClip is the fallback.
        const liveClipId = stageClip?.id ?? currentClip?.id;
        const clipCues = (project.mediaCues ?? []).filter(
          (x) => x.clipId === liveClipId,
        );
        // The drag box shows ONLY while the cue's image is actually
        // on screen at the playhead — it used to pin to the selected
        // cue forever. Click the box to grab + select that cue; the
        // ⚙ editor auto-seeks to the word so the image appears.
        const onScreen = clipCues.filter((c) => cueOnScreen(c));
        if (!onScreen.length) return null;
        return onScreen.map((cue) => {
          const sx = cue.style?.xPct ?? 60;
          const sy = cue.style?.yPct ?? 16;
          const sw = cue.style?.widthPct ?? 34;
          const local = cue.id === cueStyleEditId ? cueDragLocal : null;
          return (
            <CueDragLayer
              key={cue.id}
              xPct={local?.xPct ?? sx}
              yPct={local?.yPct ?? sy}
              widthPct={local?.widthPct ?? sw}
              src={cue.url}
              word={project.captions[cue.clipId]?.[cue.wordIndex]?.word ?? ''}
              onSelect={() => {
                setCueStyleEditId(cue.id);
                setCueDragLocal(null);
              }}
              onMove={(x, y) => {
                setCueStyleEditId(cue.id);
                setCueDragLocal({
                  xPct: x,
                  yPct: y,
                  widthPct: local?.widthPct ?? sw,
                });
              }}
              onCommit={(x, y) => {
                setCueDragLocal(null);
                void patchCueStyle(cue.id, { xPct: x, yPct: y });
              }}
              onResize={(w) => {
                setCueStyleEditId(cue.id);
                setCueDragLocal({
                  xPct: local?.xPct ?? sx,
                  yPct: local?.yPct ?? sy,
                  widthPct: w,
                });
              }}
              onResizeCommit={(w) => {
                setCueDragLocal(null);
                void patchCueStyle(cue.id, { widthPct: w });
              }}
            />
          );
        });
      })()}
    </>
  );
}

/**
 * The canvas right-click word menu (Preview mode — Edit mode's
 * WordDragLayer owns right-click there). Free-place / Remove placement /
 * Behind the subject + the full per-word style editor. The page mounts this
 * ONCE at its root.
 */
export function CaptionWordContextMenu({
  project,
  edit,
}: {
  project: ReelProject | null;
  edit: Edit;
}) {
  const { wordCtxMenu, setWordCtxMenu, applyWordMark, freePlaceWord, removeWordPlace, toggleWordBehind } =
    edit;
  if (!wordCtxMenu || !project) return null;
  const words = project.captions[wordCtxMenu.clipId] ?? [];
  const w = words[wordCtxMenu.index];
  if (!w) return null;
  const placed = typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
  const selected: WordPlace = {
    index: wordCtxMenu.index,
    xPct: w.mark?.xPct ?? wordCtxMenu.xPct,
    yPct: w.mark?.yPct ?? wordCtxMenu.yPct,
    label: w.word,
    placed,
    behind: w.mark?.behind === true,
    scale: w.mark?.scale,
    anim: w.mark?.anim,
    color: w.mark?.color,
    fx: w.mark?.fx,
    fxColor: w.mark?.fxColor,
    fxColor2: w.mark?.fxColor2,
    ambient: w.mark?.ambient,
    font: w.mark?.font,
    hidden: w.mark?.hidden,
  };
  return (
    <WordContextMenu
      clientX={wordCtxMenu.clientX}
      clientY={wordCtxMenu.clientY}
      selected={selected}
      onApply={(partial) =>
        void applyWordMark(
          wordCtxMenu.index,
          wordStylePatchToMark(partial),
          wordCtxMenu.clipId,
        )
      }
      onClose={() => setWordCtxMenu(null)}
      onFreePlace={
        placed
          ? undefined
          : () =>
              freePlaceWord(
                wordCtxMenu.clipId,
                wordCtxMenu.index,
                wordCtxMenu.xPct,
                wordCtxMenu.yPct,
              )
      }
      onRemovePlace={
        placed ? () => removeWordPlace(wordCtxMenu.clipId, wordCtxMenu.index) : undefined
      }
      onToggleBehind={() =>
        toggleWordBehind(
          wordCtxMenu.clipId,
          wordCtxMenu.index,
          wordCtxMenu.xPct,
          wordCtxMenu.yPct,
        )
      }
    />
  );
}

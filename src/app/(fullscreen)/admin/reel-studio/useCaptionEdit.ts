'use client';

/**
 * useCaptionEdit — the caption-edit surface's state + handlers, extracted
 * from page.tsx (Task 3 of REEL_STUDIO_NEXT_TASKS). PURE EXTRACTION: the
 * page destructures the SAME names it used to declare locally, so the JSX
 * body is untouched and behavior is identical by construction.
 *
 * The four free helpers (timelineStartOf, clipWordIndexFromPlanIndex,
 * planWordIndexFromClipIndex, wordStylePatchToMark) live here as the single
 * source — the page imports them back (they're used in its JSX too), and the
 * hook file never imports the page (no cycle).
 */
import { useState } from 'react';
import type {
  ReelClip,
  ReelProject,
  ReelWord,
  ReelWordMark,
} from '@/lib/mothermode/reel/types';
import {
  effectiveClipDuration,
  transitionOverlapSec,
} from '@/lib/mothermode/reel/timeline';
import type { WordStylePatch } from './WordDragLayer';

// ---------------------------------------------------------------------------
// Free helpers (moved from page.tsx — the single source)
// ---------------------------------------------------------------------------

/**
 * Timeline seconds where clip `index` starts. Transition-aware: each seam's
 * overlap pulls the start earlier by that many seconds — the SAME frame space
 * buildRenderPlan produces, so a word's absolute time on the Remotion stage
 * (and every seek/scrub target) agrees with the plan instead of drifting
 * right by the cumulative overlaps. No transitions anywhere = the old sum.
 */
export function timelineStartOf(clips: ReelClip[], index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < clips.length; i += 1) {
    t += effectiveClipDuration(clips[i]);
    // The seam BEFORE clip i+1 overlaps into clip i's tail — clip i+1 starts
    // that much earlier, so the running total shrinks by the overlap.
    if (i + 1 < clips.length) t -= transitionOverlapSec(clips[i + 1], clips[i]);
  }
  return Math.max(0, t);
}

/**
 * Map a caption-layer `data-caption-word` index on the REMOTION preview back to
 * the clip's own captions index. The layer numbers words in the TIMELINE-merged
 * plan list (all clips concatenated, trim-cut words dropped by shiftWords); the
 * editor writes marks per-clip. Without this a right-click on clip 2's word
 * styled clip 1's word. The edit stage numbers per-clip already (its
 * StageCaptions gets the clip's own word list), so only the Remotion surface
 * needs the walk.
 */
export function clipWordIndexFromPlanIndex(
  proj: ReelProject,
  planIdx: number,
): { clipId: string; index: number } | null {
  let rest = planIdx;
  for (const clip of proj.clips) {
    const ws = proj.captions[clip.id] ?? [];
    const trimStart = clip.trimStartSec ?? 0;
    const effSec = effectiveClipDuration(clip);
    // The surviving-word list mirrors shiftWords' drop rule exactly.
    const surviving: number[] = [];
    for (let i = 0; i < ws.length; i += 1) {
      const w = ws[i];
      const ls = w.start - trimStart;
      const le = w.end - trimStart;
      if (le <= 0 || ls >= effSec || !w.word.trim()) continue;
      surviving.push(i);
    }
    if (rest < surviving.length) return { clipId: clip.id, index: surviving[rest] };
    rest -= surviving.length;
  }
  return null;
}

/**
 * The inverse of clipWordIndexFromPlanIndex: a clip's own captions index → the
 * index the Remotion layer paints on the glyph (the timeline-merged plan list).
 * The WordDragLayer's hit boxes look glyphs up by this, so they land on the
 * RIGHT word on a multi-clip or trimmed reel.
 */
export function planWordIndexFromClipIndex(
  proj: ReelProject,
  clipId: string,
  clipIndex: number,
): number | null {
  let planOffset = 0;
  for (const clip of proj.clips) {
    const ws = proj.captions[clip.id] ?? [];
    const trimStart = clip.trimStartSec ?? 0;
    const effSec = effectiveClipDuration(clip);
    // The surviving-word list mirrors shiftWords' drop rule exactly.
    const surviving: number[] = [];
    for (let i = 0; i < ws.length; i += 1) {
      const w = ws[i];
      const ls = w.start - trimStart;
      const le = w.end - trimStart;
      if (le <= 0 || ls >= effSec || !w.word.trim()) continue;
      surviving.push(i);
    }
    if (clip.id === clipId) {
      const pos = surviving.indexOf(clipIndex);
      return pos < 0 ? null : planOffset + pos;
    }
    planOffset += surviving.length;
  }
  return null;
}

/**
 * Map a WordStylePatch (the word context menu's edit) onto a ReelWordMark
 * patch for applyWordMark. `undefined` deletes the key there, so a clearStyle
 * patch lists every style key explicitly. Shared by the three menu mounts —
 * the mapping used to be hand-copied at each and drifted.
 */
export function wordStylePatchToMark(
  partial: WordStylePatch,
): Partial<ReelWordMark> {
  if (partial.clearStyle) {
    // Keep placement + card + behind; drop the visual style fields.
    return {
      anim: undefined,
      color: undefined,
      scale: undefined,
      fx: undefined,
      fxColor: undefined,
      fxColor2: undefined,
      ambient: undefined,
      font: undefined,
      hidden: undefined,
    };
  }
  const patch: Partial<ReelWordMark> = {};
  if ('anim' in partial) patch.anim = partial.anim || undefined;
  if ('scale' in partial && typeof partial.scale === 'number') {
    patch.scale = partial.scale;
  }
  if ('color' in partial) patch.color = partial.color || undefined;
  if ('fx' in partial) patch.fx = partial.fx || undefined;
  if ('fxColor' in partial) patch.fxColor = partial.fxColor || undefined;
  if ('fxColor2' in partial) patch.fxColor2 = partial.fxColor2 || undefined;
  if ('ambient' in partial) patch.ambient = partial.ambient || undefined;
  if ('font' in partial) patch.font = partial.font || undefined;
  if ('hidden' in partial) patch.hidden = partial.hidden || undefined;
  return patch;
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export interface CaptionEditDeps {
  project: ReelProject | null;
  setProject: React.Dispatch<React.SetStateAction<ReelProject | null>>;
  /** The inspector-selected clip (or the first). */
  currentClip: ReelClip | null;
  /** The clip under the playback clock (the stage's clip). */
  stageClip: ReelClip | null;
  playheadSec: number;
  /** Karaoke captions on/off (the CC toggle). */
  ccOn: boolean;
  /** The page's API helper (POST /api/admin/mothermode-reel). */
  post: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  setNote: (msg: string) => void;
  setSelectedClip: (id: string) => void;
}

export function useCaptionEdit({
  project,
  setProject,
  currentClip,
  stageClip,
  playheadSec,
  ccOn,
  post,
  setNote,
  setSelectedClip,
}: CaptionEditDeps) {
  /** Live free-place drag offsets (index → x/y) — local only until commit. */
  const [wordPlaceLocal, setWordPlaceLocal] = useState<
    Record<number, { xPct: number; yPct: number }>
  >({});
  const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});
  /** Free-place stack: Edit shows all card words + handles; Preview = karaoke timing. */
  const [stackEditMode, setStackEditMode] = useState(false);
  /** Edit mode opt-in: show EVERY word on the card (off = just the on-screen
   *  page, same as Preview — the default, so Edit no longer scatters the card). */
  const [showAllCardWords, setShowAllCardWords] = useState(false);
  /** The canvas right-click word menu (Preview mode): which word + where the
   *  glyph's centre sits (frame %, y from bottom) so free-place/behind pin it
   *  exactly there instead of teleporting it. */
  const [wordCtxMenu, setWordCtxMenu] = useState<{
    clipId: string;
    index: number;
    clientX: number;
    clientY: number;
    xPct: number;
    yPct: number;
  } | null>(null);
  /** Word FX mode: click words in the subtitle list to mark them, then the FX
   *  bar applies the effect to every picked word (the cue flow's sibling). */
  const [fxMode, setFxMode] = useState(false);
  const [fxWords, setFxWords] = useState<ReadonlySet<number>>(new Set());
  /** Scope: 'global' = settings write to every picked word (a bulk
   *  convenience); 'individual' = they write to ONE target word, seeded
   *  from its current mark. Individual is the truth — global is bulk. */
  const [fxScope, setFxScope] = useState<'global' | 'individual'>('global');
  const [fxTarget, setFxTarget] = useState<number | null>(null);

  /** Individual scope: merge a mark patch onto ONE word and persist. */
  async function applyWordMark(
    index: number,
    partial: Partial<ReelWordMark>,
    clipIdOverride?: string,
  ) {
    const clipId = clipIdOverride ?? currentClip?.id;
    if (!project || !clipId) return;
    const words = (project.captions[clipId] ?? []).map((w, i) => {
      if (i !== index) return w;
      // undefined in partial means "clear this field" (spread alone keeps old).
      const next: Record<string, unknown> = { ...(w.mark ?? {}) };
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      const empty = Object.keys(next).length === 0;
      return empty
        ? { word: w.word, start: w.start, end: w.end }
        : { ...w, mark: next as ReelWordMark };
    });
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [clipId]: words },
    };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** Merge a mark patch onto every picked word and persist (the subtitle
   *  panel's own save path — marks ride the words array). */
  async function applyWordMarks(partial: Partial<ReelWordMark>) {
    // Individual scope: the panel writes to the ONE target word instead.
    if (fxScope === 'individual') {
      if (fxTarget == null) return;
      return applyWordMark(fxTarget, partial);
    }
    if (!project || !currentClip || fxWords.size === 0) return;
    const words = (project.captions[currentClip.id] ?? []).map((w, i) =>
      fxWords.has(i) ? { ...w, mark: { ...(w.mark ?? {}), ...partial } } : w,
    );
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [currentClip.id]: words },
    };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** Strip the fx/ambient/sfx keys off every picked word (empty marks drop). */
  async function clearWordFx() {
    if (!project || !currentClip) return;
    const targets: ReadonlySet<number> =
      fxScope === 'individual' ? new Set(fxTarget != null ? [fxTarget] : []) : fxWords;
    const words = (project.captions[currentClip.id] ?? []).map((w, i) => {
      if (!targets.has(i) || !w.mark) return w;
      const mark = { ...w.mark };
      delete mark.fx;
      delete mark.fxColor;
      delete mark.fxColor2;
      delete mark.fxAmount;
      delete mark.fxDensity;
      delete mark.font;
      delete mark.ambient;
      delete mark.sfx;
      return Object.keys(mark).length ? { ...w, mark } : { ...w, mark: undefined };
    });
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [currentClip.id]: words },
    };
    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** FX-mode word click: global toggles the pick set; individual selects the
   *  ONE target word the settings edit (click again to deselect). */
  function toggleFxWord(i: number) {
    if (fxScope === 'individual') {
      setFxTarget((t) => (t === i ? null : i));
      return;
    }
    setFxWords((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  /** Free-place the word exactly where it sits, then open Edit so it drags. */
  function freePlaceWord(clipId: string, index: number, xPct: number, yPct: number) {
    void applyWordMark(index, { xPct, yPct }, clipId);
    setStackEditMode(true);
    setFxMode(false);
    setWordCtxMenu(null);
    setNote('Free-placed — drag the word on the canvas; its corner scales it. Preview toggles back.');
  }

  /**
   * Exit free-place Edit (the Preview toggle): flush any in-flight drag
   * offsets still only in local state, then SAVE — so leaving Edit never
   * silently drops a placement and the user never wonders if it kept.
   */
  function exitStackEdit() {
    const clipId = currentClip?.id;
    const pendingPlace = wordPlaceLocal;
    const pendingScale = wordScaleLocal;
    setWordPlaceLocal({});
    setWordScaleLocal({});
    setStackEditMode(false);
    setFxMode(false);
    if (!project || !clipId) return;
    const hasPending =
      Object.keys(pendingPlace).length > 0 || Object.keys(pendingScale).length > 0;
    const words = (project.captions[clipId] ?? []).map((w, i) => {
      const loc = pendingPlace[i];
      const sc = pendingScale[i];
      if (!loc && typeof sc !== 'number') return w;
      return {
        ...w,
        mark: {
          ...(w.mark ?? {}),
          ...(loc ? { xPct: loc.xPct, yPct: loc.yPct } : {}),
          ...(typeof sc === 'number' ? { scale: sc } : {}),
        },
      };
    });
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [clipId]: words },
    };
    setProject(updated);
    void post({ action: 'save', project: updated }).then(() => {
      if (hasPending) setNote('Placement saved.');
    });
  }

  /** Drop the word's placement (and a behind flag) — it flows back into the row. */
  function removeWordPlace(clipId: string, index: number) {
    void applyWordMark(index, { xPct: undefined, yPct: undefined, behind: undefined }, clipId);
    setWordCtxMenu(null);
  }

  /**
   * Toggle the behind-the-subject z. Behind needs the word OUT of the row
   * flow (the row block is ONE z-layer, so a per-word z inside it can't reach
   * the cutout): an un-placed word is first pinned where it sits.
   */
  function toggleWordBehind(clipId: string, index: number, xPct: number, yPct: number) {
    const w = (project?.captions[clipId] ?? [])[index];
    if (!w) return;
    if (w.mark?.behind) {
      void applyWordMark(index, { behind: undefined }, clipId);
    } else {
      const placed =
        typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
      void applyWordMark(
        index,
        { ...(placed ? {} : { xPct, yPct }), behind: true },
        clipId,
      );
    }
    setWordCtxMenu(null);
  }

  /**
   * Reset the current scene's caption words to the clean theme — strips EVERY
   * per-word mark (free-place x/y, fx, color, scale, anim, ambient, font, hide,
   * behind, card). The reel's preset + captionOverrides are untouched; this is
   * the "undo all my fp edits" escape hatch.
   */
  async function resetCaptionWords() {
    if (!project || !currentClip) return;
    const all = project.captions[currentClip.id] ?? [];
    // Scope to the words ON the current timestamp — the page showing at the
    // playhead — not the whole scene. Compute the page from the active word +
    // the layout's page size (wordsPerRow × rows).
    const clipIdx = Math.max(
      0,
      project.clips.findIndex((c) => c.id === currentClip.id),
    );
    const clipSec = Math.max(0, playheadSec - timelineStartOf(project.clips, clipIdx));
    let activeIdx = 0;
    for (let i = 0; i < all.length; i += 1) {
      if (clipSec < all[i].start) break;
      activeIdx = i;
    }
    const wpr = project.captionOverrides?.wordsPerRow ?? 3;
    const rowCount = project.captionOverrides?.rows ?? 1;
    const pageSize = Math.max(1, wpr * rowCount);
    const pageFrom = Math.floor(activeIdx / pageSize) * pageSize;
    const pageEnd = Math.min(all.length, pageFrom + pageSize);
    const inPage = new Set<number>();
    for (let i = pageFrom; i < pageEnd; i += 1) inPage.add(i);
    // Strip the marks on JUST this page's words; every other word keeps its edit.
    const words = all.map((w, i) =>
      inPage.has(i) ? { word: w.word, start: w.start, end: w.end } : w,
    );
    const updated: ReelProject = {
      ...project,
      captions: { ...project.captions, [currentClip.id]: words },
    };
    setProject(updated);
    setWordPlaceLocal({});
    setWordScaleLocal({});
    setFxWords(new Set());
    setFxTarget(null);
    await post({ action: 'save', project: updated });
    setNote('Reset the words on this timestamp to the clean theme.');
  }

  /**
   * THE free-place drag — press any caption word on the canvas and move it.
   * Always available (Preview AND Edit), no mode toggle needed. It drives off
   * the SAME hit-resolution as the right-click menu (closest + elementsFromPoint
   * + clipWordIndexFromPlanIndex), NOT the drag layer's measured boxes — so it
   * works even when those boxes don't render. The drag is RELATIVE to where you
   * grabbed the word, so it never jumps to your pointer.
   */
  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {
    if (!project || !ccOn) return;
    // Word drag is a PER-WORD-mode (Edit) gesture. In default mode the block
    // box owns the drag — "edit captions always on, edit per word is the toggle".
    if (!stackEditMode) return;
    if (e.button !== 0) return; // left press drags; right press opens the menu
    // Resolve the caption glyph under the pointer (see onCaptionWordContextMenu).
    let t = (e.target as HTMLElement | null)?.closest?.(
      '[data-caption-word]',
    ) as HTMLElement | null;
    if (!t && typeof document !== 'undefined') {
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const hit = (el as HTMLElement).closest?.(
          '[data-caption-word]',
        ) as HTMLElement | null;
        if (hit) {
          t = hit;
          break;
        }
      }
    }
    if (!t) return; // not on a word → let the video / other UI handle the press
    const rawIdx = Number(t.getAttribute('data-caption-word'));
    if (!Number.isInteger(rawIdx) || rawIdx < 0) return;
    // The Remotion layer numbers words in the TIMELINE-merged plan list; the
    // edit stage numbers per-clip. Resolve to (clipId, per-clip index).
    let clipId: string | null = null;
    let index = rawIdx;
    if (surface === 'stage') {
      clipId = stageClip?.id ?? currentClip?.id ?? null;
    } else {
      const hit = clipWordIndexFromPlanIndex(project, rawIdx);
      if (hit) {
        clipId = hit.clipId;
        index = hit.index;
      }
    }
    if (!clipId) return;
    const clipWords = project.captions[clipId] ?? [];
    if (index >= clipWords.length) return;

    // A press on a word selects it; a DRAG free-places + moves it.
    e.preventDefault();
    e.stopPropagation();
    setFxMode(true);
    setFxTarget(index);
    setFxWords(new Set([index]));
    setSelectedClip(clipId);

    const frame = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const glyph = t.getBoundingClientRect();
    // The word's CURRENT centre in frame % (y from the bottom).
    const startCX = ((glyph.left + glyph.width / 2 - frame.left) / Math.max(1, frame.width)) * 100;
    const startCY = (1 - (glyph.top + glyph.height / 2 - frame.top) / Math.max(1, frame.height)) * 100;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let last = { xPct: startCX, yPct: startCY };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && dx * dx + dy * dy < 25) return; // 5px deadzone — a click ≠ a drag
      if (!moved) {
        moved = true;
        setStackEditMode(true); // a drag enters Edit so the word shows as placed
      }
      last = {
        xPct: Math.max(2, Math.min(98, startCX + (dx / Math.max(1, frame.width)) * 100)),
        yPct: Math.max(2, Math.min(98, startCY - (dy / Math.max(1, frame.height)) * 100)),
      };
      setWordPlaceLocal((prev) => ({ ...prev, [index]: last }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (moved) {
        const finalPos = last;
        setWordPlaceLocal((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        void applyWordMark(index, { xPct: finalPos.xPct, yPct: finalPos.yPct }, clipId);
        setNote('Placed — drag any word to move it; right-click it for styles.');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /**
   * Right-click a caption word ON THE CANVAS (Preview mode — Edit mode's
   * WordDragLayer owns right-click there). The caption glyphs carry
   * data-caption-word; the menu offers Free-place / Remove placement /
   * Behind the subject + the full style editor (the shared WordContextMenu).
   */
  function onCaptionWordContextMenu(e: React.MouseEvent, surface: 'remotion' | 'stage') {
    if (!project || !ccOn || stackEditMode) return;
    // The caption words are hit-testable (the <style> on the root sets
    // pointer-events:auto), but the block-move drag box (z-30) and the
    // composition's pointer-events-none root can sit between the click and the
    // glyph. Resolve the word under the cursor from the FULL hit stack, not
    // just the event's top target — so right-click works on the word whether it
    // lands on the glyph itself or on the drag box over it.
    let t = (e.target as HTMLElement | null)?.closest?.(
      '[data-caption-word]',
    ) as HTMLElement | null;
    if (!t && typeof document !== 'undefined') {
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const hit = (el as HTMLElement).closest?.(
          '[data-caption-word]',
        ) as HTMLElement | null;
        if (hit) {
          t = hit;
          break;
        }
      }
    }
    if (!t) return; // not on a word → the browser's default menu
    const rawIdx = Number(t.getAttribute('data-caption-word'));
    if (!Number.isInteger(rawIdx) || rawIdx < 0) return;
    // The Remotion layer numbers words in the TIMELINE-merged plan list; the
    // edit stage numbers per-clip. Resolve to (clipId, per-clip index).
    let clipId: string | null = null;
    let index = rawIdx;
    if (surface === 'stage') {
      clipId = stageClip?.id ?? currentClip?.id ?? null;
    } else {
      const hit = clipWordIndexFromPlanIndex(project, rawIdx);
      if (hit) {
        clipId = hit.clipId;
        index = hit.index;
      }
    }
    if (!clipId) return;
    const words = project.captions[clipId] ?? [];
    if (index >= words.length) return;
    e.preventDefault();
    e.stopPropagation();
    // The glyph's CURRENT centre in frame % (y from the bottom) — free-place
    // and behind pin the word exactly where it sits, so neither teleports it.
    const frame = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const xPct = Math.max(
      2,
      Math.min(98, ((r.left + r.width / 2 - frame.left) / Math.max(1, frame.width)) * 100),
    );
    const yPct = Math.max(
      2,
      Math.min(98, (1 - (r.top + r.height / 2 - frame.top) / Math.max(1, frame.height)) * 100),
    );
    setWordCtxMenu({ clipId, index, clientX: e.clientX, clientY: e.clientY, xPct, yPct });
    setFxMode(true);
    setFxTarget(index);
    setFxWords(new Set([index]));
  }

  return {
    wordPlaceLocal,
    setWordPlaceLocal,
    wordScaleLocal,
    setWordScaleLocal,
    stackEditMode,
    setStackEditMode,
    showAllCardWords,
    setShowAllCardWords,
    wordCtxMenu,
    setWordCtxMenu,
    fxMode,
    setFxMode,
    fxWords,
    setFxWords,
    fxScope,
    setFxScope,
    fxTarget,
    setFxTarget,
    applyWordMark,
    applyWordMarks,
    clearWordFx,
    toggleFxWord,
    freePlaceWord,
    removeWordPlace,
    toggleWordBehind,
    resetCaptionWords,
    exitStackEdit,
    onCaptionWordPointerDown,
    onCaptionWordContextMenu,
  };
}

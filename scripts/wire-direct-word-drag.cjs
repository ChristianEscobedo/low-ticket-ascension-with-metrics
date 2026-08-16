/**
 * THE free-place drag, rebuilt to be reliable.
 *
 * The WordDragLayer measured glyph positions into `glyphBox` and drew hit boxes
 * — and it kept breaking (index mapping, async Player paint, zero-size shells,
 * empty word list): "cant select any text on the preview canvas."
 *
 * This wires a DIRECT press-drag on the caption glyph itself, driven by the
 * SAME hit-resolution the working right-click menu uses (closest +
 * elementsFromPoint + clipWordIndexFromPlanIndex) — no pre-measured boxes.
 * Press any visible word and it lifts out and follows your pointer; release to
 * commit. It works in Preview AND Edit (fp is always available on the canvas).
 *
 * Three edits: (1) the onCaptionWordPointerDown handler, (2) onPointerDown on
 * both stage containers, (3) the Edit shield stops swallowing the press so it
 * bubbles to the container.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', '(fullscreen)', 'admin', 'reel-studio', 'page.tsx');
let s = fs.readFileSync(FILE, 'utf8');
const before = s.length;
let n = 0;
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const nl = (str) => str.split('\n').join(NL);

function rep(oldStr, newStr, label) {
  const needle = nl(oldStr);
  if (!s.includes(needle)) {
    console.error(`MISS: ${label}`);
    return;
  }
  s = s.split(needle).join(nl(newStr));
  n += 1;
  console.log(`ok: ${label}`);
}

// 1 — the handler, inserted right before onCaptionWordContextMenu.
rep(
  `  function onCaptionWordContextMenu(e: React.MouseEvent, surface: 'remotion' | 'stage') {`,
  `  /**
   * THE free-place drag — press any caption word on the canvas and move it.
   * Always available (Preview AND Edit), no mode toggle needed. It drives off
   * the SAME hit-resolution as the right-click menu (closest + elementsFromPoint
   * + clipWordIndexFromPlanIndex), NOT the drag layer's measured boxes — so it
   * works even when those boxes don't render. The drag is RELATIVE to where you
   * grabbed the word, so it never jumps to your pointer.
   */
  function onCaptionWordPointerDown(e: React.PointerEvent, surface: 'remotion' | 'stage') {
    if (!project || !ccOn) return;
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

  function onCaptionWordContextMenu(e: React.MouseEvent, surface: 'remotion' | 'stage') {`,
  'onCaptionWordPointerDown handler',
);

// 2 — onPointerDown on BOTH stage containers (alongside the existing onContextMenu).
rep(
  `onContextMenu={(e) => onCaptionWordContextMenu(e, 'remotion')}`,
  `onContextMenu={(e) => onCaptionWordContextMenu(e, 'remotion')}
                    onPointerDown={(e) => onCaptionWordPointerDown(e, 'remotion')}`,
  'onPointerDown on the Remotion stage container',
);
rep(
  `onContextMenu={(e) => onCaptionWordContextMenu(e, 'stage')}`,
  `onContextMenu={(e) => onCaptionWordContextMenu(e, 'stage')}
                    onPointerDown={(e) => onCaptionWordPointerDown(e, 'stage')}`,
  'onPointerDown on the edit-stage container',
);

// 3 — the Edit shield stops SWALLOWING the press (drop stopPropagation) so a
// press on a word bubbles to the stage container's drag handler. It still
// preventDefault's, so the video never toggles play while you're editing.
rep(
  `                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}`,
  `                          onPointerDown={(e) => {
                            // Block the video toggle, but let the press BUBBLE to
                            // the stage container so a word drag still starts.
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}`,
  'Edit shield lets the press bubble',
);

fs.writeFileSync(FILE, s, 'utf8');
console.log(`\n${n}/4 edits applied · ${before} → ${s.length} bytes`);

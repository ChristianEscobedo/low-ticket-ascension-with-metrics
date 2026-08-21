// FP word-drag performance wave. Five fixes from the audit:
//  1. captionLayer: placed words keep an INVISIBLE in-flow placeholder so the
//     row never reflows around the hole ("one word pushes other words around").
//  2. useCaptionEdit: the drag translate is divided by the glyph's rendered
//     scale (the Remotion Player scales the comp ~0.35x — the word crawled at
//     a third of the pointer) + the rAF loop only writes when the value
//     actually changed (no more transform war with re-renders).
//  3. useCaptionEdit: applyWordMark debounces the save POST (600ms trailing +
//     unmount flush) — a commit/nudge/style click no longer fires a FULL
//     project save every time.
//  4. CaptionEditSurface: dragWords is useMemo'd and mapGlyphIndex is a
//     useCallback — their fresh identities re-ran the glyph-measure effect on
//     every render.
//  5. WordDragLayer: setGlyphBox no-ops when nothing moved (breaks the
//     measure -> setState -> render -> measure loop per mousemove).
const fs = require('fs');

function load(f) {
  const src = fs.readFileSync(f, 'utf8');
  return { src, nl: src.includes('\r\n') ? '\r\n' : '\n' };
}
function applyRules(file, rules) {
  let { src, nl } = load(file);
  let failed = false;
  for (const [name, searchRaw, replaceRaw] of rules) {
    const search = nl === '\r\n' ? searchRaw.replace(/\n/g, '\r\n') : searchRaw;
    const replace = nl === '\r\n' ? replaceRaw.replace(/\n/g, '\r\n') : replaceRaw;
    const first = src.indexOf(search);
    const last = src.lastIndexOf(search);
    if (first < 0) {
      console.log('MISS  [' + file.split('/').pop() + '] ' + name);
      failed = true;
      continue;
    }
    if (first !== last) {
      console.log('DUP   [' + file.split('/').pop() + '] ' + name);
      failed = true;
      continue;
    }
    src = src.slice(0, first) + replace + src.slice(first + search.length);
    console.log('ok    [' + file.split('/').pop() + '] ' + name);
  }
  if (!failed) fs.writeFileSync(file, src);
  return !failed;
}

let allOk = true;

// ---------- 1. captionLayer.tsx: in-flow placeholder ----------
allOk =
  applyRules('src/lib/mothermode/reel/render/captionLayer.tsx', [
    [
      'placeholder keeps the slot',
      `            // skip free-placed words (painted in absOverlay)
            if (
              typeof mark?.xPct === 'number' &&
              typeof mark?.yPct === 'number'
            ) {
              return null;
            }`,
      `            // Free-placed words paint in the absOverlay — but keep an
            // INVISIBLE in-flow placeholder in the row so the siblings do NOT
            // reflow around the hole on commit (the "one word pushes the other
            // words around" jump). visibility:hidden holds the slot's metrics
            // without painting; the overlay glyph carries data-caption-word.
            if (
              typeof mark?.xPct === 'number' &&
              typeof mark?.yPct === 'number'
            ) {
              return (
                <span
                  key={\`fp-hole-\${idx}\`}
                  aria-hidden
                  style={{
                    ...css.word,
                    visibility: 'hidden',
                    display: 'inline-block',
                    position: 'relative',
                  }}
                >
                  {w.text}
                </span>
              );
            }`,
    ],
  ]) && allOk;

// ---------- 2+3. useCaptionEdit.ts ----------
allOk =
  applyRules('src/app/(fullscreen)/admin/reel-studio/useCaptionEdit.ts', [
    [
      'react imports',
      `import { useState } from 'react';`,
      `import { useEffect, useRef, useState } from 'react';`,
    ],
    [
      'save refs + unmount flush',
      `  const [fxTarget, setFxTarget] = useState<number | null>(null);`,
      `  const [fxTarget, setFxTarget] = useState<number | null>(null);
  // Debounced persistence: local state is the truth the instant an edit lands;
  // the save POST fires 600ms after the LAST edit (a drag commit, a scale
  // commit, a style click, every arrow nudge each used to POST the FULL
  // project). Unmount flushes whatever is pending.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<ReelProject | null>(null);
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingSaveRef.current) {
        void post({ action: 'save', project: pendingSaveRef.current });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );`,
    ],
    [
      'debounced save in applyWordMark',
      `    setProject(updated);
    await post({ action: 'save', project: updated });
  }

  /** Merge a mark patch onto every picked word and persist (the subtitle`,
      `    setProject(updated);
    pendingSaveRef.current = updated;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const p = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (p) void post({ action: 'save', project: p });
    }, 600);
  }

  /** Merge a mark patch onto every picked word and persist (the subtitle`,
    ],
    [
      'glyph scale calibration',
      `    const baseTransform = t.style.transform || '';`,
      `    const baseTransform = t.style.transform || '';
    // The Remotion Player SCALES the composition to the stage (~0.35x), so a
    // pixel translate on the glyph is in COMPOSITION px and the word crawled
    // at a fraction of the pointer — "clunky, doesn't react". Calibrate from
    // the glyph's own rendered-vs-layout size so the word tracks the pointer
    // 1:1 (the unscaled edit stage reports 1 — a no-op there).
    const glyphScaleX = glyph.width / Math.max(1, t.offsetWidth) || 1;
    const glyphScaleY = glyph.height / Math.max(1, t.offsetHeight) || 1;`,
    ],
    [
      'conditional-write rAF + scale-corrected translate',
      `    const paint = () => {
      t.style.transform = \`\${baseTransform} translate(\${delta.x}px, \${delta.y}px)\`;
      raf = requestAnimationFrame(paint);
    };`,
      `    const paint = () => {
      // Write ONLY when the value changed (a move) or a re-render cleared it —
      // an unconditional write every frame fought React for the whole drag.
      const want = \`\${baseTransform} translate(\${delta.x / glyphScaleX}px, \${delta.y / glyphScaleY}px)\`;
      if (t.style.transform !== want) t.style.transform = want;
      raf = requestAnimationFrame(paint);
    };`,
    ],
  ]) && allOk;

// ---------- 4. CaptionEditSurface.tsx ----------
{
  const file = 'src/app/(fullscreen)/admin/reel-studio/CaptionEditSurface.tsx';
  allOk =
    applyRules(file, [
      [
        'react import',
        `import dynamic from 'next/dynamic';`,
        `import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';`,
      ],
      [
        'dragWords useMemo open',
        `  const dragWords = (() => {`,
        `  // useMemo: this list feeds the WordDragLayer's measure effect — a fresh
  // array identity per render re-ran it (measure -> setState -> render).
  const dragWords = useMemo(() => {`,
      ],
      [
        'dragWords useMemo close + mapGlyphIndex useCallback',
        `    return list;
  })();`,
        `    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClip, project, playheadSec, showAllCardWords, wordPlaceLocal, wordScaleLocal, fxTarget]);

  // Stable identity — an inline closure here re-ran the measure effect on
  // EVERY render (same loop).
  const mapGlyphIndex = useCallback(
    (i: number) =>
      currentClip ? planWordIndexFromClipIndex(project, currentClip.id, i) ?? i : i,
    [project, currentClip],
  );`,
      ],
    ]) && allOk;

  // The JSX spread: replace the inline mapGlyphIndex closure with the stable one.
  let { src } = load(file);
  const marker = 'mapGlyphIndex: (i: number) =>';
  const mi = src.indexOf(marker);
  if (mi < 0) {
    console.log('MISS  [CaptionEditSurface.tsx] inline mapGlyphIndex marker');
    allOk = false;
  } else {
    const start = src.lastIndexOf("{...(surface === 'remotion'", mi);
    const endMark = ': {})}';
    const end = src.indexOf(endMark, mi);
    if (start < 0 || end < 0) {
      console.log('MISS  [CaptionEditSurface.tsx] spread boundaries');
      allOk = false;
    } else {
      src =
        src.slice(0, start) +
        "{...(surface === 'remotion' ? { mapGlyphIndex } : {})}" +
        src.slice(end + endMark.length);
      fs.writeFileSync(file, src);
      console.log('ok    [CaptionEditSurface.tsx] spread uses stable mapGlyphIndex');
    }
  }
}

// ---------- 5. WordDragLayer.tsx: setGlyphBox guard ----------
allOk =
  applyRules('src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx', [
    [
      'setGlyphBox no-op guard',
      `      setGlyphBox(next);
    };`,
      `      // No-op when nothing actually moved: during a move/scale drag the
      // parent re-renders per pointermove, this effect re-ran, and an
      // unconditional setGlyphBox (new object identity) re-rendered AGAIN —
      // a measure -> setState -> render -> measure loop per mousemove.
      setGlyphBox((prev) => {
        const keys = Object.keys(next);
        if (keys.length === Object.keys(prev).length) {
          let same = true;
          for (const k of keys) {
            const a = prev[Number(k)];
            const b = next[Number(k)];
            if (
              !a ||
              !b ||
              Math.abs(a.left - b.left) > 0.05 ||
              Math.abs(a.top - b.top) > 0.05 ||
              Math.abs(a.width - b.width) > 0.05 ||
              Math.abs(a.height - b.height) > 0.05
            ) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    };`,
    ],
  ]) && allOk;

fs.writeFileSync('tmp-fp-perf-result.txt', allOk ? 'written' : 'NOT WRITTEN', 'utf8');
console.log(allOk ? 'ALL WRITTEN' : 'SOME RULES FAILED');

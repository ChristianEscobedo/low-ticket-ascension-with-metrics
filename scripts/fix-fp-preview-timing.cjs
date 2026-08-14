#!/usr/bin/env node
/**
 * Free-place Preview timing + fonts + Edit lock + weight parity.
 *
 * Bugs:
 * 1) Preview keeps free-placed words on screen forever (`if (!isBuildStack) return true`)
 * 2) mark.font set but StageCaptions only loads theme font → typefaces don't apply
 * 3) Free-place can look thinner (weight/size not forced from theme)
 * 4) Edit mode lets video play / click-through
 *
 * High-value:
 * - Pause + block playback when entering Edit
 * - Arrow-key nudge on selected word
 * - Center snap guide while dragging
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function write(file, content, crlf) {
  fs.writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
}

// ── 1) captionLayer: Preview timing for free-placed words ─────────────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  const oldFilter = `.filter(({ w, idx }) => {
      if (freePlaceEdit) return true;
      if (isBuildStack && frame < w.fromFrame) return false;
      if (!isBuildStack) return true;
      return frame >= w.fromFrame || idx <= activeIdx;
    });`;

  const neuFilter = `.filter(({ w, idx }) => {
      // Edit: show every free-placed word so you can grab them.
      if (freePlaceEdit) return true;
      // Preview/render: follow caption timing — only paint while the word
      // (or its card window) is live. Never leave glyphs stuck on screen.
      if (activeIdx < 0) return false;
      if (cardWin) {
        // Phrase card: show free-placed members of the active card only.
        if (w.mark?.card?.id && w.mark.card.id === words[activeIdx]?.mark?.card?.id) {
          if (isBuildStack) return frame >= w.fromFrame || idx <= activeIdx;
          return true; // page mode: whole card while card is active
        }
        // Free-placed word outside the active card — hide.
        if (w.mark?.card?.id) return false;
      }
      // Lone free-placed word: visible from its start through hold after end,
      // same window the karaoke line uses for the spoken word.
      const hold = Math.round(plan.fps * CAPTION_HOLD_SEC);
      return frame >= w.fromFrame && frame < w.toFrame + hold;
    });`;

  if (!s.includes(oldFilter)) {
    // try already fixed
    if (s.includes('Lone free-placed word')) {
      console.log('timing filter already fixed');
    } else {
      console.error('timing filter not found');
      const i = s.indexOf('freePlaceEdit) return true');
      console.log(JSON.stringify(s.slice(i - 80, i + 250)));
      process.exit(1);
    }
  } else {
    s = s.replace(oldFilter, neuFilter);
    console.log('Preview timing filter fixed');
  }

  // Weight/size parity: force theme fontSize/weight onto free-place base
  // (parent already sets fontSize, but active/word spreads can thin it)
  const oldBase = `const base: React.CSSProperties = {
            ...(isActive || power ? css.active : css.word),
            display: 'inline-block',
            position: 'absolute',
            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };`;

  const neuBase = `const themePaint = isActive || power ? css.active : css.word;
          const base: React.CSSProperties = {
            ...themePaint,
            // Force theme type metrics — free-place was painting thinner when
            // only a subset of paint props survived the dual-layer path.
            fontSize: (themePaint as React.CSSProperties).fontSize ?? fontSize,
            fontWeight: (themePaint as React.CSSProperties).fontWeight,
            fontFamily: (themePaint as React.CSSProperties).fontFamily,
            letterSpacing: (themePaint as React.CSSProperties).letterSpacing,
            WebkitTextStroke: (themePaint as React.CSSProperties).WebkitTextStroke,
            paintOrder: (themePaint as React.CSSProperties).paintOrder,
            display: 'inline-block',
            position: 'absolute',
            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };`;

  if (s.includes(oldBase)) {
    s = s.replace(oldBase, neuBase);
    console.log('weight/size parity on free-place base');
  } else if (s.includes('Force theme type metrics')) {
    console.log('weight parity already present');
  } else {
    console.warn('free-place base block not exact — skip weight');
  }

  write(p, s, crlf);
  const dst = path.join(
    root,
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  );
  if (fs.existsSync(dst)) fs.copyFileSync(p, dst);
}

// ── 2) StageCaptions: load mark fonts ─────────────────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Expand useCaptionFonts to accept extra families
  const oldHook = `function useCaptionFonts(def: { font?: string; fontUrl?: string }) {
  const fonts = useMemo(() => captionFontsFor(def), [def.font, def.fontUrl]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    for (const f of fonts) {
      const id = \`gf-\${f.family.replace(/\\s+/g, '-').toLowerCase()}\`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = f.cssU`;

  // Find full hook and replace
  const hookStart = s.indexOf('function useCaptionFonts');
  if (hookStart < 0) {
    console.error('useCaptionFonts missing');
    process.exit(1);
  }
  // end at next function
  let hookEnd = s.indexOf('\nfunction ', hookStart + 10);
  if (hookEnd < 0) hookEnd = s.indexOf('\nconst ', hookStart + 10);

  const neuHook = `function useCaptionFonts(
  def: { font?: string; fontUrl?: string },
  extraFamilies: string[] = [],
) {
  const fonts = useMemo(() => {
    const base = captionFontsFor(def);
    const seen = new Set(base.map((f) => f.family));
    const out = [...base];
    for (const fam of extraFamilies) {
      if (!fam || seen.has(fam)) continue;
      seen.add(fam);
      out.push(
        ...captionFontsFor({ font: fam } as Parameters<typeof captionFontsFor>[0]),
      );
    }
    return out;
  }, [def.font, def.fontUrl, extraFamilies.join('|')]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    for (const f of fonts) {
      const id = \`gf-\${f.family.replace(/\\s+/g, '-').toLowerCase()}\`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = f.cssUrl;
      document.head.appendChild(link);
    }
  }, [fonts]);
}
`;

  // Keep original body end carefully — read original hook body for cssUrl field name
  const origHook = s.slice(hookStart, hookEnd);
  const cssField = origHook.includes('f.cssUrl')
    ? 'cssUrl'
    : origHook.includes('f.href')
      ? 'href'
      : 'cssUrl';
  // Extract the rest of the original effect if different
  console.log('orig hook css field guess', cssField);
  console.log('orig hook snippet', origHook.slice(0, 400));

  // Safer: only change signature + fonts useMemo, leave effect body
  if (!s.includes('extraFamilies')) {
    s = s.replace(
      /function useCaptionFonts\(def: \{ font\?: string; fontUrl\?: string \}\) \{\n  const fonts = useMemo\(\(\) => captionFontsFor\(def\), \[def\.font, def\.fontUrl\]\);/,
      `function useCaptionFonts(
  def: { font?: string; fontUrl?: string },
  extraFamilies: string[] = [],
) {
  const fonts = useMemo(() => {
    const base = captionFontsFor(def);
    const seen = new Set(base.map((f) => f.family));
    const out = [...base];
    for (const fam of extraFamilies) {
      if (!fam || seen.has(fam)) continue;
      seen.add(fam);
      out.push(
        ...captionFontsFor({ font: fam } as Parameters<typeof captionFontsFor>[0]),
      );
    }
    return out;
  }, [def.font, def.fontUrl, extraFamilies.join('|')]);`,
    );
    console.log('useCaptionFonts extra families', s.includes('extraFamilies'));
  }

  // StageCaptions: collect mark fonts and pass them
  const sc = s.indexOf('function StageCaptions');
  const scEnd = s.indexOf('\nfunction ', sc + 10);
  let chunk = s.slice(sc, scEnd);

  if (!chunk.includes('markFonts')) {
    chunk = chunk.replace(
      /const def = resolveCaptionStyle\(captionDefFor\(preset\), overrides\);\n  const layout = captionLayoutFor\(def, overrides\);\n  useCaptionFonts\(def\);/,
      `const def = resolveCaptionStyle(captionDefFor(preset), overrides);
  const layout = captionLayoutFor(def, overrides);
  const markFonts = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      if (w.mark?.font) set.add(w.mark.font);
    }
    return Array.from(set);
  }, [words]);
  useCaptionFonts(def, markFonts);`,
    );
    console.log('StageCaptions markFonts', chunk.includes('markFonts'));
  }

  s = s.slice(0, sc) + chunk + s.slice(scEnd);

  // ── 3) Edit mode: pause + block click-through ───────────────────────────
  // When stackEditMode turns on, pause playback.
  if (!s.includes('/* edit-mode auto-pause */')) {
    // Find stackEditMode state and add effect after it
    const anchor = 'const [stackEditMode, setStackEditMode] = useState(true);';
    const ai = s.indexOf(anchor);
    if (ai >= 0) {
      const insertAt = ai + anchor.length;
      const effect = `

  /* edit-mode auto-pause */
  useEffect(() => {
    if (!stackEditMode) return;
    // Freeze the clock so free-place editing isn't fighting a moving playhead.
    const c = clockRef.current;
    if (c?.playing) {
      c.playing = false;
      cancelAnimationFrame(c.raf);
      setPlaying(false);
      const v = previewRef.current;
      if (v && !v.paused) v.pause();
      const ov = overlayRef.current;
      if (ov && !ov.paused) ov.pause();
    }
  }, [stackEditMode]);
`;
      s = s.slice(0, insertAt) + effect + s.slice(insertAt);
      console.log('edit auto-pause effect added');
    } else {
      console.warn('stackEditMode anchor missing');
    }
  }

  // Block pointer events on Remotion/video while editing free-place
  // Add a shield div when stackEditMode near WordDragLayer
  if (!s.includes('data-edit-shield')) {
    // Insert shield before WordDragLayer
    const wdl = s.indexOf('{stackEditMode && (');
    // find WordDragLayer occurrence with stackEditMode
    const wdlTag = s.indexOf('<WordDragLayer');
    if (wdlTag > 0) {
      // look backward for stackEditMode &&
      const before = s.lastIndexOf('stackEditMode &&', wdlTag);
      if (before > 0) {
        // insert shield as sibling before WordDragLayer inside the fragment/paren
        s = s.replace(
          /\{stackEditMode && \(\s*\n\s*<WordDragLayer/,
          `{stackEditMode && (
                        <>
                        {/* Blocks click-through to the video/player while placing words. */}
                        <div
                          data-edit-shield
                          className="absolute inset-0 z-[25]"
                          style={{ pointerEvents: 'auto', cursor: 'default' }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                        <WordDragLayer`,
        );
        // close the fragment — find onStyle end of WordDragLayer
        // Look for WordDragLayer closing />
        const afterWdl = s.indexOf('<WordDragLayer');
        // find matching /> after props — the component ends with />
        let depth = 0;
        let endTag = -1;
        for (let i = afterWdl; i < s.length; i++) {
          if (s.startsWith('/>', i) && depth === 0) {
            // check we're at WordDragLayer's close (first /> after tag)
            endTag = i + 2;
            break;
          }
        }
        if (endTag > 0 && !s.slice(afterWdl, endTag + 20).includes('</>')) {
          // replace `/>\n                        )}` after WordDragLayer with `/>\n                        </>\n                        )}`
          const close = s.indexOf('/>', afterWdl);
          // only first
          const slice = s.slice(close, close + 40);
          if (slice.includes('/>')) {
            s =
              s.slice(0, close + 2) +
              '\n                        </>' +
              s.slice(close + 2);
            console.log('edit shield + fragment close');
          }
        }
      }
    }
  }

  // Also pass freePlaceEdit only when stackEditMode — already done.
  // Ensure Remotion freePlaceEdit is false in Preview so timing applies
  // (already freePlaceEdit={stackEditMode})

  write(p, s, crlf);
}

// ── 4) WordDragLayer: arrow nudge + center snap ───────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  const p = path.join(root, rel);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);

  // Arrow-key nudge when a word is selected
  if (!s.includes('/* arrow-nudge */')) {
    // Find component body after hooks — look for return (
    const exp = s.indexOf('export default function WordDragLayer');
    const ret = s.indexOf('\n  return (', exp);
    if (ret > 0) {
      const nudge = `
  /* arrow-nudge */
  useEffect(() => {
    if (selectedIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 2.5 : 0.5; // % of frame
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = step; // bottom-% grows upward
      else if (e.key === 'ArrowDown') dy = -step;
      else return;
      e.preventDefault();
      const w = words.find((x) => x.index === selectedIndex);
      if (!w) return;
      const xPct = Math.max(2, Math.min(98, w.xPct + dx));
      const yPct = Math.max(2, Math.min(98, w.yPct + dy));
      onMove(selectedIndex, xPct, yPct);
      onCommit(selectedIndex, xPct, yPct);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, words, onMove, onCommit]);

`;
      // ensure useEffect imported
      if (!/useEffect/.test(s.slice(0, 200))) {
        s = s.replace(
          /import\s*\{([^}]+)\}\s*from\s*'react'/,
          (m, g) => {
            if (g.includes('useEffect')) return m;
            return `import {${g.replace(/\s+$/, '')}, useEffect } from 'react'`;
          },
        );
      }
      s = s.slice(0, ret + 1) + nudge + s.slice(ret + 1);
      console.log('arrow nudge added');
    }
  }

  // Center snap while dragging — in startDrag move handler
  // Look for onMove call during pointer move
  if (!s.includes('/* center-snap */')) {
    // Find where xPct/yPct computed during drag
    const moveIdx = s.indexOf('onMove(');
    // search for pattern like set of xPct during drag
    const dragMove = s.indexOf('const xPct =');
    // multiple — find inside pointer move
    let idx = 0;
    const hits = [];
    while ((idx = s.indexOf('xPct', idx)) >= 0) {
      hits.push(idx);
      idx++;
    }
    // Look for clamp during drag
    const clamp = s.indexOf('Math.min(98');
    if (clamp > 0) {
      // inject snap after xPct/yPct assignment block near clamp
      const block = s.slice(clamp - 200, clamp + 200);
      console.log('clamp context', block.replace(/\s+/g, ' ').slice(0, 180));
    }

    // Simpler: add snap guide visual when selected near center
    const mapStart = s.indexOf('words.map((w) =>');
    if (mapStart > 0 && !s.includes('data-center-guide')) {
      // After frameRef div open, add center guides when selected
      s = s.replace(
        /data-word-drag-layer\n    >/,
        `data-word-drag-layer
    >
      {selectedIndex != null && (
        <>
          <div
            data-center-guide
            className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-brass/40"
            style={{ transform: 'translateX(-0.5px)' }}
          />
          <div
            data-center-guide
            className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-brass/25"
            style={{ transform: 'translateY(-0.5px)' }}
          />
        </>
      )}
`,
      );
      console.log('center guides added');
    }

    // Snap on commit if within 1.5% of center
    if (s.includes('onCommit(') && !s.includes('/* center-snap */')) {
      // wrap is hard — do snap inside pointerup if we find it
      const pup = s.indexOf('onCommit(index');
      if (pup < 0) {
        // try other patterns
        const pup2 = s.indexOf('onCommit(');
        console.log('onCommit at', pup2, s.slice(pup2, pup2 + 80));
      }
      // Find startDrag function and its pointerup
      const pu = s.indexOf('pointerup');
      if (pu > 0) {
        console.log('pointerup', s.slice(pu - 20, pu + 300).replace(/\s+/g, ' ').slice(0, 200));
      }
    }
  }

  // Snap in onMove path: when computing final x during drag
  // Search for pattern: onMove(index, x, y) or similar
  const moveCall = s.match(/onMove\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
  if (moveCall && !s.includes('/* center-snap */')) {
    // Add helper near top of file after imports
    if (!s.includes('function snapPct')) {
      s = s.replace(
        /export type WordPlace/,
        `/** Snap to center axes when within threshold (percent). */
function snapPct(x: number, y: number, thr = 1.5): { x: number; y: number } {
  /* center-snap */
  return {
    x: Math.abs(x - 50) <= thr ? 50 : x,
    y: Math.abs(y - 50) <= thr ? 50 : y,
  };
}

export type WordPlace`,
      );
    }
    // Apply snap before onMove/onCommit in drag — find assignments
    // Common pattern: onMove(idx, nx, ny)
    s = s.replace(
      /onMove\((\w+),\s*(\w+),\s*(\w+)\)/g,
      (m, a, b, c) => {
        // don't double-wrap
        if (m.includes('snapPct')) return m;
        return `(() => { const _s = snapPct(${b}, ${c}); onMove(${a}, _s.x, _s.y); })()`;
      },
    );
    s = s.replace(
      /onCommit\((\w+),\s*(\w+),\s*(\w+)\)/g,
      (m, a, b, c) => {
        if (m.includes('snapPct')) return m;
        return `(() => { const _s = snapPct(${b}, ${c}); onCommit(${a}, _s.x, _s.y); })()`;
      },
    );
    console.log('snap applied to onMove/onCommit');
  }

  write(p, s, crlf);
}

// tsc
try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        /page\.tsx|captionLayer|WordDrag|StageCaptions|freePlace|snapPct|markFonts|useCaptionFonts/.test(
          l,
        ),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (!lines.length) {
    out
      .split(/\r?\n/)
      .filter((l) => /error TS/.test(l))
      .slice(0, 15)
      .forEach((l) => console.log(l));
  }
  if (lines.length) process.exit(1);
}
console.log('OK');

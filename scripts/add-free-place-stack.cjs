#!/usr/bin/env node
/**
 * Free-place stack cards:
 * - mark.xPct / mark.yPct = frame-relative word position (center x, bottom y)
 * - Creating a stack card seeds a multi-row default layout
 * - Caption layer renders free-placed card words as absolute items
 * - WordDragLayer lets user drag words on the preview canvas
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ---------------------------------------------------------------------------
// 1) types — xPct/yPct on ReelWordMark + layout helper
// ---------------------------------------------------------------------------
{
  let t = read('src/lib/mothermode/reel/types.ts');
  if (!t.includes('xPct?: number')) {
    t = t.replace(
      /\/\*\* Entrance anim for THIS word instead of the preset's\. \*\/\r?\n\s*anim\?: string;/,
      `/**
   * Free-place position on the frame (stack cards). xPct = horizontal centre
   * 0–100; yPct = distance from the BOTTOM edge 0–100 — same axes as the
   * caption box so drag + render agree by construction.
   */
  xPct?: number;
  yPct?: number;
  /** Entrance anim for THIS word instead of the preset's. */
  anim?: string;`,
    );
    console.log('types xPct/yPct');
  }

  // helper after wordMarkSummary or near ReelWord
  if (!t.includes('export function defaultStackLayout')) {
    const anchor = 'export function wordMarkSummary';
    if (!t.includes(anchor)) {
      console.error('wordMarkSummary missing');
      process.exit(1);
    }
    // append helper after wordMarkSummary function block — find end of function
    const start = t.indexOf(anchor);
    let brace = 0;
    let i = t.indexOf('{', start);
    let end = i;
    for (; end < t.length; end++) {
      if (t[end] === '{') brace++;
      else if (t[end] === '}') {
        brace--;
        if (brace === 0) {
          end++;
          break;
        }
      }
    }
    const helper = `

/**
 * Seed free-place positions for a stack-card phrase.
 * Spreads words into \`rows\` × words-per-row around the frame centre,
 * matching the caption box's bottom-origin y axis.
 */
export function defaultStackLayout(
  count: number,
  opts?: { rows?: number; wordsPerRow?: number; baseYPct?: number; baseXPct?: number },
): { xPct: number; yPct: number }[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const rows = Math.max(1, Math.min(4, Math.round(opts?.rows ?? Math.min(3, n))));
  const perRow = Math.max(
    1,
    Math.min(8, Math.round(opts?.wordsPerRow ?? Math.ceil(n / rows))),
  );
  const baseX = opts?.baseXPct ?? 50;
  const baseY = opts?.baseYPct ?? 42;
  const rowGap = 9; // % of frame between rows (bottom → top)
  const colGap = 14; // % between word centres
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const rowLen = Math.min(perRow, n - r * perRow);
    const rowWidth = (rowLen - 1) * colGap;
    const x0 = baseX - rowWidth / 2;
    // First row is lowest (closest to baseY); later rows stack upward.
    const y = Math.max(6, Math.min(88, baseY + r * rowGap));
    const x = Math.max(8, Math.min(92, x0 + c * colGap));
    out.push({ xPct: Math.round(x * 10) / 10, yPct: Math.round(y * 10) / 10 });
  }
  return out;
}
`;
    t = t.slice(0, end) + helper + t.slice(end);
    console.log('types defaultStackLayout');
  }

  // summary
  if (!t.includes("if (mark.xPct != null)")) {
    t = t.replace(
      /if \(mark\.hidden\) parts\.push\('muted'\);/,
      `if (mark.hidden) parts.push('muted');
  if (mark.xPct != null && mark.yPct != null) parts.push('placed');`,
    );
  }
  write('src/lib/mothermode/reel/types.ts', t);
}

// ---------------------------------------------------------------------------
// 2) captionLayer — free-place render path
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');

  // CaptionWordMark fields
  if (!s.includes('xPct?: number')) {
    s = s.replace(
      /\/\*\* Entrance anim for THIS word instead of the preset's\. \*\/\r?\n\s*anim\?: string;/,
      `/** Free-place frame position (see ReelWordMark.xPct/yPct). */
  xPct?: number;
  yPct?: number;
  /** Entrance anim for THIS word instead of the preset's. */
  anim?: string;`,
    );
    console.log('layer mark xPct');
  }

  // Free-place branch before normal rows.map return
  if (!s.includes('freePlaceCard')) {
    // Find the outer return with rows.map
    const marker = `{rows.map((row, rowIdx) => (`;
    const idx = s.indexOf(marker);
    if (idx < 0) {
      console.error('rows.map missing');
      process.exit(1);
    }
    // Walk back to `return (` of the outer box
    const retIdx = s.lastIndexOf('return (', idx);
    if (retIdx < 0) {
      console.error('return missing');
      process.exit(1);
    }

    // Insert free-place detection just before that return
    const freeDetect = `
  // Free-place stack card: every word with xPct/yPct is painted at absolute
  // frame coords instead of flowing inside the caption box. This is the
  // MILLIONAIRES composition mode — drag on the stage writes mark.xPct/yPct.
  const freePlaceCard =
    !!cardWin &&
    words
      .slice(cardWin.from, cardWin.to)
      .some(
        (w) =>
          w.mark &&
          typeof w.mark.xPct === 'number' &&
          typeof w.mark.yPct === 'number',
      );
  if (freePlaceCard && cardWin) {
    const visible = words
      .slice(cardWin.from, cardWin.to)
      .map((w, i) => ({ w, idx: cardWin.from + i }))
      .filter(({ w, idx }) => {
        if (w.mark?.hidden) return false;
        if (isBuildStack && frame < w.fromFrame) return false;
        // page mode: show whole card; build: spoken + held
        if (!isBuildStack) {
          // still only while the card's time window is live
          return true;
        }
        return frame >= w.fromFrame || idx <= activeIdx;
      });
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          fontSize,
        }}
      >
        {visible.map(({ w, idx }) => {
          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x = typeof mark?.xPct === 'number' ? mark.xPct : layout.xPct;
          const y =
            typeof mark?.yPct === 'number' ? mark.yPct : layout.positionPct;
          const base: React.CSSProperties = {
            ...(isActive || power ? css.active : css.word),
            position: 'absolute',
            left: \`\${x}%\`,
            bottom: \`\${y}%\`,
            transform: 'translate(-50%, 50%)',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          };
          if (mark?.color) {
            base.color = mark.color;
            delete (base as Record<string, unknown>)['backgroundImage'];
            delete (base as Record<string, unknown>)['WebkitBackgroundClip'];
            delete (base as Record<string, unknown>)['backgroundClip'];
            (base as Record<string, unknown>)['WebkitTextFillColor'] = undefined;
          }
          if (mark?.scale && mark.scale !== 1) {
            const sc = mark.scale;
            base.transform = \`translate(-50%, 50%) scale(\${sc})\`;
            base.transformOrigin = 'center center';
          }
          // Reuse the same word renderer path by cloning the normal branch
          // via a minimal span — entrance anims still apply through wordMotion
          // when present on the normal path; free-place keeps paint simple +
          // correct so drag placement always matches the MP4.
          const text = w.text;
          return (
            <span key={idx} style={base}>
              {text}
            </span>
          );
        })}
      </div>
    );
  }

`;
    s = s.slice(0, retIdx) + freeDetect + s.slice(retIdx);
    console.log('layer free-place branch');
  }

  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
}

// ---------------------------------------------------------------------------
// 3) SubtitlePanel — seed layout on stack create; clear on remove
// ---------------------------------------------------------------------------
{
  let g = read('src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx');

  // import defaultStackLayout
  if (!g.includes('defaultStackLayout')) {
    g = g.replace(
      /import \{ wordMarkSummary, type ReelWord \} from '@\/lib\/mothermode\/reel\/types';/,
      `import {
  defaultStackLayout,
  wordMarkSummary,
  type ReelWord,
} from '@/lib/mothermode/reel/types';`,
    );
    console.log('panel import');
  }

  // rewrite toggleStackCard body to seed positions
  if (!g.includes('defaultStackLayout(')) {
    const start = g.indexOf('function toggleStackCard(from: number, to: number)');
    if (start < 0) {
      console.error('toggleStackCard missing');
      process.exit(1);
    }
    // find matching close brace of function
    let brace = 0;
    let i = g.indexOf('{', start);
    let end = i;
    for (; end < g.length; end++) {
      if (g[end] === '{') brace++;
      else if (g[end] === '}') {
        brace--;
        if (brace === 0) {
          end++;
          break;
        }
      }
    }
    const fn = `function toggleStackCard(from: number, to: number) {
    const existing = phraseCardId(words, from, to);
    if (existing) {
      // Remove card + free-place coords
      const next = words.map((w, i) => {
        if (i < from || i >= to) return w;
        const mark = { ...(w.mark ?? {}) };
        delete mark.card;
        delete mark.xPct;
        delete mark.yPct;
        const empty = Object.keys(mark).length === 0;
        return empty ? { word: w.word, start: w.start, end: w.end } : { ...w, mark };
      });
      onEdit(next);
      return;
    }
    const id = newCardId();
    const count = to - from;
    const wordsPerRow = Math.min(4, Math.max(1, count));
    const rows = Math.min(3, Math.max(1, Math.ceil(count / wordsPerRow)));
    const layout = defaultStackLayout(count, { rows, wordsPerRow });
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      const li = i - from;
      const pos = layout[li] ?? { xPct: 50, yPct: 40 };
      return {
        ...w,
        mark: {
          ...(w.mark ?? {}),
          card: {
            id,
            mode: 'build' as const,
            rows,
            wordsPerRow,
          },
          xPct: pos.xPct,
          yPct: pos.yPct,
        },
      };
    });
    onEdit(next);
  }`;
    g = g.slice(0, start) + fn + g.slice(end);
    console.log('panel toggleStackCard layout');
  }

  write('src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx', g);
}

// ---------------------------------------------------------------------------
// 4) WordDragLayer — new overlay component
// ---------------------------------------------------------------------------
{
  const p = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx',
  );
  write(
    'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx',
    `'use client';

/**
 * WordDragLayer — free-place handles for stack-card words on the preview.
 *
 * Mirrors CaptionDragLayer's contract: live onMove (local), commit on pointerup
 * (persist). Coordinates are frame % with the same axes as the caption box
 * (x = centre, y = from bottom) so the Remotion layer and this overlay agree.
 */
import { useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import type { ReelWord } from '@/lib/mothermode/reel/types';

export type WordPlace = { index: number; xPct: number; yPct: number; label: string };

export default function WordDragLayer({
  words,
  selectedIndex,
  onSelect,
  onMove,
  onCommit,
}: {
  /** Words currently free-placed (already filtered to the active card). */
  words: WordPlace[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, xPct: number, yPct: number) => void;
  onCommit: (index: number, xPct: number, yPct: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<{ index: number; x: number; y: number } | null>(null);

  const clientToPct = useCallback((clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return { x: 50, y: 50 };
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / Math.max(1, r.width)) * 100;
    // y from BOTTOM
    const y = (1 - (clientY - r.top) / Math.max(1, r.height)) * 100;
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
    };
  }, []);

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(index);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const { x, y } = clientToPct(e.clientX, e.clientY);
    lastRef.current = { index, x, y };
    onMove(index, x, y);

    const onMoveEv = (ev: PointerEvent) => {
      const p = clientToPct(ev.clientX, ev.clientY);
      lastRef.current = { index, x: p.x, y: p.y };
      onMove(index, p.x, p.y);
    };
    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', onMoveEv);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      const last = lastRef.current;
      if (last && last.index === index) {
        onCommit(index, last.x, last.y);
      }
      lastRef.current = null;
    };
    el.addEventListener('pointermove', onMoveEv);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  if (!words.length) return null;

  return (
    <div
      ref={frameRef}
      className="pointer-events-none absolute inset-0 z-30"
      data-word-drag-layer
    >
      {words.map((w) => {
        const selected = selectedIndex === w.index;
        return (
          <button
            key={w.index}
            type="button"
            onPointerDown={(e) => startDrag(w.index, e)}
            className={clsx(
              'pointer-events-auto absolute -translate-x-1/2 translate-y-1/2',
              'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              'cursor-grab active:cursor-grabbing select-none',
              selected
                ? 'border-brass bg-brass/20 text-brass shadow-[0_0_0_1px_rgba(212,175,55,0.5)]'
                : 'border-white/30 bg-black/50 text-white/90 hover:border-brass/60',
            )}
            style={{
              left: \`\${w.xPct}%\`,
              bottom: \`\${w.yPct}%\`,
            }}
            title={\`Drag "\${w.label}" · \${w.xPct.toFixed(0)}%, \${w.yPct.toFixed(0)}%\`}
          >
            {w.label}
          </button>
        );
      })}
      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[8px] text-white/50">
        drag words to place · click selects for FX
      </div>
    </div>
  );
}

/** Build drag handles from caption words that carry free-place coords. */
export function freePlaceWordsFrom(
  all: ReelWord[],
  playheadSec: number,
): WordPlace[] {
  // Prefer the card under the playhead; else any free-placed words.
  let cardId: string | null = null;
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (
      w.mark?.card?.id &&
      playheadSec >= w.start - 0.05 &&
      playheadSec <= w.end + 0.8
    ) {
      cardId = w.mark.card.id;
      break;
    }
  }
  const out: WordPlace[] = [];
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (w.mark?.hidden) continue;
    if (typeof w.mark?.xPct !== 'number' || typeof w.mark?.yPct !== 'number') {
      continue;
    }
    if (cardId && w.mark?.card?.id !== cardId) continue;
    out.push({
      index: i,
      xPct: w.mark.xPct,
      yPct: w.mark.yPct,
      label: w.word,
    });
  }
  return out;
}
`,
  );
  console.log('WordDragLayer written');
}

// ---------------------------------------------------------------------------
// 5) page.tsx — mount WordDragLayer + local place state
// ---------------------------------------------------------------------------
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');

  // import
  if (!p.includes('WordDragLayer')) {
    p = p.replace(
      /import CaptionDragLayer from '\.\/CaptionDragLayer';/,
      `import CaptionDragLayer from './CaptionDragLayer';
import WordDragLayer, { freePlaceWordsFrom } from './WordDragLayer';`,
    );
    console.log('page import');
  }

  // local state near other caption state — find setCaptionOverridesLocal or similar
  if (!p.includes('wordPlaceLocal')) {
    // inject after a known useState
    const needle = 'const [fxMode, setFxMode]';
    const i = p.indexOf(needle);
    if (i >= 0) {
      // find end of that useState line
      const lineEnd = p.indexOf('\n', i);
      p =
        p.slice(0, lineEnd + 1) +
        `  /** Live free-place drag offsets (index → x/y) — local only until commit. */\n` +
        `  const [wordPlaceLocal, setWordPlaceLocal] = useState<\n` +
        `    Record<number, { xPct: number; yPct: number }\n` +
        `  >>({});\n` +
        p.slice(lineEnd + 1);
      console.log('page state');
    } else {
      console.warn('fxMode state not found — state inject skipped');
    }
  }

  // Helper to merge local place into words for drag layer
  // Mount WordDragLayer next to each CaptionDragLayer
  if (!p.includes('<WordDragLayer')) {
    // Insert after first CaptionDragLayer block's closing />
    // Do both occurrences
    let count = 0;
    const re =
      /(<CaptionDragLayer[\s\S]*?onResizeCommit=\{\(sizePx\) => \{\s*void setCaptionOverrides\(\{ sizePx \}\);\s*\}\}\s*\/>)/g;
    // simpler: after every `</>` that follows CaptionDragLayer — actually insert before CaptionDragLayer's sibling close

    // Find pattern: CaptionDragLayer ... />  and insert WordDragLayer after
    const simple =
      /(onResizeCommit=\{\(sizePx\) => \{\r?\n\s*void setCaptionOverrides\(\{ sizePx \}\);\r?\n\s*\}\}\r?\n\s*\/>)/g;
    if (simple.test(p)) {
      p = p.replace(simple, (m) => {
        count++;
        return (
          m +
          `
                        <WordDragLayer
                          words={(() => {
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
                            return freePlaceWordsFrom(base, clipSec).map((w) => {
                              const loc = wordPlaceLocal[w.index];
                              return loc ? { ...w, xPct: loc.xPct, yPct: loc.yPct } : w;
                            });
                          })()}
                          selectedIndex={
                            fxWordIndexes && fxWordIndexes.size === 1
                              ? [...fxWordIndexes][0]
                              : null
                          }
                          onSelect={(index) => {
                            setFxMode(true);
                            setFxPicked(new Set([index]));
                          }}
                          onMove={(index, xPct, yPct) => {
                            setWordPlaceLocal((prev) => ({
                              ...prev,
                              [index]: { xPct, yPct },
                            }));
                          }}
                          onCommit={(index, xPct, yPct) => {
                            setWordPlaceLocal((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                            void applyWordMark(index, { xPct, yPct });
                          }}
                        />`
        );
      });
      console.log('WordDragLayer mounts', count);
    } else {
      // try alternate CaptionDragLayer without resize on second branch
      console.warn('primary mount pattern missed, trying alt');
      const alt =
        /(onCommit=\{\(x, y\) => \{\r?\n\s*void setCaptionOverrides\(\{ xPct: x, positionPct: y \}\);\r?\n\s*\}\}\r?\n\s*onResize=\{\(sizePx\) => setCaptionOverridesLocal\(\{ sizePx \}\)\}\r?\n\s*onResizeCommit=\{\(sizePx\) => \{\r?\n\s*void setCaptionOverrides\(\{ sizePx \}\);\r?\n\s*\}\}\r?\n\s*\/>)/g;
      if (alt.test(p)) {
        p = p.replace(alt, (m) => {
          count++;
          return m + `\n                        {/* WordDragLayer injected */}`;
        });
      }
      // Force one mount near first CaptionDragLayer close
      const first = p.indexOf('<CaptionDragLayer');
      if (first >= 0 && !p.includes('<WordDragLayer')) {
        const close = p.indexOf('/>', first);
        if (close > 0) {
          const block = `
                        <WordDragLayer
                          words={(() => {
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
                            return freePlaceWordsFrom(base, clipSec).map((w) => {
                              const loc = wordPlaceLocal[w.index];
                              return loc ? { ...w, xPct: loc.xPct, yPct: loc.yPct } : w;
                            });
                          })()}
                          selectedIndex={
                            fxWordIndexes && fxWordIndexes.size === 1
                              ? [...fxWordIndexes][0]
                              : null
                          }
                          onSelect={(index) => {
                            setFxMode(true);
                            setFxPicked(new Set([index]));
                          }}
                          onMove={(index, xPct, yPct) => {
                            setWordPlaceLocal((prev) => ({
                              ...prev,
                              [index]: { xPct, yPct },
                            }));
                          }}
                          onCommit={(index, xPct, yPct) => {
                            setWordPlaceLocal((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                            void applyWordMark(index, { xPct, yPct });
                          }}
                        />`;
          // insert after both CaptionDragLayer self-closes — walk all
          let pos = 0;
          let inserts = 0;
          while (inserts < 2) {
            const a = p.indexOf('<CaptionDragLayer', pos);
            if (a < 0) break;
            const c = p.indexOf('/>', a);
            if (c < 0) break;
            p = p.slice(0, c + 2) + block + p.slice(c + 2);
            pos = c + 2 + block.length;
            inserts++;
          }
          console.log('forced mounts', inserts);
        }
      }
    }
  }

  // Ensure setFxPicked exists — might be setFxWordIndexes
  if (p.includes('setFxPicked') && !p.includes('const [fxPicked') && !p.includes('setFxPicked =')) {
    // find actual setter name
    const m = p.match(/const \[fxWordIndexes,\s*(\w+)\]/);
    if (m) {
      p = p.replace(/setFxPicked/g, m[1]);
      console.log('renamed setFxPicked ->', m[1]);
    } else if (p.includes('setFxWordIndexes')) {
      p = p.replace(/setFxPicked/g, 'setFxWordIndexes');
      console.log('renamed to setFxWordIndexes');
    }
  }

  write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
}

// ---------------------------------------------------------------------------
// 6) Tests
// ---------------------------------------------------------------------------
{
  write(
    'tests/lib/caption-free-place.test.ts',
    `import { describe, expect, it } from 'vitest';
import { defaultStackLayout } from '@/lib/mothermode/reel/types';

describe('defaultStackLayout', () => {
  it('returns one position per word', () => {
    expect(defaultStackLayout(5)).toHaveLength(5);
  });

  it('keeps coords inside the safe frame', () => {
    for (const p of defaultStackLayout(9, { rows: 3, wordsPerRow: 3 })) {
      expect(p.xPct).toBeGreaterThanOrEqual(8);
      expect(p.xPct).toBeLessThanOrEqual(92);
      expect(p.yPct).toBeGreaterThanOrEqual(6);
      expect(p.yPct).toBeLessThanOrEqual(88);
    }
  });

  it('stacks later rows higher (larger y from bottom)', () => {
    const layout = defaultStackLayout(6, { rows: 2, wordsPerRow: 3, baseYPct: 30 });
    // row0: indices 0..2, row1: 3..5
    expect(layout[3].yPct).toBeGreaterThan(layout[0].yPct);
  });

  it('centers a single word', () => {
    const [p] = defaultStackLayout(1, { baseXPct: 50, baseYPct: 40 });
    expect(p.xPct).toBe(50);
    expect(p.yPct).toBe(40);
  });
});
`,
  );
  console.log('tests');
}

// vendor sync
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const wl = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(wl)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
    wl,
  );
}

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts tests/lib/caption-stack-cards.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);

// tsc filter
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
        /SubtitlePanel|WordDragLayer|captionLayer|types\.ts|page\.tsx|free-place|freePlace/.test(
          l,
        ),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');

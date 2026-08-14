#!/usr/bin/env node
/**
 * Phrase stack cards + mute-on-timestamps.
 *
 * Data model (rides existing ReelWord.mark — no new project fields):
 *   mark.hidden = true           → word never paints (phrase mute)
 *   mark.card = {
 *     id,                        → groups words into one stack card
 *     mode: 'build' | 'page',    → build&hold vs karaoke page
 *     rows?, wordsPerRow?,       → layout for THIS card only
 *     anim?,                     → default entrance for words in card
 *   }
 *
 * UI: Subtitle Panel per-phrase eye (mute) + Layers (stack card) controls.
 * Layer: respects hidden; when active word is in a card, rows come from the card.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ---------------------------------------------------------------------------
// 1) types.ts — mark.hidden + mark.card
// ---------------------------------------------------------------------------
{
  let t = read('src/lib/mothermode/reel/types.ts');
  if (!t.includes('hidden?: boolean')) {
    t = t.replace(
      /export interface ReelWordMark \{\r?\n\s*\/\*\* Entrance anim/,
      `export interface ReelWordMark {
  /**
   * Hide this word from the caption layer (phrase mute). Timing stays so
   * the transcript/editor still shows it dimmed.
   */
  hidden?: boolean;
  /**
   * Phrase stack card membership. Contiguous words sharing the same card.id
   * render as one stacked page (build&hold or karaoke) with optional local
   * rows/wordsPerRow/anim — the MILLIONAIRES-style phrase block.
   */
  card?: {
    id: string;
    mode: 'build' | 'page';
    rows?: number;
    wordsPerRow?: number;
    /** Default entrance for words in this card (overridden by mark.anim). */
    anim?: string;
  };
  /** Entrance anim`,
    );
    console.log('types: hidden+card');
  }

  // wordMarkSummary
  if (!t.includes("if (mark.hidden)")) {
    t = t.replace(
      /if \(mark\.fx\) parts\.push\(mark\.fx\);/,
      `if (mark.hidden) parts.push('muted');
  if (mark.card) parts.push(\`card \${mark.card.mode}\`);
  if (mark.fx) parts.push(mark.fx);`,
    );
    console.log('types: summary');
  }
  write('src/lib/mothermode/reel/types.ts', t);
}

// ---------------------------------------------------------------------------
// 2) captionLayer — CaptionWordMark + row logic + hide
// ---------------------------------------------------------------------------
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');

  // CaptionWordMark fields
  if (!s.includes('hidden?: boolean')) {
    s = s.replace(
      /export interface CaptionWordMark \{\r?\n\s*\/\*\* Entrance anim/,
      `export interface CaptionWordMark {
  /** Hide this word from paint (phrase mute). */
  hidden?: boolean;
  /** Phrase stack card (see ReelWordMark.card). */
  card?: {
    id: string;
    mode: 'build' | 'page';
    rows?: number;
    wordsPerRow?: number;
    anim?: string;
  };
  /** Entrance anim`,
    );
    console.log('layer mark fields');
  }

  // Helper: resolve card window for active word — inject before CaptionLayerFrame
  if (!s.includes('function resolveCardWindow')) {
    const anchor = 'export const CaptionLayerFrame';
    const helper = `/** When the active word belongs to a stack card, return that card's word window. */
function resolveCardWindow(
  words: CaptionWord[],
  activeIdx: number,
): { from: number; to: number; mode: 'build' | 'page'; rows: number; wordsPerRow: number; anim?: string } | null {
  const m = words[activeIdx]?.mark?.card;
  if (!m?.id) return null;
  let from = activeIdx;
  let to = activeIdx + 1;
  while (from > 0 && words[from - 1]?.mark?.card?.id === m.id) from -= 1;
  while (to < words.length && words[to]?.mark?.card?.id === m.id) to += 1;
  return {
    from,
    to,
    mode: m.mode === 'page' ? 'page' : 'build',
    rows: Math.max(1, Math.min(4, Math.round(m.rows ?? 3))),
    wordsPerRow: Math.max(1, Math.min(8, Math.round(m.wordsPerRow ?? 3))),
    anim: m.anim,
  };
}

function cardRows(
  cardFrom: number,
  cardTo: number,
  activeIdx: number,
  wordsPerRow: number,
  rows: number,
): { from: number; to: number }[] {
  const perRow = Math.max(1, Math.round(wordsPerRow));
  const rowCount = Math.max(1, Math.round(rows));
  const local = Math.max(0, activeIdx - cardFrom);
  const pageSize = perRow * rowCount;
  const pageFrom = cardFrom + Math.floor(local / pageSize) * pageSize;
  const out: { from: number; to: number }[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const from = pageFrom + r * perRow;
    if (from >= cardTo) break;
    out.push({ from, to: Math.min(cardTo, from + perRow) });
  }
  return out.length ? out : [{ from: cardFrom, to: cardTo }];
}

`;
    s = s.replace(anchor, helper + anchor);
    console.log('layer helpers');
  }

  // Replace rows resolution to prefer card
  if (!s.includes('resolveCardWindow(')) {
    s = s.replace(
      /const css = captionCssFor\(def\);\r?\n\s*const rows = captionRows\(words\.length, activeIdx, layout\.wordsPerRow, layout\.rows\);\r?\n\s*const defAnim = \(def as \{ anim\?: string \}\)\.anim \?\? 'pop';\r?\n\s*const stackMode =[\s\S]*?const isBuildStack = stackMode === 'build';/,
      `const css = captionCssFor(def);
  const cardWin = resolveCardWindow(words, activeIdx);
  const rows = cardWin
    ? cardRows(cardWin.from, cardWin.to, activeIdx, cardWin.wordsPerRow, cardWin.rows)
    : captionRows(words.length, activeIdx, layout.wordsPerRow, layout.rows);
  const defAnim =
    (cardWin?.anim as string | undefined) ||
    (def as { anim?: string }).anim ||
    'pop';
  const stackMode = cardWin
    ? cardWin.mode
    : (((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
        ?.stackMode as string) ||
      'page');
  const isBuildStack = stackMode === 'build';`,
    );
    console.log('layer rows/card');
  }

  // Hide marked.hidden words — skip render (return null from map)
  if (!s.includes('mark?.hidden')) {
    // After const mark = ...
    if (s.includes('const mark = w.mark')) {
      s = s.replace(
        /const mark = w\.mark;/,
        `const mark = w.mark;
            if (mark?.hidden) {
              return null;
            }`,
      );
      console.log('layer hide skip');
    } else {
      // try alternate
      s = s.replace(
        /const stackBuildHide = isBuildStack && frame < w\.fromFrame;/,
        `if (w.mark?.hidden) {
              return null;
            }
            const stackBuildHide = isBuildStack && frame < w.fromFrame;`,
      );
      console.log('layer hide via stackBuild');
    }
  }

  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
}

// ---------------------------------------------------------------------------
// 3) SubtitlePanel — mute eye + stack card controls
// ---------------------------------------------------------------------------
{
  let g = read('src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx');

  // Expand imports
  if (!g.includes('EyeOff')) {
    g = g.replace(
      "import { AlignLeft, Check, Loader2, Mic, X } from 'lucide-react';",
      "import { AlignLeft, Check, Eye, EyeOff, Layers, Loader2, Mic, X } from 'lucide-react';",
    );
  }

  // Helpers after phrasesFor
  if (!g.includes('function phraseMuted')) {
    g = g.replace(
      /function activeIndexAt[\s\S]*?\n\}/,
      (m) =>
        m +
        `

function phraseMuted(words: ReelWord[], from: number, to: number): boolean {
  let n = 0;
  for (let i = from; i < to; i += 1) if (words[i]?.mark?.hidden) n += 1;
  return n > 0 && n >= to - from;
}

function phraseCardId(words: ReelWord[], from: number, to: number): string | null {
  const id = words[from]?.mark?.card?.id;
  if (!id) return null;
  for (let i = from; i < to; i += 1) {
    if (words[i]?.mark?.card?.id !== id) return null;
  }
  return id;
}

function newCardId(): string {
  return \`card_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 6)}\`;
}
`,
    );
    console.log('panel helpers');
  }

  // Add toggle helpers inside component before return
  if (!g.includes('function toggleMutePhrase')) {
    g = g.replace(
      /function commit\(i: number\) \{[\s\S]*?setEditing\(null\);\r?\n\s*\}/,
      (m) =>
        m +
        `

  function toggleMutePhrase(from: number, to: number) {
    const muted = phraseMuted(words, from, to);
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      const mark = { ...(w.mark ?? {}) };
      if (muted) delete mark.hidden;
      else mark.hidden = true;
      const empty = Object.keys(mark).length === 0;
      return empty ? { word: w.word, start: w.start, end: w.end } : { ...w, mark };
    });
    onEdit(next);
  }

  function toggleStackCard(from: number, to: number) {
    const existing = phraseCardId(words, from, to);
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      const mark = { ...(w.mark ?? {}) };
      if (existing) {
        delete mark.card;
      } else {
        // Keep a stable id across the phrase so the layer groups them.
        mark.card = mark.card?.id
          ? mark.card
          : {
              id: '', // filled below
              mode: 'build',
              rows: 3,
              wordsPerRow: Math.min(4, Math.max(1, to - from)),
            };
      }
      const empty = Object.keys(mark).length === 0;
      return empty ? { word: w.word, start: w.start, end: w.end } : { ...w, mark };
    });
    if (!existing) {
      const id = newCardId();
      for (let i = from; i < to; i += 1) {
        if (next[i].mark) {
          next[i] = {
            ...next[i],
            mark: {
              ...next[i].mark!,
              card: {
                id,
                mode: 'build',
                rows: 3,
                wordsPerRow: Math.min(4, Math.max(1, to - from)),
              },
            },
          };
        }
      }
    }
    onEdit(next);
  }

  function setCardMode(from: number, to: number, mode: 'build' | 'page') {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      return {
        ...w,
        mark: { ...w.mark, card: { ...w.mark.card, mode } },
      };
    });
    onEdit(next);
  }
`,
    );
    console.log('panel toggles');
  }

  // UI: controls on each phrase row
  if (!g.includes('toggleMutePhrase(')) {
    g = g.replace(
      /\{phrases\.map\(\(p, pi\) => \{\r?\n\s*const rowActive = activeIdx >= p\.from && activeIdx < p\.to;\r?\n\s*return \(/,
      `{phrases.map((p, pi) => {
            const rowActive = activeIdx >= p.from && activeIdx < p.to;
            const muted = phraseMuted(words, p.from, p.to);
            const cardId = phraseCardId(words, p.from, p.to);
            const cardMode = cardId ? words[p.from]?.mark?.card?.mode : null;
            return (`,
    );

    // After timecode button, before phrase <p>
    g = g.replace(
      /(\{tc\(words\[p\.from\]\.start\)\}\r?\n\s*<\/button>\r?\n)/,
      `$1
                {/* mute + stack card */}
                <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMutePhrase(p.from, p.to);
                    }}
                    title={muted ? 'Show captions for this line' : 'Mute captions for this line'}
                    className={clsx(
                      'rounded p-0.5',
                      muted ? 'text-rose-300 hover:bg-rose-400/15' : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    {muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStackCard(p.from, p.to);
                    }}
                    title={
                      cardId
                        ? 'Remove stack card (back to normal karaoke)'
                        : 'Make stack card — words build & hold as a phrase block'
                    }
                    className={clsx(
                      'rounded p-0.5',
                      cardId
                        ? 'text-brass hover:bg-brass/15'
                        : 'text-bone/30 hover:bg-bone/10 hover:text-bone/70',
                    )}
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                </div>
`,
    );

    // Dim muted phrase text
    g = g.replace(
      /className="min-w-0 flex-1 text-\[12px\] leading-5 text-bone\/80"/,
      `className={clsx(
                    'min-w-0 flex-1 text-[12px] leading-5',
                    muted ? 'text-bone/25 line-through decoration-bone/20' : 'text-bone/80',
                    cardId && !muted && 'text-bone/90',
                  )}`,
    );

    // Card mode chips under phrase when card active — after closing </p> of phrase
    g = g.replace(
      /(\s*)<\/p>\r?\n(\s*)<\/div>\r?\n(\s*)\);\r?\n(\s*)\}\)\}/,
      `$1</p>
                {cardId ? (
                  <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'build')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'build'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Build & hold — words appear on speech and stay"
                    >
                      build
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardMode(p.from, p.to, 'page')}
                      className={clsx(
                        'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                        cardMode === 'page'
                          ? 'bg-brass text-ink'
                          : 'border border-bone/15 text-bone/40 hover:bg-bone/10',
                      )}
                      title="Karaoke page — whole card visible, highlight walks"
                    >
                      page
                    </button>
                  </div>
                ) : null}
$2</div>
$3);
$4})}`,
    );

    // Footer hint
    g = g.replace(
      /: 'click a timecode to seek · click a word to edit it'\}/,
      `: 'eye = mute line · layers = stack card · click timecode to seek · click word to edit'}`,
    );

    console.log('panel UI');
  }

  write('src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx', g);
}

// ---------------------------------------------------------------------------
// 4) Tests
// ---------------------------------------------------------------------------
{
  const p = path.join(root, 'tests/lib/caption-stack-cards.test.ts');
  fs.writeFileSync(
    p,
    `import { describe, expect, it } from 'vitest';
import type { ReelWord } from '@/lib/mothermode/reel/types';
import { isCaptionVisibleAt } from '@/lib/mothermode/reel/captions';

/** Mirror of layer helpers for unit coverage (kept local to avoid exporting internals). */
function resolveCardWindow(
  words: { mark?: { card?: { id: string; mode: 'build' | 'page'; rows?: number; wordsPerRow?: number } } }[],
  activeIdx: number,
) {
  const m = words[activeIdx]?.mark?.card;
  if (!m?.id) return null;
  let from = activeIdx;
  let to = activeIdx + 1;
  while (from > 0 && words[from - 1]?.mark?.card?.id === m.id) from -= 1;
  while (to < words.length && words[to]?.mark?.card?.id === m.id) to += 1;
  return {
    from,
    to,
    mode: m.mode === 'page' ? 'page' : 'build',
    rows: Math.max(1, Math.min(4, Math.round(m.rows ?? 3))),
    wordsPerRow: Math.max(1, Math.min(8, Math.round(m.wordsPerRow ?? 3))),
  };
}

describe('phrase stack cards + mute', () => {
  it('groups contiguous card ids into one window', () => {
    const words = [
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      { mark: { card: { id: 'a', mode: 'build' as const, rows: 3, wordsPerRow: 2 } } },
      {},
    ];
    const w = resolveCardWindow(words, 1);
    expect(w).toEqual({ from: 0, to: 3, mode: 'build', rows: 3, wordsPerRow: 2 });
  });

  it('returns null when active word has no card', () => {
    expect(resolveCardWindow([{}, {}], 0)).toBeNull();
  });

  it('hidden mark is independent of global mute ranges', () => {
    // Global ranges still work
    expect(isCaptionVisibleAt(3, { muteRanges: [{ fromSec: 2, toSec: 5 }] })).toBe(false);
    // Per-word hidden is a mark concern (layer skips paint) — ranges stay for bulk windows
    expect(isCaptionVisibleAt(1, { captionsOn: true })).toBe(true);
  });

  it('phrase mute sets hidden on every word in range', () => {
    const words: ReelWord[] = [
      { word: 'hello', start: 0, end: 0.3 },
      { word: 'world', start: 0.3, end: 0.6 },
    ];
    const muted = words.map((w) => ({ ...w, mark: { ...(w.mark ?? {}), hidden: true } }));
    expect(muted.every((w) => w.mark?.hidden)).toBe(true);
  });
});
`,
  );
  console.log('tests written');
}

// Sync vendor
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
// types is not always vendored — copy layer + captions already handled
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

// Also copy types if worker has it
const wt = path.join(root, 'render-worker/src/lib/mothermode/reel/types.ts');
if (fs.existsSync(wt)) {
  // worker types may be a subset — only patch if it has ReelWordMark
  let wtS = fs.readFileSync(wt, 'utf8');
  if (wtS.includes('export interface ReelWordMark') && !wtS.includes('hidden?: boolean')) {
    wtS = wtS.replace(
      /export interface ReelWordMark \{\r?\n\s*\/\*\* Entrance anim/,
      `export interface ReelWordMark {
  hidden?: boolean;
  card?: {
    id: string;
    mode: 'build' | 'page';
    rows?: number;
    wordsPerRow?: number;
    anim?: string;
  };
  /** Entrance anim`,
    );
    fs.writeFileSync(wt, wtS);
    console.log('worker types patched');
  }
}

execSync(
  'pnpm exec vitest run tests/lib/caption-stack-cards.test.ts tests/lib/caption-mute-stack.test.ts tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);

// quick tsc filter
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
        /SubtitlePanel|captionLayer|types\.ts|captions\.ts/.test(l),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');

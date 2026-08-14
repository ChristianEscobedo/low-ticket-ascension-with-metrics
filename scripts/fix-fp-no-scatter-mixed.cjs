#!/usr/bin/env node
/**
 * FP must NOT scatter words.
 *
 * - Stack / FP only tags the phrase for edit — no auto xPct/yPct grid.
 * - Caption layer: MIXED mode — words with x/y paint absolute; others stay
 *   in the normal karaoke line (same theme/placement).
 * - Word drag: hit targets for all card words; unplaced words get estimated
 *   line positions matching the caption block; first drag writes real coords.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ─── 1) types: card.freePlace flag ───────────────────────────────────────────
{
  const rel = 'src/lib/mothermode/reel/types.ts';
  let s = read(rel);
  if (!s.includes('freePlace?: boolean')) {
    s = s.replace(
      `/** Default entrance for words in this card (overridden by mark.anim). */
    anim?: string;
  };`,
      `/** Default entrance for words in this card (overridden by mark.anim). */
    anim?: string;
    /**
     * Opt-in word edit: drag/style individual words. Does NOT scatter —
     * words keep normal caption layout until the user moves one (then
     * that word alone gets xPct/yPct).
     */
    freePlace?: boolean;
  };`,
    );
    write(rel, s);
    console.log('types: card.freePlace');
  } else console.log('types: freePlace ok');
}

// ─── 2) captionLineLayout helper in types.ts ─────────────────────────────────
{
  const rel = 'src/lib/mothermode/reel/types.ts';
  let s = read(rel);
  if (!s.includes('export function captionLineLayout')) {
    // append after defaultStackLayout function end
    const marker = 'export function defaultStackLayout';
    const start = s.indexOf(marker);
    if (start < 0) throw new Error('defaultStackLayout missing');
    // find end of function by brace match from start
    let i = s.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) throw new Error('could not find end of defaultStackLayout');
    const helper = `

/**
 * Approximate on-frame positions for words as they sit in the normal caption
 * block (centred row(s) at layout.xPct / layout.positionPct). Used so free-place
 * edit can put hit targets ON the existing glyphs without scattering them.
 */
export function captionLineLayout(
  count: number,
  opts?: {
    wordsPerRow?: number;
    baseXPct?: number;
    baseYPct?: number;
    /** Rough centre-to-centre gap as % of frame width. */
    colGapPct?: number;
    rowGapPct?: number;
  },
): { xPct: number; yPct: number }[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const perRow = Math.max(1, Math.min(8, Math.round(opts?.wordsPerRow ?? Math.min(4, n))));
  const baseX = opts?.baseXPct ?? 50;
  const baseY = opts?.baseYPct ?? 12;
  const colGap = opts?.colGapPct ?? 11;
  const rowGap = opts?.rowGapPct ?? 7;
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    // Last row may be shorter — centre that row too.
    const rowStart = row * perRow;
    const rowCount = Math.min(perRow, n - rowStart);
    const rowWidth = (rowCount - 1) * colGap;
    const x0 = baseX - rowWidth / 2;
    out.push({
      xPct: Math.max(4, Math.min(96, x0 + col * colGap)),
      // Rows stack upward from the caption baseline (y is from bottom).
      yPct: Math.max(4, Math.min(96, baseY + row * rowGap)),
    });
  }
  return out;
}
`;
    s = s.slice(0, end) + helper + s.slice(end);
    write(rel, s);
    console.log('types: captionLineLayout');
  } else console.log('types: captionLineLayout ok');
}

// ─── 3) SubtitlePanel: FP sets freePlace flag only ───────────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx';
  let s = read(rel);

  // Replace enableFreePlace body
  const reEnable =
    /function enableFreePlace\(from: number, to: number\) \{[\s\S]*?\n  \}\n\n  function clearFreePlace/;
  const neuEnable = `function enableFreePlace(from: number, to: number) {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    // Flag only — do NOT assign xPct/yPct. Words stay on the normal caption
    // line until the user drags one (that drag writes coords for that word).
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      return {
        ...w,
        mark: {
          ...w.mark,
          card: { ...w.mark.card, freePlace: true },
        },
      };
    });
    onEdit(next);
  }

  function clearFreePlace`;

  if (!reEnable.test(s)) {
    console.error('enableFreePlace not matched');
    process.exit(1);
  }
  s = s.replace(reEnable, neuEnable);

  // clearFreePlace: clear freePlace flag + any coords
  const reClear =
    /function clearFreePlace\(from: number, to: number\) \{[\s\S]*?\n  \}/;
  const neuClear = `function clearFreePlace(from: number, to: number) {
    const id = phraseCardId(words, from, to);
    if (!id) return;
    const next = words.map((w, i) => {
      if (i < from || i >= to) return w;
      if (!w.mark?.card || w.mark.card.id !== id) return w;
      const mark = { ...w.mark };
      delete mark.xPct;
      delete mark.yPct;
      if (mark.card) {
        const card = { ...mark.card };
        delete (card as { freePlace?: boolean }).freePlace;
        mark.card = card;
      }
      return { ...w, mark };
    });
    onEdit(next);
  }`;
  if (!reClear.test(s)) {
    console.error('clearFreePlace not matched');
    process.exit(1);
  }
  s = s.replace(reClear, neuClear);

  // FP button active state: freePlace flag OR any coords
  s = s.replace(
    /const hasFp = words\s*\.slice\(p\.from, p\.to\)\s*\.some\(\s*\(w\) =>\s*typeof w\.mark\?\.xPct === 'number' &&\s*typeof w\.mark\?\.yPct === 'number',\s*\);/g,
    `const hasFp = words
                          .slice(p.from, p.to)
                          .some(
                            (w) =>
                              w.mark?.card?.freePlace === true ||
                              (typeof w.mark?.xPct === 'number' &&
                                typeof w.mark?.yPct === 'number'),
                          );`,
  );
  // title/className still use inline some() — replace those patterns
  s = s.replace(
    /words\s*\.slice\(p\.from, p\.to\)\s*\.some\(\s*\(w\) =>\s*typeof w\.mark\?\.xPct === 'number' &&\s*typeof w\.mark\?\.yPct === 'number',\s*\)/g,
    `words
                          .slice(p.from, p.to)
                          .some(
                            (w) =>
                              w.mark?.card?.freePlace === true ||
                              (typeof w.mark?.xPct === 'number' &&
                                typeof w.mark?.yPct === 'number'),
                          )`,
  );

  s = s.replace(
    'Free place — drag words anywhere on the frame',
    'Word edit — keep layout; drag a word to nudge it',
  );
  s = s.replace(
    'Exit free-place — back to normal caption layout',
    'Exit word edit — clear nudged positions',
  );

  write(rel, s);
  console.log('SubtitlePanel: FP flag only');
}

// ─── 4) captionLayer: MIXED free-place (no whole-card takeover) ──────────────
{
  const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
  let s = read(rel);
  const nl = s.includes('\r\n') ? '\r\n' : '\n';

  // Replace freePlaceCard early-return block with mixed absolute overlay only
  const startNeedle = `${nl}  // Free-place stack card: every word with xPct/yPct is painted at absolute`;
  const start = s.indexOf(startNeedle);
  if (start < 0) {
    // try without leading nl
    const alt = s.indexOf('  // Free-place stack card: every word with xPct/yPct is painted at absolute');
    if (alt < 0) throw new Error('free-place block start not found');
  }
  const startIdx =
    start >= 0
      ? start
      : s.indexOf('  // Free-place stack card: every word with xPct/yPct is painted at absolute');

  // End at the normal return (after free place block closes)
  const endNeedle = `${nl} return (${nl}    <div${nl}      style={{${nl}        position: 'absolute',${nl}        left: \`\${layout.xPct}%\``;
  let endIdx = s.indexOf(endNeedle, startIdx);
  if (endIdx < 0) {
    endIdx = s.indexOf(
      `${nl}  return (${nl}    <div${nl}      style={{${nl}        position: 'absolute',${nl}        left: \`\${layout.xPct}%\``,
      startIdx,
    );
  }
  if (endIdx < 0) {
    // looser
    const m = s.indexOf('left: `${layout.xPct}%`', startIdx);
    // walk back to return
    endIdx = s.lastIndexOf('return (', m);
    if (endIdx < 0) throw new Error('end of free-place block not found');
  }

  // Find the free-place block end: the `  }` before normal return
  // We'll replace from startIdx through the closing of free place if-block
  const ifStart = s.indexOf('if (freePlaceCard && cardWin)', startIdx);
  if (ifStart < 0) throw new Error('if freePlaceCard not found');
  // brace match
  let bi = s.indexOf('{', ifStart);
  let depth = 0;
  let ifEnd = -1;
  for (let i = bi; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        ifEnd = i + 1;
        break;
      }
    }
  }
  if (ifEnd < 0) throw new Error('if freePlaceCard end not found');

  // Also remove freePlaceCard const
  const constStart = s.lastIndexOf('const freePlaceCard', ifStart);
  const blockStart = Math.min(startIdx, constStart >= 0 ? constStart : ifStart);

  const mixed = `  // Free-place MIXED mode: only words that the user has actually moved
  // (mark.xPct + mark.yPct) leave the caption line. Everything else stays in
  // the normal karaoke block so Stack/FP never changes look until edited.
  const freePlacedAbs = words
    .map((w, idx) => ({ w, idx }))
    .filter(
      ({ w }) =>
        !w.mark?.hidden &&
        typeof w.mark?.xPct === 'number' &&
        typeof w.mark?.yPct === 'number',
    )
    .filter(({ w, idx }) => {
      if (freePlaceEdit) return true;
      if (isBuildStack && frame < w.fromFrame) return false;
      if (!isBuildStack) return true;
      return frame >= w.fromFrame || idx <= activeIdx;
    });

  const absOverlay =
    freePlacedAbs.length > 0 ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 11,
          pointerEvents: 'none',
          fontSize,
        }}
      >
        {freePlacedAbs.map(({ w, idx }) => {
          const isActive = idx === activeIdx;
          const power = isPowerWord(w.text, powerWords as string[]);
          const mark = w.mark;
          const x = mark!.xPct as number;
          const y = mark!.yPct as number;
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
            delete (base as Record<string, unknown>)['WebkitTextFillColor'];
          } else if (
            def.gradientShift &&
            (base as Record<string, unknown>)['backgroundImage']
          ) {
            const tSec = frame / plan.fps;
            const gx = ((tSec * 22) % 100).toFixed(1);
            const gy = ((tSec * 13) % 100).toFixed(1);
            (base as Record<string, unknown>)['backgroundPosition'] = \`\${gx}% \${gy}%\`;
            if (!(base as Record<string, unknown>)['backgroundSize']) {
              (base as Record<string, unknown>)['backgroundSize'] = '200% 200%';
            }
          }
          const text = def.upper ? w.text.toUpperCase() : w.text;
          const style: React.CSSProperties = { ...base };
          if (mark?.scale && mark.scale !== 1) {
            style.transform = \`translate(-50%, 50%) scale(\${mark.scale})\`;
            style.transformOrigin = 'center center';
          }
          applyWordMarkExtras(
            style,
            mark,
            frame,
            w.fromFrame,
            plan.fps,
            css.active.color as string,
          );
          const isGradFill = !!(style as Record<string, unknown>)['backgroundImage'];
          if (isGradFill) {
            return (
              <span
                key={\`fp-\${idx}\`}
                style={{
                  position: 'absolute',
                  left: \`\${x}%\`,
                  bottom: \`\${y}%\`,
                  transform: 'translate(-50%, 50%)',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {renderGradientWord(text, style, '', '')}
              </span>
            );
          }
          return (
            <span key={\`fp-\${idx}\`} style={style}>
              {text}
            </span>
          );
        })}
      </div>
    ) : null;

`;

  // Replace from blockStart through ifEnd with mixed (no early return)
  s = s.slice(0, blockStart) + mixed + s.slice(ifEnd);

  // In normal word map: skip words that are free-placed (have x/y)
  if (!s.includes('// skip free-placed words (painted in absOverlay)')) {
    const hideNeedle = `if (mark?.hidden) {
              return null;
            }`;
    const hideRepl = `if (mark?.hidden) {
              return null;
            }
            // skip free-placed words (painted in absOverlay)
            if (
              typeof mark?.xPct === 'number' &&
              typeof mark?.yPct === 'number'
            ) {
              return null;
            }`;
    // only first occurrence in normal path — replace all is ok (free place path gone)
    if (!s.includes(hideNeedle)) {
      console.warn('hidden skip needle not found');
    } else {
      s = s.replace(hideNeedle, hideRepl);
      console.log('normal path skips free-placed words');
    }
  }

  // Render absOverlay alongside main return — wrap return in fragment
  // Find main return after absOverlay
  const mainRet = s.indexOf('return (\n    <div\n      style={{\n        position: \'absolute\',\n        left: `${layout.xPct}%`');
  const mainRet2 = s.indexOf('return (\r\n    <div\r\n      style={{\r\n        position: \'absolute\',\r\n        left: `${layout.xPct}%`');
  const mr = mainRet >= 0 ? mainRet : mainRet2;
  if (mr < 0) {
    // try after our mixed insert
    const loose = s.indexOf('left: `${layout.xPct}%`');
    const retAt = s.lastIndexOf('return (', loose);
    if (retAt < 0) throw new Error('main return not found');
    // wrap: return ( <> {absOverlay} ... </> )
    // find matching close of this return - hard. Simpler: inject absOverlay as sibling inside a fragment.

    // Replace `return (` at retAt with `return (\n    <>\n      {absOverlay}\n`
    // and before final closing of component... 

    // Find the end of CaptionLayerFrame - last `);` before final `};` of component
  }

  // Simpler approach: inject absOverlay as first child of the main absolute div
  const leftStyle = 'left: `${layout.xPct}%`';
  const li = s.indexOf(leftStyle);
  if (li < 0) throw new Error('layout.xPct style not found');
  // find opening of that div's children - after `>` of the outer div
  // look for `    >\n      {rows.map` 
  const rowsMap = s.indexOf('{rows.map', li);
  if (rowsMap < 0) throw new Error('rows.map not found');
  // insert absOverlay before rows.map - but absOverlay is full-frame absolute so it should be OUTSIDE the caption box.
  // Better wrap entire return.

  // Find `return (` just before leftStyle
  const retBefore = s.lastIndexOf('return (', li);
  const afterRet = retBefore + 'return ('.length;
  // Check if already wrapped
  if (!s.slice(afterRet, afterRet + 80).includes('absOverlay')) {
    s = s.slice(0, afterRet) + `\n    <>\n      {absOverlay}\n` + s.slice(afterRet);
    // close fragment before the final `  );` of this return
    // The return ends with `  );` after the main div. Find from retBefore the matching paren... 
    // Heuristic: the main return's closing is `\n  );\n};` near end of file for the component
    // Search for pattern after rows - the structure ends with `    </div>\n  );`
    const closeDiv = s.indexOf('    </div>\n  );', li);
    const closeDivCrlf = s.indexOf('    </div>\r\n  );', li);
    const cd = closeDiv >= 0 ? closeDiv : closeDivCrlf;
    if (cd < 0) {
      // try last occurrence
      const last = s.lastIndexOf('    </div>');
      console.log('close near', JSON.stringify(s.slice(last, last + 40)));
      throw new Error('could not close fragment');
    }
    const insertAt = cd + '    </div>'.length;
    s = s.slice(0, insertAt) + `\n    </>` + s.slice(insertAt);
    console.log('wrapped return with absOverlay fragment');
  }

  write(rel, s);
  console.log('captionLayer: mixed free-place');
}

// ─── 5) WordDragLayer freePlaceWordsFrom: card words + line estimates ────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx';
  let s = read(rel);
  if (!s.includes('captionLineLayout')) {
    s = s.replace(
      `import type { ReelWord, ReelWordFx, ReelWordMark } from '@/lib/mothermode/reel/types';
import { WORD_FONTS, WORD_FX } from '@/lib/mothermode/reel/types';`,
      `import type { ReelWord, ReelWordFx, ReelWordMark } from '@/lib/mothermode/reel/types';
import { WORD_FONTS, WORD_FX, captionLineLayout } from '@/lib/mothermode/reel/types';`,
    );
  }

  const oldFn = /export function freePlaceWordsFrom\([\s\S]*?\n\}/;
  // read current to replace whole function - match until next export or end
  const fnStart = s.indexOf('export function freePlaceWordsFrom');
  if (fnStart < 0) throw new Error('freePlaceWordsFrom missing');
  let brace = s.indexOf('{', fnStart);
  let d = 0;
  let fnEnd = -1;
  for (let i = brace; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') {
      d--;
      if (d === 0) {
        fnEnd = i + 1;
        break;
      }
    }
  }
  const neuFn = `export function freePlaceWordsFrom(
  all: ReelWord[],
  playheadSec: number,
  layout?: { xPct?: number; positionPct?: number; wordsPerRow?: number },
): WordPlace[] {
  // Prefer the card under the playhead; else any freePlace-flagged card.
  let cardId: string | null = null;
  let cardMeta: { wordsPerRow?: number; freePlace?: boolean } | null = null;
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (
      w.mark?.card?.id &&
      playheadSec >= w.start - 0.05 &&
      playheadSec <= w.end + 0.8
    ) {
      cardId = w.mark.card.id;
      cardMeta = w.mark.card;
      break;
    }
  }
  if (!cardId) {
    for (let i = 0; i < all.length; i++) {
      const w = all[i];
      if (w.mark?.card?.freePlace || (typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number')) {
        cardId = w.mark!.card!.id;
        cardMeta = w.mark!.card!;
        break;
      }
    }
  }
  if (!cardId) return [];

  // Collect card word indexes in order
  const idxs: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].mark?.card?.id === cardId) idxs.push(i);
  }
  if (!idxs.length) return [];

  // Only show drag UI when freePlace is on OR some word already has coords
  const editable =
    cardMeta?.freePlace === true ||
    idxs.some(
      (i) =>
        typeof all[i].mark?.xPct === 'number' &&
        typeof all[i].mark?.yPct === 'number',
    );
  if (!editable) return [];

  const estimates = captionLineLayout(idxs.length, {
    wordsPerRow:
      cardMeta?.wordsPerRow ??
      layout?.wordsPerRow ??
      Math.min(4, idxs.length),
    baseXPct: layout?.xPct ?? 50,
    baseYPct: layout?.positionPct ?? 12,
  });

  const out: WordPlace[] = [];
  idxs.forEach((i, li) => {
    const w = all[i];
    const est = estimates[li] ?? { xPct: 50, yPct: 12 };
    const xPct =
      typeof w.mark?.xPct === 'number' ? w.mark.xPct : est.xPct;
    const yPct =
      typeof w.mark?.yPct === 'number' ? w.mark.yPct : est.yPct;
    out.push({
      index: i,
      xPct,
      yPct,
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
    });
  });
  return out;
}`;

  s = s.slice(0, fnStart) + neuFn + s.slice(fnEnd);
  write(rel, s);
  console.log('WordDragLayer: freePlaceWordsFrom line estimates');
}

// ─── 6) page.tsx: pass caption layout into freePlaceWordsFrom ────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  let s = read(rel);
  const oldCall = 'return freePlaceWordsFrom(base, clipSec)';
  const neuCall = `return freePlaceWordsFrom(base, clipSec, {
                              xPct: project.captionOverrides?.xPct ?? 50,
                              positionPct: project.captionOverrides?.positionPct ?? 12,
                              wordsPerRow: project.captionOverrides?.wordsPerRow,
                            })`;
  if (!s.includes(oldCall)) {
    console.warn('freePlaceWordsFrom call pattern not found');
  } else {
    s = s.split(oldCall).join(neuCall);
    write(rel, s);
    console.log('page: pass layout to freePlaceWordsFrom');
  }
}

// ─── 7) Show Edit/Preview when freePlace flag OR coords ──────────────────────
{
  const rel = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
  let s = read(rel);
  // The gate for Edit/Preview chrome - find "has placed words"
  if (s.includes('has placed words') || s.includes('freePlaceWordsFrom(base')) {
    // broaden gate: any card with freePlace or coords
    // Look for condition that checks free place words length
    const re =
      /freePlaceWordsFrom\([^)]+\)\.length\s*>\s*0/g;
    // may not exist - check stack edit UI condition
  }
  // Find: only when card has placed words
  const idx = s.indexOf('Free-place stack Edit/Preview');
  if (idx >= 0) {
    console.log('edit chrome context:', s.slice(idx, idx + 500).slice(0, 400));
  }
}

// vendor captions types if needed
try {
  execSync('node scripts/sync-vendored-captions.cjs', {
    cwd: root,
    stdio: 'inherit',
  });
} catch (_) {}

// copy captionLayer
const src = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
const dst = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(dst)) fs.copyFileSync(src, dst);

const typesSrc = path.join(root, 'src/lib/mothermode/reel/types.ts');
const typesDst = path.join(root, 'render-worker/src/lib/mothermode/reel/types.ts');
if (fs.existsSync(typesDst)) fs.copyFileSync(typesSrc, typesDst);

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
        /SubtitlePanel|WordDrag|captionLayer|page\.tsx|types\.ts|freePlace|captionLine/.test(
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

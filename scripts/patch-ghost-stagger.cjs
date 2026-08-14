#!/usr/bin/env node
/**
 * Patch captionLayer.tsx:
 * 1) ghostUnitOpacity helper
 * 2) ghostFade block → page envelope + stagger params
 * 3) per-word / per-letter opacity when stagger is word|letter
 * 4) gradient/shine mark fx: drop text-shadow, use filter
 */
const fs = require('fs');
const path = require('path');

const p = path.join(
  __dirname,
  '..',
  'src/lib/mothermode/reel/render/captionLayer.tsx',
);
let s = fs.readFileSync(p, 'utf8');

const helper = `
/**
 * Ghost unit opacity for one staggered item (word or letter).
 * unitIndex 0 is first; higher indices lag by staggerFrames on the way IN
 * and on the way OUT (first in, first out — a smooth cascade both ways).
 * Returns 0..1: fade in → hold → fade out.
 */
export function ghostUnitOpacity(
  frame: number,
  pageStartFrame: number,
  pageEndFrame: number,
  unitIndex: number,
  inF: number,
  outF: number,
  staggerFrames: number,
): number {
  const delay = Math.max(0, unitIndex) * Math.max(0, staggerFrames);
  const localIn = frame - pageStartFrame - delay;
  const localOut = pageEndFrame - frame - delay;
  const inOp = Math.min(1, Math.max(0, localIn / Math.max(1, inF)));
  const outOp = Math.min(1, Math.max(0, localOut / Math.max(1, outF)));
  return Math.min(inOp, outOp);
}
`;

if (!s.includes('export function ghostUnitOpacity')) {
  s = s.replace(
    'const clamp01 = (n: number) => Math.min(1, Math.max(0, n));',
    'const clamp01 = (n: number) => Math.min(1, Math.max(0, n));\n' + helper,
  );
  console.log('added ghostUnitOpacity');
}

// Replace ghostFade block body — match from if to closing brace before return
const ghostRe =
  /if \(blockFx\.includes\('ghostFade'\)\) \{[\s\S]*?blockStyle\.opacity = [^;]+;\s*\}/;

const ghostNew = `if (blockFx.includes('ghostFade')) {
    // Each PAGE of rows: fade fully ON → HOLD at 1 → fade fully OFF.
    // stagger 'word'/'letter' defers the envelope to each unit (see below);
    // 'block' (default) fades the whole page together.
    const pageFrom = rows[0]?.from ?? 0;
    const pageSize = Math.max(1, layout.wordsPerRow * layout.rows);
    const pageStartFrame = words[pageFrom]?.fromFrame ?? activeWord.fromFrame;
    const nextPageStart = words[pageFrom + pageSize]?.fromFrame;
    const pageEndFrame = nextPageStart ?? words[words.length - 1].toFrame + holdFrames;
    const pageDur = Math.max(1, pageEndFrame - pageStartFrame);
    const ghost = (def as CaptionStyleDef).ghost;
    let inF = Math.max(
      2,
      Math.round(plan.fps * (ghost?.fadeInSec ?? GHOST_FADE_IN_SEC)),
    );
    let outF = Math.max(
      2,
      Math.round(plan.fps * (ghost?.fadeOutSec ?? GHOST_FADE_OUT_SEC)),
    );
    const minHold = Math.max(1, Math.round(plan.fps * 0.08));
    if (inF + outF + minHold > pageDur) {
      const budget = Math.max(2, pageDur - minHold);
      const total = inF + outF;
      inF = Math.max(2, Math.round((budget * inF) / total));
      outF = Math.max(2, budget - inF);
    }
    const staggerMode = ghost?.stagger ?? 'block';
    const defaultStaggerSec = staggerMode === 'letter' ? 0.03 : 0.05;
    const staggerFrames = Math.max(
      0,
      Math.round(plan.fps * (ghost?.staggerSec ?? defaultStaggerSec)),
    );
    // Stash on a plain object the word loop can read (no React state).
    (blockStyle as Record<string, unknown>).__ghost = {
      pageStartFrame,
      pageEndFrame,
      inF,
      outF,
      staggerMode,
      staggerFrames,
      pageFrom,
    };
    if (staggerMode === 'block') {
      const local = frame - pageStartFrame;
      let opacity = 1;
      if (local < inF) opacity = clamp01(local / inF);
      else if (local > pageDur - outF) opacity = clamp01((pageEndFrame - frame) / outF);
      blockStyle.opacity = opacity;
    }
    // word/letter: leave block at full opacity; each unit fades itself.
  }`;

if (!ghostRe.test(s)) {
  console.error('ghostFade block not found');
  process.exit(1);
}
s = s.replace(ghostRe, ghostNew);
console.log('replaced ghostFade block');

// After base style is built, apply word-level ghost opacity when stagger is word
// Insert after gradientShift block / before const text =
const marker = `const text = def.upper ? w.text.toUpperCase() : w.text;`;
if (!s.includes('__ghost')) {
  console.error('__ghost not in file after replace?');
}
const inject = `// Ghost stagger: word-level fade (letter handled below when rendering).
            const ghostMeta = (blockStyle as Record<string, unknown>).__ghost as
              | {
                  pageStartFrame: number;
                  pageEndFrame: number;
                  inF: number;
                  outF: number;
                  staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                }
              | undefined;
            if (ghostMeta && ghostMeta.staggerMode === 'word') {
              const unitIdx = idx - ghostMeta.pageFrom;
              const gOp = ghostUnitOpacity(
                frame,
                ghostMeta.pageStartFrame,
                ghostMeta.pageEndFrame,
                unitIdx,
                ghostMeta.inF,
                ghostMeta.outF,
                ghostMeta.staggerFrames,
              );
              base.opacity = gOp;
            }

            ${marker}`;

if (!s.includes('ghostMeta && ghostMeta.staggerMode === \'word\'')) {
  if (!s.includes(marker)) {
    console.error('text marker not found');
    process.exit(1);
  }
  s = s.replace(marker, inject);
  console.log('injected word stagger');
}

// For letter stagger: when rendering the main word span, split into letters
// Replace the simple `{text}` in the default return with a letter-stagger branch.
// Find: `{text}` after marker fx underline etc — the main content text node.
// Safer: wrap the default return's text content.

const letterBranch = `ghostMeta && ghostMeta.staggerMode === 'letter'
                  ? Array.from(text).map((ch, li) => {
                      const unitIdx =
                        // letters across the whole page: prior words' lengths + this letter
                        words
                          .slice(ghostMeta.pageFrom, idx)
                          .reduce((n, ww) => n + Array.from(ww.text).length, 0) + li;
                      const gOp = ghostUnitOpacity(
                        frame,
                        ghostMeta.pageStartFrame,
                        ghostMeta.pageEndFrame,
                        unitIdx,
                        ghostMeta.inF,
                        ghostMeta.outF,
                        ghostMeta.staggerFrames,
                      );
                      return (
                        <span
                          key={li}
                          style={{ display: 'inline-block', opacity: gOp }}
                        >
                          {ch}
                        </span>
                      );
                    })
                  : text`;

// Only replace the bare `{text}` that sits between marker/underline and emoji
// Pattern unique enough:
const textNodeRe = /(\{mark\?\.fx === 'marker'[\s\S]*?\}\) : null\}\s*)\{text\}(\s*\{mark\?\.fx === 'underline')/;
if (textNodeRe.test(s) && !s.includes("staggerMode === 'letter'")) {
  s = s.replace(textNodeRe, `$1${letterBranch}$2`);
  console.log('injected letter stagger into default return');
} else if (s.includes("staggerMode === 'letter'")) {
  console.log('letter stagger already present');
} else {
  console.warn('could not find text node for letter stagger — manual check');
}

// Fix gradient/shine mark fx: kill text stroke leftovers already done; also
// clear textShadow and prefer filter when applying gradient fill via marks.
s = s.replace(
  `case 'gradient': {
      style.backgroundImage = \`linear-gradient(92deg, \${fxColor}, \${mark.fxColor2 ?? '#ffffff'} 130%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      // Stroke outside a clipped fill reads as a hard black halo — drop it.
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`,
  `case 'gradient': {
      style.backgroundImage = \`linear-gradient(92deg, \${fxColor}, \${mark.fxColor2 ?? '#ffffff'} 130%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      style.display = 'inline-block';
      // text-shadow on transparent fill = silhouette only. Use drop-shadow.
      if (style.textShadow) {
        style.filter = \`drop-shadow(\${String(style.textShadow).split(',')[0].trim()})\`;
        delete style.textShadow;
      }
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`,
);

s = s.replace(
  `case 'shine': {
      // A light band sweeping across the glyphs, over the word's own color.
      const baseC = (style.color as string) || '#ffffff';
      // Density packs more sweeps into the same cycle (period shrinks).
      const span = 200 / density;
      const pos = ((tSec * 70) % span) - span / 4;
      const band = 14 * amount;
      const light = mark.fxColor2 ?? '#ffffff';
      style.backgroundImage = \`linear-gradient(105deg, \${baseC} \${pos.toFixed(1)}%, \${light} \${(pos + band).toFixed(1)}%, \${baseC} \${(pos + band * 2).toFixed(1)}%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`,
  `case 'shine': {
      // A light band sweeping across the glyphs, over the word's own color.
      const baseC = (style.color as string) || '#ffffff';
      const span = 200 / density;
      const pos = ((tSec * 70) % span) - span / 4;
      const band = 14 * amount;
      const light = mark.fxColor2 ?? '#ffffff';
      style.backgroundImage = \`linear-gradient(105deg, \${baseC} \${pos.toFixed(1)}%, \${light} \${(pos + band).toFixed(1)}%, \${baseC} \${(pos + band * 2).toFixed(1)}%)\`;
      style.backgroundClip = 'text';
      (style as Record<string, unknown>).WebkitBackgroundClip = 'text';
      (style as Record<string, unknown>).WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
      style.display = 'inline-block';
      if (style.textShadow) {
        style.filter = \`drop-shadow(\${String(style.textShadow).split(',')[0].trim()})\`;
        delete style.textShadow;
      }
      delete (style as Record<string, unknown>).WebkitTextStroke;
      delete (style as Record<string, unknown>).paintOrder;
      break;
    }`,
);

fs.writeFileSync(p, s);
console.log('wrote', p);

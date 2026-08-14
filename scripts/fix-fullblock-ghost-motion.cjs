#!/usr/bin/env node
/**
 * User intent:
 * - Ghost = FULL caption block fades completely ON → holds → completely OFF (smooth).
 * - Float/Wiggle = FULL block motion (not per-word), phase locked to speech page timing.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const layerPath = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
const galleryPath = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
);
let layer = fs.readFileSync(layerPath, 'utf8');
let gallery = fs.readFileSync(galleryPath, 'utf8');

// ─── 1) Ghost: always full-block fade; never per-word ───────────────────────
// Replace the ghostFade block body to always set block opacity, ignore syncToWords
// for opacity, force staggerMode effectively block for the envelope.
{
  const start = layer.indexOf("if (blockFx.includes('ghostFade'))");
  if (start < 0) throw new Error('ghostFade block missing');
  // Find matching close: next top-level sibling after this if — look for
  // "  if (blockFx.includes" after, or "  return (" after ghost section.
  // Safer: find from start to the line after __ghost assignment + block opacity.
  const marker = "(blockStyle as Record<string, unknown>).__ghost = {";
  const mAt = layer.indexOf(marker, start);
  if (mAt < 0) throw new Error('__ghost assign missing');

  // Find end of the if (blockFx.includes('ghostFade')) block — brace match from start
  let i = layer.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let k = i; k < layer.length; k++) {
    if (layer[k] === '{') depth++;
    else if (layer[k] === '}') {
      depth--;
      if (depth === 0) {
        end = k + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('could not find end of ghostFade if');

  const newGhost = `if (blockFx.includes('ghostFade')) {
    // FULL BLOCK ghost: entire caption page fades completely ON → HOLD → completely OFF.
    // Timing is glued to the spoken word window for this page (not per-word karaoke).
    const pageFrom = rows[0]?.from ?? 0;
    const pageSize = Math.max(1, layout.wordsPerRow * layout.rows);
    const pageStartFrame = words[pageFrom]?.fromFrame ?? activeWord.fromFrame;
    const nextPageStart = words[pageFrom + pageSize]?.fromFrame;
    const pageEndFrame = nextPageStart ?? words[words.length - 1].toFrame + holdFrames;
    const pageDur = Math.max(1, pageEndFrame - pageStartFrame);
    const ghost = (def as CaptionStyleDef).ghost;
    // Generous defaults so the eye reads a real full-on / full-off (not a blink).
    let inF = Math.max(
      3,
      Math.round(plan.fps * (ghost?.fadeInSec ?? Math.max(GHOST_FADE_IN_SEC, 0.28))),
    );
    let outF = Math.max(
      3,
      Math.round(plan.fps * (ghost?.fadeOutSec ?? Math.max(GHOST_FADE_OUT_SEC, 0.32))),
    );
    // Keep a real hold beat so opacity actually sits at 1.
    const minHold = Math.max(2, Math.round(plan.fps * 0.12));
    if (inF + outF + minHold > pageDur) {
      const budget = Math.max(4, pageDur - minHold);
      const total = inF + outF;
      inF = Math.max(3, Math.round((budget * inF) / total));
      outF = Math.max(3, budget - inF);
    }
    const ease = (ghost?.ease ?? 'smooth') as 'linear' | 'smooth';
    const driftEm = ghost?.driftEm ?? (ease === 'smooth' ? 0.12 : 0);
    // Always full-block envelope (unitIndex 0, no stagger).
    const opacity = ghostUnitOpacity(
      frame,
      pageStartFrame,
      pageEndFrame,
      0,
      inF,
      outF,
      0,
      ease,
    );
    blockStyle.opacity = opacity;
    if (driftEm > 0) {
      const df = ghostDriftFactor(
        frame,
        pageStartFrame,
        pageEndFrame,
        0,
        inF,
        outF,
        0,
      );
      const dy = (df * driftEm).toFixed(3);
      const prev = (blockStyle.transform as string) || 'translateX(-50%)';
      blockStyle.transform = \`\${prev} translateY(\${dy}em)\`.trim();
    }
    // Stash page bounds for motion phase-lock (float/wiggle sync to speech page).
    (blockStyle as Record<string, unknown>).__ghost = {
      pageStartFrame,
      pageEndFrame,
      inF,
      outF,
      staggerMode: 'block' as const,
      staggerFrames: 0,
      pageFrom,
      ease,
      driftEm,
      syncToWords: false,
    };
    (blockStyle as Record<string, unknown>).__pageStartFrame = pageStartFrame;
  }`;

  layer = layer.slice(0, start) + newGhost + layer.slice(end);
  console.log('rewrote ghost to full-block only');
}

// ─── 2) Float/wiggle: always full block; optional phase lock to page speech ─
{
  // Remove the "skip block motion when word-synced" gates — always run block motion.
  layer = layer.replace(
    /\/\/ skip block motion when word-synced\s*\n\s*if \(!\(def as CaptionStyleDef\)\.motion\?\.syncToWords && blockFx\.includes\('float'\)\)/g,
    `if (blockFx.includes('float'))`,
  );
  layer = layer.replace(
    /if \(!\(def as CaptionStyleDef\)\.motion\?\.syncToWords && blockFx\.includes\('wiggle'\)\)/g,
    `if (blockFx.includes('wiggle'))`,
  );

  // Rewrite float/wiggle to use page-locked phase when motion.syncToWords
  // Find the float block after ghost or before
  const floatNeedle = `if (blockFx.includes('float')) {
      const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;
      const amp = mot?.floatAmpEm ?? 0.12;
      ty += Math.sin(tSec * ((2 * Math.PI) / period)) * amp;
    }
    if (blockFx.includes('wiggle')) {
      const wPer = mot?.wigglePeriodSec ?? 0.9;
      const deg = mot?.wiggleDeg ?? 1.4;
      rot += Math.sin(tSec * ((2 * Math.PI) / wPer)) * deg;
      ty += Math.sin(tSec * ((2 * Math.PI) / (wPer * 2))) * 0.06;
    }`;

  const floatNew = `// Full-block float/wiggle. When motion.syncToWords, phase is locked to the
    // caption PAGE start (spoken window) so the bob/sway feels cued to speech —
    // still one solid block, never per-word.
    {
      const syncMotion = !!(def as CaptionStyleDef).motion?.syncToWords;
      const pageFromM = rows[0]?.from ?? 0;
      const pageStartM = words[pageFromM]?.fromFrame ?? activeWord.fromFrame;
      const tMotion = syncMotion
        ? Math.max(0, (frame - pageStartM) / plan.fps)
        : tSec;
      if (blockFx.includes('float')) {
        const period = mot?.floatPeriodSec ?? FLOAT_PERIOD_SEC;
        const amp = mot?.floatAmpEm ?? 0.12;
        ty += Math.sin(tMotion * ((2 * Math.PI) / period)) * amp;
      }
      if (blockFx.includes('wiggle')) {
        const wPer = mot?.wigglePeriodSec ?? 0.9;
        const deg = mot?.wiggleDeg ?? 1.4;
        rot += Math.sin(tMotion * ((2 * Math.PI) / wPer)) * deg;
        ty += Math.sin(tMotion * ((2 * Math.PI) / (wPer * 2))) * 0.06;
      }
    }`;

  if (layer.includes(floatNeedle)) {
    layer = layer.replace(floatNeedle, floatNew);
    console.log('rewrote float/wiggle full-block + page phase');
  } else {
    // try CRLF
    const n1 = floatNeedle.replace(/\n/g, '\r\n');
    if (layer.includes(n1)) {
      layer = layer.replace(n1, floatNew.replace(/\n/g, '\r\n'));
      console.log('rewrote float/wiggle CRLF');
    } else {
      console.log('WARN: float needle miss — dumping nearby');
      const fi = layer.indexOf("blockFx.includes('float')");
      console.log(JSON.stringify(layer.slice(fi - 80, fi + 500)));
    }
  }
}

// ─── 3) Remove per-word motion + per-word ghost opacity ─────────────────────
{
  // Remove Word-synced float/wiggle block
  const ws = layer.indexOf('// Word-synced float/wiggle');
  if (ws >= 0) {
    // find the opening { after comment and match braces
    const brace = layer.indexOf('{', ws);
    let depth = 0;
    let end = -1;
    for (let k = brace; k < layer.length; k++) {
      if (layer[k] === '{') depth++;
      else if (layer[k] === '}') {
        depth--;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end > 0) {
      layer = layer.slice(0, ws) + layer.slice(end);
      console.log('removed per-word float/wiggle');
    }
  }

  // Remove wordSyncedGhostOpacity application in word loop
  // Pattern: if (ghostMeta && ghostMeta.syncToWords) { ... }
  const gws = layer.indexOf('if (ghostMeta && ghostMeta.syncToWords)');
  if (gws >= 0) {
    const brace = layer.indexOf('{', gws);
    let depth = 0;
    let end = -1;
    for (let k = brace; k < layer.length; k++) {
      if (layer[k] === '{') depth++;
      else if (layer[k] === '}') {
        depth--;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end > 0) {
      layer = layer.slice(0, gws) + layer.slice(end);
      console.log('removed per-word ghost opacity');
    }
  }

  // Also remove word-level stagger ghost if it multiplies opacity per word when
  // staggerMode is word — user wants full block only. Force any remaining
  // ghostMeta stagger paths to no-op by not applying unit opacity.
  // Find: ghostMeta && ghostMeta.staggerMode === 'word'
  const stw = layer.indexOf("ghostMeta.staggerMode === 'word'");
  if (stw >= 0) {
    // find enclosing if
    const ifAt = layer.lastIndexOf('if (', stw);
    const brace = layer.indexOf('{', ifAt);
    let depth = 0;
    let end = -1;
    for (let k = brace; k < layer.length; k++) {
      if (layer[k] === '{') depth++;
      else if (layer[k] === '}') {
        depth--;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end > 0) {
      layer = layer.slice(0, ifAt) + layer.slice(end);
      console.log('removed word-stagger ghost path');
    }
  }
  const stl = layer.indexOf("ghostMeta.staggerMode === 'letter'");
  if (stl >= 0) {
    const ifAt = layer.lastIndexOf('if (', stl);
    const brace = layer.indexOf('{', ifAt);
    let depth = 0;
    let end = -1;
    for (let k = brace; k < layer.length; k++) {
      if (layer[k] === '{') depth++;
      else if (layer[k] === '}') {
        depth--;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end > 0) {
      layer = layer.slice(0, ifAt) + layer.slice(end);
      console.log('removed letter-stagger ghost path');
    }
  }
}

// ─── 4) Gallery UI: simplify Sync section ───────────────────────────────────
{
  const startMarker = 'Sync to speech';
  const at = gallery.indexOf(startMarker);
  if (at >= 0) {
    const divStart = gallery.lastIndexOf('<div', at);
    // find the outer space-y div start
    const outer = gallery.lastIndexOf('{/* Sync', at);
    const start = outer >= 0 ? outer : gallery.lastIndexOf('className="space-y-1.5', at - 200);
    // better: find comment or the space-y wrapper containing Sync to speech
    let s0 = gallery.lastIndexOf('space-y-1.5 rounded-md border border-bone/10 bg-ink/50', at);
    if (s0 < 0) s0 = gallery.lastIndexOf('<div', at);
    else s0 = gallery.lastIndexOf('<div', s0);
    // end after help text
    const help = 'When on, each word fades/moves';
    const helpAt = gallery.indexOf(help, at);
    let end = helpAt >= 0 ? gallery.indexOf('</div>', helpAt) : -1;
    if (end >= 0) {
      end = gallery.indexOf('</div>', end + 1) + 6;
    }
    if (s0 >= 0 && end > s0) {
      const replacement = `{/* Full-block motion phase-lock to spoken caption page */}
            <div className="space-y-1.5 rounded-md border border-bone/10 bg-ink/50 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-bone/50">
                Motion cue
              </div>
              <button
                type="button"
                onClick={() =>
                  onCustomize({
                    motionSyncToWords: !(overrides?.motionSyncToWords ?? false),
                  })
                }
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  overrides?.motionSyncToWords
                    ? 'bg-brass text-ink'
                    : 'border border-bone/15 text-bone/45 hover:bg-bone/10',
                )}
                title="Float/wiggle phase starts when this caption page is spoken"
              >
                {overrides?.motionSyncToWords ? 'Phase ↔ speech' : 'Phase free-run'}
              </button>
              <div className="text-[9px] leading-snug text-bone/40">
                Ghost always fades the full caption on, then fully off. Float/wiggle
                move the whole block — turn Phase ↔ speech on to lock the bob to when
                the line is spoken.
              </div>
            </div>`;
      gallery = gallery.slice(0, s0) + replacement + gallery.slice(end);
      console.log('updated gallery sync UI');
    } else {
      console.log('WARN gallery block bounds', s0, end);
    }
  }
}

// brace balance layer
let d = 0;
for (const c of layer) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('layer brace balance', d);
if (d !== 0) {
  console.error('BAD BALANCE');
  process.exit(1);
}

fs.writeFileSync(layerPath, layer);
fs.writeFileSync(galleryPath, gallery);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('ALL OK');

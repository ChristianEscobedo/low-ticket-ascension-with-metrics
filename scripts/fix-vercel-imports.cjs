#!/usr/bin/env node
/**
 * Fix Vercel build breakers from batch-3 gallery patches:
 * 1) CaptionOverrides missing anim/highlight/wave/handDrawn/punch/letterbox/springExit
 * 2) CaptionGallery pack button used onSelect instead of onPick
 * Then sync vendored captions.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

// --- captions.ts: extend CaptionOverrides ---
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('waveBounce?:')) {
    const needle = '  /** Delay between staggered ghost units in seconds (0.02–0.25). */\n  ghostStaggerSec?: number;\n}';
    if (!s.includes(needle)) {
      console.error('CaptionOverrides close not found');
      process.exit(1);
    }
    const extra = `  /** Delay between staggered ghost units in seconds (0.02–0.25). */
  ghostStaggerSec?: number;
  /** Entrance animation override (pop, slam, tilt3d, …). */
  anim?: CaptionAnim | '';
  /** Highlight mode override (color, box, boxGrow, …). */
  highlightMode?: HighlightMode;
  /** Wave bounce on the caption block (audio-reactive when peaks exist). */
  waveBounce?: boolean;
  /** Hand-drawn SVG accent on the active word. */
  handDrawn?: false | 'underline' | 'circle';
  /** Camera punch-in on page enter. */
  punchIn?: boolean;
  /** Cinematic letterbox bars. */
  letterbox?: boolean;
  /** Springy scale-out on page exit. */
  springExit?: boolean;
}`;
    s = s.replace(needle, extra);
    fs.writeFileSync(p, s);
    console.log('CaptionOverrides extended');
  } else {
    console.log('CaptionOverrides already has waveBounce');
  }
}

// --- CaptionGallery: onSelect -> onPick ---
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('onSelect?.(pack.presetId)')) {
    s = s.replace(
      'onSelect?.(pack.presetId);',
      "const def = CAPTION_STYLE_DEFS.find((d) => d.id === pack.presetId);\n                      if (def) onPick(def);",
    );
    fs.writeFileSync(p, s);
    console.log('pack button uses onPick');
  } else if (s.includes('onPick(def)')) {
    console.log('pack button already onPick');
  } else {
    console.warn('pack onSelect pattern not found — check manually');
  }
}

// page import already fixed in prior step; verify
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes("from './useRenderJob, { keepWorkerWarm }'")) {
    console.error('page still has broken useRenderJob import');
    process.exit(1);
  }
  if (!s.includes('keepWorkerWarm')) {
    console.error('page missing keepWorkerWarm');
    process.exit(1);
  }
  console.log('page import ok');
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
console.log('OK');

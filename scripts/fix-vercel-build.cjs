#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// 1) CaptionOverrides — add missing fields (CRLF-safe)
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('waveBounce?:')) {
    const re = /ghostStaggerSec\?: number;\r?\n\}/;
    if (!re.test(s)) {
      console.error('CaptionOverrides close not found');
      // dump nearby
      const i = s.indexOf('ghostStaggerSec');
      console.log(JSON.stringify(s.slice(i, i + 80)));
      process.exit(1);
    }
    s = s.replace(re, (m) => {
      const nl = m.includes('\r\n') ? '\r\n' : '\n';
      return (
        'ghostStaggerSec?: number;' +
        nl +
        '  /** Entrance animation override (pop, slam, tilt3d, ...). */' +
        nl +
        "  anim?: CaptionAnim | '';" +
        nl +
        '  /** Highlight mode override (color, box, boxGrow, ...). */' +
        nl +
        '  highlightMode?: HighlightMode;' +
        nl +
        '  /** Wave bounce on the caption block. */' +
        nl +
        '  waveBounce?: boolean;' +
        nl +
        '  /** Hand-drawn SVG accent on the active word. */' +
        nl +
        "  handDrawn?: false | 'underline' | 'circle';" +
        nl +
        '  /** Camera punch-in on page enter. */' +
        nl +
        '  punchIn?: boolean;' +
        nl +
        '  /** Cinematic letterbox bars. */' +
        nl +
        '  letterbox?: boolean;' +
        nl +
        '  /** Springy scale-out on page exit. */' +
        nl +
        '  springExit?: boolean;' +
        nl +
        '}'
      );
    });
    fs.writeFileSync(p, s);
    console.log('CaptionOverrides extended');
  } else {
    console.log('CaptionOverrides already has waveBounce');
  }
}

// 2) CaptionGallery pack button: onSelect -> onPick
{
  const p = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
  );
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('onSelect?.(pack.presetId)')) {
    s = s.replace(
      'onSelect?.(pack.presetId);',
      'const def = CAPTION_STYLE_DEFS.find((d) => d.id === pack.presetId);\n                      if (def) onPick(def);',
    );
    fs.writeFileSync(p, s);
    console.log('pack button fixed');
  } else {
    console.log('pack button already ok', s.includes('if (def) onPick(def)'));
  }

  // verify import block is clean
  if (s.includes(', EDITOR_PACKS') || s.includes("from ''lib/")) {
    console.error('gallery import still mangled');
    process.exit(1);
  }
  console.log('gallery import ok');
}

// 3) page.tsx useRenderJob import
{
  const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes("from './useRenderJob, { keepWorkerWarm }'")) {
    s = s.replace(
      "import { useRenderJob, type RenderJob } from './useRenderJob, { keepWorkerWarm }';",
      "import { useRenderJob, keepWorkerWarm, type RenderJob } from './useRenderJob';",
    );
    fs.writeFileSync(p, s);
    console.log('page import fixed');
  } else if (s.includes('keepWorkerWarm, type RenderJob')) {
    console.log('page import already ok');
  } else {
    console.error('page import unexpected');
    const i = s.indexOf('useRenderJob');
    console.log(JSON.stringify(s.slice(i, i + 120)));
    process.exit(1);
  }
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

// quick sanity
const caps = fs.readFileSync(
  path.join(root, 'src/lib/mothermode/reel/captions.ts'),
  'utf8',
);
console.log('has waveBounce', caps.includes('waveBounce?:'));
console.log('has punchIn', caps.includes('punchIn?:'));
console.log('OK');

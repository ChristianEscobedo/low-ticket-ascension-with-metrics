#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// 1) types — ensure xPct/yPct on ReelWordMark
{
  let t = read('src/lib/mothermode/reel/types.ts');
  if (!/xPct\?: number/.test(t) || !t.includes('Free-place position')) {
    // insert after card block closing
    if (t.includes('card?:') && !t.includes('xPct?: number')) {
      t = t.replace(
        /(card\?: \{[\s\S]*?anim\?: string;\s*\};\r?\n)/,
        `$1  /**
   * Free-place position on the frame (stack cards). xPct = horizontal centre
   * 0–100; yPct = distance from the BOTTOM edge 0–100 — same axes as the
   * caption box so drag + render agree by construction.
   */
  xPct?: number;
  yPct?: number;
`,
      );
      console.log('types: added xPct/yPct after card');
    } else if (!t.includes('xPct?: number')) {
      t = t.replace(
        /export interface ReelWordMark \{\r?\n/,
        `export interface ReelWordMark {
  xPct?: number;
  yPct?: number;
`,
      );
      console.log('types: added xPct/yPct at top');
    } else {
      console.log('types: xPct already present');
    }
  } else {
    console.log('types: xPct ok');
  }
  if (!t.includes('export function defaultStackLayout')) {
    console.error('defaultStackLayout missing — re-run add-free-place-stack');
    process.exit(1);
  }
  write('src/lib/mothermode/reel/types.ts', t);
}

// 2) page.tsx — import + rename fx symbols
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');

  if (!p.includes("from './WordDragLayer'") && !p.includes('from "./WordDragLayer"')) {
    if (p.includes("import CaptionDragLayer from './CaptionDragLayer';")) {
      p = p.replace(
        "import CaptionDragLayer from './CaptionDragLayer';",
        "import CaptionDragLayer from './CaptionDragLayer';\nimport WordDragLayer, { freePlaceWordsFrom } from './WordDragLayer';",
      );
      console.log('page: import added');
    } else {
      console.error('CaptionDragLayer import not found');
      process.exit(1);
    }
  } else {
    console.log('page: import ok');
  }

  // Fix broken useState generic if missing >
  p = p.replace(
    /const \[wordPlaceLocal, setWordPlaceLocal\] = useState<\r?\n\s*Record<number, \{ xPct: number; yPct: number \}\r?\n\s*>\(\{\}\);/,
    `const [wordPlaceLocal, setWordPlaceLocal] = useState<
    Record<number, { xPct: number; yPct: number }>
  >({});`,
  );

  // Rename wrong identifiers
  if (p.includes('fxWordIndexes')) {
    p = p.replace(/\bfxWordIndexes\b/g, 'fxWords');
    console.log('page: fxWordIndexes -> fxWords');
  }
  if (p.includes('setFxPicked')) {
    p = p.replace(/\bsetFxPicked\b/g, 'setFxWords');
    console.log('page: setFxPicked -> setFxWords');
  }

  // Ensure WordDragLayer file exists
  const wdl = path.join(
    root,
    'src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx',
  );
  if (!fs.existsSync(wdl)) {
    console.error('WordDragLayer.tsx missing');
    process.exit(1);
  }

  write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
}

// 3) captionLayer mark fields
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  if (!/xPct\?: number/.test(s)) {
    s = s.replace(
      /export interface CaptionWordMark \{\r?\n/,
      `export interface CaptionWordMark {
  xPct?: number;
  yPct?: number;
`,
    );
    write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
    console.log('layer: xPct added');
  } else {
    console.log('layer: xPct ok');
  }
}

// vendor
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
        /page\.tsx|WordDrag|SubtitlePanel|captionLayer|types\.ts|freePlace|xPct/.test(
          l,
        ),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');

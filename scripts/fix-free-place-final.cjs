#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// ---- types: force xPct/yPct on ReelWordMark ----
{
  let t = read('src/lib/mothermode/reel/types.ts');
  const ifaceStart = t.indexOf('export interface ReelWordMark');
  if (ifaceStart < 0) throw new Error('ReelWordMark missing');
  let brace = 0;
  let i = t.indexOf('{', ifaceStart);
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
  const iface = t.slice(ifaceStart, end);
  if (!/\bxPct\?:/.test(iface)) {
    // insert after card block if present, else after opening brace
    let next = iface;
    if (next.includes('card?:')) {
      next = next.replace(
        /(card\?: \{[\s\S]*?\};\r?\n)/,
        `$1  /** Free-place frame position (centre x, bottom y). */
  xPct?: number;
  yPct?: number;
`,
      );
    } else {
      next = next.replace(
        /export interface ReelWordMark \{\r?\n/,
        `export interface ReelWordMark {
  xPct?: number;
  yPct?: number;
`,
      );
    }
    t = t.slice(0, ifaceStart) + next + t.slice(end);
    write('src/lib/mothermode/reel/types.ts', t);
    console.log('types: xPct/yPct injected into interface');
  } else {
    console.log('types: interface already has xPct');
  }
}

// ---- page.tsx: dynamic import + fx renames ----
{
  let p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');

  // Remove any broken static import of WordDragLayer
  p = p.replace(
    /import\s+WordDragLayer(?:\s*,\s*\{\s*freePlaceWordsFrom\s*\})?\s+from\s+['"]\.\/WordDragLayer['"];\r?\n/g,
    '',
  );
  p = p.replace(
    /import\s+\{\s*freePlaceWordsFrom\s*\}\s+from\s+['"]\.\/WordDragLayer['"];\r?\n/g,
    '',
  );

  // Add dynamic WordDragLayer next to CaptionDragLayer
  const capDyn =
    "const CaptionDragLayer = dynamic(() => import('./CaptionDragLayer'), { ssr: false });";
  const wordDyn =
    "const WordDragLayer = dynamic(() => import('./WordDragLayer'), { ssr: false });";
  if (!p.includes("import('./WordDragLayer')")) {
    if (!p.includes(capDyn)) throw new Error('CaptionDragLayer dynamic missing');
    p = p.replace(capDyn, capDyn + '\n' + wordDyn);
    console.log('page: dynamic WordDragLayer');
  } else {
    console.log('page: dynamic WordDrag already');
  }

  // Static named import for freePlaceWordsFrom (safe — pure helper)
  if (!p.includes('freePlaceWordsFrom')) {
    // shouldn't happen — JSX uses it
  }
  if (!/import\s*\{[^}]*freePlaceWordsFrom/.test(p)) {
    // place with other relative imports near top after dynamic block
    const anchor = wordDyn;
    if (p.includes(anchor)) {
      p = p.replace(
        anchor,
        anchor + "\nimport { freePlaceWordsFrom } from './WordDragLayer';",
      );
      console.log('page: freePlaceWordsFrom import');
    }
  }

  // Rename wrong identifiers in JSX
  const beforeFx = (p.match(/\bfxWordIndexes\b/g) || []).length;
  const beforePick = (p.match(/\bsetFxPicked\b/g) || []).length;
  p = p.replace(/\bfxWordIndexes\b/g, 'fxWords');
  p = p.replace(/\bsetFxPicked\b/g, 'setFxWords');
  console.log('renamed fxWordIndexes', beforeFx, 'setFxPicked', beforePick);

  // Fix wordPlaceLocal generic if broken
  p = p.replace(
    /const \[wordPlaceLocal, setWordPlaceLocal\] = useState<\s*Record<number, \{ xPct: number; yPct: number \}\s*>\(\{\}\);/,
    `const [wordPlaceLocal, setWordPlaceLocal] = useState<
    Record<number, { xPct: number; yPct: number }>
  >({});`,
  );

  write('src/app/(fullscreen)/admin/reel-studio/page.tsx', p);
}

// ---- captionLayer mark ----
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  const i = s.indexOf('export interface CaptionWordMark');
  if (i >= 0) {
    let brace = 0;
    let j = s.indexOf('{', i);
    let end = j;
    for (; end < s.length; end++) {
      if (s[end] === '{') brace++;
      else if (s[end] === '}') {
        brace--;
        if (brace === 0) {
          end++;
          break;
        }
      }
    }
    const iface = s.slice(i, end);
    if (!/\bxPct\?:/.test(iface)) {
      const next = iface.replace(
        /export interface CaptionWordMark \{\r?\n/,
        `export interface CaptionWordMark {
  xPct?: number;
  yPct?: number;
`,
      );
      s = s.slice(0, i) + next + s.slice(end);
      write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
      console.log('layer: xPct on CaptionWordMark');
    } else {
      console.log('layer: CaptionWordMark ok');
    }
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

// verify
const p = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');
console.log('has dynamic WordDrag', p.includes("import('./WordDragLayer')"));
console.log('has freePlace import', /import\s*\{[^}]*freePlaceWordsFrom/.test(p));
console.log('fxWordIndexes left', (p.match(/\bfxWordIndexes\b/g) || []).length);
console.log('setFxPicked left', (p.match(/\bsetFxPicked\b/g) || []).length);
const t = read('src/lib/mothermode/reel/types.ts');
const is = t.indexOf('export interface ReelWordMark');
let brace = 0;
let j = t.indexOf('{', is);
let end = j;
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
console.log('iface has xPct', /\bxPct\?:/.test(t.slice(is, end)));

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts --reporter=dot',
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
  lines.slice(0, 50).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const pagePath = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/page.tsx',
);
let p = fs.readFileSync(pagePath, 'utf8');

// --- 1) Fix wordPlaceLocal type + add wordScaleLocal ---
// Actual broken form (missing > on Record):
//   useState<\n    Record<number, { xPct: number; yPct: number }\n  >({});
const placeRe =
  /const \[wordPlaceLocal, setWordPlaceLocal\] = useState<\s*Record<number, \{ xPct: number; yPct: number \}\s*>\(\{\}\);/;
const placeFixed = `const [wordPlaceLocal, setWordPlaceLocal] = useState<
    Record<number, { xPct: number; yPct: number }>
  >({});
  const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});`;

if (p.includes('wordScaleLocal')) {
  console.log('wordScaleLocal already present');
} else if (placeRe.test(p)) {
  p = p.replace(placeRe, placeFixed);
  console.log('fixed place state + scale');
} else {
  // index-based fallback
  const marker = 'const [wordPlaceLocal, setWordPlaceLocal] = useState<';
  const i = p.indexOf(marker);
  if (i < 0) throw new Error('wordPlaceLocal not found');
  const end = p.indexOf('>({});', i);
  if (end < 0) throw new Error('wordPlaceLocal end not found');
  p = p.slice(0, i) + placeFixed + p.slice(end + '>({});'.length);
  console.log('index-based place+scale fix');
}

// --- 2) Update freePlaceWordsFrom map (both mounts) ---
const oldMapRe =
  /return freePlaceWordsFrom\(base, clipSec\)\.map\(\(w\) => \{\s*const loc = wordPlaceLocal\[w\.index\];\s*return loc \? \{ \.\.\.w, xPct: loc\.xPct, yPct: loc\.yPct \} : w;\s*\}\);/g;
const newMap = `return freePlaceWordsFrom(base, clipSec).map((w) => {
                              const loc = wordPlaceLocal[w.index];
                              const sc = wordScaleLocal[w.index];
                              return {
                                ...w,
                                xPct: loc ? loc.xPct : w.xPct,
                                yPct: loc ? loc.yPct : w.yPct,
                                scale: typeof sc === 'number' ? sc : w.scale,
                              };
                            });`;
const beforeMaps = (p.match(oldMapRe) || []).length;
p = p.replace(oldMapRe, newMap);
console.log('maps replaced', beforeMaps, '->', (p.match(/wordScaleLocal\[w\.index\]/g) || []).length);

// --- 3) Append handlers after WordDrag onCommit ---
if (!p.includes('onScale={')) {
  const commitRe =
    /void applyWordMark\(index, \{ xPct, yPct \}\);\s*\}\s*\}/g;
  const handlers = `void applyWordMark(index, { xPct, yPct });
                          }}
                          onScale={(index, scale) => {
                            setWordScaleLocal((prev) => ({ ...prev, [index]: scale }));
                          }}
                          onScaleCommit={(index, scale) => {
                            setWordScaleLocal((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                            void applyWordMark(index, { scale });
                          }}
                          onStyle={(index, partial) => {
                            const patch: Partial<
                              import('@/lib/mothermode/reel/types').ReelWordMark
                            > = {};
                            if ('anim' in partial) patch.anim = partial.anim || undefined;
                            if ('scale' in partial && typeof partial.scale === 'number') {
                              patch.scale = partial.scale;
                            }
                            if ('color' in partial) {
                              patch.color = partial.color || undefined;
                            }
                            void applyWordMark(index, patch);
                          }}`;
  const n = (p.match(commitRe) || []).length;
  console.log('commit sites', n);
  if (n < 1) throw new Error('no commit sites');
  p = p.replace(commitRe, handlers);
  console.log('onScale after', (p.match(/onScale=\{/g) || []).length);
} else {
  console.log('onScale already wired');
}

fs.writeFileSync(pagePath, p);

// verify
const v = fs.readFileSync(pagePath, 'utf8');
console.log('wordScaleLocal', v.includes('setWordScaleLocal'));
console.log('onScale', (v.match(/onScale=\{/g) || []).length);
console.log('onStyle', (v.match(/onStyle=\{/g) || []).length);
console.log('broken place type?', /Record<number, \{ xPct: number; yPct: number \}\s*>\(\{\}\)/.test(v) && !/Record<number, \{ xPct: number; yPct: number \}>\s*>\(\{\}\)/.test(v));

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
        /WordDrag|page\.tsx|wordScale|wordPlace|freePlace|CAPTION_ANIMS/.test(l),
    );
  console.log('relevant errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

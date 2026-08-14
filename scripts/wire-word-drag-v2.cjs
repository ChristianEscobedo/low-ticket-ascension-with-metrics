#!/usr/bin/env node
/**
 * Wire WordDragLayer v2: scale local state + onScale/onStyle props on both mounts.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const pagePath = path.join(
  root,
  'src/app/(fullscreen)/admin/reel-studio/page.tsx',
);
let p = fs.readFileSync(pagePath, 'utf8');

// 1) Add wordScaleLocal state next to wordPlaceLocal
if (!p.includes('wordScaleLocal')) {
  const anchor =
    'const [wordPlaceLocal, setWordPlaceLocal] = useState<\n    Record<number, { xPct: number; yPct: number }>\n  >({});';
  const anchor2 =
    'const [wordPlaceLocal, setWordPlaceLocal] = useState<Record<number, { xPct: number; yPct: number }>>({});';
  const inject = `const [wordPlaceLocal, setWordPlaceLocal] = useState<
    Record<number, { xPct: number; yPct: number }>
  >({});
  const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});`;
  if (p.includes(anchor)) {
    p = p.replace(anchor, inject);
    console.log('state: wordScaleLocal (multiline)');
  } else if (p.includes(anchor2)) {
    p = p.replace(
      anchor2,
      `const [wordPlaceLocal, setWordPlaceLocal] = useState<Record<number, { xPct: number; yPct: number }>>({});
  const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});`,
    );
    console.log('state: wordScaleLocal (single)');
  } else {
    // looser
    const m = p.match(
      /const \[wordPlaceLocal, setWordPlaceLocal\] = useState<[^;]+>;/,
    );
    if (!m) throw new Error('wordPlaceLocal state not found');
    p = p.replace(
      m[0],
      m[0] +
        '\n  const [wordScaleLocal, setWordScaleLocal] = useState<Record<number, number>>({});',
    );
    console.log('state: wordScaleLocal (loose)');
  }
} else {
  console.log('state: wordScaleLocal already');
}

// 2) Replace WordDragLayer mount blocks — both occurrences
// Match from <WordDragLayer through its closing />
const mountRe =
  /<WordDragLayer\s+words=\{\(\(\) => \{[\s\S]*?void applyWordMark\(index, \{ xPct, yPct \}\);\s*\}\s*\}\s*\/>/g;

const newMount = `<WordDragLayer
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
                              const sc = wordScaleLocal[w.index];
                              return {
                                ...w,
                                xPct: loc ? loc.xPct : w.xPct,
                                yPct: loc ? loc.yPct : w.yPct,
                                scale: typeof sc === 'number' ? sc : w.scale,
                              };
                            });
                          })()}
                          selectedIndex={
                            fxWords && fxWords.size === 1
                              ? Array.from(fxWords)[0]
                              : null
                          }
                          onSelect={(index) => {
                            setFxMode(true);
                            setFxWords(new Set([index]));
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
                          }}
                        />`;

const matches = p.match(mountRe);
if (!matches || matches.length < 1) {
  console.error('WordDragLayer mounts not matched', matches && matches.length);
  // debug
  const i = p.indexOf('<WordDragLayer');
  console.log(JSON.stringify(p.slice(i, i + 200)));
  process.exit(1);
}
console.log('replacing mounts', matches.length);
p = p.replace(mountRe, newMount);

fs.writeFileSync(pagePath, p);

// verify
const v = fs.readFileSync(pagePath, 'utf8');
console.log('onScale count', (v.match(/onScale=\{/g) || []).length);
console.log('onStyle count', (v.match(/onStyle=\{/g) || []).length);
console.log('wordScaleLocal', v.includes('wordScaleLocal'));

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
        /WordDrag|page\.tsx|captionLayer|freePlace/.test(l),
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

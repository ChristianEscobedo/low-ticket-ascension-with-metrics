#!/usr/bin/env node
/**
 * Expand page.tsx onStyle handlers for full WordStylePatch
 * (fx / gradient / ambient / font / clear / hide).
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

const oldRe =
  /onStyle=\{\(index, partial\) => \{\s*const patch: Partial<\s*import\('@\/lib\/mothermode\/reel\/types'\)\.ReelWordMark\s*> = \{\};\s*if \('anim' in partial\) patch\.anim = partial\.anim \|\| undefined;\s*if \('scale' in partial && typeof partial\.scale === 'number'\) \{\s*patch\.scale = partial\.scale;\s*\}\s*if \('color' in partial\) \{\s*patch\.color = partial\.color \|\| undefined;\s*\}\s*void applyWordMark\(index, patch\);\s*\}\}/g;

const newHandler = `onStyle={(index, partial) => {
                            if (partial.clearStyle) {
                              // Keep placement + card; drop visual style fields.
                              void applyWordMark(index, {
                                anim: undefined,
                                color: undefined,
                                scale: undefined,
                                fx: undefined,
                                fxColor: undefined,
                                fxColor2: undefined,
                                ambient: undefined,
                                font: undefined,
                                hidden: undefined,
                              });
                              return;
                            }
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
                            if ('fx' in partial) patch.fx = partial.fx || undefined;
                            if ('fxColor' in partial) {
                              patch.fxColor = partial.fxColor || undefined;
                            }
                            if ('fxColor2' in partial) {
                              patch.fxColor2 = partial.fxColor2 || undefined;
                            }
                            if ('ambient' in partial) {
                              patch.ambient = partial.ambient || undefined;
                            }
                            if ('font' in partial) patch.font = partial.font || undefined;
                            if ('hidden' in partial) {
                              patch.hidden = partial.hidden || undefined;
                            }
                            void applyWordMark(index, patch);
                          }}`;

const before = (p.match(oldRe) || []).length;
if (before < 1) {
  console.error('onStyle blocks not matched');
  const i = p.indexOf('onStyle={(index');
  console.log(JSON.stringify(p.slice(i, i + 400)));
  process.exit(1);
}
p = p.replace(oldRe, newHandler);
console.log('onStyle replaced', before);

// freePlaceWordsFrom map already spreads ...w so fx fields flow if present.
// Ensure local map keeps them (it spreads ...w already).

fs.writeFileSync(pagePath, p);

// applyWordMark must merge undefined to clear — check if it spreads partial
const applyIdx = p.indexOf('async function applyWordMark');
console.log('applyWordMark snippet:');
console.log(p.slice(applyIdx, applyIdx + 450));

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
        /WordDrag|page\.tsx|WordStyle|freePlace/.test(l),
    );
  console.log('errors', lines.length);
  lines.slice(0, 30).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

console.log('OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// Remove orphan else after ghostMeta
const bad = `const ghostMeta = (blockStyle as Record<string, unknown>).__ghost as
              | {
                  pageStartFrame: number;
                  pageEndFrame: number;
                  inF: number;
                  outF: number;
                  staggerMode: 'block' | 'word' | 'letter';
                  staggerFrames: number;
                  pageFrom: number;
                  ease?: 'linear' | 'smooth';
                  driftEm?: number;
                  syncToWords?: boolean;
                }
              | undefined;
             else 

            const text = def.upper ? w.text.toUpperCase() : w.text;`;

const good = `const text = def.upper ? w.text.toUpperCase() : w.text;`;

if (s.includes(bad)) {
  s = s.replace(bad, good);
  console.log('removed ghostMeta + orphan else (LF)');
} else {
  // looser: remove from comment through orphan else
  const re =
    /\/\/ Ghost stagger:[\s\S]*?const ghostMeta =[\s\S]*?\|\s*undefined;\s*else\s*\n\s*\n\s*const text =/;
  if (re.test(s)) {
    s = s.replace(re, 'const text =');
    console.log('removed via regex');
  } else {
    // just strip "else" line after undefined;
    s = s.replace(
      /\|\s*undefined;\s*\n\s*else\s*\n/,
      '| undefined;\n',
    );
    // and remove unused ghostMeta if no longer referenced
    console.log('stripped else line only');
  }
}

// If ghostMeta is declared but never used, remove the whole declaration
const uses = (s.match(/ghostMeta/g) || []).length;
console.log('ghostMeta refs', uses);
if (uses === 1 || (uses <= 2 && s.includes('const ghostMeta'))) {
  // only the declaration left
  const re2 =
    /\s*\/\/ Ghost stagger:[\s\S]*?const ghostMeta =[\s\S]*?\|\s*undefined;\s*\n/;
  if (re2.test(s)) {
    s = s.replace(re2, '\n');
    console.log('removed unused ghostMeta decl');
  }
}

// Also remove dual-layer check that references ghostMeta.staggerMode === 'letter'
s = s.replace(
  /&&\s*\n\s*!\(ghostMeta && ghostMeta\.staggerMode === 'letter'\)/g,
  '',
);
s = s.replace(
  /!\(ghostMeta && ghostMeta\.staggerMode === 'letter'\)\s*&&\s*/g,
  '',
);
s = s.replace(
  /&&\s*!\(ghostMeta && ghostMeta\.staggerMode === 'letter'\)/g,
  '',
);

fs.writeFileSync(p, s);

let d = 0;
for (const c of s) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('balance', d);
console.log('has orphan else after undefined', /\|\s*undefined;\s*\n\s*else/.test(s));
console.log('ghostMeta left', (s.match(/ghostMeta/g) || []).length);

if (d !== 0) process.exit(1);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

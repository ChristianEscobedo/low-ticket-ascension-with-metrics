#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

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
                  inF: number;
                  outF: number;
                }
              | undefined;`;

const good = `const ghostMeta = (blockStyle as Record<string, unknown>).__ghost as
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
              | undefined;`;

// Normalize CRLF for match
const badN = bad.replace(/\n/g, '\r\n');
if (s.includes(bad)) {
  s = s.replace(bad, good);
  console.log('fixed LF');
} else if (s.includes(badN)) {
  s = s.replace(badN, good.replace(/\n/g, '\r\n'));
  console.log('fixed CRLF');
} else {
  // regex fallback: remove trailing duplicate inF/outF before closing of type
  const re =
    /(syncToWords\?: boolean;\s*)inF: number;\s*outF: number;\s*(\}\s*\|\s*undefined)/;
  if (re.test(s)) {
    s = s.replace(re, '$1$2');
    console.log('fixed via regex');
  } else {
    console.error('pattern not found');
    // dump the actual type
    const i = s.indexOf('const ghostMeta =');
    console.log(JSON.stringify(s.slice(i, i + 700)));
    process.exit(1);
  }
}

fs.writeFileSync(p, s);

// Verify no duplicate in type
const i = s.indexOf('const ghostMeta =');
const chunk = s.slice(i, i + 600);
const infCount = (chunk.match(/inF: number/g) || []).length;
console.log('inF in ghostMeta type chunk:', infCount);
if (infCount > 1) {
  console.error('still duplicated');
  process.exit(1);
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

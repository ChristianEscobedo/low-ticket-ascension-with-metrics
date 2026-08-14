#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

const marker = '// Drop shadow + outer glow';
const i = s.indexOf(marker);
if (i < 0) throw new Error('drop shadow marker not found');

// Only insert if the ghost timing block is still open (depth 2 at return)
const start = s.indexOf('export function resolveCaptionStyle');
const ret = s.indexOf('return out;', i);
let d = 0;
for (const c of s.slice(start, ret)) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('depth at return before fix', d);

if (d === 2) {
  // Close the ghost timing `{` that opened before gi/go
  s = s.slice(0, i) + '  }\n  ' + s.slice(i);
  fs.writeFileSync(p, s);
  console.log('inserted closing brace before drop shadow');
} else if (d === 1) {
  console.log('already balanced enough at return (depth 1 = function body)');
} else {
  console.log('unexpected depth', d);
}

s = fs.readFileSync(p, 'utf8');
const start2 = s.indexOf('export function resolveCaptionStyle');
const next2 = s.indexOf('\nexport ', start2 + 10);
d = 0;
for (const c of s.slice(start2, next2)) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('resolve depth after', d);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

// gradientShift is a def flag, not a CaptionBlockFx — drop the invalid blockFx push.
const bad = `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
        out.blockFx = [...(out.blockFx ?? []).filter((fx) => fx !== 'gradientShift'), 'gradientShift'];
      }`;
const good = `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
      }`;

if (s.includes(bad)) {
  s = s.replace(bad, good);
  fs.writeFileSync(p, s);
  console.log('removed invalid gradientShift blockFx push');
} else if (s.includes("out.blockFx") && s.includes("'gradientShift'")) {
  // looser match
  s = s.replace(
    /if \(overrides\.gradientFill\.shift\) \{[\s\S]*?out\.gradientShift = true;[\s\S]*?out\.blockFx = \[\.\.\.\(out\.blockFx \?\? \[\]\)\.filter\(\(fx\) => fx !== 'gradientShift'\), 'gradientShift'\];\s*\}/,
    `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
      }`,
  );
  fs.writeFileSync(p, s);
  console.log('removed via regex');
} else {
  console.log('pattern not found, checking context...');
  const i = s.indexOf('out.gradientShift = true');
  console.log(JSON.stringify(s.slice(i, i + 250)));
}

// Confirm CaptionBlockFx does not need gradientShift if we only use the flag
const t = s.indexOf('export type CaptionBlockFx');
console.log(s.slice(t, t + 200));

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

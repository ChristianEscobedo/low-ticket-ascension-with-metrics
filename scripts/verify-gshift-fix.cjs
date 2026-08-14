#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

const badNeedle = "fx !== 'gradientShift'";
const badBlock = `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
        out.blockFx = [...(out.blockFx ?? []).filter((fx) => fx !== 'gradientShift'), 'gradientShift'];
      }`;
const goodBlock = `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
      }`;

console.log('has bad needle:', s.includes(badNeedle));
const i = s.indexOf('out.gradientShift = true');
console.log('context:\n', s.slice(i - 40, i + 280));

if (s.includes(badNeedle) || s.includes(badBlock)) {
  if (s.includes(badBlock)) {
    s = s.replace(badBlock, goodBlock);
  } else {
    s = s.replace(
      /if \(overrides\.gradientFill\.shift\) \{[\s\S]*?out\.gradientShift = true;[\s\S]*?out\.blockFx = \[\.\.\.\(out\.blockFx \?\? \[\]\)\.filter\(\(fx\) => fx !== 'gradientShift'\), 'gradientShift'\];\s*\}/,
      goodBlock,
    );
  }
  fs.writeFileSync(p, s);
  console.log('FIXED bad gradientShift blockFx push');
} else {
  console.log('already clean — no gradientShift in blockFx');
}

// Also ensure CaptionBlockFx does not include gradientShift
const t = s.indexOf('export type CaptionBlockFx');
console.log('CaptionBlockFx:', s.slice(t, t + 120));

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });

// Typecheck the captions file path via tsc if available, else vitest
try {
  execSync(
    'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/caption-vendor-parity.test.ts',
    { cwd: root, stdio: 'inherit' },
  );
} catch (e) {
  process.exit(1);
}

// Final assert
const final = fs.readFileSync(p, 'utf8');
if (final.includes(badNeedle)) {
  console.error('STILL HAS BAD NEEDLE');
  process.exit(1);
}
console.log('VERIFIED CLEAN');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

console.log('gradientShift?:', s.includes('gradientShift?:'));
console.log('has gradientShift in resolve:', s.includes('out.gradientShift'));

// Ensure def has gradientShift?: boolean
if (!s.includes('gradientShift?:')) {
  // add near gradientAngle
  const ga = s.indexOf('gradientAngle?: number;');
  if (ga >= 0) {
    const end = s.indexOf('\n', ga);
    s = s.slice(0, end) + '\n  /** Animate gradient position over time. */\n  gradientShift?: boolean;' + s.slice(end);
    console.log('added gradientShift field');
  }
}

// Fix resolve to set out.gradientShift
if (!s.includes('out.gradientShift')) {
  s = s.replace(
    `if (overrides.gradientFill.shift) {
        out.blockFx = [...(out.blockFx ?? []).filter((fx) => fx !== 'gradientShift'), 'gradientShift'];
      }`,
    `if (overrides.gradientFill.shift) {
        out.gradientShift = true;
        out.blockFx = [...(out.blockFx ?? []).filter((fx) => fx !== 'gradientShift'), 'gradientShift'];
      }`,
  );
  console.log('set out.gradientShift in resolve');
}

fs.writeFileSync(p, s);

// also check captionCssFor uses gradientShift
const css = s.indexOf('gradientShift');
console.log('gradientShift refs', (s.match(/gradientShift/g) || []).length);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

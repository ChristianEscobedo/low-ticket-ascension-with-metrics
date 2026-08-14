#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

if (s.includes('overrides.gradientFill')) {
  console.log('gradientFill resolve already present');
} else {
  const marker = 'out.wordSpacingEm = Math.max(0, Math.min(0.6, overrides.wordSpacing));';
  const i = s.indexOf(marker);
  if (i < 0) throw new Error('spacing marker not found');
  // find end of that if-block: next "}\n" after marker
  const close = s.indexOf('}', i + marker.length);
  if (close < 0) throw new Error('close brace not found');
  const insertAt = close + 1;
  const block = `
  // Whole-text gradient fill override (paints every word, drops stroke).
  if (overrides.gradientFill && Array.isArray(overrides.gradientFill.colors)) {
    const cols = overrides.gradientFill.colors.filter(
      (c): c is string => typeof c === 'string' && c.length > 0,
    );
    if (cols.length >= 2) {
      out.gradient = cols.length >= 3
        ? [cols[0], cols[1], cols[2]]
        : [cols[0], cols[1]];
      out.gradientScope = overrides.gradientFill.scope === 'active' ? 'active' : 'all';
      if (typeof overrides.gradientFill.angle === 'number' && Number.isFinite(overrides.gradientFill.angle)) {
        out.gradientAngle = Math.max(0, Math.min(360, overrides.gradientFill.angle));
      }
      if (overrides.gradientFill.shift) {
        out.blockFx = [...(out.blockFx ?? []).filter((fx) => fx !== 'gradientShift'), 'gradientShift'];
      }
      // Gradient glyphs can't carry a stroke without the black-halo bug.
      out.stroke = undefined;
    }
  }`;
  s = s.slice(0, insertAt) + block + s.slice(insertAt);
  fs.writeFileSync(p, s);
  console.log('gradientFill resolve inserted at', insertAt);
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

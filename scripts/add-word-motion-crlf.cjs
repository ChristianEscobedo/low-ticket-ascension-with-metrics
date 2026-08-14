#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

if (s.includes('// Word-synced float/wiggle')) {
  console.log('already present');
  process.exit(0);
}

const needle = `position: 'relative',
            };
            if (mark?.color) {`;
const needleCrlf = needle.replace(/\n/g, '\r\n');
const use = s.includes(needleCrlf) ? needleCrlf : s.includes(needle) ? needle : null;
if (!use) {
  console.log('needle not found');
  process.exit(1);
}

const nl = use.includes('\r\n') ? '\r\n' : '\n';
const block = `position: 'relative',
            };
            // Word-synced float/wiggle: phase starts when THIS word is spoken.
            {
              const motion = (def as CaptionStyleDef).motion;
              const syncM = !!motion?.syncToWords;
              const blockFxList = (def as CaptionStyleDef).blockFx ?? [];
              if (syncM && (blockFxList.includes('float') || blockFxList.includes('wiggle'))) {
                const parts: string[] = [];
                if (blockFxList.includes('float')) {
                  const amp = motion?.floatAmpEm ?? 0.08;
                  const period = motion?.floatPeriodSec ?? 1.8;
                  const ph = wordMotionPhase(frame, w.fromFrame, plan.fps, period);
                  parts.push(\`translateY(\${(Math.sin(ph) * amp).toFixed(3)}em)\`);
                }
                if (blockFxList.includes('wiggle')) {
                  const deg = motion?.wiggleDeg ?? 2.5;
                  const period = motion?.wigglePeriodSec ?? 0.45;
                  const ph = wordMotionPhase(frame, w.fromFrame, plan.fps, period);
                  parts.push(\`rotate(\${(Math.sin(ph) * deg).toFixed(2)}deg)\`);
                }
                if (parts.length) base.transform = parts.join(' ');
              }
            }
            if (mark?.color) {`.replace(/\n/g, nl);

s = s.replace(use, block);
fs.writeFileSync(p, s);
console.log('added word motion');
console.log('wordMotionPhase calls', (s.match(/wordMotionPhase\(/g) || []).length);

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

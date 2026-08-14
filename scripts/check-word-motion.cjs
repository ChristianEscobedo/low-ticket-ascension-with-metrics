#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

const i = s.indexOf('function wordMotionPhase');
console.log('def at', i);
// all occurrences
let pos = 0;
while ((pos = s.indexOf('wordMotionPhase', pos)) >= 0) {
  console.log(pos, JSON.stringify(s.slice(pos, pos + 60)));
  pos += 10;
}

// word synced ghost usage
pos = 0;
while ((pos = s.indexOf('wordSyncedGhostOpacity', pos)) >= 0) {
  console.log('ghost', pos, JSON.stringify(s.slice(pos, pos + 80)));
  pos += 10;
}

// If wordMotionPhase only defined, add per-word call
if ((s.match(/wordMotionPhase\(/g) || []).length < 1) {
  console.log('need to add calls');
}

// Check if Word-synced float block exists
console.log('has Word-synced float comment', s.includes('Word-synced float'));
console.log('has motion?.syncToWords in word map', s.includes('motion?.syncToWords'));

// Add per-word motion if missing
if (!s.includes('// Word-synced float/wiggle')) {
  const baseMark = `const base: React.CSSProperties = {
              ...(isActive || power ? css.active : css.word),
              display: 'inline-block',
              position: 'relative',
            };`;
  if (s.includes(baseMark)) {
    s = s.replace(
      baseMark,
      baseMark +
        `
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
`,
    );
    fs.writeFileSync(p, s);
    console.log('added word motion calls');
    execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
    execSync(
      'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/render-vendor-parity.test.ts',
      { cwd: root, stdio: 'inherit' },
    );
  } else {
    console.log('baseMark not found');
    const b = s.indexOf('css.active : css.word');
    console.log(JSON.stringify(s.slice(b - 80, b + 200)));
  }
} else {
  console.log('already has word motion block');
}
console.log('done');

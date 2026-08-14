#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// 1) Remove the wrongly-inserted cases from applyWordMarkExtras (they use `t` which doesn't exist there)
const bad = `    case 'slam': {
      const s = 1.55 - 0.55 * t;
      const y = (1 - t) * -0.55;
      return { opacity: t, transform: \`translateY(\${y.toFixed(3)}em) scale(\${s.toFixed(3)})\` };
    }
    case 'typewriter': {
      return { opacity: t > 0.05 ? 1 : 0, transform: 'none' };
    }
    case 'blurPop': {
      const blur = ((1 - t) * 8).toFixed(1);
      const s = 0.85 + 0.15 * t;
      return { opacity: t, filter: \`blur(\${blur}px)\`, transform: \`scale(\${s.toFixed(3)})\` };
    }
    case 'neonPulse': {
      const pulse = 0.6 + 0.4 * Math.sin(t * Math.PI);
      return { opacity: Math.max(t, pulse), transform: \`scale(\${(0.96 + 0.08 * t).toFixed(3)})\` };
    }
    case 'zoomSnap': {
      const s = 0.4 + 0.6 * t;
      return { opacity: t, transform: \`scale(\${s.toFixed(3)})\` };
    }
    case 'dropIn': {
      const y = (1 - t) * -1.1;
      return { opacity: t, transform: \`translateY(\${y.toFixed(3)}em)\` };
    }
`;

if (s.includes("case 'slam':")) {
  // Find and remove - may have slight whitespace diffs
  const start = s.indexOf("    case 'slam':");
  const end = s.indexOf("case 'dropIn':");
  if (start < 0 || end < 0) throw new Error('bad block bounds');
  // find end of dropIn case
  let i = end;
  // find matching closing of case block - look for next "    case" or "    default" or "  }" after dropIn's return
  const after = s.indexOf('return { opacity: t, transform:', end);
  const close = s.indexOf('}', after + 10);
  // dropIn ends with `    }\n`
  const dropEnd = s.indexOf('\n', close) + 1;
  console.log('removing bad block', start, dropEnd, s.slice(start, dropEnd).slice(0, 80));
  s = s.slice(0, start) + s.slice(dropEnd);
  console.log('removed bad anim cases from mark extras');
}

// 2) Insert into entranceStyle properly — after riseUp case
const good = `    case 'slam': {
      const sc = 1.55 - 0.55 * p;
      const y = (1 - p) * -0.55;
      return { opacity: p, transform: \`translateY(\${y.toFixed(3)}em) scale(\${sc.toFixed(3)})\` };
    }
    case 'typewriter':
      return { opacity: p > 0.05 ? 1 : 0 };
    case 'blurPop': {
      const blur = ((1 - p) * 8).toFixed(1);
      const sc = 0.85 + 0.15 * p;
      return { opacity: p, filter: \`blur(\${blur}px)\`, transform: \`scale(\${sc.toFixed(3)})\` };
    }
    case 'neonPulse': {
      const pulse = 0.6 + 0.4 * Math.sin(p * Math.PI);
      return {
        opacity: Math.max(p, pulse),
        transform: \`scale(\${(0.96 + 0.08 * p).toFixed(3)})\`,
        textShadow: \`0 0 \${(4 + p * 10).toFixed(1)}px currentColor\`,
      };
    }
    case 'zoomSnap': {
      const sc = 0.4 + 0.6 * p;
      return { opacity: p, transform: \`scale(\${sc.toFixed(3)})\` };
    }
    case 'dropIn': {
      const y = (1 - p) * -1.1;
      return { opacity: p, transform: \`translateY(\${y.toFixed(3)}em)\` };
    }
`;

if (!s.includes("case 'slam':")) {
  // Insert after riseUp
  const rise = `case 'riseUp':
      return { transform: \`translateY(\${(1 - p) * 0.35}em)\`, opacity: p };`;
  if (!s.includes(rise)) {
    // try alternate
    const r2 = s.indexOf("case 'riseUp':");
    console.log('riseUp at', r2, JSON.stringify(s.slice(r2, r2 + 120)));
    const lineEnd = s.indexOf('\n', s.indexOf('return', r2));
    // find end of riseUp case (next case)
    const nextCase = s.indexOf('case ', r2 + 10);
    s = s.slice(0, nextCase) + good + s.slice(nextCase);
    console.log('inserted after riseUp via nextCase');
  } else {
    s = s.replace(rise, rise + '\n' + good);
    console.log('inserted after riseUp exact');
  }
}

fs.writeFileSync(p, s);

// Also fix dual-layer early return - need to ensure it's wired
if (!s.includes('renderGradientWord(text, style')) {
  console.log('WARN: dual-layer not wired');
} else {
  console.log('dual-layer wired OK');
}

// Fix word-synced float - check if wordMotionPhase is used
console.log('wordMotionPhase uses', (s.match(/wordMotionPhase/g) || []).length);
console.log('wordSyncedGhostOpacity uses', (s.match(/wordSyncedGhostOpacity/g) || []).length);
console.log('syncToWords', (s.match(/syncToWords/g) || []).length);

// Fix block float gating - read current float block
const fi = s.indexOf("blockFx.includes('float')");
console.log('float blocks context:\n', s.slice(fi - 80, fi + 200));

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

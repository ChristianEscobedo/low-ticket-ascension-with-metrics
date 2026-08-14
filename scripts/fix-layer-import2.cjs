#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);

// dump import area
console.log('--- imports 50-90 ---');
for (let i = 49; i < 90 && i < lines.length; i++) {
  console.log(String(i + 1).padStart(4) + '|' + lines[i]);
}

// Fix bad import
const before = s;
s = s.replace(
  /import\s*\{\s*isCaptionVisibleAt\s*\}\s*from\s*['"]\.\.\/\.\.\/captions['"];\r?\n?/,
  '',
);
console.log('removed bad import', before !== s);

// Find existing captions import and add symbol
if (!s.includes('isCaptionVisibleAt')) {
  // Prefer value import block from '../captions'
  const idx = s.indexOf("from '../captions'");
  if (idx < 0) {
    console.error('no ../captions import');
    process.exit(1);
  }
  // walk back to import {
  const start = s.lastIndexOf('import', idx);
  const block = s.slice(start, idx + "from '../captions'".length + 1);
  console.log('found block:\n', block.slice(0, 200));
  if (block.includes('{')) {
    const newBlock = block.replace(
      /import\s*\{/,
      'import {\n  isCaptionVisibleAt,',
    );
    s = s.slice(0, start) + newBlock + s.slice(start + block.length);
    console.log('inserted into import block');
  }
} else {
  console.log('already has isCaptionVisibleAt');
}

// stackMode after defAnim
if (!s.includes('const stackMode')) {
  const needle = "const defAnim = (def as { anim?: string }).anim ?? 'pop';";
  const i = s.indexOf(needle);
  if (i < 0) {
    console.error('defAnim not found');
    process.exit(1);
  }
  const insert = `${needle}
  const stackMode =
    ((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
      ?.stackMode as string) ||
    'page';
  const isBuildStack = stackMode === 'build';`;
  s = s.slice(0, i) + insert + s.slice(i + needle.length);
  console.log('stackMode inserted');
}

// build hide after base style
if (!s.includes('stackBuildHide')) {
  // find first occurrence of position relative in base
  const marker = "position: 'relative',";
  let i = s.indexOf(marker);
  // find the one near const base
  const baseIdx = s.indexOf('const base: React.CSSProperties');
  i = s.indexOf(marker, baseIdx);
  if (i < 0) {
    console.error('base position not found');
    process.exit(1);
  }
  // find closing }; after that
  const close = s.indexOf('};', i);
  const inject = `
            const stackBuildHide = isBuildStack && frame < w.fromFrame;
            if (stackBuildHide) {
              base.opacity = 0;
            }`;
  s = s.slice(0, close + 2) + inject + s.slice(close + 2);
  console.log('stackBuildHide inserted at', close);
}

// active scale
if (!s.includes('isBuildStack && isActive')) {
  const needle = 'const style: React.CSSProperties = { ...base };';
  const i = s.indexOf(needle);
  if (i >= 0) {
    s =
      s.slice(0, i) +
      `const style: React.CSSProperties = { ...base };
            if (isBuildStack && isActive && !style.transform) {
              style.transform = 'scale(1.35)';
              style.transformOrigin = 'center center';
              style.zIndex = 2;
            }` +
      s.slice(i + needle.length);
    console.log('active scale inserted');
  }
}

// plan wiring
{
  const planPath = path.join(root, 'src/lib/mothermode/reel/render/plan.ts');
  let plan = fs.readFileSync(planPath, 'utf8');
  if (!plan.includes('captionOverrides: project.captionOverrides')) {
    const n = plan.indexOf('captionLayout,');
    const pwr = plan.indexOf('powerWords:', n);
    if (n >= 0 && pwr > n) {
      plan =
        plan.slice(0, pwr) +
        'captionOverrides: project.captionOverrides ?? null,\n      ' +
        plan.slice(pwr);
      fs.writeFileSync(planPath, plan);
      console.log('plan wired');
    } else {
      console.log('plan already or not found', n, pwr);
    }
  } else {
    console.log('plan already has captionOverrides pass');
  }
}

fs.writeFileSync(p, s);

// verify
const v = fs.readFileSync(p, 'utf8');
console.log('bad path?', v.includes("../../captions"));
console.log('has symbol?', v.includes('isCaptionVisibleAt'));
console.log('has stackBuildHide?', v.includes('stackBuildHide'));
console.log('has stackMode?', v.includes('const stackMode'));
// show import lines
v.split(/\r?\n/).forEach((l, i) => {
  if (l.includes('captions') && l.includes('import')) console.log(i + 1, l);
  if (l.includes('isCaptionVisibleAt') && i < 100) console.log(i + 1, l);
});

if (v.includes("../../captions") || !v.includes('isCaptionVisibleAt')) {
  process.exit(1);
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const wl = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(wl)) fs.copyFileSync(p, wl);
const wp = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/plan.ts',
);
if (fs.existsSync(wp)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/plan.ts'),
    wp,
  );
}

execSync(
  'pnpm exec vitest run tests/lib/caption-mute-stack.test.ts tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

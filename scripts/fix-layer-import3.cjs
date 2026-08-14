#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// 1) Kill any value import from wrong path
s = s.replace(
  /import\s*\{\s*isCaptionVisibleAt\s*\}\s*from\s*['"]\.\.\/\.\.\/captions['"];\r?\n?/g,
  '',
);

// 2) Fix type-only import('../../captions') -> '../captions'
s = s.replace(
  /import\(['"]\.\.\/\.\.\/captions['"]\)/g,
  "import('../captions')",
);

// 3) Ensure value import of isCaptionVisibleAt from '../captions'
const hasValueImport =
  /import\s*\{[^}]*\bisCaptionVisibleAt\b[^}]*\}\s*from\s*['"]\.\.\/captions['"]/.test(
    s,
  );
if (!hasValueImport) {
  // Prefer existing multi-line value import from '../captions'
  const multi = /import\s*\{\r?\n([\s\S]*?)\}\s*from\s*'\.\.\/captions';/;
  if (multi.test(s)) {
    s = s.replace(multi, (m, body) => {
      if (body.includes('isCaptionVisibleAt')) return m;
      return m.replace(
        body,
        `  isCaptionVisibleAt,\n${body.replace(/^\r?\n/, '')}`,
      );
    });
    console.log('added to multi import');
  } else {
    // insert new import after react
    s = s.replace(
      /import React from 'react';\r?\n/,
      (m) =>
        m + "import { isCaptionVisibleAt } from '../captions';\n",
    );
    console.log('added standalone import');
  }
} else {
  console.log('value import already ok');
}

// 4) stackMode
if (!s.includes('const stackMode')) {
  const needle = "const defAnim = (def as { anim?: string }).anim ?? 'pop';";
  const i = s.indexOf(needle);
  if (i < 0) {
    console.error('defAnim missing');
    process.exit(1);
  }
  s =
    s.slice(0, i) +
    needle +
    `
  const stackMode =
    ((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
      ?.stackMode as string) ||
    'page';
  const isBuildStack = stackMode === 'build';` +
    s.slice(i + needle.length);
  console.log('stackMode');
}

// 5) stackBuildHide
if (!s.includes('stackBuildHide')) {
  const baseIdx = s.indexOf('const base: React.CSSProperties');
  if (baseIdx < 0) {
    console.error('base missing');
    process.exit(1);
  }
  const close = s.indexOf('};', baseIdx);
  s =
    s.slice(0, close + 2) +
    `
            const stackBuildHide = isBuildStack && frame < w.fromFrame;
            if (stackBuildHide) {
              base.opacity = 0;
            }` +
    s.slice(close + 2);
  console.log('stackBuildHide');
}

// 6) plan pass-through
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
    }
  }
}

fs.writeFileSync(p, s);

// verify
const v = fs.readFileSync(p, 'utf8');
const badValue = /from\s*['"]\.\.\/\.\.\/captions['"]/.test(v);
const goodValue =
  /import\s*\{[^}]*\bisCaptionVisibleAt\b[^}]*\}\s*from\s*['"]\.\.\/captions['"]/.test(
    v,
  );
console.log({
  badValue,
  goodValue,
  stackBuildHide: v.includes('stackBuildHide'),
  stackMode: v.includes('const stackMode'),
});
// print import lines
v.split(/\r?\n/).forEach((l, i) => {
  if (i < 80 && (l.includes('captions') || l.includes('isCaptionVisibleAt'))) {
    console.log(i + 1, l);
  }
});
if (badValue || !goodValue) process.exit(1);

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

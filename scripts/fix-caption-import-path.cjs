#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// Remove bad import path (render/ is one level under reel/, not two)
s = s.replace(
  /import \{\s*isCaptionVisibleAt\s*\} from '\.\.\/\.\.\/captions';\r?\n/,
  '',
);

// Merge into existing ../captions value import
if (!s.includes('isCaptionVisibleAt')) {
  const multi = /import \{\r?\n([\s\S]*?)\} from '\.\.\/captions';/;
  if (multi.test(s)) {
    s = s.replace(multi, (m, body) => {
      if (body.includes('isCaptionVisibleAt')) return m;
      const trimmed = body.replace(/\s+$/, '');
      const needsComma = /,\s*$/.test(trimmed.trimEnd()) ? '' : ',';
      return m.replace(body, `${trimmed}${needsComma}\n  isCaptionVisibleAt,\n`);
    });
    console.log('merged multi-line import');
  } else {
    const single = /import \{([^}]+)\} from '\.\.\/captions';/;
    if (!single.test(s)) {
      console.error('no ../captions import found');
      process.exit(1);
    }
    s = s.replace(single, (m, body) => {
      if (body.includes('isCaptionVisibleAt')) return m;
      return `import {${body.replace(/\s*$/, '')}, isCaptionVisibleAt } from '../captions';`;
    });
    console.log('merged single-line import');
  }
} else {
  console.log('symbol present after strip');
}

// Ensure stackMode + build hide
if (!s.includes('const stackMode')) {
  s = s.replace(
    /const defAnim = \(def as \{ anim\?: string \}\)\.anim \?\? 'pop';/,
    (m) =>
      `${m}
  const stackMode =
    ((plan as { captionOverrides?: { stackMode?: string } }).captionOverrides
      ?.stackMode as string) ||
    'page';
  const isBuildStack = stackMode === 'build';`,
  );
  console.log('stackMode added');
}

if (!s.includes('stackBuildHide')) {
  const re = /(transformOrigin: 'center center',\r?\n\s*\};)/;
  if (!re.test(s)) {
    console.error('base end not found');
    process.exit(1);
  }
  s = s.replace(
    re,
    `$1
            const stackBuildHide = isBuildStack && frame < w.fromFrame;
            if (stackBuildHide) {
              base.opacity = 0;
            }`,
  );
  console.log('stackBuildHide added');
}

if (!s.includes('isBuildStack && isActive')) {
  s = s.replace(
    'const style: React.CSSProperties = { ...base };',
    `const style: React.CSSProperties = { ...base };
            if (isBuildStack && isActive && !style.transform) {
              style.transform = 'scale(1.35)';
              style.transformOrigin = 'center center';
              style.zIndex = 2;
            }`,
  );
  console.log('build active scale');
}

// plan must pass captionOverrides — double-check
{
  const planPath = path.join(root, 'src/lib/mothermode/reel/render/plan.ts');
  let plan = fs.readFileSync(planPath, 'utf8');
  if (!plan.includes('captionOverrides: project.captionOverrides')) {
    if (plan.includes('captionLayout,') && plan.includes('powerWords:')) {
      plan = plan.replace(
        /captionLayout,(\r?\n\s*)powerWords:/,
        (m, nl) =>
          `captionLayout,${nl}captionOverrides: project.captionOverrides ?? null,${nl}powerWords:`,
      );
      fs.writeFileSync(planPath, plan);
      console.log('plan captionOverrides wired');
    }
  }
}

fs.writeFileSync(p, s);

// sanity
const check = fs.readFileSync(p, 'utf8');
if (check.includes("from '../../captions'")) {
  console.error('bad path still present');
  process.exit(1);
}
if (!check.includes('isCaptionVisibleAt')) {
  console.error('symbol missing');
  process.exit(1);
}
if (!check.includes('stackBuildHide')) {
  console.error('stackBuildHide missing');
  process.exit(1);
}
console.log('layer OK');

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const workerLayer = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
);
if (fs.existsSync(workerLayer)) {
  fs.copyFileSync(p, workerLayer);
}
const workerPlan = path.join(
  root,
  'render-worker/src/lib/mothermode/reel/render/plan.ts',
);
if (fs.existsSync(workerPlan)) {
  fs.copyFileSync(
    path.join(root, 'src/lib/mothermode/reel/render/plan.ts'),
    workerPlan,
  );
}

execSync(
  'pnpm exec vitest run tests/lib/caption-mute-stack.test.ts tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

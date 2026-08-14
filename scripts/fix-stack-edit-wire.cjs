#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const write = (r, s) => fs.writeFileSync(path.join(root, r), s);

// 1) captionLayer: freePlaceEdit from plan
{
  let s = read('src/lib/mothermode/reel/render/captionLayer.tsx');
  s = s.replace(
    /export function CaptionLayer\(\{\s*freePlaceEdit = false,\s*/g,
    'export function CaptionLayer({',
  );

  const needle =
    'const { words, captionStyle: def, captionLayout: layout, powerWords } = plan;';
  if (!s.includes('const freePlaceEdit')) {
    if (!s.includes(needle)) throw new Error('destructure not found');
    s = s.replace(
      needle,
      needle +
        '\n  const freePlaceEdit = !!(plan as { freePlaceEdit?: boolean }).freePlaceEdit;',
    );
    console.log('layer: freePlaceEdit from plan');
  } else {
    console.log('layer: freePlaceEdit already');
  }

  if (!s.includes('if (freePlaceEdit) return true')) {
    s = s.replace(
      /(\.filter\(\(\{ w, idx \}\) => \{\s*if \(w\.mark\?\.hidden\) return false;)/,
      '$1\n        if (freePlaceEdit) return true;',
    );
    console.log('layer: filter inject');
  }
  write('src/lib/mothermode/reel/render/captionLayer.tsx', s);
}

// 2) RemotionPreview: bake into plan, clean inputProps
{
  let s = read('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx');
  const oldPlan = `const plan = useMemo(
    () => buildRenderPlan(project, { fps, width: size.width, height: size.height }),
    [project, fps, size.width, size.height],
  );`;
  const newPlan = `const plan = useMemo(() => {
    const base = buildRenderPlan(project, { fps, width: size.width, height: size.height });
    // Studio-only: free-place Edit mode shows every card word (not in final render).
    return freePlaceEdit ? { ...base, freePlaceEdit: true as const } : base;
  }, [project, fps, size.width, size.height, freePlaceEdit]);`;

  if (s.includes(oldPlan)) {
    s = s.replace(oldPlan, newPlan);
    console.log('preview: plan merges freePlaceEdit');
  } else if (!s.includes('freePlaceEdit: true')) {
    const re =
      /const plan = useMemo\(\s*\(\) => buildRenderPlan\(project, \{ fps, width: size\.width, height: size\.height \}\),\s*\[project, fps, size\.width, size\.height\],\s*\);/;
    if (re.test(s)) {
      s = s.replace(re, newPlan);
      console.log('preview: loose plan replace');
    } else {
      console.warn('preview: plan useMemo not matched');
    }
  } else {
    console.log('preview: plan already merges');
  }

  s = s.replace(
    /inputProps=\{\{\s*freePlaceEdit,\s*plan\s*\}\}/g,
    'inputProps={{ plan }}',
  );
  write('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx', s);
  console.log(
    'preview inputProps clean',
    read('src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx').includes(
      'inputProps={{ plan }}',
    ),
  );
}

// 3) RenderPlan type
{
  let s = read('src/lib/mothermode/reel/render/plan.ts');
  if (!s.includes('freePlaceEdit?:')) {
    s = s.replace(
      /(export interface RenderPlan \{[\s\S]*?captionLayout: CaptionLayout;)/,
      `$1
  /** Studio-only: show all free-place card words (ignored in final render). */
  freePlaceEdit?: boolean;`,
    );
    write('src/lib/mothermode/reel/render/plan.ts', s);
    console.log('plan: freePlaceEdit field');
  }
}

// vendor
execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});
const pairs = [
  [
    'src/lib/mothermode/reel/render/captionLayer.tsx',
    'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
  ],
  [
    'src/lib/mothermode/reel/render/plan.ts',
    'render-worker/src/lib/mothermode/reel/render/plan.ts',
  ],
];
for (const [a, b] of pairs) {
  if (fs.existsSync(path.join(root, b))) {
    fs.copyFileSync(path.join(root, a), path.join(root, b));
  }
}

const page = read('src/app/(fullscreen)/admin/reel-studio/page.tsx');
console.log('stackEditMode', page.includes('stackEditMode'));
console.log('toggle', page.includes('data-stack-edit-toggle'));
console.log(
  'CaptionDrag gated',
  (page.match(/stack-edit: hide box/g) || []).length,
);
console.log(
  'WordDrag gated',
  (page.match(/stackEditMode && \(/g) || []).length,
);
console.log(
  'layer freePlaceEdit from plan',
  read('src/lib/mothermode/reel/render/captionLayer.tsx').includes(
    'const freePlaceEdit = !!(plan as',
  ),
);

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out
    .split(/\r?\n/)
    .filter(
      (l) =>
        /error TS/.test(l) &&
        /page\.tsx|WordDrag|RemotionPreview|captionLayer|stackEdit|freePlace|plan\.ts/.test(
          l,
        ),
    );
  console.log('errors', lines.length);
  lines.slice(0, 40).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}

execSync(
  'pnpm exec vitest run tests/lib/caption-free-place.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

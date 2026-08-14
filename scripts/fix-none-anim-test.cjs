#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// 1) captionAnimKeyframes / captionAnimCss handle ''
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  if (!/export function captionAnimKeyframes\([^)]+\):\s*string\s*\{\s*if\s*\(!anim\)/.test(s)) {
    s = s.replace(
      /export function captionAnimKeyframes\(anim: CaptionAnim\): string \{\r?\n/,
      (m) => m + "  if (!anim) return '';\n",
    );
    n++;
  }
  if (!/export function captionAnimCss\([^)]+\):\s*string\s*\{\s*if\s*\(!anim\)/.test(s)) {
    s = s.replace(
      /export function captionAnimCss\(anim: CaptionAnim\): string \{\r?\n/,
      (m) => m + "  if (!anim) return '';\n",
    );
    n++;
  }
  // also handle case '' in switches if present as fallthrough — early return is enough
  fs.writeFileSync(p, s);
  console.log('helpers patched', n);
}

// 2) test skips empty anim
{
  const p = path.join(root, 'tests/lib/caption-presets.test.ts');
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes("if (!anim)")) {
    console.log('test already skips empty');
  } else {
    const re =
      /for \(const anim of CAPTION_ANIMS\) \{\r?\n\s*const kf = captionAnimKeyframes\(anim\);/;
    if (!re.test(t)) {
      console.error('test loop not found');
      process.exit(1);
    }
    t = t.replace(
      re,
      `for (const anim of CAPTION_ANIMS) {
      // '' / none = no entrance — no keyframes required.
      if (!anim) {
        expect(captionAnimKeyframes(anim)).toBe('');
        expect(captionAnimCss(anim)).toBe('');
        continue;
      }
      const kf = captionAnimKeyframes(anim);`,
    );
    fs.writeFileSync(p, t);
    console.log('test patched');
  }
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-vendor-parity.test.ts --reporter=dot',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

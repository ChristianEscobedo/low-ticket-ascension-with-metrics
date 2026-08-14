#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

const files = [
  'src/lib/mothermode/reel/captions.ts',
  'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx',
];

for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  const n = (s.match(/CaptionStyleOverrides/g) || []).length;
  if (n) {
    s = s.split('CaptionStyleOverrides').join('CaptionOverrides');
    fs.writeFileSync(p, s);
    console.log(rel, 'replaced', n);
  } else {
    console.log(rel, 'clean');
  }
}

execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });

// Verify no remaining bad name in src
const caps = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/captions.ts'), 'utf8');
if (caps.includes('CaptionStyleOverrides')) {
  console.error('still present');
  process.exit(1);
}
// EditorPack should reference CaptionOverrides
const i = caps.indexOf('export type EditorPack');
console.log(caps.slice(i, i + 280));
console.log('OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

const re = /export type CaptionBlockFx = [^;]+;/;
const m = s.match(re);
console.log('before:', m && m[0]);

const next =
  "export type CaptionBlockFx = 'ghostFade' | 'float' | 'wiggle' | 'punchIn' | 'letterbox' | 'springExit' | 'waveBounce';";

if (!m) {
  console.error('CaptionBlockFx not found');
  process.exit(1);
}
if (m[0].includes('waveBounce')) {
  console.log('already has waveBounce');
} else {
  s = s.replace(re, next);
  fs.writeFileSync(p, s);
  console.log('after:', fs.readFileSync(p, 'utf8').match(re)[0]);
}

execSync('node scripts/sync-vendored-captions.cjs', {
  cwd: root,
  stdio: 'inherit',
});

// verify tsc on these files
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
        (/captions\.ts|captionLayer\.tsx|waveBounce|CaptionBlockFx/.test(l) ||
          /Cannot find name/.test(l)),
    );
  console.log('errors left:', lines.length);
  lines.slice(0, 20).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('OK');

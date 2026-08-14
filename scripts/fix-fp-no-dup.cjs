#!/usr/bin/env node
/**
 * FP Edit was painting every word as an absolute overlay (default 50/18)
 * AND still painting unplaced words in the caption row. That is the
 * "duplicated / jumbled at the bottom" look.
 *
 * Edit must look identical to normal captions. Overlay only words that
 * already have x/y. Unplaced words stay in the row.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function write(file, content, crlf) {
  fs.writeFileSync(file, crlf ? content.replace(/\n/g, '\r\n') : content);
}

const files = [
  'src/lib/mothermode/reel/render/captionLayer.tsx',
  'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx',
];

const old = `    .filter(({ w }) => {
      if (freePlaceEdit) return true; // Edit: every word in this section
      return typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
    })
    .filter(({ w, idx }) => {
      // Edit: show every free-placed word so you can grab them.
      if (freePlaceEdit) return true;`;

const neu = `    .filter(({ w }) => {
      // Overlay ONLY words that already have a place. Unplaced words stay
      // in the caption row — Edit must look identical to Preview.
      return typeof w.mark?.xPct === 'number' && typeof w.mark?.yPct === 'number';
    })
    .filter(({ w, idx }) => {
      // Edit: still only overlay placed words, but keep them visible so
      // you can grab the one you want without karaoke hiding it.
      if (freePlaceEdit) return true;`;

let n = 0;
for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.warn('missing', rel);
    continue;
  }
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = norm(raw);
  if (!s.includes(old)) {
    console.warn('block not exact', rel);
    continue;
  }
  s = s.replace(old, neu);
  write(p, s, crlf);
  n++;
  console.log('patched', rel);
}

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l));
  console.log('errors', lines.length);
  lines.slice(0, 12).forEach((l) => console.log(l));
  if (lines.length) process.exit(1);
}
console.log('patches', n);
console.log('OK');

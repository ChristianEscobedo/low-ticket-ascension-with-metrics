#!/usr/bin/env node
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

const rel = 'src/lib/mothermode/reel/render/captionLayer.tsx';
const p = path.join(root, rel);
const raw = fs.readFileSync(p, 'utf8');
const crlf = raw.includes('\r\n');
let s = norm(raw);

const needleA = 'key={`fp-${idx}`}';
const replA = 'key={`fp-${idx}`} data-caption-word={idx}';
const needleB = 'key={`${idx}-${w.text}`}';
const replB = 'key={`${idx}-${w.text}`} data-caption-word={idx}';

let n = 0;
if (s.includes(needleA)) {
  const before = s.split(needleA).length - 1;
  s = s.split(needleA).join(replA);
  n += before;
  console.log('tagged fp', before);
}
if (s.includes(needleB)) {
  const before = s.split(needleB).length - 1;
  s = s.split(needleB).join(replB);
  n += before;
  console.log('tagged idx-text', before);
}
console.log('total tags', n);
console.log('has data-caption-word', s.includes('data-caption-word'));

write(p, s, crlf);
const dst = path.join(root, 'render-worker/src/lib/mothermode/reel/render/captionLayer.tsx');
if (fs.existsSync(dst)) fs.copyFileSync(p, dst);

try {
  execSync('pnpm exec tsc --noEmit -p tsconfig.json --pretty false 2>&1', {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log('tsc clean');
} catch (e) {
  const out = String(e.stdout || e.message || e);
  out
    .split(/\r?\n/)
    .filter((l) => /error TS/.test(l) && /captionLayer/.test(l))
    .slice(0, 20)
    .forEach((l) => console.log(l));
}
console.log('OK');

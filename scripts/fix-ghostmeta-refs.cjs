#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

console.log('ghostMeta count', (s.match(/ghostMeta/g) || []).length);
let pos = 0;
while ((pos = s.indexOf('ghostMeta', pos)) >= 0) {
  const lineStart = s.lastIndexOf('\n', pos) + 1;
  const lineEnd = s.indexOf('\n', pos);
  console.log('---', pos, JSON.stringify(s.slice(lineStart, Math.min(lineEnd, pos + 200))));
  // show more context
  console.log(s.slice(Math.max(0, pos - 80), pos + 300));
  console.log('====');
  pos += 9;
}

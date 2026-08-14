#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function dump(rel, re, pad) {
  const file = path.join(root, rel);
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  console.log('\n########', rel, '########');
  const hits = [];
  lines.forEach((l, i) => {
    if (re.test(l)) hits.push(i);
  });
  const show = new Set();
  hits.forEach((i) => {
    for (let k = i - pad; k <= i + pad; k += 1) if (k >= 0 && k < lines.length) show.add(k);
  });
  let last = -1;
  [...show].sort((a, b) => a - b).forEach((i) => {
    if (last >= 0 && i > last + 1) console.log('   ...');
    console.log(String(i + 1).padStart(5), lines[i]);
    last = i;
  });
}

dump('src/app/(fullscreen)/admin/reel-studio/page.tsx', /waitUntilPlayable|async function probeDuration|function probeDuration/, 14);
dump('src/app/(fullscreen)/admin/reel-studio/WordDragLayer.tsx', /selected|activeId|opacity|visibility|display:|editing/, 4);

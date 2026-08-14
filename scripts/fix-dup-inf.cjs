#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// Find the ghost meta type / assignment around inF
const idx = s.indexOf("staggerMode: 'block' | 'word' | 'letter'");
console.log('staggerMode type at', idx);
console.log(s.slice(idx - 400, idx + 500));

// Count let inF / const inF
const matches = [];
let pos = 0;
while ((pos = s.indexOf('inF', pos)) >= 0) {
  const lineStart = s.lastIndexOf('\n', pos) + 1;
  const lineEnd = s.indexOf('\n', pos);
  const line = s.slice(lineStart, lineEnd);
  if (/\b(let|const|var)\s+inF\b/.test(line) || /inF:\s*number/.test(line)) {
    matches.push({ pos, line: line.trim() });
  }
  pos += 3;
}
console.log('\n--- inF decls ---');
matches.forEach((m) => console.log(m.pos, m.line));

// The issue: ghost meta object type uses inF/outF AND outer scope already has let inF/outF
// Fix: rename the type fields in the inline type annotation to fadeInF/fadeOutF
// OR remove the inline type and just assign the object.

// Better approach: find the __ghost / ghostMeta assignment with inline type and simplify
const ghostMetaPatterns = [
  'ghostMeta',
  '__ghost',
  '(blockStyle as any).__ghost',
  "as {\n                  pageStartFrame",
];

for (const pat of ghostMetaPatterns) {
  const i = s.indexOf(pat);
  if (i >= 0) console.log('found', JSON.stringify(pat), 'at', i);
}

// Dump around line-ish 900-950 by finding pageStartFrame: number in type
const typeAt = s.indexOf('pageStartFrame: number');
console.log('\n--- type block ---\n', s.slice(typeAt - 200, typeAt + 600));

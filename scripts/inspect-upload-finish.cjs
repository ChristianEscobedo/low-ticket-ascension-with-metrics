#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/page.tsx');
const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');

const start = lines.findIndex((l) => /async function addUpload/.test(l));
if (start < 0) {
  console.log('addUpload not found');
} else {
  let depth = 0;
  let end = start;
  for (let i = start; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
    }
    if (depth === 0 && i > start) {
      end = i;
      break;
    }
  }
  console.log('=== addUpload', start + 1, '-', end + 1, '===');
  for (let i = start; i <= end; i += 1) console.log(String(i + 1).padStart(5), lines[i]);
}

console.log('\n=== revokeObjectURL / blobUrl refs ===');
lines.forEach((l, i) => {
  if (/revokeObjectURL|blobUrl|uploadJob/.test(l)) console.log(String(i + 1).padStart(5), l);
});

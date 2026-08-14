#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');
const keys = [
  'addUpload(',
  'fileInput',
  'setBusy',
  'uploadPct',
  'blob:',
  'accept=',
  'type="file"',
  'previewMode ===',
  'clips.length > 0',
  'data-empty-start',
  'RemotionPreview',
  'previewRef',
  'currentClip',
  'stageBox.w',
];
for (const k of keys) {
  console.log(k, p.split(k).length - 1, p.indexOf(k));
}
const fileIdx = p.indexOf('type="file"');
console.log('\n---file input---');
console.log(p.slice(Math.max(0, fileIdx - 250), fileIdx + 450));
const addIdx = p.indexOf('void addUpload');
console.log('\n---addUpload calls---');
let i = 0;
let n = 0;
while ((i = p.indexOf('addUpload', i)) >= 0 && n < 8) {
  console.log(n, i, JSON.stringify(p.slice(i, i + 90)));
  i += 8;
  n++;
}

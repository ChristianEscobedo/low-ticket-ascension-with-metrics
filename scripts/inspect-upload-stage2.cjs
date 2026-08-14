#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

const spots = [
  'previewMode === \'remotion\' && project.clips.length > 0',
  'data-empty-start',
  '<video',
  'RemotionPreview',
  'currentClip?.url',
  'previewRef',
  'const [busy',
  'useState(false)',
];
for (const s of spots) {
  const i = p.indexOf(s);
  console.log('\n====', s, i);
  if (i >= 0) console.log(p.slice(i, i + 420));
}

console.log('\n==== remotion stage block');
const i = p.indexOf("previewMode === 'remotion' && project.clips.length > 0");
console.log(p.slice(i, i + 1800));

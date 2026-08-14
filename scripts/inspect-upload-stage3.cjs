#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

const i = p.indexOf("previewMode === 'remotion' && project.clips.length > 0");
console.log('---stage after 1800---');
console.log(p.slice(i + 1800, i + 3600));

const j = p.indexOf('<RemotionPreview');
console.log('\n---RemotionPreview usage---', j);
if (j >= 0) console.log(p.slice(j, j + 700));

const k = p.indexOf('function currentClip');
console.log('\n---currentClip---', k);
const k2 = p.indexOf('const currentClip');
console.log('const currentClip', k2);
if (k2 >= 0) console.log(p.slice(k2, k2 + 400));

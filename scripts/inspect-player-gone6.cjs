#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

function dump(label, idx, before, after) {
  console.log('\n====', label, idx);
  if (idx < 0) return;
  console.log(p.slice(Math.max(0, idx - before), idx + after));
}

const keys = [
  'No video',
  'newProject',
  'createProject',
  'emptyProject',
  'function patch',
  'function persist',
  'uploadJob &&',
  'uploadJob?',
  'blobUrl',
  'setProject(',
  'if (!project)',
  'project ?',
  '!project ?',
];
for (const k of keys) {
  console.log(k.padEnd(20), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}

dump('No video', p.indexOf('No video'), 400, 800);
dump('function patch', p.indexOf('function patch'), 40, 900);
dump('if (!project) return insert', p.indexOf('if (!project) return;'), 80, 200);

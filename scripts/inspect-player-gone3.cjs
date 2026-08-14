#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

function dump(label, idx, before, after) {
  console.log('\n====', label, idx);
  if (idx < 0) return;
  console.log(p.slice(Math.max(0, idx - before), idx + after));
}

const keys = [
  'async function add',
  'function addFile',
  'addLocal',
  'uploadClip',
  'pickFile',
  'files[0]',
  'accept="video',
  'setProject((',
  'clips: [',
  'makeClip',
  'newClip',
  'busy &&',
  '{busy',
  'if (busy',
  'if (!project',
  'if (!clips',
  'project.clips.length === 0',
  '!project.clips.length',
  'Drop a clip',
  'Add a clip',
];
for (const k of keys) {
  console.log(k.padEnd(28), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}

dump('files[0]', p.indexOf('files[0]'), 300, 1800);
dump('accept video', p.indexOf('accept="video'), 200, 400);

#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

function dump(label, idx, before, after) {
  console.log('\n====', label, idx);
  if (idx < 0) return;
  console.log(p.slice(Math.max(0, idx - before), idx + after));
}

const keys = [
  'addUpload',
  'async function addUpload',
  'function addUpload',
  'busy &&',
  'if (!project',
  'project.clips.length === 0',
  '<video',
  'src={',
  'selectedClip',
  'currentClip',
];
for (const k of keys) {
  console.log(k.padEnd(28), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}

dump('addUpload def', p.indexOf('async function addUpload'), 80, 3500);
dump('busy &&', p.indexOf('busy &&'), 250, 500);
dump('clips.length === 0', p.indexOf('project.clips.length === 0'), 250, 600);

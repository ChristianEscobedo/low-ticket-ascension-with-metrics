#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');

function dump(label, idx, before, after) {
  console.log('\n====', label, idx);
  if (idx < 0) return;
  console.log(p.slice(Math.max(0, idx - before), idx + after));
}

const keys = [
  'insertClipAtPlayhead',
  'uploadJob',
  'setUploadJob',
  'previewEngine',
  'remotion',
  'currentClip.url',
  'clip.url',
  'if (!currentClip',
  'if (!project ||',
  'empty canvas',
  'No video',
  'Pick a clip',
  'stageW',
  'canvas',
];
for (const k of keys) {
  console.log(k.padEnd(24), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}

dump('insertClipAtPlayhead', p.indexOf('function insertClipAtPlayhead'), 40, 1200);
dump('uploadJob state', p.indexOf('uploadJob'), 80, 400);
dump('if (!currentClip', p.indexOf('if (!currentClip'), 200, 700);
dump('if (!project ||', p.indexOf('if (!project ||'), 200, 700);

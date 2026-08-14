#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');
const keys = [
  'onPickFile',
  'createObjectURL',
  'revokeObjectURL',
  'setBusy',
  'busy ===',
  'uploading',
  'localPreview',
  'blobUrl',
  'stageSrc',
  'activeClip',
  'clips.length',
  'No clip',
  'empty stage',
  'uploadPct',
  'probeDuration',
  'setProject',
];
for (const k of keys) {
  console.log(k.padEnd(18), String(p.split(k).length - 1).padStart(3), p.indexOf(k));
}
console.log('len', p.length);

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const layer = fs.readFileSync(
  path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
  'utf8',
);
const gallery = fs.readFileSync(
  path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx'),
  'utf8',
);
const captions = fs.readFileSync(
  path.join(root, 'src/lib/mothermode/reel/captions.ts'),
  'utf8',
);

// Ghost block
const gStart = layer.indexOf("if (blockFx.includes('ghostFade'))");
const gEnd = layer.indexOf('// skip block motion', gStart);
console.log('=== GHOST BLOCK ===');
console.log(layer.slice(gStart, gEnd > 0 ? gEnd : gStart + 2500));

// Float/wiggle block
const fStart = layer.indexOf('// skip block motion');
console.log('\n=== FLOAT/WIGGLE GATING ===');
console.log(layer.slice(fStart, fStart + 1200));

// Word-synced motion
const wStart = layer.indexOf('// Word-synced float');
console.log('\n=== WORD-SYNCED MOTION ===');
console.log(layer.slice(wStart, wStart + 900));

// wordSyncedGhostOpacity usage
console.log('\n=== wordSyncedGhostOpacity usage ===');
let pos = 0;
while ((pos = layer.indexOf('wordSyncedGhostOpacity', pos)) >= 0) {
  console.log(layer.slice(pos, pos + 200));
  pos += 20;
}

// Gallery sync UI
const sStart = gallery.indexOf('Sync to speech');
console.log('\n=== GALLERY SYNC UI ===');
console.log(gallery.slice(sStart - 100, sStart + 900));

// resolveCaptionStyle ghost/motion sync
const rStart = captions.indexOf('ghostSyncToWords');
console.log('\n=== captions ghostSync ===');
console.log(captions.slice(rStart - 80, rStart + 400));

const mStart = captions.indexOf('motionSyncToWords');
console.log('\n=== captions motionSync ===');
console.log(captions.slice(mStart - 80, mStart + 400));

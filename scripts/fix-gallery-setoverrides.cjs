#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx');
let s = fs.readFileSync(p, 'utf8');

console.log('setOverrides count', (s.match(/setOverrides/g) || []).length);
console.log('ghostSyncToWords count', (s.match(/ghostSyncToWords/g) || []).length);

// Find how overrides are updated elsewhere
const patterns = [
  'onChangeOverrides',
  'patchOverrides',
  'updateOverrides',
  'setCaptionOverrides',
  'onOverrides',
  'overrides:',
  'props.on',
];
for (const pat of patterns) {
  const n = (s.match(new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (n) console.log(pat, n);
}

// Dump component props / function signature
const fn = s.indexOf('export function CaptionGallery');
const alt = s.indexOf('function CaptionGallery');
const at = fn >= 0 ? fn : alt;
console.log('\n--- component head ---\n', s.slice(at, at + 800));

// Find an existing override update pattern near ghostFade
const g = s.indexOf('ghostFade');
console.log('\n--- ghostFade usages ---');
let pos = 0;
let c = 0;
while ((pos = s.indexOf('ghostFade', pos)) >= 0 && c < 8) {
  console.log('\n@', pos, JSON.stringify(s.slice(Math.max(0, pos - 120), pos + 200)));
  pos += 8;
  c++;
}

// Find setOverrides block we injected
const bad = s.indexOf('setOverrides((o)');
console.log('\n--- bad setOverrides block ---\n', s.slice(bad - 200, bad + 900));

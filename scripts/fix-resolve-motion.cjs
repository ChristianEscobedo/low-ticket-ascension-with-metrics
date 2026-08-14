#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

// ---- captions.ts resolve ----
{
  const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
  let s = fs.readFileSync(p, 'utf8');

  // Find resolve blockMotion section
  const i = s.indexOf('overrides.blockMotion');
  console.log('blockMotion resolve idx', i);
  console.log(s.slice(i - 120, i + 500));

  const j = s.indexOf('ghostStagger');
  console.log('--- ghost resolve ---');
  // find in resolveCaptionStyle
  const r = s.indexOf('export function resolveCaptionStyle');
  const g = s.indexOf('ghostStagger', r);
  console.log(s.slice(g - 100, g + 700));

  // Check if floatOn is in interface
  console.log('floatOn in file', s.includes('floatOn?:'));
  console.log('ghostEase in file', s.includes('ghostEase?:'));
  console.log('motion?: in def', s.includes('motion?: {'));
}

// ---- layer float ----
{
  const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
  let s = fs.readFileSync(p, 'utf8');
  const i = s.indexOf("blockFx.includes('float')");
  console.log('--- layer float ---');
  console.log(s.slice(i - 20, i + 800));
  console.log('ghostSmooth', s.includes('ghostSmooth'));
  console.log('ghostDriftFactor', s.includes('ghostDriftFactor'));
}

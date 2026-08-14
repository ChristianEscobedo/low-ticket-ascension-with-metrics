#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const layer = fs.readFileSync(
  path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'),
  'utf8',
);
const captions = fs.readFileSync(
  path.join(root, 'src/lib/mothermode/reel/captions.ts'),
  'utf8',
);
const worker = fs.readFileSync(path.join(root, 'render-worker/server.js'), 'utf8');

// Dual-layer section
const d = layer.indexOf('Dual-layer gradient');
console.log('=== DUAL LAYER ===\n', layer.slice(d, d + 1800));

// gradientCssFor + captionCssFor gradient
const g = captions.indexOf('export function gradientCssFor');
console.log('\n=== gradientCssFor ===\n', captions.slice(g, g + 600));

const paint = captions.indexOf('const paintGradient');
console.log('\n=== paintGradient ===\n', captions.slice(paint - 100, paint + 900));

// renderMedia quality
const rm = worker.indexOf('renderMedia');
console.log('\n=== renderMedia ===\n', worker.slice(rm, rm + 1200));

// quality handling
const q = worker.indexOf("quality === '720'");
console.log('\n=== quality 720 ===\n', worker.slice(q - 200, q + 400));

// health/ping
console.log('\n=== health ===', worker.includes('/health'), worker.includes('keepAlive'));

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// Show around the error
const lines = s.split(/\r?\n/);
console.log('total lines', lines.length);
for (let i = 540; i < 620 && i < lines.length; i++) {
  console.log(String(i + 1).padStart(4), lines[i]);
}

// Find applyWordMarkExtras function and dump its switch
const aw = s.indexOf('function applyWordMarkExtras');
console.log('\n--- applyWordMarkExtras start ---');
console.log(s.slice(aw, aw + 3500));

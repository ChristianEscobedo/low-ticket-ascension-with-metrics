#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

// Show around line 922
const lines = s.split(/\r?\n/);
console.log('total lines', lines.length);
for (let i = 900; i < Math.min(960, lines.length); i++) {
  console.log(String(i + 1).padStart(4), lines[i]);
}

// Find orphan else after ghostMeta removal
// Common pattern: removed if (...) { ... } else { ... } leaving else
const orphan = s.indexOf('else\n');
const orphan2 = s.indexOf('else {\n');
// Search near ghostMeta
const gm = s.indexOf('const ghostMeta');
console.log('\nghostMeta at', gm);
console.log(JSON.stringify(s.slice(gm, gm + 800)));

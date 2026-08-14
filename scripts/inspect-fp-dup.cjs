#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
let i = 0;
let n = 0;
while ((i = p.indexOf('freePlaceEdit', i)) >= 0 && n < 12) {
  console.log('\n====', n, i);
  console.log(p.slice(Math.max(0, i - 180), i + 420));
  i += 13;
  n++;
}

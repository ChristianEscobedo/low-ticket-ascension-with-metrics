#!/usr/bin/env node
const fs = require('fs');
const p = fs.readFileSync('src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
const spots = [
  'freePlacedAbs',
  'placedIdx',
  'skip row',
  'rows.map',
  'captionRows',
  'isPlaced',
  'mark?.xPct',
  'return null',
];
for (const s of spots) {
  console.log(s, p.split(s).length - 1, p.indexOf(s));
}
const i = p.indexOf('const freePlacedAbs');
console.log('\n---freePlacedAbs block---');
console.log(p.slice(i, i + 2200));
const j = p.indexOf('rows.map');
console.log('\n---rows.map---', j);
if (j >= 0) console.log(p.slice(j - 200, j + 900));

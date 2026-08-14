#!/usr/bin/env node
const fs = require('fs');
const g = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx', 'utf8');
for (const k of ['float', 'wiggle', 'Feel', 'Motion', 'blockFx', 'ghostFade', 'onCustomize']) {
  let idx = 0, n = 0;
  while ((idx = g.indexOf(k, idx)) >= 0 && n < 3) {
    console.log('---', k, 'at', idx, '---');
    console.log(g.slice(Math.max(0, idx - 80), idx + 200).replace(/\n/g, '\\n'));
    idx += k.length;
    n++;
  }
}
const s = fs.readFileSync('src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
console.log('FLOAT_PERIOD', s.includes('FLOAT_PERIOD_SEC'));
const i = s.indexOf('FLOAT_PERIOD');
console.log(s.slice(i - 40, i + 80));
// ghost fade ease - check if linear
const j = s.indexOf('function ghostUnitOpacity');
console.log(s.slice(j, j + 600));

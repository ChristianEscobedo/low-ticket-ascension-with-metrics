#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const s = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'), 'utf8');
const c = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/captions.ts'), 'utf8');
const g = fs.readFileSync(path.join(root, 'src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx'), 'utf8');

// rest of word render after "Compose the transform"
const i = s.indexOf('Compose the transform');
console.log(s.slice(i, i + 4500));

console.log('\n--- entranceProgress / anim helpers ---');
for (const name of ['entranceProgress', 'animTransform', 'ghostUnitOpacity', 'ghostDriftFactor', 'float', 'wiggle']) {
  const j = s.indexOf(`function ${name}`);
  const k = s.indexOf(`export function ${name}`);
  const at = j >= 0 ? j : k;
  console.log(name, at);
  if (at >= 0) console.log(s.slice(at, at + 600), '\n---');
}

console.log('\n--- gallery shine/gradient UI ---');
const sh = g.indexOf('shine');
console.log('shine', sh);
const gr = g.indexOf('gradientFill');
console.log(g.slice(gr, gr + 800));

console.log('\n--- gradient presets with shadow that might silhouette ---');
const re = /id: '([^']+)'[\s\S]{0,400}gradient:/g;
let m;
while ((m = re.exec(c))) {
  const chunk = c.slice(m.index, m.index + 450);
  if (chunk.includes('shadow:')) {
    console.log('---', m[1]);
    const sh2 = chunk.match(/shadow: '([^']+)'/);
    console.log('shadow', sh2 && sh2[1]);
  }
}

console.log('\n--- tests about gradient silhouette ---');
const t = fs.readFileSync(path.join(root, 'tests/lib/caption-presets.test.ts'), 'utf8');
const ti = t.indexOf('drop-shadow');
console.log(t.slice(ti - 200, ti + 400));

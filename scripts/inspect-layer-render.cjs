#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const s = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx'), 'utf8');
const c = fs.readFileSync(path.join(root, 'src/lib/mothermode/reel/captions.ts'), 'utf8');

const markers = [
  'rows.map',
  'words.map',
  'text.split',
  'ghostUnitOpacity',
  'shine',
  'gradient',
  'filter',
  'textShadow',
  'drop-shadow',
  'cssTextShadowToDropFilter',
  'highlightMode',
  'wordFx',
  'anim',
];
for (const m of markers) {
  let n = 0;
  let i = 0;
  while ((i = s.indexOf(m, i)) >= 0) {
    n++;
    i += m.length;
  }
  const nc = (() => {
    let n2 = 0;
    let j = 0;
    while ((j = c.indexOf(m, j)) >= 0) {
      n2++;
      j += m.length;
    }
    return n2;
  })();
  console.log(m, 'layer', n, 'captions', nc);
}

const r = s.indexOf('rows.map');
console.log('\n--- rows.map context ---');
console.log(s.slice(r, r + 4000));

console.log('\n--- cssTextShadowToDropFilter ---');
const d = c.indexOf('function cssTextShadowToDropFilter');
console.log(c.slice(d, d + 1200));

console.log('\n--- shine / gradient presets ---');
for (const id of ['shine', 'gradient-flow', 'iridescent', 'neon-glow', 'chrome']) {
  const i = c.indexOf(`id: '${id}'`);
  if (i < 0) {
    console.log(id, 'NOT FOUND');
    continue;
  }
  console.log('\nPRESET', id);
  console.log(c.slice(i, i + 500));
}

console.log('\n--- CaptionAnim types ---');
const a = c.indexOf('export type CaptionAnim');
console.log(c.slice(a, a + 400));

console.log('\n--- highlightMode ---');
const h = c.indexOf('highlightMode?:');
console.log(c.slice(h - 40, h + 200));

#!/usr/bin/env node
const fs = require('fs');
const c = fs.readFileSync('src/lib/mothermode/reel/captions.ts', 'utf8');
let i = c.indexOf('blockMotion');
console.log('=== captions blockMotion ===');
console.log(c.slice(i - 80, i + 600));
i = c.indexOf('overrides.blockMotion');
console.log('=== resolve blockMotion ===');
console.log(c.slice(i - 40, i + 450));
i = c.indexOf('FLOAT_PERIOD');
console.log('FLOAT refs', (c.match(/FLOAT/g) || []).length);

const s = fs.readFileSync('src/lib/mothermode/reel/render/captionLayer.tsx', 'utf8');
i = s.indexOf("blockFx.includes('float')");
console.log('=== layer float/wiggle ===');
console.log(s.slice(i - 40, i + 1100));
i = s.indexOf('ghostUnitOpacity');
console.log('=== ghostUnitOpacity ===');
console.log(s.slice(i, i + 500));
i = s.indexOf("staggerMode === 'block'");
console.log('=== ghost block path ===');
console.log(s.slice(i - 200, i + 400));

const g = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/CaptionGallery.tsx', 'utf8');
i = g.indexOf('blockMotion');
console.log('=== gallery blockMotion ===');
console.log(g.slice(Math.max(0, i - 150), i + 1200));
i = g.indexOf('ghostStagger');
console.log('=== gallery ghostStagger ===');
console.log(g.slice(Math.max(0, i - 100), i + 800));

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rd = (r) => fs.readFileSync(path.join(root, r), 'utf8').replace(/\r\n/g, '\n').split('\n');

// 1) ReelClip type
const t = rd('src/lib/mothermode/reel/types.ts');
const s = t.findIndex((l) => /export (type|interface) ReelClip\b/.test(l));
console.log('--- ReelClip type ---');
for (let i = s; i < Math.min(s + 24, t.length); i += 1) console.log(String(i + 1).padStart(5), t[i]);

// 2) waitUntilPlayable in page.tsx
const p = rd('src/app/(fullscreen)/admin/reel-studio/page.tsx');
const w = p.findIndex((l) => /function waitUntilPlayable/.test(l));
console.log('\n--- waitUntilPlayable ---');
for (let i = w; i < Math.min(w + 30, p.length); i += 1) console.log(String(i + 1).padStart(5), p[i]);
console.log('\n--- probeDuration ---');
const d = p.findIndex((l) => /function probeDuration/.test(l));
for (let i = d; i < Math.min(d + 22, p.length); i += 1) console.log(String(i + 1).padStart(5), p[i]);

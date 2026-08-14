#!/usr/bin/env node
const fs = require('fs');
const t = fs.readFileSync('src/lib/mothermode/reel/types.ts', 'utf8');
const i = t.indexOf('export type ReelProject');
const j = t.indexOf('export type ReelClip');
console.log('ReelProject', i);
console.log(t.slice(i, i + 1200));
console.log('\n---ReelClip---', j);
console.log(t.slice(j, j + 500));
const p = fs.readFileSync('src/app/(fullscreen)/admin/reel-studio/page.tsx', 'utf8');
console.log('\nmakeClipId import', p.includes('makeClipId'));
console.log('makeProjectId', p.indexOf('makeProjectId'), p.split('makeProjectId').length - 1);
const k = t.indexOf('export function make');
console.log('\nmakers', t.slice(k, k + 400));

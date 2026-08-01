'use strict';
/** One-off: bump the research port doc's test counts 209 -> 210 (0.2). */
const fs = require('fs');
const f = 'docs/RESEARCH_LAB_SYSTEM_PORT.md';
let t = fs.readFileSync(f, 'utf8');
t = t.replace(/\(18\) .. 209 total/, '(19) — 210 total');
t = t.replace('(209 tests) should pass', '(210 tests) should pass');
fs.writeFileSync(f, t);
console.log('210 total:', (t.match(/210 total/g) || []).length);
console.log('210 tests:', (t.match(/210 tests/g) || []).length);
console.log('209 leftovers:', (t.match(/209/g) || []).length);

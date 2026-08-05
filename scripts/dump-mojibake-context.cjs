#!/usr/bin/env node
/**
 * Dump every mojibake run in reel-studio/page.tsx with line number and the
 * full source line, so each one can be decided deliberately.
 *
 * Groups by run length: 2 (`??` - could be the real operator), 3 (a single
 * multi-byte glyph), 4+ (emoji).
 */
const fs = require('fs');

const FILE = process.argv[2] || 'src/app/(fullscreen)/admin/reel-studio/page.tsx';
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

const buckets = { two: [], three: [], emoji: [] };

lines.forEach((line, i) => {
  for (const m of line.matchAll(/\?{2,}/g)) {
    const len = m[0].length;
    const rec = { n: i + 1, col: m.index, line: line.trim() };
    if (len === 2) buckets.two.push(rec);
    else if (len === 3) buckets.three.push(rec);
    else buckets.emoji.push({ ...rec, len });
  }
});

// `??` is overwhelmingly the nullish operator. Only show ones that are NOT
// surrounded by code-ish context, i.e. likely a real separator dot.
const suspiciousTwo = buckets.two.filter((r) => {
  const around = r.line.slice(Math.max(0, r.col - 2), r.col + 4);
  return !/[\w)\]'"`]\s*\?\?\s*[\w([''"`]/.test(around);
});

console.log(`=== ${buckets.three.length} three-char runs (single glyph) ===`);
for (const r of buckets.three) console.log(`${String(r.n).padStart(5)}: ${r.line}`);

console.log(`\n=== ${buckets.emoji.length} emoji runs ===`);
for (const r of buckets.emoji) console.log(`${String(r.n).padStart(5)} len=${r.len}: ${r.line}`);

console.log(`\n=== ${buckets.two.length} two-char runs, ${suspiciousTwo.length} look like separators ===`);
for (const r of suspiciousTwo) console.log(`${String(r.n).padStart(5)}: ${r.line}`);

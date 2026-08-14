#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/captions.ts');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('export function resolveCaptionStyle');
const next = s.indexOf('\nexport ', start + 10);
const body = s.slice(start, next);
let d = 0;
for (const c of body) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('resolve depth', d);

if (d === 1) {
  // Find "  return out;\n}" inside resolve and add closing brace before return
  const ret = s.lastIndexOf('  return out;', next);
  if (ret < start) throw new Error('return out not found');
  s = s.slice(0, ret) + '}\n  ' + s.slice(ret);
  // wait that would close too early if we're inside drop shadow block
  // Better: add } after return out's closing }
  // Actually depth 1 means function body never closed. The "return out;\n}" closes something else.
  // Look at end of resolve:
  console.log('END:', JSON.stringify(s.slice(next - 80, next)));
}

// Re-read after potential edit - do proper fix
s = fs.readFileSync(p, 'utf8');
const start2 = s.indexOf('export function resolveCaptionStyle');
const next2 = s.indexOf('\nexport ', start2 + 10);
// Find the last "return out;" before next export
const retIdx = s.lastIndexOf('return out;', next2);
console.log('return out at', retIdx, s.slice(retIdx, retIdx + 30));

// Count depth from start to just before return out
let d2 = 0;
for (const c of s.slice(start2, retIdx)) {
  if (c === '{') d2++;
  if (c === '}') d2--;
}
console.log('depth at return', d2);

// The function opened with { after ): CaptionStyleDef {
// If depth is 2 at return, we're inside an extra block (the motion block we added)
// Looking at our replacement - we have `{ let fx = ... if (touched) out.motion = m; }` 
// That should be closed. Maybe ghost ease block left an open brace?

// Print from hasFloatToggle area
const hf = s.indexOf('hasFloatToggle');
console.log(s.slice(hf - 50, hf + 1200));
console.log('---ghost ease---');
const ge = s.indexOf('overrides.ghostEase');
console.log(s.slice(ge - 80, ge + 900));

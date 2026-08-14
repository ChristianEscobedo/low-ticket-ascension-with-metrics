#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf("{ghostMeta && ghostMeta.staggerMode === 'letter'");
if (start < 0) {
  console.log('letter branch not found');
  process.exit(0);
}

// Find the ternary end: look for `})` then `: (` or `: text` pattern
// Show full ternary
console.log(s.slice(start, start + 1200));

// The pattern is typically:
// {ghostMeta && ghostMeta.staggerMode === 'letter'
//   ? Array.from(text).map(...)
//   : (
//     <>
//       {text}
//       ...
//     </>
//   )}
// or : text}

// Find matching closing of the JSX expression { ... }
let i = start;
// start is at '{', find matching }
let depth = 0;
let end = -1;
for (let k = i; k < s.length; k++) {
  if (s[k] === '{') depth++;
  else if (s[k] === '}') {
    depth--;
    if (depth === 0) {
      end = k + 1;
      break;
    }
  }
}
if (end < 0) {
  console.error('no end');
  process.exit(1);
}

const block = s.slice(start, end);
console.log('\n--- FULL BLOCK LEN', block.length);
console.log(block.slice(-200));

// Replace with simple text render (the false branch content if we can extract it)
// Prefer: just {text}{emoji}{tail} or whatever the else was
const elseAt = block.lastIndexOf(':');
// Better approach: replace entire ternary with plain children
// Looking at structure - after map comes `})` then `:` then false branch
const colonMatch = block.match(/\}\)\s*\n\s*:\s*\(?([\s\S]*)\)?\s*$/);
let replacement = '{text}{emoji}{tail}';
if (block.includes(': (')) {
  const falseStart = block.indexOf(': (') + 3;
  let falseBody = block.slice(falseStart);
  // strip trailing )
  falseBody = falseBody.replace(/\)\s*$/, '').trim();
  replacement = falseBody;
  console.log('false branch:', JSON.stringify(replacement.slice(0, 200)));
} else if (block.includes('\n                  : ')) {
  const falseStart = block.indexOf('\n                  : ') + '\n                  : '.length;
  replacement = block.slice(falseStart).replace(/\}\s*$/, '').trim();
  console.log('false simple:', JSON.stringify(replacement.slice(0, 200)));
}

// Wrap as JSX expression content without outer braces if replacement already has fragments
// The original was { ternary } so replacement should be the inner content
// If false branch is fragment or text, use:
// {text}
// {emoji}
// {tail}
// as simple children without braces wrapper issues

// Actually the parent is already inside a <span>... so we need:
// {text}
// {emoji}
// {tail}
// without an extra wrapping { }

const simple = `{text}
                {emoji}
                {tail}`;

s = s.slice(0, start) + simple + s.slice(end);
console.log('replaced letter stagger branch');

// Verify no ghostMeta left
const left = (s.match(/ghostMeta/g) || []).length;
console.log('ghostMeta left', left);

let d = 0;
for (const c of s) {
  if (c === '{') d++;
  if (c === '}') d--;
}
console.log('balance', d);
if (d !== 0 || left > 0) {
  // dump remaining
  let pos = 0;
  while ((pos = s.indexOf('ghostMeta', pos)) >= 0) {
    console.log(s.slice(pos - 40, pos + 80));
    pos += 9;
  }
  if (d !== 0) process.exit(1);
}

fs.writeFileSync(p, s);
execSync('node scripts/sync-vendored-captions.cjs', { cwd: root, stdio: 'inherit' });
execSync(
  'pnpm exec vitest run tests/lib/caption-presets.test.ts tests/lib/caption-preset-round-trip.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts',
  { cwd: root, stdio: 'inherit' },
);
console.log('OK');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const p = path.join(
  __dirname,
  '..',
  'src/app/(fullscreen)/admin/reel-studio/page.tsx',
);
let s = fs.readFileSync(p, 'utf8');

// Pattern: conditional opens with CaptionDragLayer then WordDragLayer sibling
// Wrap both in <>...</>
//
// {ccOn && ... && (
//   <CaptionDragLayer ... />
//   <WordDragLayer ... />
// )}

const re =
  /(\{ccOn &&\r?\n\s*Object\.values\(project\.captions \?\? \{\}\)\.some\(\(w\) => \(w\?\.length \?\? 0\) > 0\) && \(\r?\n)(\s*)(<CaptionDragLayer[\s\S]*?\/>\r?\n)(\s*<WordDragLayer[\s\S]*?\/>\r?\n)(\s*\))/g;

let n = 0;
s = s.replace(re, (m, open, indent, cap, word, close) => {
  n++;
  return `${open}${indent}<>\n${indent}  ${cap.trimStart()}${indent}  ${word.trimStart()}${indent}</>\n${indent}${close.trimStart() === ')' ? ')' : close}`;
});

// Also handle cases without the exact ccOn pattern — any place where
// CaptionDragLayer is immediately followed by WordDragLayer without fragment
if (n === 0) {
  // Broader: after `&& (` that precedes CaptionDragLayer + WordDragLayer
  const re2 =
    /(&& \(\r?\n)(\s*)(<CaptionDragLayer[\s\S]*?\/>\r?\n)(\s*<WordDragLayer[\s\S]*?\/>\r?\n)(\s*\))/g;
  s = s.replace(re2, (m, open, indent, cap, word, close) => {
    // skip if already wrapped
    if (m.includes('<>')) return m;
    n++;
    return `${open}${indent}<>\n${indent}  ${cap.trimStart()}${indent}  ${word.trimStart()}${indent}</>\n${close}`;
  });
}

console.log('wrapped', n);
if (n === 0) {
  // dump context around first WordDragLayer
  const i = s.indexOf('<WordDragLayer');
  console.log(s.slice(i - 300, i + 200));
  process.exit(1);
}

// Fix setFxPicked if still wrong
if (s.includes('setFxPicked')) {
  const m = s.match(/const \[fxWordIndexes,\s*(\w+)\]/);
  if (m && m[1] !== 'setFxPicked') {
    s = s.replace(/setFxPicked/g, m[1]);
    console.log('fx setter ->', m[1]);
  } else if (s.includes('setFxWordIndexes')) {
    s = s.replace(/setFxPicked/g, 'setFxWordIndexes');
    console.log('fx setter -> setFxWordIndexes');
  } else {
    // search for how fx indexes are set
    const hits = [];
    const lines = s.split(/\r?\n/);
    lines.forEach((l, i) => {
      if (/fxWord|FxWord|fxPicked|setFx/.test(l) && /useState|Set\(/.test(l)) {
        hits.push(i + 1 + ': ' + l.trim().slice(0, 120));
      }
    });
    console.log('fx hits', hits.slice(0, 10));
  }
}

// wordPlaceLocal type might be broken - check
if (s.includes('wordPlaceLocal')) {
  const i = s.indexOf('wordPlaceLocal');
  console.log('state snippet', JSON.stringify(s.slice(i - 80, i + 200)));
}

fs.writeFileSync(p, s);

// verify fragments
const v = fs.readFileSync(p, 'utf8');
const i = v.indexOf('<WordDragLayer');
console.log('context:\n', v.slice(i - 120, i + 80));
console.log('OK');

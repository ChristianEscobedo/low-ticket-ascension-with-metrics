#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const p = path.join(
  __dirname,
  '..',
  'src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx',
);
let g = fs.readFileSync(p, 'utf8');

// Show current locations
const lines = g.split(/\r?\n/);
lines.forEach((l, i) => {
  if (
    l.includes('const muted') ||
    l.includes('const cardId') ||
    l.includes('const cardMode') ||
    l.includes('phrases.map')
  ) {
    console.log(i + 1, l.trim());
  }
});

const needle =
  '            const rowActive = activeIdx >= p.from && activeIdx < p.to;\n            return (';
const needleCrlf = needle.replace(/\n/g, '\r\n');
const insert =
  '            const rowActive = activeIdx >= p.from && activeIdx < p.to;\n' +
  '            const muted = phraseMuted(words, p.from, p.to);\n' +
  '            const cardId = phraseCardId(words, p.from, p.to);\n' +
  '            const cardMode = cardId ? words[p.from]?.mark?.card?.mode : null;\n' +
  '            return (';
const insertCrlf = insert.replace(/\n/g, '\r\n');

// Remove any existing muted/cardId/cardMode decls that are NOT right after rowActive
// (stray decls from earlier partial patches)
g = g.replace(
  /\r?\n\s*const muted = phraseMuted\(words, p\.from, p\.to\);\r?\n\s*const cardId = phraseCardId\(words, p\.from, p\.to\);\r?\n\s*const cardMode = cardId \? words\[p\.from\]\?\.mark\?\.card\?\.mode : null;/g,
  '',
);

if (g.includes(needle)) {
  g = g.replace(needle, insert);
  console.log('patched lf');
} else if (g.includes(needleCrlf)) {
  g = g.replace(needleCrlf, insertCrlf);
  console.log('patched crlf');
} else {
  // try looser
  const re =
    /(const rowActive = activeIdx >= p\.from && activeIdx < p\.to;)\r?\n(\s*)return \(/;
  if (!re.test(g)) {
    console.error('cannot find map rowActive');
    process.exit(1);
  }
  g = g.replace(
    re,
    `$1\n$2const muted = phraseMuted(words, p.from, p.to);\n$2const cardId = phraseCardId(words, p.from, p.to);\n$2const cardMode = cardId ? words[p.from]?.mark?.card?.mode : null;\n$2return (`,
  );
  console.log('patched loose');
}

fs.writeFileSync(p, g);

const v = fs.readFileSync(p, 'utf8');
const ls = v.split(/\r?\n/);
console.log('--- after ---');
for (let i = 244; i < 255; i++) console.log(i + 1, ls[i]);

if (!v.includes('const muted = phraseMuted(words, p.from, p.to)')) {
  console.error('still missing');
  process.exit(1);
}
console.log('OK');

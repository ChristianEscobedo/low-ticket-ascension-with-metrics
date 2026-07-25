#!/usr/bin/env node
/**
 * Read-only reconnaissance for the Chrome/footer extraction (Task B) and the
 * Media scoping question (Task C).
 *
 * Writes nothing. Everything it prints is an anchor the wiring script will
 * assert on, so if a number here disagrees with the task doc we find out now
 * rather than mid-write.
 */
const fs = require('fs');
const path = require('path');

const SHELL = path.join('src', 'app', 'admin', 'sales-funnels', 'SalesFunnelEditor.tsx');
const src = fs.readFileSync(SHELL, 'utf8');
const lines = src.split(/\r?\n/);

function count(re) {
  return (src.match(re) || []).length;
}

function findLines(re) {
  const out = [];
  lines.forEach((l, i) => {
    if (re.test(l)) out.push(i + 1);
  });
  return out;
}

console.log('=== shell ===');
console.log('file          :', SHELL);
console.log('lines         :', lines.length);
console.log('line endings  :', src.includes('\r\n') ? 'CRLF' : 'LF');

console.log('\n=== primitive usage in the shell ===');
console.log('<Field  uses  :', count(/<Field\b/g), 'at', findLines(/<Field\b/).join(', ') || '(none)');
console.log('<Area   uses  :', count(/<Area\b/g), 'at', findLines(/<Area\b/).join(', ') || '(none)');
console.log('<StatChip uses:', count(/<StatChip\b/g), 'at', findLines(/<StatChip\b/).join(', ') || '(none)');
console.log('local defs    :', findLines(/^function (Field|Area|StatChip)\b/).join(', ') || '(none)');
console.log('<NumberField  :', count(/<NumberField\b/g));

console.log('\n=== ui.tsx import in the shell ===');
const uiImport = src.match(/import\s*\{[^}]*\}\s*from '\.\/parts\/ui';/);
console.log(uiImport ? uiImport[0] : '(no ./parts/ui import found)');

console.log('\n=== footer ===');
console.log('setHeader occurrences :', count(/setHeader/g));
console.log('setFooter occurrences :', count(/setFooter/g), 'at', findLines(/setFooter/).join(', '));
console.log('footer state decl at  :', findLines(/const \[footer, setFooter\]/).join(', '));
console.log("tab === 'footer' at   :", findLines(/tab === 'footer'/).join(', '));

// Enumerate every label in the footer body: this is the field-label guard input.
const openIdx = lines.findIndex((l) => l.includes("{tab === 'footer' && ("));
if (openIdx === -1) {
  console.log('!! footer body opener not found');
} else {
  const indent = lines[openIdx].match(/^\s*/)[0];
  let closeIdx = -1;
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (lines[i] === indent + ')}') {
      closeIdx = i;
      break;
    }
  }
  console.log('body span             :', openIdx + 1, '->', closeIdx === -1 ? '(no closer)' : closeIdx + 1);
  const body = lines.slice(openIdx, closeIdx + 1).join('\n');
  const labels = [...body.matchAll(/label="([^"]+)"/g)].map((m) => m[1]);
  console.log('labels (' + labels.length + '):');
  labels.forEach((l) => console.log('  -', JSON.stringify(l)));
  const footerKeys = [...new Set([...body.matchAll(/footer\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
  console.log('footer keys touched  :', footerKeys.join(', '));
  console.log('unlabelled controls  :', (body.match(/<input type="checkbox"/g) || []).length, 'checkbox(es)');
}

console.log('\n=== nav groups ===');
findLines(/id: '(offer|pages|emails|chrome|leads|media)'/).forEach((n) => {
  console.log('  ' + n + ': ' + lines[n - 1].trim());
});

console.log('\n=== media controls (Task C scoping) ===');
['FunnelMediaStudio', 'onGenerateImages', 'generateImages', 'bulkImage', 'imageSlot'].forEach((needle) => {
  const re = new RegExp(needle, 'g');
  const at = findLines(new RegExp(needle));
  console.log('  ' + needle.padEnd(18), count(re), at.length ? 'at ' + at.join(', ') : '');
});

console.log('\n=== media controls elsewhere in parts/ ===');
const partsDir = path.join('src', 'app', 'admin', 'sales-funnels', 'parts');
for (const f of fs.readdirSync(partsDir)) {
  const text = fs.readFileSync(path.join(partsDir, f), 'utf8');
  const hits = ['FunnelMediaStudio', 'onGenerateImages', 'MediaStudio', 'image'].filter((n) => text.includes(n));
  console.log('  ' + f.padEnd(20), hits.join(', ') || '-');
}

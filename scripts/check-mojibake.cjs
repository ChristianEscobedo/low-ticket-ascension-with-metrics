/**
 * Detect "?"-substitution mojibake in source files.
 *
 * CAUSE (confirmed): the file was decoded as UTF-8 and re-encoded to a
 * single-byte codepage with "?" substituted PER BYTE. So each run of "?"
 * maps to exactly one lost character, and the run length tells you what it was:
 *
 *   "???"  = 3 UTF-8 bytes  -> a BMP glyph: em dash, en dash, arrow, heart, check
 *   "????" = 4 UTF-8 bytes  -> an astral emoji: fire, speech balloon, thumbs up
 *
 * IMPORTANT: a bare "??" is almost always the TypeScript nullish-coalescing
 * operator (`x ?? 'default'`) and must NOT be touched. Two-byte mojibake does
 * exist but is rare, so "??" is reported separately and only when it sits
 * inside a string literal or JSX text rather than in an expression.
 *
 * Usage: node scripts/check-mojibake.cjs [--contexts]
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src', 'render-worker/remotion-project', 'remotion-project'];
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build']);
const SHOW_CONTEXTS = process.argv.includes('--contexts');

/** A "??" preceded by an identifier/paren/bracket is the ?? operator, not damage. */
const NULLISH_OPERATOR = /[\w$)\]'"`?]\s*$/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
const report = [];
let totalGlyphs = 0;
let totalEmoji = 0;
let totalSuspectPairs = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const hits = [];
  const re = /\?{2,}/g;
  let m;

  while ((m = re.exec(src))) {
    const run = m[0].length;
    const before = src.slice(Math.max(0, m.index - 40), m.index);

    if (run === 2) {
      if (NULLISH_OPERATOR.test(before)) continue; // real ?? operator
      totalSuspectPairs += 1;
    } else if (run === 4) {
      totalEmoji += 1;
    } else {
      totalGlyphs += 1;
    }

    const line = src.slice(0, m.index).split('\n').length;
    const after = src.slice(m.index + run, m.index + run + 24);
    hits.push({
      line,
      run,
      kind: run === 4 ? 'emoji' : run === 2 ? 'suspect-pair' : 'glyph',
      context: `${before.slice(-32)}<<<${m[0]}>>>${after}`.replace(/\s+/g, ' '),
    });
  }

  if (hits.length) report.push({ file, hits });
}

report.sort((a, b) => b.hits.length - a.hits.length);

console.log('=== "?" mojibake scan ===');
console.log(`files scanned:   ${files.length}`);
console.log(`files affected:  ${report.length}`);
console.log(`3-byte glyphs:   ${totalGlyphs}   (dashes / arrows / symbols)`);
console.log(`4-byte emoji:    ${totalEmoji}`);
console.log(`suspect "??":    ${totalSuspectPairs}  (excludes the ?? operator)`);
console.log('');

for (const { file, hits } of report) {
  const g = hits.filter((h) => h.kind === 'glyph').length;
  const e = hits.filter((h) => h.kind === 'emoji').length;
  const p = hits.filter((h) => h.kind === 'suspect-pair').length;
  console.log(`${String(hits.length).padStart(4)}  ${file}  (glyph:${g} emoji:${e} pair:${p})`);
  if (SHOW_CONTEXTS) {
    for (const h of hits) console.log(`        L${h.line} [${h.kind}] ${h.context}`);
  }
}

if (!SHOW_CONTEXTS && report.length) {
  console.log('\nRe-run with --contexts to see every occurrence.');
}

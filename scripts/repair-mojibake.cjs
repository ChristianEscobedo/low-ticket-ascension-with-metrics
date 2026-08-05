#!/usr/bin/env node
/**
 * Repair "?"-run mojibake in reel-studio source files.
 *
 * Background: a previous patch script rewrote these files through a non-UTF-8
 * encoding. Every byte of a multi-byte UTF-8 character became a literal "?".
 * Run length therefore tells us the size of the original character:
 *
 *   ??     -> 2-byte char (·)          BUT also the real ?? operator. Dangerous.
 *   ???    -> 3-byte char (— → … •)
 *   ????   -> 4-byte char (emoji)
 *   ?????? -> 6-byte char (emoji + variation selector, e.g. ❤️)
 *
 * Safety rules:
 *  - 2-char runs are ONLY replaced from an explicit literal whitelist, so the
 *    nullish-coalescing operator (`a ?? b`) is never touched.
 *  - 3-char runs use conservative context rules; anything that doesn't match a
 *    rule is left alone and reported, rather than guessed.
 *  - 4/6-char runs (emoji) are never auto-replaced. They need human intent.
 *
 * Usage:
 *   node scripts/repair-mojibake.cjs           # dry run, shows what it would do
 *   node scripts/repair-mojibake.cjs --write   # apply
 */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');

const FILES = [
  'src/app/(fullscreen)/admin/reel-studio/page.tsx',
  'src/app/(fullscreen)/admin/reel-studio/RenderPanel.tsx',
];

/**
 * Exact literal replacements for 2-char runs. Whitelist only — these are the
 * separator dots in display strings. Anything not listed here stays as `??`
 * because it is almost certainly the nullish-coalescing operator.
 */
const PAIR_WHITELIST = [
  ["Story ?? 15s cards", "Story · 15s cards"],
  ["% CTR ?? ", "% CTR · "],
  ["1 view ?? 1 minute ago", "1 view · 1 minute ago"],
  ["Just now ?? ", "Just now · "],
  ["Founder ?? 1h", "Founder · 1h"],
];

let totalPairs = 0;

let totalTriples = 0;
let totalLeft = 0;

for (const rel of FILES) {
  const abs = path.join(process.cwd(), rel);
  if (!fs.existsSync(abs)) {
    console.log(`skip (missing): ${rel}`);
    continue;
  }
  const before = fs.readFileSync(abs, 'utf8');
  let out = before;
  let pairs = 0;
  let triples = 0;

  for (const [from, to] of PAIR_WHITELIST) {
    const n = out.split(from).length - 1;
    if (n) {
      out = out.split(from).join(to);
      pairs += n;
    }
  }

  // 3-char runs, most specific rule first.
  // Ellipsis: attached to a word and closing a string.
  out = out.replace(/([A-Za-z0-9])\?\?\?(?=['"`])/g, (m, c) => (triples++, c + '…'));
  out = out.replace(/([A-Za-z0-9])\?\?\?(?=\s*\$\{)/g, (m, c) => (triples++, c + '…'));
  // Arrow: aligned ASCII-art in header comments (2+ spaces before).
  out = out.replace(/( {2,})\?\?\?( )/g, (m, a, b) => (triples++, a + '→' + b));
  // Em dash: single space either side (prose, comments, labels).
  out = out.replace(/ \?\?\? /g, () => (triples++, ' — '));

  const leftovers = [...out.matchAll(/\?{2,}/g)];
  const emoji = leftovers.filter((l) => l[0].length >= 4).length;
  const stillPairs = leftovers.filter((l) => l[0].length === 2).length;
  const stillTriples = leftovers.filter((l) => l[0].length === 3).length;

  totalPairs += pairs;
  totalTriples += triples;
  totalLeft += stillTriples;

  console.log(`\n${rel}`);
  console.log(`  fixed:  ${pairs} separator dots, ${triples} glyphs`);
  console.log(`  left:   ${stillTriples} unmatched 3-char runs (need review)`);
  console.log(`          ${emoji} emoji runs (intentionally untouched)`);
  console.log(`          ${stillPairs} two-char "??" (expected: real ?? operators)`);

  if (stillTriples) {
    console.log('  unmatched 3-char contexts:');
    for (const m of out.matchAll(/(.{20})\?\?\?(.{20})/gs)) {
      console.log('    ' + (m[1] + '[???]' + m[2]).replace(/\n/g, '\\n'));
    }
  }

  if (WRITE && out !== before) {
    fs.writeFileSync(abs, out, 'utf8');
    console.log('  -> written');
  }
}

console.log(
  `\n${WRITE ? 'Applied' : 'Dry run'}: ${totalPairs} dots + ${totalTriples} glyphs, ${totalLeft} left for review.`,
);
if (!WRITE) console.log('Re-run with --write to apply.');

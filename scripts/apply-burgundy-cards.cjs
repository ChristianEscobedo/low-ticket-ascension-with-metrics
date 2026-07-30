/**
 * Codemod: bring the 12 MotherMode admin pages onto the same burgundy card
 * treatment the legacy admin already uses:
 *
 *   rounded-2xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70
 *
 * Only touches *card* shells: class strings that contain `rounded-xl`/`rounded-2xl`
 * AND a `border-bone/10|15` token. Form fields (`focus:` / `placeholder`),
 * pills (`rounded-full`) and bare dividers (`border-b border-bone/10`, no
 * rounding) are deliberately left alone.
 *
 * Usage:
 *   node scripts/apply-burgundy-cards.cjs            # dry run, writes report
 *   node scripts/apply-burgundy-cards.cjs --write    # apply
 */
const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const REPORT = path.join('scripts', 'burgundy-cards-report.txt');

const TARGETS = [
  'brand-bible',
  'help',
  'community',
  'high-ticket',
  'lead-gen',
  'email-marketing',
  'funnels',
  'sales-funnels',
  'planner',
  'cta-analytics',
  'licenses',
  'receipt-log'
];

const GRADIENT = 'bg-gradient-to-br from-mode-deep/40 to-ink/70';

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Is this class string a card shell we should restyle? */
function isCardShell(cls) {
  if (!/border-bone\/1[05]\b/.test(cls)) return false;
  if (!/\brounded-(?:xl|2xl)\b/.test(cls)) return false;
  if (/rounded-full/.test(cls)) return false;
  // form fields / focusable inputs keep their flat, high-contrast shell
  if (/focus:|placeholder|outline-none|appearance-none/.test(cls)) return false;
  // modals need an opaque fill — a gradient would sit on top of bg-[#141210]
  if (/bg-\[#/.test(cls)) return false;
  // dashed empty-state placeholders stay unfilled
  if (/border-dashed/.test(cls)) return false;
  return true;
}

function restyle(cls) {
  // Nested sub-panels (bg-ink/20) sit *inside* a card: they get a quieter
  // brass edge instead of a second gradient, so the hierarchy still reads.
  if (/bg-ink\/20\b/.test(cls)) {
    return cls
      .replace(/border-bone\/1[05]\b/g, 'border-brass/10')
      .replace(/bg-ink\/20\b/, 'bg-ink/40')
      .replace(/\s{2,}/g, ' ');
  }

  let next = cls.replace(/border-bone\/1[05]\b/g, 'border-brass/15');

  // Swap whatever flat fill the card had for the burgundy gradient.
  const FILL = /bg-bone\/\[0\.0\d\]|bg-bone\/(?:5|10)\b|bg-ink\/(?:\d{2})\b|bg-ink\b/;
  if (FILL.test(next)) {
    next = next.replace(FILL, GRADIENT);
  } else {
    next = next.replace(/border-brass\/15\b/, `border-brass/15 ${GRADIENT}`);
  }


  // Collapse any duplicate gradient tokens introduced by repeat runs.
  next = next.replace(/(\bbg-gradient-to-br from-mode-deep\/40 to-ink\/70\b)(\s+\1)+/g, '$1');
  return next.replace(/\s{2,}/g, ' ');
}

const lines = [];
let filesChanged = 0;
let shellsChanged = 0;

for (const slug of TARGETS) {
  const dir = path.join('src', 'app', 'admin', slug);
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, 'utf8');
    let count = 0;

    // Match quoted class strings (single, double, or template literal chunks).
    const after = before.replace(/(['"`])((?:[^'"`\n\\]|\\.)*?)\1/g, (whole, q, body) => {
      if (!isCardShell(body)) return whole;
      const next = restyle(body);
      if (next === body) return whole;
      count += 1;
      lines.push(`${file}\n    -  ${body}\n    +  ${next}`);
      return `${q}${next}${q}`;
    });

    if (count) {
      filesChanged += 1;
      shellsChanged += count;
      if (WRITE) fs.writeFileSync(file, after);
    }
  }
}

const header = [
  WRITE ? 'MODE: write (files updated)' : 'MODE: dry run (no files written)',
  `files touched:  ${filesChanged}`,
  `card shells:    ${shellsChanged}`,
  ''
].join('\n');

fs.writeFileSync(REPORT, header + lines.join('\n') + '\n');
console.log(header);
console.log(`report -> ${REPORT}`);

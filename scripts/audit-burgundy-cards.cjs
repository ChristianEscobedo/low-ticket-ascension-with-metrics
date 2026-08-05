/**
 * Audit: which admin pages already use the burgundy (`mode`) card treatment
 * and which are still on the flat bone/ink card shell.
 *
 * Usage: node scripts/audit-burgundy-cards.cjs
 */
const fs = require('fs');
const path = require('path');

const ADMIN = path.join('src', 'app', 'admin');

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

// Card-ish container: rounded + border, on the flat bone shell.
const FLAT_CARD = /border-bone\/1[05]\b/g;
const MODE_HIT = /(?:border|bg|from|via|to|ring|shadow|text)-mode(?:\/|\[|-)?/g;

const rows = [];
for (const slug of TARGETS) {
  const dir = path.join(ADMIN, slug);
  if (!fs.existsSync(dir)) {
    rows.push({ slug, status: 'MISSING', files: 0, flat: 0, mode: 0 });
    continue;
  }
  const files = walk(dir);
  let flat = 0;
  let mode = 0;
  const detail = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const f = (text.match(FLAT_CARD) || []).length;
    const m = (text.match(MODE_HIT) || []).length;
    flat += f;
    mode += m;
    if (f || m) detail.push(`    ${path.relative(dir, file)}  flat=${f} mode=${m}`);
  }
  rows.push({ slug, status: 'ok', files: files.length, flat, mode, detail });
}

for (const row of rows) {
  console.log(
    `${row.slug.padEnd(16)} status=${row.status} files=${row.files} flatCardBorders=${row.flat} modeAccents=${row.mode}`
  );
  if (row.detail) console.log(row.detail.join('\n'));
}

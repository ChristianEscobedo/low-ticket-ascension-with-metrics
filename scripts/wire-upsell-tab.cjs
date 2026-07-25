/**
 * Wires SalesFunnelEditor.tsx to src/app/admin/sales-funnels/parts/UpsellTab.tsx:
 *   1. deletes the local `function UpsellTab(...)` (was lines 1384-1544)
 *   2. adds `import UpsellTab from './parts/UpsellTab';`
 *
 * Both happen in one write, so the file never has two UpsellTabs in scope.
 * Every assumption is asserted first — on any mismatch it prints why and exits
 * non-zero WITHOUT writing, because a half-applied edit here breaks the editor
 * for every funnel page.
 *
 * Idempotent: re-running after success is a no-op.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'SalesFunnelEditor.tsx');
const IMPORT_LINE = "import UpsellTab from './parts/UpsellTab';";

function die(msg) {
  console.error(`ABORTED (nothing written): ${msg}`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');
const before = src.split('\n').length;

if (src.includes(IMPORT_LINE)) {
  console.log('Already wired — import present. No change.');
  process.exit(0);
}

// --- locate the local component ------------------------------------------------
const startMatches = [...src.matchAll(/^function UpsellTab\(/gm)];
if (startMatches.length !== 1) {
  die(`expected exactly 1 top-level "function UpsellTab(", found ${startMatches.length}`);
}
const start = startMatches[0].index;

// It is immediately followed by the Field/Area/StatChip helpers.
const endRel = src.slice(start).search(/^function Field\(/m);
if (endRel === -1) {
  die('could not find the "function Field(" that should follow UpsellTab — file layout differs from the map in docs/SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md');
}
const end = start + endRel;

const removed = src.slice(start, end);
// Sanity-check that we grabbed the right region and not something larger.
for (const marker of ['Enable this upsell step', 'Gallery shots (src|alt|caption|hint', 'Regenerate this page']) {
  if (!removed.includes(marker)) die(`removal region is missing expected marker: ${marker}`);
}
if (removed.includes('export default function')) {
  die('removal region contains the default export — boundaries are wrong');
}
const removedLines = removed.split('\n').length - 1;
if (removedLines < 140 || removedLines > 175) {
  die(`removal region is ${removedLines} lines; expected ~161. Refusing to guess.`);
}

// --- find where the import block ends -----------------------------------------
const lines = src.split('\n');
let lastImport = -1;
for (let i = 0; i < Math.min(lines.length, 120); i += 1) {
  if (/^import\b/.test(lines[i])) lastImport = i;
}
if (lastImport === -1) die('found no top-level import lines to anchor the new import to');

// --- apply (delete first, then insert, so indices stay valid) -------------------
let out = src.slice(0, start) + src.slice(end);
const outLines = out.split('\n');
outLines.splice(lastImport + 1, 0, IMPORT_LINE);
out = outLines.join('\n');

if (([...out.matchAll(/^function UpsellTab\(/gm)]).length !== 0) {
  die('post-check: a local UpsellTab still exists');
}
if (!out.includes('<UpsellTab')) {
  die('post-check: no <UpsellTab call sites left — the four upsell tabs would render nothing');
}

fs.writeFileSync(FILE, out, 'utf8');
console.log(`Removed local UpsellTab: ${removedLines} lines`);
console.log(`Inserted after line ${lastImport + 1}: ${IMPORT_LINE}`);
console.log(`SalesFunnelEditor.tsx: ${before} -> ${out.split('\n').length} lines`);

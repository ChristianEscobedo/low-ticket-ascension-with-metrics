/**
 * Step 2 of the /admin/sales-funnels refactor.
 *
 * Wires SalesFunnelEditor.tsx to src/app/admin/sales-funnels/parts/SalesTab.tsx:
 *   1. replaces the inlined `{tab === 'sales' && (...)}` body (was lines
 *      1014-1213, ~200 lines) with a <SalesTab .../> call
 *   2. adds `import SalesTab from './parts/SalesTab';`
 *
 * Both happen in ONE write, so the file is never in a half-edited state.
 *
 * Why a script and not replace_in_file: that tool echoes the whole 1395-line
 * file back on success (~30k tokens). See docs/SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md §3a.
 *
 * Import anchoring: deliberately anchored on the single-line
 * `import UpsellTab from './parts/UpsellTab';`, NOT on /^import/ — this file has
 * multi-line `import { ... }` blocks and /^import/ matches their OPENING line,
 * which lands the new import inside the braces (TS1003/TS1005). That already
 * happened once in step 1.
 *
 * Every assumption is asserted first; on any mismatch it prints why and exits
 * non-zero WITHOUT writing. Idempotent: re-running after success is a no-op.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'SalesFunnelEditor.tsx');
const IMPORT_LINE = "import SalesTab from './parts/SalesTab';";
const ANCHOR = "import UpsellTab from './parts/UpsellTab';";

function die(msg) {
  console.error(`ABORTED (nothing written): ${msg}`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');
const beforeLines = src.split('\n').length;

if (src.includes(IMPORT_LINE)) {
  console.log('Already wired — import present. No change.');
  process.exit(0);
}

const eol = src.includes('\r\n') ? '\r\n' : '\n';

// --- locate the region ---------------------------------------------------------
// Start: the opening of the sales tab conditional. End: the opening of the vsl one.
const startRe = /\n[ \t]*\{tab === 'sales' && \(/;
const endRe = /\n[ \t]*\{tab === 'vsl' && \(/;

const startMatch = startRe.exec(src);
if (!startMatch) die("could not find the `{tab === 'sales' && (` line");
if (startRe.exec(src.slice(startMatch.index + 1))) {
  die("found more than one `{tab === 'sales' && (` — refusing to guess which is the tab body");
}

const endMatch = endRe.exec(src);
if (!endMatch) die("could not find the following `{tab === 'vsl' && (` line, which bounds the region");
if (endMatch.index <= startMatch.index) {
  die("the vsl tab appears BEFORE the sales tab — file layout differs from the map in docs/SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md");
}

// +1 to keep the newline that precedes the sales block.
const start = startMatch.index + 1;
const end = endMatch.index + 1;
const removed = src.slice(start, end);

// --- assert we grabbed exactly the sales body ----------------------------------
for (const marker of [
  'Full MotherMode long-form sales page',
  'Identity & media',
  'Bumps (id|title|description|price',
  'Regenerate this page',
  "onGeneratePage('sales')",
]) {
  if (!removed.includes(marker)) die(`removal region is missing expected marker: ${marker}`);
}
for (const stray of ["{tab === 'vsl'", "{tab === 'optin'", 'export default function', 'function UpsellTab(']) {
  if (removed.includes(stray)) die(`removal region unexpectedly contains "${stray}" — boundaries are wrong`);
}
const removedLines = removed.split('\n').length - 1;
if (removedLines < 185 || removedLines > 215) {
  die(`removal region is ${removedLines} lines; expected ~200. Refusing to guess.`);
}

// --- build the replacement -----------------------------------------------------
// Mirrors the original bar exactly: disabled on ANY busy, "Regenerating…" only
// while this page is the one regenerating.
const replacement = [
  "        {tab === 'sales' && (",
  '          <SalesTab',
  '            sales={sales}',
  '            setField={setSalesField}',
  "            onRegenerate={() => onGeneratePage('sales')}",
  "            regenBusy={busy === 'generatePage'}",
  '            disabled={busy !== null}',
  '          />',
  '        )}',
  '',
].join(eol);

let out = src.slice(0, start) + replacement + src.slice(end);

// --- insert the import ---------------------------------------------------------
if (!out.includes(ANCHOR)) die(`import anchor not found: ${ANCHOR}`);
out = out.replace(ANCHOR, ANCHOR + eol + IMPORT_LINE);

// --- post-checks ---------------------------------------------------------------
if (!out.includes('<SalesTab')) die('post-check: no <SalesTab call site — the sales tab would render nothing');
if (out.includes('Full MotherMode long-form sales page')) {
  die('post-check: the inlined sales body is still present');
}
if (([...out.matchAll(/^import SalesTab from/gm)]).length !== 1) {
  die('post-check: expected exactly one SalesTab import');
}
// Guard the exact trap from step 1: an import must not have landed inside a
// multi-line import block.
const importLineIdx = out.split('\n').findIndex((l) => l.startsWith('import SalesTab from'));
const preceding = out.split('\n').slice(0, importLineIdx).join('\n');
// Count only MULTI-line openings: `import {` with no closing `}` on the same
// line. `import { useEffect } from 'react';` opens and closes on one line and
// must not be counted, or this check false-positives and blocks a valid write.
const opens = (preceding.match(/^import \{(?![^\n]*\})/gm) || []).length;
const closes = (preceding.match(/^\} from /gm) || []).length;

if (opens !== closes) {
  die(`post-check: the new import landed inside an unclosed multi-line import block (${opens} opens vs ${closes} closes)`);
}

fs.writeFileSync(FILE, out, 'utf8');
console.log(`Replaced inlined sales body: ${removedLines} lines -> 9 lines`);
console.log(`Inserted after "${ANCHOR}": ${IMPORT_LINE}`);
console.log(`SalesFunnelEditor.tsx: ${beforeLines} -> ${out.split('\n').length} lines`);

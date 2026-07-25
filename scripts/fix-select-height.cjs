/**
 * Point every <select> in the sales-funnel editor at `selectClass`.
 *
 * WHY: a native <select> adds its own internal padding on top of the shared
 * `inputClass` (`px-3 py-2 text-sm`), so it rendered ~4px taller than the
 * <input> beside it. Inside `grid gap-3 sm:grid-cols-2` the row grows to its
 * tallest cell, so one select dragged its whole row out of alignment and read
 * as "overlapping fields" on the Offer tab. `selectClass` pins both to 38px.
 *
 * Idempotent: re-running reports 0 changes. Safe to leave in the tree.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'parts');

const FILES = ['UpsellTab.tsx', 'PageTabs.tsx', 'OfferTab.tsx', 'EmailsTab.tsx'];

// Only <select> elements. Inputs and textareas must keep inputClass: textareas
// in particular need to stay free to grow (min-h-[80px] resize-y).
const SELECT_RE = /(<select\b[^>]*?className=\{)inputClass(\})/g;

let totalSwaps = 0;
let totalImports = 0;
const report = [];

for (const file of FILES) {
  const full = path.join(DIR, file);
  if (!fs.existsSync(full)) {
    report.push(`  ${file}: MISSING - skipped`);
    continue;
  }

  const before = fs.readFileSync(full, 'utf8');
  let after = before.replace(SELECT_RE, '$1selectClass$2');
  const swaps = (before.match(SELECT_RE) || []).length;

  // Add selectClass to the existing ./ui import if we introduced a use of it.
  let importAdded = false;
  if (after.includes('selectClass')) {
    const importRe = /import\s*\{([^}]*)\}\s*from\s*(['"])\.\/ui\2/;
    const m = after.match(importRe);
    if (m && !/\bselectClass\b/.test(m[1])) {
      // Insert next to inputClass so the related names stay adjacent.
      const names = m[1];
      const updated = /\binputClass\b/.test(names)
        ? names.replace(/\binputClass\b/, 'inputClass, selectClass')
        : names.replace(/\s*$/, ', selectClass');
      after = after.replace(importRe, `import {${updated}} from '${'.'}/ui'`);
      importAdded = true;
    } else if (!m) {
      report.push(`  ${file}: !! uses selectClass but no './ui' import found - FIX BY HAND`);
    }
  }

  if (after !== before) {
    fs.writeFileSync(full, after, 'utf8');
  }

  totalSwaps += swaps;
  if (importAdded) totalImports += 1;
  report.push(
    `  ${file}: ${swaps} select(s) swapped${importAdded ? ', import updated' : ''}${
      swaps === 0 && !importAdded ? ' (already done)' : ''
    }`
  );
}

console.log('select -> selectClass');
console.log(report.join('\n'));
console.log(`\ntotal: ${totalSwaps} select(s), ${totalImports} import(s) updated`);
if (totalSwaps === 0 && totalImports === 0) {
  console.log('no-op: every <select> already uses selectClass');
}

// Leftover check: any <select> still on inputClass anywhere under parts/.
const stragglers = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.tsx')) continue;
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (/<select\b[^>]*?className=\{inputClass\}/.test(src)) stragglers.push(f);
}
console.log(
  stragglers.length
    ? `\nWARNING still on inputClass: ${stragglers.join(', ')}`
    : '\nverified: no <select> left on inputClass'
);

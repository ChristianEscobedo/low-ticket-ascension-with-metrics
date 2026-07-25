/**
 * Fixes a copy bug introduced by the step-2 extraction.
 *
 * SalesTab's RegenerateBar says "Rewrite this page from the Offer tab stack."
 * but the Build -> Offer rename does not happen until step 5. Until then that
 * sentence points the user at a tab that is not in the UI. Restore "Build tab".
 *
 * Step 5 should change it back, together with the actual rename.
 *
 * Idempotent; asserts before writing.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'parts', 'SalesTab.tsx');
const WRONG = 'Rewrite this page from the Offer tab stack.';
const RIGHT = 'Rewrite this page from the Build tab offer stack.';

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes(RIGHT) && !src.includes(WRONG)) {
  console.log('Already correct. No change.');
  process.exit(0);
}

const hits = src.split(WRONG).length - 1;
if (hits !== 1) {
  console.error(`ABORTED (nothing written): expected exactly 1 occurrence of the label, found ${hits}`);
  process.exit(1);
}

fs.writeFileSync(FILE, src.replace(WRONG, RIGHT), 'utf8');
console.log(`Label restored to: "${RIGHT}"`);
console.log('Step 5 must update this string when it renames Build -> Offer.');

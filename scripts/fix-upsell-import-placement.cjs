/**
 * Repairs wire-upsell-tab.cjs's one bad assumption: it inserted the new import
 * after the last line MATCHING /^import\b/, but this file uses multi-line
 * `import {` blocks, so that line was the OPENING of a block — the import landed
 * inside it (line 44), producing TS1003/TS1005 syntax errors.
 *
 * Correct anchor: after the closing `} from '...';` of the LAST import block.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'app', 'admin', 'sales-funnels', 'SalesFunnelEditor.tsx');
const BAD = "import {\nimport UpsellTab from './parts/UpsellTab';\n";
const ANCHOR = "} from '@/lib/mothermode/sales/aiIntake';\n";

const src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

if (!src.includes(BAD)) {
  console.error('ABORTED: misplaced import not found in the expected shape — inspect lines 40-55 by hand.');
  process.exit(1);
}
if (!src.includes(ANCHOR)) {
  console.error('ABORTED: could not find the aiIntake import block to anchor after.');
  process.exit(1);
}

// 1. restore the mangled import block opener
let out = src.replace(BAD, 'import {\n');
// 2. re-insert the import after the last import block closes
out = out.replace(ANCHOR, `${ANCHOR}import UpsellTab from './parts/UpsellTab';\n`);

const count = (out.match(/^import UpsellTab from '\.\/parts\/UpsellTab';$/gm) || []).length;
if (count !== 1) {
  console.error(`ABORTED: expected exactly 1 UpsellTab import after fix, got ${count}`);
  process.exit(1);
}

fs.writeFileSync(FILE, out, 'utf8');
console.log('Moved the UpsellTab import out of the multi-line import block, to after the aiIntake block.');

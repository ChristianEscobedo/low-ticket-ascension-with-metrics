/**
 * Step 1 of wiring the Asset Hub Systems tab.
 *
 * (a) Cleans the stray blank lines the editor inserted into `assets/types.ts`
 *     when `systems` was added to `AssetTabId` / `ASSET_TABS`.
 * (b) Prints the two anchors in `AssetsWorkspace.tsx` that the Systems tab has
 *     to hook into — the `Record<AssetTabId, number>` counts object (the thing
 *     that broke last attempt) and wherever tab bodies are rendered — with line
 *     numbers, so the follow-up patch is exact instead of guessed.
 */
const fs = require('fs');

const TYPES = 'src/lib/mothermode/assets/types.ts';
const WS = 'src/app/admin/assets/AssetsWorkspace.tsx';

let types = fs.readFileSync(TYPES, 'utf8');
const before = types;
types = types.replace(/(\|\s*'ads'\r?\n)\r?\n/, '$1');
types = types.replace(/(\{ id: 'funnels', label: 'Funnels' \},\r?\n)\r?\n/, '$1');
if (types !== before) {
  fs.writeFileSync(TYPES, types);
  console.log('cleaned blank lines in types.ts');
} else {
  console.log('types.ts already clean');
}

const lines = fs.readFileSync(WS, 'utf8').split(/\r?\n/);
const show = (label, test, pad) => {
  console.log(`\n===== ${label} =====`);
  lines.forEach((line, i) => {
    if (!test(line)) return;
    const from = Math.max(0, i - pad[0]);
    const to = Math.min(lines.length - 1, i + pad[1]);
    for (let n = from; n <= to; n++) console.log(`${n + 1} | ${lines[n]}`);
    console.log('---');
  });
};

show('imports from lib/mothermode/assets', (l) => l.includes('mothermode/assets'), [0, 0]);
show('counts record (Record<AssetTabId, number>)', (l) => /AssetTabId,\s*number/.test(l), [4, 16]);
show('tab body rendering', (l) => /tab === '|activeTab ===/.test(l), [1, 2]);

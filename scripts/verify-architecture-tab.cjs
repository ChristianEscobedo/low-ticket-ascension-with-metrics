/**
 * Verification for the Architecture tab wiring.
 *
 * Reports what is actually true rather than what the patch intended: whether
 * every anchor landed, and whether tsc reports errors in the touched modules.
 * The repo has pre-existing errors elsewhere, so the count is split.
 */
const fs = require('fs');
const { execSync } = require('child_process');

const EDITOR = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
const editor = fs.readFileSync(EDITOR, 'utf8');

const checks = [
  ["Tab union has 'architecture'", /type Tab =[^;]*'architecture'/.test(editor)],
  ['ArchitectureTab imported', editor.includes("import ArchitectureTab from './parts/ArchitectureTab'")],
  ['OFFER_TABS declared', editor.includes('const OFFER_TABS')],
  ['Offer group uses OFFER_TABS', editor.includes("label: 'Offer', tabs: OFFER_TABS.map")],
  ['Offer sub-nav renders', editor.includes("activeGroup.id === 'offer' && (")],
  ['Panel rendered with intake', editor.includes("{tab === 'architecture' && <ArchitectureTab intake={intake} />}")],
  ['Panel file exists', fs.existsSync('src/app/admin/sales-funnels/parts/ArchitectureTab.tsx')],
];

let ok = true;
for (const [label, pass] of checks) {
  if (!pass) ok = false;
  console.log((pass ? 'PASS  ' : 'FAIL  ') + label);
}

console.log('');
let out = '';
try {
  out = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  out = (e.stdout || '') + (e.stderr || '');
}
const errors = out.split(/\r?\n/).filter((l) => l.includes('error TS'));
const touched = errors.filter((l) =>
  /ArchitectureTab|SalesFunnelEditor|intakeAscension|sales[\\/]ascension|funnelMap/i.test(l),
);
console.log('tsc errors, whole repo:      ' + errors.length);
console.log('tsc errors, touched modules: ' + touched.length);
touched.slice(0, 20).forEach((l) => console.log('  ' + l));

console.log('');
console.log(ok && touched.length === 0 ? 'RESULT: wiring verified' : 'RESULT: needs attention');

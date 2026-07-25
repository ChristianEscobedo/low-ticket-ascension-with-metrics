/**
 * Step 7 of the SalesFunnelEditor refactor: move the footer body into
 * parts/ChromeTab.tsx.
 *
 * This is the last body to leave the shell, which makes it the step that also
 * removes the shell's private copies of Field/Area/StatChip. Field and Area are
 * used *only* by the footer body, so they go with it. StatChip is used by the
 * always-mounted readiness strip, so it stays needed -- and the shell has no
 * './parts/ui' import at all today, so one has to be added or the readiness
 * strip loses its chip and the file will not compile.
 *
 * Every assertion below runs before anything is written. On any failure the
 * file on disk is untouched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHELL = path.join(ROOT, 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
const PART = path.join(ROOT, 'src/app/admin/sales-funnels/parts/ChromeTab.tsx');
const UI = path.join(ROOT, 'src/app/admin/sales-funnels/parts/ui.tsx');

const fail = (msg) => {
  console.error('FAIL: ' + msg);
  console.error('nothing written.');
  process.exit(1);
};
const ok = (msg) => console.log('  ok   ' + msg);

const SELF_TEST = process.argv.includes('--self-test');

let src = SELF_TEST ? '' : fs.readFileSync(SHELL, 'utf8');
const part = SELF_TEST ? '' : fs.readFileSync(PART, 'utf8');
const ui = SELF_TEST ? '' : fs.readFileSync(UI, 'utf8');

/**
 * `node scripts/wire-chrome-tab.cjs --self-test`
 *
 * Exercises the real findFunction (hoisted, defined below) against the exact
 * signature shape that defeated the first version. Without this the matcher fix
 * would be reasoning only -- and reasoning is what produced the bug.
 */
if (SELF_TEST) {
  const sample = [
    'const before = 1;',
    '',
    'function Field({ label, value, onChange, placeholder }',
    ': { label: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {',
    '  return <div>{label}</div>;',
    '}',
    '',
    'const after = 2;',
    '',
  ].join('\n');

  const loc = findFunction(sample, 'Field');
  if (!loc) fail('self-test: findFunction returned null');
  const cut = sample.slice(loc.start, loc.end);
  const remainder = sample.slice(0, loc.start) + sample.slice(loc.end);

  if (!cut.startsWith('function Field(')) fail('self-test: cut does not start at the declaration');
  if (!cut.trimEnd().endsWith('}')) fail('self-test: cut does not end at the body brace');
  if (!cut.includes('return <div>{label}</div>;')) fail('self-test: cut omitted the body');
  if (/\n\s*: \{/.test(remainder)) fail('self-test: remainder still holds an orphaned signature tail');
  if (!remainder.includes('const before = 1;') || !remainder.includes('const after = 2;')) {
    fail('self-test: cut damaged surrounding code');
  }
  ok('self-test: multiline destructured signature cut cleanly (' + cut.split('\n').length + ' lines)');
  console.log('self-test passed.');
  process.exit(0);
}

if (src.includes('\r\n')) fail('shell has CRLF endings; this script assumes LF');


/* -- idempotence ---------------------------------------------------------- */
if (src.includes("from './parts/ChromeTab'")) {
  console.log('already wired (ChromeTab import present). no-op.');
  process.exit(0);
}

/* -- the part must actually carry the footer over -------------------------- */
const LABELS = [
  'Brand line',
  'Disclaimer / advertising disclosure',
  'Footer links (label|href, one per line)',
  'Copyright',
];
for (const l of LABELS) {
  if (!part.includes(l)) fail('ChromeTab.tsx is missing the "' + l + '" control');
}
ok('ChromeTab carries all 4 labelled controls');

// The enabled checkbox is the one unlabelled control in the original body; it is
// the easiest thing to silently drop, so it gets its own assertion.
if (!/type="checkbox"/.test(part) || !/footer\.enabled/.test(part)) {
  fail('ChromeTab.tsx is missing the footer.enabled checkbox');
}
ok('ChromeTab carries the enabled checkbox');

if (/useState|useEffect|useRef/.test(part)) {
  fail('ChromeTab.tsx declares state; parts must be stateless (see step 6 autobuild bug)');
}
ok('ChromeTab is stateless');

for (const name of ['Field', 'Area', 'panelClass', 'StatChip']) {
  if (!new RegExp('export (function|const) ' + name + '\\b').test(ui)) {
    fail('parts/ui.tsx does not export ' + name);
  }
}
ok('parts/ui.tsx exports Field, Area, panelClass, StatChip');

/* -- locate the footer body ------------------------------------------------ */
/**
 * Walks a balanced {...} JSX expression, skipping string literals so that a
 * bracket inside e.g. a placeholder cannot throw the depth count off.
 */
function matchBraces(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const openMatches = [...src.matchAll(/\{tab === 'footer' && \(/g)];
if (openMatches.length !== 1) {
  fail('expected exactly 1 footer body opener, found ' + openMatches.length);
}
const bodyStart = openMatches[0].index;
const bodyEnd = matchBraces(src, bodyStart);
if (bodyEnd === -1) fail('could not brace-match the footer body');
const body = src.slice(bodyStart, bodyEnd + 1);
ok('footer body isolated (' + body.split('\n').length + ' lines)');

// Everything the body touched must be represented in the part.
for (const key of ['enabled', 'brandLine', 'disclaimer', 'links', 'copyright']) {
  if (!body.includes(key)) fail('footer body unexpectedly lacks key ' + key);
  if (!part.includes(key)) fail('ChromeTab.tsx does not handle footer key ' + key);
}
ok('all 5 footer keys accounted for in ChromeTab');

/* -- Field/Area must be footer-only before we delete them ------------------ */
const fieldAll = (src.match(/<Field\b/g) || []).length;
const areaAll = (src.match(/<Area\b/g) || []).length;
const fieldInBody = (body.match(/<Field\b/g) || []).length;
const areaInBody = (body.match(/<Area\b/g) || []).length;
if (fieldAll !== fieldInBody) {
  fail('<Field used outside the footer body (' + fieldAll + ' total, ' + fieldInBody + ' in body); cannot delete the local def');
}
if (areaAll !== areaInBody) {
  fail('<Area used outside the footer body (' + areaAll + ' total, ' + areaInBody + ' in body); cannot delete the local def');
}
ok('<Field (' + fieldAll + ') and <Area (' + areaAll + ') are footer-body-only');

const statChipUses = (src.match(/<StatChip\b/g) || []).length;
if (statChipUses === 0) fail('no <StatChip uses found; the ui import would be dead');
if ((body.match(/<StatChip\b/g) || []).length !== 0) {
  fail('StatChip used inside the footer body; scope assumption wrong');
}
ok('<StatChip used ' + statChipUses + 'x, all outside the footer body -> needs ui import');

/* -- locate the three local defs ------------------------------------------- */
/** Balanced (...) walk, same string-skipping rules as matchBraces. */
function matchParens(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * These three functions take a destructured param with an inline type:
 *
 *   function Field({ label, value, onChange, placeholder }
 *   : { label: string; ... }) {
 *
 * so the FIRST `{` after the name opens the destructuring pattern, not the
 * body. Brace-matching from there returns after the pattern and leaves the
 * `: {...}) { ... }` tail orphaned in the file -- valid-looking to a line
 * count, fatal to the parser. Paren-match the parameter list first, then take
 * the next `{`; that is unambiguously the body.
 */
function findFunction(text, name) {
  const m = new RegExp('\\nfunction ' + name + '\\b').exec(text);
  if (!m) return null;
  const start = m.index + 1;
  const parenOpen = text.indexOf('(', start);
  const parenClose = matchParens(text, parenOpen);
  if (parenClose === -1) return null;
  const braceOpen = text.indexOf('{', parenClose);
  if (braceOpen === -1) return null;
  const end = matchBraces(text, braceOpen);
  if (end === -1) return null;
  return { start, end: end + 1 };
}


const defs = {};
for (const name of ['Field', 'Area', 'StatChip']) {
  const hits = (src.match(new RegExp('\\nfunction ' + name + '\\b', 'g')) || []).length;
  if (hits !== 1) fail('expected exactly 1 local `function ' + name + '`, found ' + hits);
  const loc = findFunction(src, name);
  if (!loc) fail('could not brace-match local function ' + name);
  defs[name] = loc;
}
ok('located local Field / Area / StatChip definitions');

/* -- anchors --------------------------------------------------------------- */
const IMPORT_ANCHOR = "import LeadsTab from './parts/LeadsTab';";
const SETTER_ANCHOR =
  '  function setAccessField<K extends keyof AccessContent>(key: K, value: AccessContent[K]) { setAccess((prev) => ({ ...prev, [key]: value })); }';
for (const [label, anchor] of [['import', IMPORT_ANCHOR], ['setter', SETTER_ANCHOR]]) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) fail(label + ' anchor matched ' + n + ' times, expected 1');
}
ok('import + setter anchors are unique');

/* -- apply (highest offset first so earlier indices stay valid) ------------ */
const cuts = [defs.StatChip, defs.Area, defs.Field].sort((a, b) => b.start - a.start);
for (const c of cuts) src = src.slice(0, c.start) + src.slice(c.end);

src = src.slice(0, bodyStart) +
  '{tab === \'footer\' && <ChromeTab footer={footer} setField={setFooterField} />}' +
  src.slice(bodyEnd + 1);

src = src.replace(
  IMPORT_ANCHOR,
  IMPORT_ANCHOR +
    "\nimport ChromeTab from './parts/ChromeTab';" +
    "\nimport { StatChip } from './parts/ui';",
);

src = src.replace(
  SETTER_ANCHOR,
  SETTER_ANCHOR +
    '\n  function setFooterField<K extends keyof SalesFooterContent>(key: K, value: SalesFooterContent[K]) { setFooter((prev) => ({ ...prev, [key]: value })); }',
);

/* -- post-conditions ------------------------------------------------------- */
if ((src.match(/<Field\b/g) || []).length !== 0) fail('post: <Field still present');
if ((src.match(/<Area\b/g) || []).length !== 0) fail('post: <Area still present');
if ((src.match(/\nfunction (Field|Area|StatChip)\b/g) || []).length !== 0) {
  fail('post: a local primitive def survived');
}
if ((src.match(/<StatChip\b/g) || []).length !== statChipUses) {
  fail('post: StatChip use count changed');
}
if (!src.includes('<ChromeTab footer={footer} setField={setFooterField} />')) {
  fail('post: ChromeTab call site missing');
}
if ((src.match(/setFooterField/g) || []).length !== 2) {
  fail('post: expected exactly 2 setFooterField mentions (def + call site)');
}

// The first run of this script cut each def mid-signature and left the
// `: { label: string; ... }) {` tail behind. Nothing above noticed, because the
// orphan no longer starts with `function` and contains no <Field/<Area. tsc
// caught it, which is the wrong place to catch it -- a line-count check would
// have called the result a success. Assert directly on the shape of the wound.
const orphans = (src.match(/\n\s*: \{/g) || []).length;
if (orphans !== 0) {
  fail('post: ' + orphans + ' orphaned signature tail(s) -- a def was cut mid-signature');
}
// Cheap whole-file sanity: a correct cut leaves braces balanced.
let depth = 0;
for (const c of src) {
  if (c === '{') depth++;
  else if (c === '}') depth--;
}
console.log('  note brace delta (informational, strings/JSX not excluded): ' + depth);
ok('post-conditions pass');


/* Trailing consts that only the deleted primitives used would now be dead. */
for (const name of ['inputClass', 'labelClass']) {
  const uses = (src.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
  console.log('  note ' + name + ': ' + uses + ' remaining mention(s)' + (uses <= 1 ? '  <-- now dead, declaration only' : ''));
}

fs.writeFileSync(SHELL, src);
console.log('\nwrote ' + path.relative(ROOT, SHELL));
console.log('lines: ' + src.split('\n').length);

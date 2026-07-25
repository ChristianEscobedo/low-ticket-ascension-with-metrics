/**
 * Loose end from SALES_FUNNEL_EDITOR_EMAILS_TAB_TASK.md: the five short page
 * tabs pass `busy` but no `disabled`, so their Regenerate button stays clickable
 * while a *different* job runs — a second POST on top of an in-flight one.
 * `RegenerateBar` already supports `disabled`; this just wires it through.
 *
 * Idempotent, and asserts every count before writing.
 *
 * Usage: node scripts/fix-page-regen-disabled.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TABS = path.join(ROOT, 'src/app/admin/sales-funnels/parts/PageTabs.tsx');
const SHELL = path.join(ROOT, 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');

function die(m) {
  console.error('FAIL: ' + m);
  process.exit(1);
}

let tabs = fs.readFileSync(TABS, 'utf8');
let shell = fs.readFileSync(SHELL, 'utf8');

if (tabs.includes('disabled?: boolean;') && shell.includes("busy === 'generatePage'} disabled=")) {
  console.log('no-op: page regenerate bars already take disabled.');
  process.exit(0);
}

// 1. Common gains the prop.
const commonAnchor = 'interface Common {\n  onRegenerate: () => void;\n  busy?: boolean;\n}';
const commonAnchorCrlf = commonAnchor.replace(/\n/g, '\r\n');
if (tabs.includes(commonAnchor)) {
  tabs = tabs.replace(
    commonAnchor,
    'interface Common {\n  onRegenerate: () => void;\n  /** This page is regenerating. */\n  busy?: boolean;\n  /** Any job is running — blocks a second overlapping POST. */\n  disabled?: boolean;\n}',
  );
} else if (tabs.includes(commonAnchorCrlf)) {
  tabs = tabs.replace(
    commonAnchorCrlf,
    'interface Common {\r\n  onRegenerate: () => void;\r\n  /** This page is regenerating. */\r\n  busy?: boolean;\r\n  /** Any job is running — blocks a second overlapping POST. */\r\n  disabled?: boolean;\r\n}',
  );
} else {
  die('Common interface not found in PageTabs.tsx');
}

// 2. Each of the five components destructures and forwards it.
const destructures = tabs.match(/, onRegenerate, busy \}/g) || [];
if (destructures.length !== 5) die('expected 5 destructures, found ' + destructures.length);
tabs = tabs.replace(/, onRegenerate, busy \}/g, ', onRegenerate, busy, disabled }');

const bars = tabs.match(/<RegenerateBar onRegenerate=\{onRegenerate\} busy=\{busy\} \/>/g) || [];
if (bars.length !== 5) die('expected 5 RegenerateBar usages, found ' + bars.length);
tabs = tabs.replace(
  /<RegenerateBar onRegenerate=\{onRegenerate\} busy=\{busy\} \/>/g,
  '<RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />',
);

// 3. The shell passes the whole-editor busy flag.
const calls = shell.match(/busy=\{busy === 'generatePage'\} \/>\}/g) || [];
if (calls.length !== 5) die('expected 5 page tab call sites, found ' + calls.length);
shell = shell.replace(
  /busy=\{busy === 'generatePage'\} \/>\}/g,
  "busy={busy === 'generatePage'} disabled={busy !== null} />}",
);

fs.writeFileSync(TABS, tabs);
fs.writeFileSync(SHELL, shell);
console.log('patched: 5 page Regenerate bars now disable while any job runs.');

/**
 * Records step 7 (Chrome/footer extraction) in the refactor port doc, and
 * corrects the two facts step 7 changed: the shell line count, and the
 * scope of the "Media" half of the Chrome & Media group.
 *
 * Also repairs the blank lines that a replace_in_file pass left inside the
 * parts table in section 2 (a blank line inside a GFM table ends the table).
 *
 * Idempotent: exits 0 with "already applied" if the step-7 row is present.
 * Asserts every anchor before writing; writes nothing if any is missing.
 */
const fs = require('fs');

const DOC = 'docs/SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md';
let s = fs.readFileSync(DOC, 'utf8');

if (s.includes('| 7 | Footer/Chrome body')) {
  console.log('already applied — no changes written');
  process.exit(0);
}

const fail = (m) => {
  console.error('ABORT (nothing written): ' + m);
  process.exit(1);
};

// --- assertions -------------------------------------------------------------
const anchors = {
  uiRowBlank: '`linesToList` / `listToLines` helpers. As of step 7 the shell holds **no**\nlocal copies',
  chromeRow: "| `ChromeTab.tsx` | The funnel footer:",
  step6Row: '| 6 | Emails/kit-binding + analytics',
  shellCount: '`SalesFunnelEditor.tsx` (1059 lines)',
  gap2: '2. The Chrome/footer body is still inline.',
  gap4: '4. The Media group from the original plan was never started.',
  sec7: '## 7. Porting this pattern to another admin editor',
};
for (const [k, v] of Object.entries(anchors)) {
  if (k === 'uiRowBlank') continue; // whitespace-sensitive, handled below
  if (!s.includes(v)) fail(`missing anchor "${k}": ${v.slice(0, 60)}`);
}

// --- 1. repair blank lines inside the section-2 table ----------------------
// A blank line between two table rows terminates the table in GFM.
// Line-based and line-ending agnostic: this file is CRLF, so \n-anchored
// regexes silently match nothing (which is how the guard caught this).
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
let lines = s.split(/\r?\n/);

const isRow = (l) => l.trimStart().startsWith('|');
const kept = [];
let removedBlanks = 0;
for (let i = 0; i < lines.length; i++) {
  const blankBetweenRows =
    lines[i].trim() === '' &&
    isRow(kept[kept.length - 1] || '') &&
    isRow(lines[i + 1] || '');
  if (blankBetweenRows) {
    removedBlanks++;
    continue;
  }
  kept.push(lines[i]);
}
lines = kept;
s = lines.join(EOL);
if (removedBlanks === 0) console.log('  (note: no in-table blank lines found)');
else console.log(`  (removed ${removedBlanks} blank line(s) inside tables)`);

// The table must survive as one block: assert the parts table still has every row.
for (const row of ['`ui.tsx`', '`OfferTab.tsx`', '`ChromeTab.tsx`', '`LeadsTab.tsx`']) {
  if (!s.includes('| ' + row + ' |')) fail('lost parts-table row ' + row);
}


// --- 2. shell line count ---------------------------------------------------
s = s.replace('`SalesFunnelEditor.tsx` (1059 lines)', '`SalesFunnelEditor.tsx` (1043 lines)');

// --- 3. step 7 row ---------------------------------------------------------
const step6Line = s.split('\n').find((l) => l.startsWith(anchors.step6Row));
if (!step6Line) fail('could not isolate the step 6 table row');
s = s.replace(
  step6Line,
  step6Line + '\n| 7 | Footer/Chrome body → `ChromeTab` | 1059 → **1043** |'
);

// --- 4. gap 2 → closed ----------------------------------------------------
const gap2Start = s.indexOf(anchors.gap2);
const gap2End = s.indexOf('3. ~~The Emails / kit-binding block', gap2Start);
if (gap2End < 0) fail('could not find the end of gap 2');
s =
  s.slice(0, gap2Start) +
  `2. ~~The Chrome/footer body is still inline.~~ **Closed** — extracted to
   \`parts/ChromeTab.tsx\` (79 lines) by \`scripts/wire-chrome-tab.cjs\`. The type is
   the real \`SalesFooterContent\`, imported, not a structural stand-in — the
   \`setFooter\` write path makes a loose shape unsound. The shell's last local
   \`Field\` / \`Area\` / \`StatChip\` copies went with it; \`StatChip\` moved to
   \`parts/ui.tsx\` because the readiness chips still use it. Confirmed there is no
   \`setHeader\` anywhere in the shell, so "Chrome" is footer-only despite the group
   name — the group is a single tab, not a sub-tab pair (§6.2).
` +
  s.slice(gap2End);

// --- 5. gap 4 → rescoped --------------------------------------------------
const gap4Start = s.indexOf(anchors.gap4);
const gap4End = s.indexOf('### 6.1 The Emails group', gap4Start);
if (gap4End < 0) fail('could not find the end of gap 4');
s =
  s.slice(0, gap4Start) +
  `4. **The Media group does not exist to be built.** Scoped before building, per the
   rule above, and the scoping is the result: \`tab === 'media'\` appears **zero**
   times in the shell, and \`FunnelMediaStudio\` is imported **only** by the six
   public funnel page components (\`SalesPage\`, \`VslPage\`, \`CheckoutPage\`,
   \`AccessPage\`, \`UpsellPage\`, \`SalesOptinPage\`) — never by the admin editor.
   Media editing is inline-on-the-page, reached from the live funnel, not from a tab
   here. There is no admin-side media body to extract, so this item is **void as
   written** rather than pending. Anyone reviving it is proposing to *build* a new
   admin media tab, which is a feature, not a refactor step.

`+
  s.slice(gap4End);

// --- 6. new section 6.2 ---------------------------------------------------
const sec7At = s.indexOf(anchors.sec7);
s =
  s.slice(0, sec7At) +
  `### 6.2 Chrome is footer-only, and the brace-matching bug

The group is named "Chrome" but there is no header editor: \`setHeader\` appears
nowhere in the shell, and the inline body held exactly one content object,
\`SalesFooterContent\`. So \`Chrome\` is a single tab, not a sub-tab pair — do not add a
\`Header\` sub-tab to match the name.

The extraction tripped the one guard that had not fired before. Rule 2 (find the
\`)}\` at the same indent as the \`{tab === '…' && (\` opener) is not sufficient when the
body is the **last** tab in the file and is followed by the component's own closing
braces: the naive same-indent scan ran past the body's end and swallowed the shell's
trailing \`);\` / \`}\`, leaving orphaned signature remnants that \`tsc\` reported as a
dozen unrelated syntax errors far from the real cause. The fix in
\`wire-chrome-tab.cjs\` is to match braces by *depth* from the opener rather than by
indentation, and to assert the extracted region both starts with \`{tab ===\` and ends
with a balanced \`)}\` before deleting anything. Indentation is a formatting
convention; brace depth is the actual structure. Prefer depth for any body that might
be last in its file.

`+
  s.slice(sec7At);

fs.writeFileSync(DOC, s);
console.log('patched ' + DOC);
console.log('  - repaired section-2 table blank lines');
console.log('  - shell 1059 -> 1043');
console.log('  - added step 7 row');
console.log('  - gap 2 closed, gap 4 rescoped as void');
console.log('  - added section 6.2');

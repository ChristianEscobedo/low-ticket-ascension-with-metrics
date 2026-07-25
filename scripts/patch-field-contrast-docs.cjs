const fs = require('fs');

const PORT_INSERT = `

**Field sheet contrast (post-chrome UX fix)**

Bottom edit sheets must use real form controls — not bare \`<Editable>\` hover targets — or labels/values wash out on \`bg-bone\`.

| Rule | Detail |
|------|--------|
| Sheet container | \`bg-bone/95 text-ink shadow-2xl backdrop-blur\` (explicit \`text-ink\`) |
| Sheet \`Field\` helper | \`<input>\` / \`<textarea>\` with \`bg-white text-ink border-ink/15\` |
| Do **not** | Wrap sheet fields in \`<Editable>\` (that is for on-page hover only) |
| Pages fixed | \`SalesPage\`, \`CheckoutPage\`, \`UpsellPage\`, \`VslPage\` |
| Script | \`scripts/fix-sheet-field-contrast.cjs\` |

`;

const HANDOFF_INSERT = `

### Field sheet contrast (UX fix)

**Problem:** Sheet \`Field\` helpers used bare \`<Editable>\` (on-page hover chrome). On \`bg-bone\` sheets, text washed out / looked unreadable.

**Fix:**
- \`Field\` on \`SalesPage\`, \`CheckoutPage\`, \`UpsellPage\`, \`VslPage\` → real \`<input>\` / \`<textarea>\` with \`bg-white text-ink\`
- Sheet shell: \`bg-bone/95 text-ink\` so labels never inherit light page color
- Script: \`scripts/fix-sheet-field-contrast.cjs\`

**Rule for future pages:** on-page hover = \`<Editable>\` / \`<MmEditable>\`; bottom sheet scalars = native inputs with dark-on-light classes.
`;

// Port doc
{
  const path = 'docs/SALES_FUNNEL_SYSTEM_PORT.md';
  let t = fs.readFileSync(path, 'utf8');
  if (t.includes('Field sheet contrast')) {
    console.log('port already has Field sheet contrast');
  } else {
    const anchor = 'Detail: `docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md`';
    if (!t.includes(anchor)) {
      console.error('port anchor missing');
      process.exit(1);
    }
    t = t.replace(anchor, anchor + PORT_INSERT);
    fs.writeFileSync(path, t);
    console.log('port updated');
  }
}

// Handoff
{
  const path = 'docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md';
  let t = fs.readFileSync(path, 'utf8');
  if (t.includes('Field sheet contrast')) {
    console.log('handoff already has Field sheet contrast');
  } else {
    t = t.replace(/\s*$/, '') + '\n' + HANDOFF_INSERT;
    fs.writeFileSync(path, t);
    console.log('handoff updated');
  }
}

// Verify
const p = fs.readFileSync('docs/SALES_FUNNEL_SYSTEM_PORT.md', 'utf8');
const h = fs.readFileSync('docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md', 'utf8');
console.log('port has contrast', p.includes('Field sheet contrast'));
console.log('port has fix-sheet script', p.includes('fix-sheet-field-contrast.cjs'));
console.log('handoff has contrast', h.includes('Field sheet contrast'));
console.log('handoff has rule', h.includes('bottom sheet scalars'));
const i = p.indexOf('Field sheet contrast');
console.log('---port snippet---');
console.log(p.slice(i, i + 650));

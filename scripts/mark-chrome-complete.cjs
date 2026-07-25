const fs = require('fs');
const path = 'docs/SALES_FUNNEL_CHROME_EDIT_HANDOFF.md';
let t = fs.readFileSync(path, 'utf8');

if (!t.includes('Status: COMPLETE')) {
  t = t.replace(
    /^# .+$/m,
    (m) =>
      m +
      '\n\n> **Status: COMPLETE** — chrome editability wired and verified (`node scripts/verify-chrome-final.cjs` → ALL PASS). `blankCheckout()` includes `timerLabel` + `brandLabel`.'
  );
}

if (t.includes('## Remaining gaps') && !t.includes('## Remaining gaps (resolved)')) {
  t = t.replace('## Remaining gaps', '## Remaining gaps (resolved)');
} else if (t.includes('### Remaining gaps') && !t.includes('### Remaining gaps (resolved)')) {
  t = t.replace('### Remaining gaps', '### Remaining gaps (resolved)');
}

const note = `

### Post-verify fix
- \`blankCheckout()\` in \`types.ts\` returns \`timerLabel\` + \`brandLabel\` (empty strings) so \`CheckoutContent\` is complete.
- Port doc updated: \`docs/SALES_FUNNEL_SYSTEM_PORT.md\` — chrome section + checklist.
- Verify: \`node scripts/verify-chrome-final.cjs\` → ALL PASS.
`;

if (!t.includes('blankCheckout()')) {
  t += note;
} else if (!t.includes('Post-verify fix')) {
  t += note;
}

fs.writeFileSync(path, t);
console.log('OK handoff', path, 'len', t.length);
console.log('has COMPLETE', t.includes('Status: COMPLETE'));
console.log('has blankCheckout note', t.includes('blankCheckout'));

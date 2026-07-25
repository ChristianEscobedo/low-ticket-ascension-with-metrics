/**
 * Step 7 falsified one sentence in section 3 of the port doc: it still cited the
 * footer body as "still inline" as the example of why a structural stand-in is
 * unsafe on a write path. The rule is still true and still worth stating — only
 * the example changed, since ChromeTab now imports the real SalesFooterContent.
 *
 * Idempotent. Line-ending agnostic. Writes nothing unless the exact stale text
 * is found.
 */
const fs = require('fs');

const DOC = 'docs/SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md';
let s = fs.readFileSync(DOC, 'utf8');

const MARK = 'That is why `ChromeTab` imports the';
if (s.includes(MARK)) {
  console.log('already applied — no changes written');
  process.exit(0);
}

// Normalise for matching so the search is not hostage to CRLF vs LF.
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const flat = s.replace(/\r\n/g, '\n');

const stale =
  '(the return type must be assignable both ways), which is exactly why the footer body\nis still inline (see §6).';
const fresh =
  '(the return type must be assignable both ways). That is why `ChromeTab` imports the\nreal `SalesFooterContent` rather than describing it structurally (§6.2).';

if (!flat.includes(stale)) {
  console.error('ABORT (nothing written): stale section-3 sentence not found verbatim.');
  console.error('Check whether it was already reworded by hand.');
  process.exit(1);
}

let out = flat.replace(stale, fresh);

// Post-condition: no *live* "still inline" claim may remain. Struck-through text
// (~~…~~) is quoted history in the closed-gap list, not a live claim, so it is
// allowed — the first version of this guard counted it and correctly refused to
// write, which is why this distinction is now explicit rather than assumed.
const live = out
  .split('\n')
  .map((l, i) => [i + 1, l])
  .filter(([, l]) => /still inline/.test(l) && !l.includes('~~'));
if (live.length) {
  console.error(`ABORT (nothing written): ${live.length} live "still inline" claim(s) remain:`);
  for (const [n, l] of live) console.error(`  line ${n}: ${l.trim()}`);
  process.exit(1);
}


if (EOL === '\r\n') out = out.replace(/\n/g, '\r\n');
fs.writeFileSync(DOC, out);
console.log('patched ' + DOC);
console.log('  - section 3 now cites ChromeTab importing the real type');
console.log('  - 0 remaining "still inline" claims');

/** Read-only: locate every "inline" claim in the port doc so step 7's doc pass
 *  can tell a stale claim from a still-true one. Writes nothing. */
const fs = require('fs');
const DOC = 'docs/SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md';
const lines = fs.readFileSync(DOC, 'utf8').split(/\r?\n/);
lines.forEach((l, i) => {
  if (/still inline|is inline|inline body|remains inline/.test(l)) {
    console.log(`${String(i + 1).padStart(4)} | ${l}`);
  }
});

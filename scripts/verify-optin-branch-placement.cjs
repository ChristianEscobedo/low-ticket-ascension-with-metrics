/**
 * Confirms the injected optin-resolution branch sits inside `case 'createLink'`
 * and after the sales-funnel branch. `String.replace` takes the FIRST match, so
 * if `if (!baseUrl) {` appeared earlier in the file the branch would have landed
 * in the wrong handler and still typechecked cleanly.
 */
const fs = require('fs');

const lines = fs
  .readFileSync('src/app/api/admin/mothermode-links/route.ts', 'utf8')
  .split(/\r?\n/);

const at = (needle) => lines.findIndex((l) => l.includes(needle)) + 1;
const count = (needle) =>
  lines.filter((l) => l.includes(needle)).length;

const createLink = at("case 'createLink'");
const optinBranch = at('if (optinFunnelId) {');
const salesBranch = at('if (funnelId) {');
const baseUrlGuard = at('if (!baseUrl) {');
const persisted = at('optinFunnelId,');

// Which case block does the optin branch live in?
let owner = '(none)';
for (const l of lines.slice(0, optinBranch)) {
  const m = l.match(/case '([a-zA-Z]+)'/);
  if (m) owner = m[1];
}

console.log('createLink case at line   :', createLink);
console.log('sales funnel branch line  :', salesBranch);
console.log('optin branch line         :', optinBranch);
console.log('baseUrl guard line        :', baseUrlGuard);
console.log('optinFunnelId persisted   :', persisted);
console.log('enclosing case block      :', owner);
console.log('"if (!baseUrl) {" count   :', count('if (!baseUrl) {'));

const ok =
  owner === 'createLink' &&
  optinBranch > salesBranch &&
  optinBranch < baseUrlGuard &&
  persisted > optinBranch;

console.log(ok ? '\nPLACEMENT OK' : '\nPLACEMENT WRONG — fix before shipping');
process.exit(ok ? 0 : 1);

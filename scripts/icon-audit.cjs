/**
 * Read-only audit: enumerate every producer (`icon: X`) and consumer (`.icon`)
 * of the LucideIcon-in-data pattern that breaks Server->Client serialization.
 * Writes scripts/icon-audit.txt.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src'];
const hits = {};
const iconValues = new Set();

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (/\.(ts|tsx)$/.test(e.name)) scan(fp);
  }
}

function scan(fp) {
  const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    const t = l.trim();
    const isDecl = /\bicon\s*:\s*LucideIcon/.test(t);
    const isLit = /\bicon\s*:\s*[A-Z][A-Za-z0-9_]*\s*[,}]/.test(t);
    const isUse = /\.icon\b/.test(t);
    if (!isDecl && !isLit && !isUse) return;
    if (isLit) {
      const m = t.match(/\bicon\s*:\s*([A-Z][A-Za-z0-9_]*)/);
      if (m) iconValues.add(m[1]);
    }
    (hits[fp] = hits[fp] || []).push(
      `${String(i + 1).padStart(5)}  ${isDecl ? 'DECL' : isLit ? 'LIT ' : 'USE '}  ${t}`
    );
  });
}

ROOTS.forEach(walk);

const out = [];
out.push('# icon-in-data audit');
out.push('');
out.push('## Distinct component values assigned to `icon:`');
out.push([...iconValues].sort().join(', ') || '(none)');
out.push('');
out.push(`## Files (${Object.keys(hits).length})`);
for (const f of Object.keys(hits).sort()) {
  out.push('');
  out.push(`=== ${f}`);
  hits[f].forEach((l) => out.push(l));
}
fs.writeFileSync('scripts/icon-audit.txt', out.join('\n'));
console.log(out.slice(0, 6).join('\n'));
console.log(`\nfiles: ${Object.keys(hits).length} -> scripts/icon-audit.txt`);

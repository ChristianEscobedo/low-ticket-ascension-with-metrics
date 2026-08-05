#!/usr/bin/env node
/**
 * Inspect a secret-bearing blob that exists only in git history, WITHOUT printing
 * the secret. Prints shape only: length, short head, tail, and a placeholder verdict.
 *
 * Why this exists: docs/RENDER_WORKER_DEPLOY_BLOCKED_SECRETS.md claims commit 6f01559
 * carries a real Anthropic key, which blocks `git push` behind GitHub push protection.
 * "It's just a placeholder" and "it's real" imply very different remediations
 * (drop the file vs. rotate the credential first), so the claim gets checked, not assumed.
 *
 *   node scripts/inspect-committed-secrets.cjs [rev] [path]
 */
const { execFileSync } = require('node:child_process');

const rev = process.argv[2] || '6f01559';
const path = process.argv[3] || '.env.local.bak';

let raw;
try {
  raw = execFileSync('git', ['--no-pager', 'show', `${rev}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch {
  console.log(`${path} not present in ${rev} — nothing to inspect.`);
  process.exit(0);
}

const SENSITIVE = /KEY|TOKEN|SECRET|PASSWORD|DSN|CREDENTIAL/i;

// Deliberately generous: anything that smells like a stand-in counts as a placeholder.
// A false "REAL" costs a needless key rotation; a false "PLACEHOLDER" leaks a live
// credential to a public remote. The asymmetry says which way to lean when unsure.
function verdict(v) {
  if (!v) return ['PLACEHOLDER', 'empty'];
  if (/^(your|my|the)[-_ ]?/i.test(v)) return ['PLACEHOLDER', 'starts with your/my/the'];
  if (/^(placeholder|changeme|change_me|dummy|example|sample|test|fake|todo|none|null|xxx)/i.test(v))
    return ['PLACEHOLDER', 'stand-in word'];
  if (/x{6,}/i.test(v)) return ['PLACEHOLDER', 'run of x'];
  if (/[<>{}]|\.\.\./.test(v)) return ['PLACEHOLDER', 'template punctuation'];
  if (/^(0+|1+)$/.test(v.replace(/[-_]/g, ''))) return ['PLACEHOLDER', 'all zeros/ones'];
  if (/^(sk-ant-api03-|sk-|ghp_|gho_|xox[baprs]-|AKIA|glpat-)/.test(v) && v.length >= 32)
    return ['REAL-SHAPED', 'known live prefix + full length'];
  if (v.length >= 32 && /[A-Za-z]/.test(v) && /[0-9]/.test(v))
    return ['REAL-SHAPED', 'long mixed-entropy string'];
  return ['PLACEHOLDER', `short (${v.length} chars)`];
}

const rows = [];
for (const line of raw.split(/\r?\n/)) {
  if (/^\s*#/.test(line)) continue;
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  const key = m[1];
  if (!SENSITIVE.test(key)) continue;
  const val = m[2].trim().replace(/^["']|["']$/g, '');
  const [flag, why] = verdict(val);
  rows.push({ flag, key, len: val.length, head: val.slice(0, 10), tail: val.slice(-4), why });
}

if (!rows.length) {
  console.log(`No sensitive-looking assignments found in ${rev}:${path}`);
  process.exit(0);
}

console.log(`${rev}:${path} — ${rows.length} sensitive-looking key(s). Values masked.\n`);
for (const r of rows.sort((a, b) => a.flag.localeCompare(b.flag))) {
  console.log(
    `  [${r.flag.padEnd(11)}] ${r.key.padEnd(28)} len=${String(r.len).padEnd(4)} ` +
      `head=${JSON.stringify(r.head).padEnd(14)} tail=${JSON.stringify(r.tail).padEnd(8)} (${r.why})`
  );
}

const real = rows.filter((r) => r.flag === 'REAL-SHAPED');
console.log(
  real.length
    ? `\n=> ${real.length} value(s) look REAL. Rotate before rewriting history: ${real.map((r) => r.key).join(', ')}`
    : `\n=> Nothing looks like a live credential. Dropping the file from history is sufficient.`
);

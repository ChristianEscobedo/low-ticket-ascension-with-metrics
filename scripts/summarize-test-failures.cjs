#!/usr/bin/env node
/**
 * Reduce a vitest run log to "which files failed, and how many tests in each".
 *
 * Exists because the raw log is ~300 lines of stack traces per run, and the only
 * question that matters after a change is whether the failure set *grew*. A
 * count per file answers that in one glance; the stacks are still in the log for
 * whoever actually needs to fix them.
 */
const fs = require('fs');

const file = process.argv[2] || 'test-session4.txt';
/*
 * PowerShell's `>` writes UTF-16LE, not UTF-8.
 *
 * Read as utf8 the whole log comes back interleaved with NULs and every regex
 * silently matches nothing — which looks exactly like "no failures" instead of
 * "unreadable file". The BOM is the reliable tell, so it decides the decoding.
 */
const raw = fs.readFileSync(file);
const text =
  raw[0] === 0xff && raw[1] === 0xfe
    ? raw.toString('utf16le')
    : raw.toString('utf8');

// Colour codes are stripped next. The reporter emits them even when redirected
// to a file, and they sit *between* "FAIL" and the path — so a regex written
// against what the terminal shows matches nothing against what's on disk.
const lines = text

  // eslint-disable-next-line no-control-regex
  .replace(/\u001b\[[0-9;]*m/g, '')
  .split(/\r?\n/);


const counts = new Map();
for (const line of lines) {
  // Match the reporter's "FAIL  <path> > <test name>" lines only. Summary lines
  // like "Test Files 6 failed" also contain "fail" and would double-count.
  const m = line.match(/FAIL\s+(\S+\.test\.[cm]?[jt]sx?)/);
  if (!m) continue;
  counts.set(m[1], (counts.get(m[1]) || 0) + 1);
}

const totals = lines.filter((l) => /^\s*(Test Files|Tests)\s+/.test(l));
for (const [path, n] of [...counts].sort()) {
  console.log(`${String(n).padStart(3)}  ${path}`);
}
console.log('---');
for (const t of totals) console.log(t.trim());

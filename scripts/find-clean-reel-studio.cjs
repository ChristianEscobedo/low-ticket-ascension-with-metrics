#!/usr/bin/env node
/**
 * Walk the git history of reel-studio/page.tsx and report, for each revision,
 * how many mojibake runs it contains. The goal is to find the newest revision
 * that is still CLEAN so the file can be restored instead of guessed at.
 *
 * Why this exists: the "???" damage is lossy. A 3-byte run could originally
 * have been any of  —  →  …  •  , so it cannot be reconstructed by inspection.
 * Git is the only source of truth for the original characters.
 */
const { execSync } = require('child_process');

const FILE = 'src/app/(fullscreen)/admin/reel-studio/page.tsx';

function sh(cmd) {
  return execSync(cmd, { maxBuffer: 1 << 28 }).toString('utf8');
}

const revs = sh(`git log --format=%H --follow -- "${FILE}"`).trim().split('\n').filter(Boolean);

console.log(`revisions touching this file: ${revs.length}\n`);

let firstClean = null;

for (const rev of revs) {
  let body;
  try {
    body = sh(`git show ${rev}:"${FILE}"`);
  } catch {
    continue; // file did not exist at this rev (rename boundary)
  }
  const triples = (body.match(/\?{3}/g) || []).length;
  const emoji = (body.match(/\?{4,}/g) || []).length;
  const subject = sh(`git log -1 --format=%s ${rev}`).trim();
  const clean = triples === 0 && emoji === 0;
  if (clean && !firstClean) firstClean = rev;
  console.log(
    `${clean ? 'CLEAN' : ' bad '} ${rev.slice(0, 9)}  ` +
      `glyph=${String(triples).padStart(3)} emoji=${String(emoji).padStart(3)} ` +
      `lines=${String(body.split('\n').length).padStart(5)}  ${subject.slice(0, 58)}`,
  );
}

console.log('');
if (firstClean) {
  console.log(`Newest CLEAN revision: ${firstClean}`);
  console.log(`Restore with:\n  git checkout ${firstClean} -- "${FILE}"`);
} else {
  console.log('No clean revision found in this file\'s history.');
}

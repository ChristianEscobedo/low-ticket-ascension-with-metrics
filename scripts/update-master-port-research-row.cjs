'use strict';
/**
 * One-off: refresh the master port doc's Research Lab row for the 16-play
 * fleet + the in-chat Plays rail, and bump the research test count 191 -> 194.
 */
const fs = require('fs');

const f = 'docs/MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md';
let t = fs.readFileSync(f, 'utf8');

const a =
  '8-expert crew + declarative Agent Recipes with background runs and weekly watch digests;';
const b =
  '8-expert crew + 16 declarative Agent Recipes (the launch/system originals, the builder fleet: bulk content, full funnel, paid launch, email sequences, repurpose, launch week, and the deep research fleet: multi-influencer dives, comment mining, cross-channel sweeps with cited LinkedIn/Facebook web passes, and the Audience Mosaic flagship) with background runs, approve gates, weekly watch digests, and the in-chat Plays rail;';
if (!t.includes(a)) {
  console.error('A NOT FOUND — already updated?');
  process.exit(1);
}
t = t.replace(a, b);

const c = 'tests `tests/lib/research-*.test.ts` (191) +';
const d = 'tests `tests/lib/research-*.test.ts` (194) +';
if (!t.includes(c)) {
  console.error('C NOT FOUND — already updated?');
  process.exit(1);
}
t = t.replace(c, d);

fs.writeFileSync(f, t);
console.log('ok: research row now describes the 16-play fleet + Plays rail; tests 191 -> 194.');

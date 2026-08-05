/**
 * Cross-reference the thread-tagged-as-paid finding from the docs that own this
 * area.
 *
 * A standalone finding doc nobody links to is a doc nobody reads. The port doc
 * describes how paid figures are computed and the handoff describes what Phase 2
 * must not undo — a reader of either needs to know the stored rows feeding those
 * figures have not been repaired yet.
 *
 * Idempotent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = 'THREAD_TAGGED_AS_PAID_FINDING';

const NOTE = `
### Known data caveat: historical thread links are mis-tagged as paid

\`mediumForFormat\` classified the \`thread\` format as \`paid_social\` (the test was
\`f.includes('ad')\` — thre**ad**), so organic X threads were counted as paid
traffic. The code is fixed and pinned by
\`tests/lib/planner-medium-for-format.test.ts\`, but **links minted before the fix
still carry the wrong \`utm_medium\`**, so any paid EPC covering that period is
inflated — and organic converts better than paid, so it is inflated in the
direction that raises a bid ceiling.

Repair predicate and the two cautions that make a blanket UPDATE wrong:
[docs/${MARKER}.md](./${MARKER}.md).
`;

function append(relPath) {
  const abs = path.join(ROOT, relPath);
  let text = fs.readFileSync(abs, 'utf8');
  if (text.includes(MARKER)) {
    console.log(`  skip (already linked): ${relPath}`);
    return;
  }
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(abs, `${text}${NOTE}`, 'utf8');
  console.log(`  linked: ${relPath}`);
}

console.log('Cross-referencing the finding:');
append('docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md');
append('docs/AD_METRICS_PHASE1_HANDOFF.md');
console.log('Done.');

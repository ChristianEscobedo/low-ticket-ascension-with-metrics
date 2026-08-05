/**
 * Record in the port doc HOW a piece's utm_medium is derived, and point both the
 * port doc and the handoff at the outstanding-work doc.
 *
 * The port doc already explains what the paid figures mean and carries the
 * mis-tagging caveat. What it lacked is the rule that decides whether a piece is
 * paid at all — which is the input every one of those figures depends on, and the
 * place the bug actually lived.
 *
 * Idempotent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = '### How a piece becomes "paid"';

const PORT_SECTION = `
${MARKER}

Nothing marks a piece as an ad directly. The chain is:

\`\`\`
piece.format → mediumForFormat() → utm_medium on the link → trafficType() → paid | organic | untagged
\`\`\`

So the *format string* decides whether clicks land in the paid bucket, and
therefore whether the paid block renders and what the bid ceiling is built from.

**Match whole words, not substrings.** \`mediumForFormat\` originally tested
\`f.includes('ad')\`, which classified the \`thread\` format as \`paid_social\`
(thre**ad**) along with \`lead magnet\`, \`roadmap\` and \`download\`. Short markers
(\`ad\`, \`ads\`, \`dm\`) are now matched as whole words after splitting the slug;
only long, unambiguous markers (\`paid\`, \`newsletter\`, \`article\`) remain
substring tests. \`tests/lib/planner-medium-for-format.test.ts\` asserts both
directions and sweeps every key of \`FORMAT_LABEL\`, so a new hub format that lands
in the paid bucket fails there rather than on a dashboard.

If a genuinely paid format is ever added, declare it in that test's
\`KNOWN_PAID_FORMATS\` — the sweep is meant to force the decision, not to be
deleted.

**Remaining work on this system:** [docs/AD_METRICS_NEXT_TASKS.md](./AD_METRICS_NEXT_TASKS.md).
`;

const HANDOFF_SECTION = `
### Outstanding work

The decisions still open — historical row repair (blocking accurate paid
figures), campaign-grain spend storage, untagged-link visibility — are written up
with their blockers in
[docs/AD_METRICS_NEXT_TASKS.md](./AD_METRICS_NEXT_TASKS.md), including the
non-goals, so a later session doesn't rebuild something that was declined on
purpose.
`;

function append(relPath, section, marker) {
  const abs = path.join(ROOT, relPath);
  let text = fs.readFileSync(abs, 'utf8');
  if (text.includes(marker)) {
    console.log(`  skip (already documented): ${relPath}`);
    return;
  }
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(abs, `${text}${section}`, 'utf8');
  console.log(`  appended: ${relPath}`);
}

console.log('Documenting medium derivation + next tasks:');
append('docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md', PORT_SECTION, MARKER);
append(
  'docs/AD_METRICS_PHASE1_HANDOFF.md',
  HANDOFF_SECTION,
  'AD_METRICS_NEXT_TASKS'
);
console.log('Done.');

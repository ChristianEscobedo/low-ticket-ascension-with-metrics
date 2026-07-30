/**
 * Repairs the Session 2 box in CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md:
 * removes the stray blank lines that broke the blockquote table, updates the
 * top-line status, and marks the finished item as done instead of leaving it in
 * the "remaining" list.
 */
const fs = require('fs');

const file = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
let src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const edits = [
  // 1. A blank line mid-table splits it into two tables and drops the rows.
  [
    '| (1) + (2) |\n\n> | `POST /api/admin/mothermode-planner',
    '| (1) + (2) |\n> | `POST /api/admin/mothermode-planner',
  ],
  // 2. Blank line ends the blockquote early, orphaning the correction.
  ['either.\n\n>\n> **Correction to this document:**', 'either.\n>\n> **Correction to this document:**'],
  // 3. Top-line status: (2) is wired now, not just seamed.
  [
    'Session 2: the server seams for (1), (3), (4) are done; only the client\ncomponents remain.**',
    'Session 2: (2) is wired end-to-end through the UI, and the server seams for\n(1), (3), (4) are done — what remains is two client surfaces.**',
  ],
  // 4. The export-wiring item is no longer remaining work.
  [
    '> Remaining work is the three client components, in this order:\n>\n> 1. **Hub data layer + export wiring**',
    '> Remaining work, in this order:\n>\n> 1. ~~**Hub data layer + export wiring**~~ — **DONE** (see above).\n>    Original note kept for context: **Hub data layer + export wiring**',
  ],
];

let applied = 0;
for (const [from, to] of edits) {
  if (src.includes(from)) {
    src = src.replace(from, to);
    applied += 1;
  } else if (!src.includes(to.slice(0, 40))) {
    console.error('MISS:', JSON.stringify(from.slice(0, 60)));
  }
}

fs.writeFileSync(file, src);
console.log(`applied ${applied}/${edits.length} edits to ${file}`);

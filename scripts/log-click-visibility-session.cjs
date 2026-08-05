/**
 * Appends the session-3 record (click visibility across surfaces) to the
 * content-hub handoff. Idempotent; run again safely.
 */
const fs = require('fs');

const file = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
const raw = fs.readFileSync(file, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';

if (raw.includes('Click visibility across surfaces')) {
  console.log('already present — no changes');
  process.exit(0);
}

const lines = [
  '',
  '---',
  '',
  '## Click visibility across surfaces (session 3)',
  '',
  'Diagnosed with `node scripts/inspect-tracked-link-clicks.cjs` (read-only). It',
  'separates the three failures that look identical in the admin: the click row not',
  'being written, `click_count` drifting from the rows, and `utm_content` matching',
  'no post.',
  '',
  'Verified against live data: clicks **are** recorded — 1 click row, counter in',
  'sync, `ua_family=desktop`. The gap was elsewhere. `utm_content=fb-reel-1` matches',
  '**no plan card**, because the database has zero plan cards. Per-post metrics has',
  'no post to attach the click to. That is the same missing add-card UI listed',
  'earlier in this doc, so build that first — otherwise per-post numbers stay empty',
  'no matter how many surfaces read them.',
  '',
  '### Shared seam (built, tested)',
  '',
  '`rollupClicks()` (pure) and `getClickRollups()` in `planner/links.ts` return',
  '`totalClicks`, `recentClicks`, `botClicks`, `lastClickAt`, `linkCount`,',
  '`linksWithClicks`, and `byFunnelId` / `byOptinFunnelId` / `byPieceId`.',
  '6 tests in `tests/lib/planner-click-rollups.test.ts`.',
  '',
  'One aggregation rather than three ad-hoc sums, because three surfaces each',
  'summing their own way is how you get three different click numbers on three',
  'screens and no way to tell which is right.',
  '',
  '**Two numbers on purpose.** `totalClicks` is the all-time `click_count` counter;',
  '`recentClicks` is the click rows, which are windowed *and* row-capped. Never add',
  'them, never substitute one for the other — the total would shrink as the window',
  'slides. Bots stay in their own field because `/go/<code>` logs a bot hit without',
  'incrementing the counter, so counting rows naively puts a larger unexplained',
  '"clicks" figure next to the counter. Per-key breakdowns use the all-time counter',
  'so a funnel number never drops just because clicks aged out.',
  '',
  '`byPieceId` keys on `utm_content`, falling back to `piece_id`: the lead row',
  'carries `utm_content`, so it is the only key that can join to attribution.',
  'Zero-click links are omitted from the breakdowns rather than emitted as `0` — an',
  'empty row reads as "measured and failed" instead of "never used".',
  '',
  '### Wired',
  '',
  '`/admin` overview — a **Tracked link clicks** card (all-time, with 30d, bots',
  'excluded, and links-used underneath) plus a Content Planner quick link. It',
  'degrades to `n/a`, never `0`, and cannot take the revenue dashboard down: the',
  'planner migration may legitimately not be applied on a given database, and `0`',
  'would be a claim that nobody clicked.',
  '',
  '### Not wired yet (both small now the seam exists)',
  '',
  '1. **Funnel dashboard** — `src/app/admin/funnel-stats/page.tsx` (200 lines,',
  '   server component). Read `getClickRollups()`, index `byFunnelId` by the funnel',
  '   id already in scope, and copy the `safeClickRollups()` degradation from',
  '   `src/app/admin/page.tsx`. Lead magnets use `byOptinFunnelId`.',
  '2. **Per-post metrics** — `PieceLinkPanel.tsx` (client). Add `clicks` to the',
  '   `?format=byPiece` payload in `mothermode-links/route.ts`, keyed by',
  '   `utm_content`, then render it next to the piece\u2019s tracked link. Show',
  '   opt-ins from `getPieceAttribution()` beside it: clicks alone tell you the',
  '   post worked while hiding that the destination did not, which is the exact',
  '   read the amber zero-optin highlight exists to prevent.',
  '',
];

fs.writeFileSync(file, raw.replace(/\s*$/, '') + nl + lines.join(nl));
console.log('appended session 3 section to', file);

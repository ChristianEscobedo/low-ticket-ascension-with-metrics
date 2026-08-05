/**
 * Appends session 3's outcome to the handoff, including the correction to a
 * claim the previous session's own handoff got wrong. Idempotent.
 */
const fs = require('fs');

const file = 'docs/CONTENT_HUB_UTM_AND_PLANNER_CARDS_HANDOFF.md';
const src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const marker = '## Session 3 — add-card UI + clicks on funnel stats';

if (src.includes(marker)) {
  console.log('already logged — no changes');
  process.exit(0);
}

const lines = [
  '',
  '---',
  '',
  marker,
  '',
  '### Built and verified',
  '',
  '**1. Planner add-card UI** — `src/app/admin/planner/AddPlanCard.tsx`, rendered',
  'from `PlannerWorkspace` on the Content Board tab.',
  '',
  '- Posts the existing `upsertPlan` action; no API or store change was needed.',
  '- The piece id is **pre-filled from `newManualPieceId()` and shown as an',
  '  editable field**, because a card saved with a blank `piece_id` is invisible',
  '  to the export bridge, to `utm_content`, and to click attribution — forever,',
  '  and silently, since "no attribution rows" and "no such piece id" are the',
  '  same empty result. The generated id is stable for the life of the open form',
  '  and re-generated after each save.',
  '- Dates are sent as **noon local**, not midnight: midnight local converted to',
  '  UTC lands on the previous day west of GMT, which would shift every scheduled',
  '  post by one day in both the calendar and the CSV.',
  '',
  '**2. Clicks on `/admin/funnel-stats`** — three tiles (all-time, 30d, clicks',
  'per purchase) plus a "Traffic by post" table off `byPieceId`.',
  '',
  '- The wrapper that keeps clicks from taking a revenue page down now lives in',
  '  the lib as `getClickRollupsSafe()` (`planner/links.ts`) and is shared by the',
  '  overview and funnel-stats. Previously the overview held a private copy;',
  '  two pages inventing their own fallback is how one screen shows `0` while',
  '  the other shows `n/a` from the identical failure. Failure still renders',
  '  `n/a` — an unapplied migration must not read as "nobody clicked".',
  '',
  '### Correction to this document',
  '',
  'An earlier section of this handoff said to index `byFunnelId` on funnel-stats',
  'using "the funnel id already in scope". **There is no funnel id in scope on',
  'that page.** Its breakdowns are Stripe `product_id` and `page_type`; no',
  'mothermode funnel record is loaded there. Showing "clicks per funnel" would',
  'have required inventing a join that does not exist, so clicks are surfaced by',
  '*piece* instead, which is the key that actually carries traffic. The tiles',
  'also carry a caveat line: clicks and purchases are not a matched pair, since a',
  'click can convert weeks later and direct traffic buys without one.',
  '',
  '### Still not started',
  '',
  '- **Per-post clicks inside `PieceLinkPanel`** (content hub). Needs a read path',
  '  to per-piece counts from a client component — the panel has no server props.',
  '- **Add-lead card UI.** `upsertLead` already exists and the drag path already',
  '  calls it; this is a form only.',
  '- **Lead-magnet picker for tracked links.** UI over the existing destination',
  '  fields.',
  '',
  'Stopped at ~80% context with these three untouched rather than half-wiring',
  'them. Two failing tests in the suite (`compliance-pass`, `review-logic`) are',
  'pre-existing and unrelated — neither file appears in this session\'s diff.',
  '',
];

fs.writeFileSync(file, src.replace(/\s*$/, '') + nl + lines.join(nl));
console.log('appended session 3 notes to', file);

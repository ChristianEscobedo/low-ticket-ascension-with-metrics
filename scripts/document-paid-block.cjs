/**
 * Append the paid-block decision to the link-tracking port doc and the ad-metrics
 * handoff.
 *
 * A script rather than hand-editing because both files must gain the SAME
 * decision: the port doc records what the surface does, the handoff records what
 * Phase 2 must not undo. If only one is updated, the next session reads the
 * handoff, sees no mention of the spend-grain rule, and adds a per-piece spend
 * field — which is the exact outcome this section exists to prevent.
 *
 * Idempotent: re-running does not duplicate the section.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MARKER = '## Paid traffic on a piece';

const PORT_SECTION = `
${MARKER} (the Metrics tab's paid block)

A piece's Metrics tab shows a **Paid traffic** block under the money grid,
built by \`paidResultsSummary(economics)\`: paid clicks, paid opt-in rate, and
earnings per PAID click.

**Gated on \`economics.paidClicks\`, not on the piece's format.** The content hub
has ad-shaped sizes (\`platformSizes\` group \`'ads'\`), and it would be natural to
key the block off that instead. It would also be wrong in both directions: an
ad-sized creative that was never boosted has no paid results, and a plain feed
post that WAS boosted does. The \`utm_medium\` on the link is a fact about what
happened; the aspect ratio is an intention.

\`paidClicks\` is deliberately \`number | null\`:

| Value | Means | Block |
| --- | --- | --- |
| \`null\` | the medium split could not be read | hidden — absence of a reading, not a reading of zero |
| \`0\` | split read, this piece had no paid clicks | hidden — correctly, it is organic |
| \`> 0\` | this piece ran as an ad | shown |

The block also **survives the "nothing happened yet" early return** in
\`PieceMoneyLines\`. A post with no clicks and no leads renders nothing, but an ad
with 200 paid clicks and zero opt-ins renders the block — one is waiting, the
other is spending, and only the second is urgent. In that state the paid EPC
prints \`$0.000\`, which is a measured fact; \`n/a\` would falsely imply the ad was
never tracked. When the attribution join actually fails, the rate and per-click
parts are omitted entirely rather than shown as zero.

### Why there are no CPC / CPL / ROAS / profit cells here

Every cost metric is gated on \`spendCents\`, which has no storage yet. Rendering
them now would put six \`n/a\` cells on a live ad, and \`n/a\` means "not measured"
everywhere else in this system — so a reader would conclude the click pipeline is
broken and debug the wrong thing. Instead the block prints
\`SPEND_NOT_RECORDED_NOTE\`, which says the missing input is the budget, not the
measurement.

### Spend is campaign-grain. Do not put a spend field on a piece.

The tempting next step is a spend box on the ad's content sheet. It must not be
built. Ad platforms do not reliably export per-creative spend, so a per-piece
figure would be an admin splitting a campaign budget across posts by guess — and
the resulting per-piece ROAS would look authoritative while being invented. Spend
belongs at \`(utm_campaign, date)\`, which is the grain that can be reconciled
against a platform's own reporting.
`;

const HANDOFF_SECTION = `
${MARKER} — shipped, and the one thing Phase 2 must not undo

\`PieceEconomics\` now carries \`paidClicks: number | null\`, and the Metrics tab
renders a paid block whenever it is \`> 0\` (\`paidResultsSummary\`). Null vs 0 is
load-bearing: null is "no medium split read", 0 is "not boosted", and only the
first must never be printed as the second. See the port doc for the full table.

**\`SPEND_NOT_RECORDED_NOTE\` is the placeholder for every cost metric.** When
spend storage lands, that constant is what gets replaced — not added to. Leaving
it up beside real CPC/ROAS numbers would tell a reader the figures are unusable
at the moment they finally are.

**The trap for Phase 2:** spend is \`(utm_campaign, date)\`-grain. A per-piece
spend field is easy to add here — \`pieceEconomics\` already accepts \`spendCents\`
and applies it to the paid side only — and it would immediately produce
convincing per-post ROAS numbers derived from a human guess at how a campaign
budget divided across creatives. Ad platforms do not export that split. Store
spend per campaign, and let a piece show cost metrics only when it is the sole
creative in one, or not at all.
`;

function append(relPath, section) {
  const abs = path.join(ROOT, relPath);
  let text = fs.readFileSync(abs, 'utf8');
  if (text.includes(MARKER)) {
    console.log(`  skip (already documented): ${relPath}`);
    return;
  }
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(abs, `${text}${section}`, 'utf8');
  console.log(`  appended: ${relPath}`);
}

console.log('Documenting the paid block:');
append('docs/PLANNER_LINK_TRACKING_SYSTEM_PORT.md', PORT_SECTION);
append('docs/AD_METRICS_PHASE1_HANDOFF.md', HANDOFF_SECTION);
console.log('Done.');

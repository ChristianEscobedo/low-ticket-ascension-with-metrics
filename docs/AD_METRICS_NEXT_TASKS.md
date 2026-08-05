# Ad metrics — outstanding work

Everything here is deliberately *not* built. Each item is blocked on a decision
rather than on effort, and the decision is recorded with it so the next session
doesn't have to re-derive it.

Shipped so far: `adMetrics.ts` (paid/blended split, formatters, break-even and
bid-ceiling summaries), attribution joins in `links.ts`, and four read surfaces —
`/admin`, `/admin/funnel-stats`, the piece Metrics tab (incl. the paid block),
and the planner Tracking tab.

---

## 1. Repair the mis-tagged historical rows — BLOCKING accurate paid figures

**Why it's first:** every paid number on every surface reads history, and history
is contaminated. See `THREAD_TAGGED_AS_PAID_FINDING.md`. The code is fixed; the
stored `utm_medium` values are not.

**Why it isn't a one-line UPDATE:**

- A blanket `paid_social → organic_social` for thread pieces is wrong. Boosted
  threads exist and are correctly paid. Format cannot distinguish "thread" from
  "thread we spent money on" — only the admin can.
- `utm_medium` is stamped on **lead rows** as well as link rows. Fixing one and
  not the other leaves the two disagreeing, which is worse than a uniform error,
  because then no surface can be trusted to agree with any other.

**Shape:** report-first, confirm-then-write, like
`scripts/repair-localhost-tracked-links.cjs`. Print each affected link with its
piece, its click count and its medium, and require an explicit flag to write.
Identifying SQL is in the finding doc.

**Done when:** a paid EPC on any piece can be trusted, and the finding doc's
status line changes from "rows NOT yet repaired".

---

## 2. Ad spend storage — at `(utm_campaign, date)` grain, never per piece

**Blocked on:** where spend is entered, not on the maths. `pieceEconomics`
already accepts `spendCents` and correctly applies it to the paid side only, so
every cost metric (CPC, CPL, CAC, ROAS, profit) lights up the moment a number
exists.

**The trap, restated because it is genuinely tempting:** a spend box on an ad's
content sheet would work, look reasonable, and produce fabricated data. Ad
platforms don't reliably export per-creative spend, so the admin would be
splitting a campaign budget across posts by guess — and the resulting per-post
ROAS reads as authoritative. Store spend at `(utm_campaign, date)`, which is the
grain that reconciles against a platform's own reporting.

**Also on landing:** replace `SPEND_NOT_RECORDED_NOTE`, don't add beside it. That
constant currently *explains* the absent cost cells; left up next to real ROAS it
would tell readers the figures are unusable exactly when they become usable.

**Done when:** cost metrics appear on the campaign surface, and a piece shows
them only when it is the sole creative in its campaign (or not at all).

---

## 3. Untagged-traffic visibility

`trafficMix` already exposes an `untagged` share, and `blendedRateCaveat` warns
when the blend is unreliable. What's missing is anything that tells an admin
*which links* are untagged so they can be fixed. Untagged clicks silently shrink
every denominator they should be in.

**Done when:** a surface lists links with no `utm_medium`, ranked by clicks.

---

## 4. Attribution floor, permanently

`ATTRIBUTED_REVENUE_FLOOR_NOTE` exists because attributed revenue only counts
sales that arrived through a tracked link, so it will always read lower than
Stripe. This is **not** a bug to close, and the note must not be quietly dropped
to make a dashboard look tidier: the day the two numbers are presented as
comparable, someone will add them together.

---

## Non-goals

- **Per-piece ROAS from split campaign spend.** See item 2.
- **Attributing untracked sales by time proximity.** A guess with a number
  attached is worse than a gap, because a gap prompts a question.
- **Hiding the paid block for ad-shaped formats that were never boosted.** The
  block is gated on measured paid clicks, not on the piece's aspect ratio.

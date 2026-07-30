# Ad Metrics + Click Rollups (System / Port Guide)

Per-post measurement on every Planner card: clicks, the people behind them,
leads, and sales, plus a separate paid block for promoted posts. This is the
read side of the tracked-link system; the write side (minting `/go/code` links
and recording clicks) lives in `PLANNER_LINK_TRACKING_SYSTEM_PORT.md`. Read that
first; this doc covers how the numbers roll up onto a card and how to debug them.

Consolidates the phase-1 work in `AD_METRICS_PHASE1_HANDOFF.md` and the follow-ups
in `AD_METRICS_NEXT_TASKS.md`, plus the two findings `CLICK_TRACKING_NOT_COUNTING_FINDING.md`
and `THREAD_TAGGED_AS_PAID_FINDING.md`.

---

## 1. What it does

Every post that goes out carries a tracked link whose `utm_content` is set to the
piece id. Because of that one convention, the Planner can show, on the card
itself:

- **Clicks** — a denormalized counter kept in step with the raw click rows.
- **Click people** — a drill-down: who clicked, when, from what referrer and
  device family.
- **Leads and sales** — joined through the lead/order's UTM, so the card answers
  "this post produced these leads and these sales".
- **Paid block** — for promoted posts: spend, results, and derived metrics (cost
  per lead, cost per sale), tracked separately from organic.

---

## 2. Files

```
src/lib/mothermode/planner/adMetrics.ts        derived metrics + paid-block model
src/lib/mothermode/planner/clickPeople.ts      the click drill-down (who/when/where)
src/lib/mothermode/planner/links.ts            tracked-link reads + rollups
src/lib/mothermode/planner/utm.ts              utm_content <-> piece-id convention
src/components/mothermode/content/PieceClickMetrics.tsx   card metrics row UI
src/app/api/admin/mothermode-links/route.ts    admin link metrics API
tests/lib/planner-ad-metrics.test.ts
tests/lib/planner-ad-metrics-surfaces.test.ts
tests/lib/planner-click-rollups.test.ts
tests/lib/planner-click-people.test.ts
tests/lib/planner-paid-results.test.ts
tests/lib/planner-link-row-totals.test.ts
scripts/inspect-tracked-link-clicks.cjs        read-only numbers debugger
scripts/add-click-rollups.cjs / add-safe-click-rollups.cjs  rollup backfill
```

---

## 3. The join that makes it all work

`utm_content` is a **convention, not a foreign key**. When it equals a planner
piece id, every stage joins:

1. The piece is placed on the Planner; its tracked link is minted with
   `utm_content = piece.id`.
2. A click writes a raw click row (time, referrer, device family) and bumps the
   link's counter.
3. An opt-in or purchase copies the link's UTM onto the lead/order.
4. The card joins clicks -> leads -> sales through that shared `piece.id`.

If a link is hand-made (typed `utm_content` like "fb-reel-1"), it still mints and
redirects, but it never joins to a piece, so its clicks stay unattributed forever
and nothing in the UI warns. Always mint links from the piece.

---

## 4. The paid block and the medium trap

Paid spend is tracked separately from organic. A promoted piece carries a paid
block with spend, results, and derived metrics. The **medium is derived from the
format**, and there is a known trap (`THREAD_TAGGED_AS_PAID_FINDING.md`): a format
whose medium resolves to paid can tag an organic thread as paid, producing phantom
paid numbers. If a card shows paid spend you never bought, check the medium
derivation first.

---

## 5. Debugging: three problems that look identical

`scripts/inspect-tracked-link-clicks.cjs` (read-only) separates the three states
that all look like "the card shows the wrong number" but have different fixes:

1. **Clicks not written at all** — a routing or integration problem.
2. **The counter behind the raw rows** — a rollup problem (see
   `CLICK_TRACKING_NOT_COUNTING_FINDING.md`); backfill with
   `add-safe-click-rollups.cjs`.
3. **`utm_content` does not join** — a hand-made link; clicks stay unattributed
   and cannot be fully repaired after the fact.

Run the inspector first. It tells you which of the three you have.

---

## 6. Port order

1. Port the tracked-link write side first (`PLANNER_LINK_TRACKING_SYSTEM_PORT.md`):
   `/go/[code]`, the click table, the counter.
2. Port `planner/links.ts`, `utm.ts`, `clickPeople.ts`, `adMetrics.ts` + their tests.
3. Port `PieceClickMetrics.tsx` and the `/api/admin/mothermode-links` route.
4. Port `inspect-tracked-link-clicks.cjs` and the rollup backfill scripts.
5. Verify: `tsc --noEmit` and the planner metrics/click vitest suites.

### Verification checklist
- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/planner-ad-metrics.test.ts tests/lib/planner-click-rollups.test.ts tests/lib/planner-click-people.test.ts tests/lib/planner-paid-results.test.ts` green.
- A card shows clicks that match the raw click rows.
- The click-people drill-down lists who/when/referrer.
- An organic thread is never tagged paid.

---

## 7. Notes

- No new env or tables beyond the tracked-link migration from the write side.
- The card metrics are read-mostly and derived; they can always be rebuilt from
  the raw click rows + the piece's `utm_content` if a rollup drifts.

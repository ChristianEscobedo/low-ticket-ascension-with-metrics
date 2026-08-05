# Finding: planner cards from the Schedule tab were saved without an offer

**Symptom.** Opening a planner card's detail drawer showed:

> Could not load this piece's content, so nothing is shown rather than a
> guessed preview.

Every card mirrored from the Content Hub's Schedule tab was affected. The card's
own fields (title, platform, schedule, publish state) were correct — only the
preview failed.

## Root cause

`content_plan` rows are keyed by **two** things, not one:

| column | supplied by |
| --- | --- |
| `piece_id` | the piece being planned |
| `offer_slug` | the offer it was planned for |

The review store — where the edited copy, the uploaded image and the final-cut
video live — is scoped by *both*: `getReview(offerSlug, pieceId)`. An evergreen
piece can be planned against several offers and carry different edits in each,
so `piece_id` alone does not identify content.

`SchedulePanel` sent `pieceId` in its `upsertPlan` body but **never sent
`offerSlug`** — the component wasn't even given it, only `offerUrl`. So:

- `offer_slug` was written `null`,
- `str(row.offer_slug)` normalised that to `''`,
- the drawer had no offer to look up, and correctly refused to guess.

Everything downstream was working. The API route already accepted `offerSlug`,
the column already existed, and `ContentSheet` already had the value in hand —
it simply wasn't passed down one level. A missing prop, not a missing feature.

## Fix

1. `SchedulePanel` takes `offerSlug` and includes it in the `upsertPlan` body.
2. `ContentSheet` passes the `offerSlug` it already holds.
3. `PlanPiecePreview` now resolves the review through `reviewClient` — the same
   cache the Hub's sheet and cards use — rather than its own `fetch`. A second
   independent fetch would have shown a stale image next to a Hub showing the
   new one; the shared cache plus its subscription keeps the two honest.

## Existing rows

Cards written **before** this fix still have `offer_slug = null` and will show
the amber "saved without an offer" note. No migration is needed to repair one:
re-send it from the Schedule tab. `upsertPlan` matches on `piece_id`, so it
updates the same row in place and fills in the offer.

A bulk backfill is possible (join each plan row to the review row that shares
its `piece_id`, where that is unambiguous) but was deliberately not run: the
mapping is only safe for pieces planned against exactly one offer, and guessing
the offer is precisely the failure mode this finding is about.

## Guardrail

`offerSlug` is a **required** prop on `SchedulePanel`, not optional. Making it
optional would let the next call site reintroduce this silently — the write
succeeds, the card looks right, and the breakage only surfaces later in a
different surface. Now it fails at the type level instead.

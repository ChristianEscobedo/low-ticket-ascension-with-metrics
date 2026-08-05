# Finding: `brief.visual` is never populated — the image-prompt congruence path is inert

Companion to `SALES_FUNNEL_IMAGE_PROMPTS_HANDOFF.md`. Written mid-session; the
three gaps listed in that handoff are all still open. This file adds a fourth
that was found while starting on them, and gives the next session an ordered
plan. Nothing in this file was fixed — it is a record, not a changelog.

## The finding

`buildSalesImagePrompts` derives its style line from `FunnelBrief.visual`, and
falls back to a neutral look when that block is empty, reporting which fields it
had to assume via `assumedVisualFields`. That mechanism works. The problem is
what feeds it.

Every reference to `visual.styleKeywords` in `src/`:

| Location | What it does |
| --- | --- |
| `sales/funnelBrief.ts:199` | blank brief default — `styleKeywords: []` |
| `sales/funnelBrief.ts:261` | `normalizeFunnelBrief` reads it *from a raw object* |
| `sales/funnelBrief.ts:407` | renders it into the prompt text for the copy AI |
| `sales/funnelBrief.ts:472` | lists it as an auditable field |
| `sales/imagePrompts.ts:162,179,180,190,200` | consumes it / falls back / reports |

Nothing **writes** it. The other four `visual.*` fields are in the same
position. `normalizeFunnelBrief` can accept a populated `visual` block, but no
caller ever passes one, and no funnel record persists one.

`SalesFunnelEditor.onGenerateImages` (line ~691) builds its brief with
`funnelBriefFromIntake(intake, …)`, and the intake (`SalesAiIntake`,
`sales/aiIntake.ts:66-88`) has no visual fields at all — the closest is
`toneNotes`, which is copy tone, not art direction.

**Consequence:** today, for every funnel and every user, all 16 image slots use
the neutral fallback and `assumedVisualFields` returns all five field names.
Removing the hardcoded `'Warm dark background, brass and bone palette, calm
luxury'` was correct — it was MotherMode's world imposed on everyone — but what
replaced it is not yet per-brand art direction. It is *nobody's* look rather
than *one wrong person's* look. That is an improvement (generic beats
confidently off-brand) but it is not the "one brief yields one congruent visual
world" claim in the handoff. That claim is currently true only in the sense that
all 16 slots agree with each other; they do not yet agree with *this brand*,
because the brand never states a visual position.

This also changes the shape of gap #1 in the handoff. Surfacing
`assumedVisualFields` in the UI as-is would render a warning that is always on
and never actionable — the admin has no field to fill to clear it. A permanent
warning is trained-away noise. The surfacing and the input have to land
together.

## Ordered plan for the next session

1. **Tests first — they need no new plumbing and unblock everything else.**
   `tests/lib/sales-image-prompts.test.ts`, `@/lib/mothermode/sales/imagePrompts`.
   The module is pure, so assert on returned data, not on generated pictures:
   - **coverage** — the slot table has 16 entries, keys unique, and
     `buildSalesImagePrompts` returns a non-empty `imagePrompt` for each. This is
     the assertion the handoff said slots-as-data would make possible; make it.
   - **congruence** — the resolved style line appears verbatim in all 16 prompts.
   - **variation** — two briefs with different `visual` blocks produce different
     style lines, and neither contains `brass`, `bone`, or `Warm dark background`.
     This is the regression test for the literal Task C removed.
   - **format** — assert the specific formats differ across slots (hero wide,
     checkout square, founder portrait). Regression test for the `'feed'`-for-all
     bug; without it that bug silently returns.
   - **fallback reporting** — empty `visual` gives all five field names in
     `assumedVisualFields`; a fully-populated `visual` gives `[]`; a partially
     populated one names exactly the missing fields.
   - **name resolution** — ctx overrides win, then brief names, then the offer
     name; no slot ever ends up with an empty subject.
2. **Add the input.** Extend `SalesAiIntake` with a visual block (subject,
   palette, style keywords, lighting, composition, avoid), persist it on the
   funnel record, map it through `funnelBriefFromIntake`, and have the AI intake
   fill propose values the way it already proposes the offer stack. Until this
   exists, step 3 has nothing to point at.
3. **Then surface the gap**, in the Offer tab next to "3. Generate missing
   images", computed from the brief *before* the API spend rather than only in
   the post-run notice string. With step 2 in place the warning becomes rare and
   clearing it is a concrete action.
4. **Generate one image end to end** and look at it. Still not done. `tsc
   --noEmit` being clean says the wiring typechecks, not that a single prompt
   produces a usable picture, and not that the per-slot formats come back at the
   aspect ratios the layout expects.

## Status

- Step 1 of the plan is done. `tests/lib/sales-image-prompts.test.ts` was
  written against the real module and **run**: 19 passed, 0 failed
  (`npx vitest run tests/lib/sales-image-prompts.test.ts`, vitest 4.1.8). All
  six named cases are covered — coverage, congruence, variation, per-slot
  format, fallback reporting, name resolution. The congruence/variation/
  coverage claims from the handoff are no longer unverified.
- The finding itself is now pinned by a test, not only by grep: with a brief
  that states no visual position, `assumedVisualFields` returns all five names.
  That is every funnel today, because `funnelBriefFromIntake` spreads
  `blankFunnelBrief()` and sets only identity/audience/promise/voice/offer —
  confirmed by reading the function, not just searching for a writer.
- Still open, in order: add a visual input the admin can actually fill, surface
  the warning together with it, then generate one real image through the path.
- No image has been generated. Nothing about how a prompt *renders* is tested;
  these are assertions on returned strings only.
- Task D (video scripts) untouched.

## 2026-07-25 — Visual direction: the brief finally has a writer

This section supersedes the Status section above, which recorded step 1 (tests)
as the only completed step. Step 2 is now done.


**What shipped**

`SalesAiIntake` gained six flat art-direction fields — `visualSubject`,
`visualPalette`, `visualStyleKeywords`, `visualLighting`, `visualComposition`,
`visualAvoid` — and `funnelBriefFromIntake` now maps them onto
`FunnelBrief.visual`. Before this, nothing in `src/` wrote a single `visual.*`
field: the mapper spread `blankFunnelBrief()` and set only identity, audience,
promise, voice and offer. Every funnel's 16 image slots therefore rendered the
neutral fallback and `assumedVisualFields` returned all five names. The slots
agreed with each other; they did not agree with any brand.

Flat string fields, not a nested block, on purpose: the intake already stores
flat `upsell1Name`/`upsell1Price` pairs, the admin setter is
`setIntakeField(key, value)` keyed on `keyof SalesAiIntake`, and the AI-fill
merge copies an allowlist of scalar keys. A nested object would have needed all
three changed; flat fields ride plumbing that already exists and is already
tested. The list-ish fields are comma separated and split in exactly one place,
`splitVisualList`.


**Gap #4 is closed.** The gap was: `FunnelBrief.visual` had no writer, so the
visual congruence the prompt builder is designed around was congruence with a
default rather than with the brand. There is now an input, it persists, the AI
can propose it, and the mapping is pinned by tests.

**Surfacing, in the order the last session argued for.** The pre-flight warning
lives in the Offer tab beside "Generate missing images" and lists the exact
fields that will be assumed — `missingIntakeVisualFields(intake)`. It was
deliberately added *after* the input existed: a permanently-on banner with no
field to clear it would have been noise. It now clears itself when the admin
fills the fields, and a test asserts it names exactly the same paths that
`assumedVisualFields` reports after the run, so the before and after messages
cannot drift apart.

**Verification**

- `npx tsc --noEmit` — clean.
- `npx vitest run` (whole suite) — 539 passed, 39 failed across 6 files. None
  of the 6 are files this work touched: `tests/api/create-payment-intent.test.ts`,
  `tests/api/webhooks.test.ts`, `tests/utils/receipt.test.ts`,
  `tests/utils/receipt-template.test.ts`,
  `tests/lib/mothermode/compliance-pass.test.ts`, and
  `tests/lib/mothermode/review-logic.test.ts` — Stripe/receipt/webhook infra
  plus two content-hub logic tests. These are pre-existing and were not
  investigated here; they are called out so the green numbers below are not
  mistaken for a green repo.
- `npx vitest run` on the three sales suites — 44 passed, 0 failed (vitest
  4.1.8): 15 new in `tests/lib/sales-visual-direction.test.ts`, plus the 19 from
  last session and 10 offer-stack, all still green.

- New tests cover: list splitting (commas, semicolons, newlines, blank-vs-empty),
  `missingIntakeVisualFields` on blank/filled/partial intakes, the brief mapping
  field by field, all 16 slots carrying the stated style line, `avoid` reaching
  the negative prompt, two palettes producing two different worlds, a JSON round
  trip through the normalizer, and a legacy record saved before the fields
  existed still normalizing and mapping without throwing.

**Still honestly outstanding**

- No image has been generated. Every assertion here is about returned strings.
  Whether a stated palette actually improves the rendered result is unmeasured,
  and the only way to measure it is to run the generator and look.
- The AI-fill prompt now asks for `visual*` values and is told to leave a field
  empty rather than invent a look. That instruction is untested against a live
  model — no API call was made this session.
- Task D remains untouched.
- The warning's placement was verified by reading the JSX and by a clean
  typecheck, not in a browser.

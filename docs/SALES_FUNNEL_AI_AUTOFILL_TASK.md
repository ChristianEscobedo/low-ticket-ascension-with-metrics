# Sales Funnel — AI Autofill: A-Level Copy, Congruent Images, Video Scripts

Scope requested: onboarding questions → outline → **every** page field filled with A-level
copy, **congruent** image prompts for every image slot, and **video scripts** per page.

Task A (measurement) is **done** — see §1 for the measured baseline. Tasks B, C and D are
not implemented. This is a build spec written against a real audit
(`node scripts/audit-ai-fill-coverage.cjs`, read-only) so the next session starts from
facts instead of guesses.


---

## 0. Audit findings — read this before planning

| Capability | Status (measured) | Consequence |
|---|---|---|
| AI entry points | Exactly **3**: `aiGenerateSalesFunnel`, `aiFillSalesIntake`, `aiGenerateSalesPage` (`openai-sales.ts`, 972 lines) | Extend these; do not add a 4th parallel path |
| Onboarding intake | **Exists** — `blankSalesAiIntake`, `normalizeSalesAiIntake`, `syncIntakeStack`, `formatOfferStackForPrompt` (`sales/aiIntake.ts`, 351 lines) | The "quick onboarding questions" layer is **already built**. Reuse it. |
| Offer stack / bumps / upsells / bonuses | **Exists** — `blankOfferStack`, `normalizeOfferStackBump/Upsell/Bonus` | Outline structure for stack+bumps+OTOs already models what you described |
| Thank-you pages | **Exists under different names** — `success` + `access` (`SuccessContent`, `AccessContent`) | ⚠️ Do **not** build a "thank you" page. It exists as `success`/`access`. |
| Image prompts (sales) | **ABSENT** | Genuinely new work |
| Video scripts (sales) | **ABSENT** | Genuinely new work, but see reuse below |

**Reuse, do not rebuild** (all present):
`content/scriptStoryboard.ts` (94), `content/filmBible.ts` (249),
`openai-content.ts` (2472), `sales/fromOffer.ts` (401), `sales/emailAutobuild.ts` (217).
`FunnelMediaStudio.tsx` + `scripts/patch-bulk-images.cjs` already handle image *slots*;
what's missing is prompt *derivation*, not image plumbing. `VslPage.tsx` already exists,
so a generated VSL script has a home to render into.

**Net:** roughly half of what was asked is already in the repo. The real gaps are
(a) field coverage completeness, (b) image-prompt derivation, (c) video scripts.

---

## 1. Task A — Prove the coverage gap before closing it

### STATUS: DONE. Baseline measured 2026-07-25.

Run `node scripts/audit-ai-fill-coverage.cjs` (read-only, writes
`scripts/ai-fill-coverage.txt`). Current baseline:

| | count |
|---|---|
| declared fields across 11 page shapes | 321 |
| media slots (Task C, not a copy gap) | 24 |
| **non-media fields** | **297** |
| asked for by an AI schema | 276 (93%) |
| render a hardcoded literal if the model is silent | 19 |
| **render blank — nothing asks, nothing defaults** | **2** |

**"All the fields" now has a definition: GAP = 0.** Task B is done when the
audit prints `(none)` under GAP and the footer line disappears from PROMPT DRIFT.

**The headline finding is not the one I expected.** Coverage is already 93%, so
Task B is not "write the prompts" — it is three specific holes:

1. **`footer` has no AI schema at all.** Verified: the strings `footer` and
   `SalesFooterContent` appear *nowhere* in `openai-sales.ts`. Neither the
   full-funnel generator nor per-page regenerate can produce this block, so all
   5 fields fall through to `normalizeSalesFooter` literals — including
   `brandLine: 'MotherMode'` and a MotherMode-specific `disclaimer`. Every
   generated funnel ships the template's footer.
2. **19 fields render a hardcoded literal**, and 15 are on the sales page. These
   are the real congruence risk, worse than a blank: a blank is visibly missing,
   whereas `founderName: 'Loni Brown'`, `founderRole: 'Founder of MotherMode'`,
   `brandLine: 'Motherhood, Redesigned.'` and `generationalLine: 'So our
   daughters will not have to.'` render as *confident, wrong* copy in someone
   else's funnel. This is the strongest argument for the shared funnel brief in
   §2 — these fields are exactly brief-level identity, not per-page copy.
3. **Two true blanks:** `sales.pricingStackTotalLabel` and `footer.links`.

### Two corrections the audit forced (both were wrong before verification)

- **The probe's "thank-you copy: ABSENT" was wrong.** Those pages ship as
  `success` + `access`; the corrected probe reports FOUND. **Do not build a
  thank-you page.** See the §0 table.

- **The audit's own first run reported DEFAULT=0 for all 11 pages.** That was a
  parser bug, not a finding: it walked the normalizer return object by bracket
  depth and silently matched nothing. Had it been believed, all 19 hardcoded
  literals above — the most interesting result in this table — would have been
  invisible, and Task B would have been scoped as "fill 2 blanks." Fixed to read
  each field by name; the audit now prints the literal beside each field so the
  claim is checkable by eye rather than trusted.

### Reading the PROMPT DRIFT section

Entries tagged `[NOT REAL DRIFT: ... by reference ...]` are a limitation of
reading prompts as text, not defects. `optin`, `sales` and the four `upsell`
blocks define one side of their schema by pointing at another ("`... upsell
block ...`"), so that side enumerates no keys and every key looks one-sided.
Those are excluded from the drift verdict. The remaining entries are real and
small: `checkout` (3), `success` (6) and `access` (9) have keys the per-page
regenerate asks for that the full-funnel prompt does not — so "Generate funnel"
produces a thinner page than "Regenerate page" for those three.

### Still true and still first

The editor has never been rendered in a browser. Autofill writes through those
same tabs, so a render bug there will present as an AI bug. This audit reads
source text only — it proves what the prompts *ask for*, not what survives to
the page.

### Re-run it after every prompt change

The audit is the regression test for Tasks B–D: it reads `types.ts` and
`openai-sales.ts` on each run, so adding a field to an interface without adding
it to a prompt will show up as a new GAP. Precedent:
`audit-funnel-editability.cjs` → `fix-audit-gaps.cjs` did this for editability.

---

## 2. Task B — A-level copy

Scope is now known (from §1): add a `footer` block to both generators, close 2
blanks, and move the 19 hardcoded literals into generated copy — prioritising the
identity-bearing ones (`founderName`, `founderRole`, `brandLine`,
`generationalLine`, `categoryLine`, footer `disclaimer`). Also close the real
drift on `checkout`/`success`/`access` so the two generators agree.


- Copy quality is a **prompt** problem, not a schema problem. The frameworks already used
  for email (`email/frameworks/*`: PAS, soap-opera, objection-crusher…) are the model for
  what "A-level" means here; consider a `sales/frameworks/` peer rather than ad-hoc
  prose instructions.
- Feed `formatOfferStackForPrompt` output + Brand Bible context
  (`context/fromBrandBible.ts`) so voice is consistent across pages.
- **Congruence requires one call, or a shared brief.** Per-page independent calls will
  drift — different promises, different avatar language. Generate a single "funnel brief"
  first, persist it, then have every page/image/script call consume it. This is the one
  architectural decision that is expensive to retrofit; make it first.

## 3. Task C — Congruent image prompts

- Add `imagePrompt` derivation keyed to the same funnel brief. Congruence across images
  is the stated requirement, so the brief must carry subject/style/palette, not just copy.
- Enumerate real slots with `scripts/inspect-image-slots.cjs` (exists) before inventing
  fields.
- Feed into existing generation (`openai-content.ts`, `fal-smart-resize`), do not add a
  new image pipeline.

## 4. Task D — Video scripts per page

- Wrap `scriptStoryboard.ts` + `filmBible.ts` rather than writing a new generator.
- Per-page intent already exists in `emailPlan.ts` (`success: 'pre-post-purchase'`,
  `access: 'community-onboarding'`, upsell/no-branches…). Reuse those intents so a page's
  script matches the page's job.
- Storage: video scripts are a new persisted asset → needs a migration + `store.ts`
  normalizer. Follow the `20260902000000_sales_funnel_email_kits.sql` precedent.

---

## 5. Sequencing (why this order)

1. ~~**Task A** (measure)~~ — **done**; it defines "done" for everything after it (GAP = 0).
2. **Funnel brief** (§2 bullet 3) — the congruence substrate for B, C, and D. **Start here.**
3. **Task B** copy → **Task C** images → **Task D** scripts.


Doing C or D before the brief exists guarantees rework, because congruence is exactly the
thing a shared brief provides.

## 6. Standing risk — carried over, still open

Steps 1–7 of the editor refactor have **never been rendered in a browser**. `tsc` is clean,
which is not the same claim. Autofill writes to those same fields through the same tabs, so
a render bug there will look like an AI bug here and cost far more to diagnose. **Render-check
the editor before starting Task B.** Task A did not need it — it reads source text only and
never renders — so the risk is unchanged and now blocking, not deferred.


Also note: token cost and latency will rise materially — a full-funnel generate becomes
copy + images + scripts across ~10 page shapes. Decide whether generation is per-page
on-demand or one long job with progress, and reuse the in-flight/`disabled` guard pattern
from `fix-page-regen-disabled.cjs` so a second job cannot be fired over the first.

## 2026-07-25 — Visual direction: the brief finally has a writer

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


**Effect on coverage.** Six new intake fields are now AI-fillable and
admin-editable, and one previously unreachable brief block (`visual`, five
reported paths) now has a path from input to output. Anyone re-running
`scripts/audit-ai-fill-coverage.cjs` should expect the totals to move; the
numbers recorded earlier in this doc predate these fields.

# Task C — Image prompts (done) → Task D — Video scripts (next)

## What was wrong

`SalesFunnelEditor.onGenerateImages` derived every image prompt from an inline
string literal that hardcoded `'Warm dark background, brass and bone palette,
calm luxury'`. That is MotherMode's visual world, baked into every funnel any
user generates — the image-side twin of the `'Loni Brown'` / `'MotherMode'` copy
literals Task B moved into the schema. It fails the same way copy literals do:
confidently wrong rather than visibly empty, so nobody files a bug.

## What changed

**`src/lib/mothermode/sales/imagePrompts.ts`** (new) derives prompts from
`FunnelBrief.visual` — the same brief the copy generators read. One brief → one
visual world → congruent images across optin, sales, checkout, 4 upsells.

- `SALES_IMAGE_SLOTS` enumerates all 16 image slots as *data*, sourced from the
  MEDIA rows of `scripts/ai-fill-coverage.txt` minus pure-video fields. Data, not
  a switch, so the audit can assert slot coverage later instead of trusting a comment.
- `formatVisualStyleLine()` is the one sentence every image embeds verbatim.
  Congruence lives there: two images differ in *framing*, never in *world*.
- `framingFor()` handles intent (hero / portrait / product-mockup / poster /
  gallery). Gallery slots vary angle across the 3 shots so a 3-up reads as a set.
- `SalesImageFormat` is now a named export; `SalesImageSlot['format']` refers to
  it rather than restating the union.

**`SalesFunnelEditor.tsx`** — `onGenerateImages` calls `buildSalesImagePrompts`;
12 slots carry `slot.format` through to `aiGenerateImage(prompt, format)`. It
previously passed `'feed'` for all of them, so a wide sales hero and a square
checkout thumbnail were generated at identical aspect ratio and letterboxed by
CSS. Now the request matches the slot.

## The honest limits

- **No brand invention.** Empty `brief.visual` gets a deliberately forgettable
  neutral fallback (`clean, editorial, uncluttered`) and every substituted field
  is listed in `SalesImagePromptSet.assumedVisualFields`. Generic-but-labelled
  beats on-brand-for-the-wrong-brand. **Nothing surfaces `assumedVisualFields` in
  the UI yet** — the signal exists but the admin can't see it. Worth wiring.
- **No tests.** `imagePrompts.ts` is pure and trivially testable (brief in,
  strings out) but has no `tests/lib/` file. The claims above — congruent style
  line, varied gallery angles, fallback reporting — are currently unverified.
- **Not run end-to-end.** Typecheck is clean and prompt text was read by eye;
  no images have actually been generated through this path.

## Task D — video scripts

Untouched. The video slots deliberately skipped here:
`sales.heroVideoUrl`, `vsl.videoUrl`, `success.welcomeVideoUrl`,
`upsell{1..4}.videoUrl`. Note `mediaVideoPoster` is already covered by Task C —
a poster is a still.

Existing machinery to reuse rather than rebuild: `content/scriptStoryboard.ts`,
`content/filmBible.ts`, `content/reelDirector.ts`, `openai-content.ts`. The same
literal-inheritance failure likely lives in whatever currently seeds VSL copy —
check it against `funnelBrief.ts` before writing anything new.

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


**The pipeline as it now stands**

```
Offer tab visual fields (or AI fill)
  -> SalesAiIntake.visual*            (persisted in the existing ai_intake JSON)
  -> funnelBriefFromIntake            -> FunnelBrief.visual
  -> buildSalesImagePrompts           -> styleLine + 16 slot prompts
                                      -> assumedVisualFields (now usually empty)
```

No migration was needed: the intake is stored as JSON, and
`normalizeSalesAiIntake` fills the new keys with `''` for records written
before they existed. A test pins that legacy path.

Unchanged and still true: `assumedVisualFields` reports what the builder had to
assume, and an empty `visualAvoid` is never reported because the builder always
has a base negative list.

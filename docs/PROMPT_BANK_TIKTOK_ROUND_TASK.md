# Prompt Bank: TikTok Round — Scripts, Covers, and Spark-Style Ads — Task Spec

**Status:** SHIPPED. All three pillars landed exactly as specced:
`promptBankRound4.ts` (10 `ttshort-` + 6 `ttad-`, 5 inputs-bar recipes) and
`imagePromptBankRound4.ts` (8 `ttimg-` covers, the missing cover sub-bank
from the roadmap), spread into `PROMPT_RECIPES` / `IMAGE_PROMPT_RECIPES`
with no picker, route, generator, or migration changes. The 8 cross-posted
`ytshort-` frameworks all carry tiktok `platformNotes` now (3 notes added
this round: comment-bait, micro-method, watch-twice), so no `ttshort-`
recipe near-duplicates a Short. Tests: 66 bank tests green across the two
suites (counts 105 → 121 text, 58 → 66 image, round-4 family + inputs +
cross-post assertions) plus 23 `prompt-bank-actions`; `tsc --noEmit` clean;
dry-run seed lists all 201. One DB step remains before the bank is live:
the long-standing §2 migration apply in
`PROMPT_BANK_ROUND3_HANDOFF_TASK.md`, then
`node scripts/seed-prompt-bank.cjs` → expect `upserted 201 recipes`.

**Status history:** Spec, ready to build → SHIPPED (this round)
**Bank surface:** `promptBankRound4.ts` + `imagePromptBankRound4.ts` (new
files, round-2/3 pattern), `/admin/prompt-bank` + Test lab for verification
**Prereq:** migrations `20261029000000` (image group) and `20261030000000`
(inputs) applied + the seed re-run (see `PROMPT_BANK_ROUND3_HANDOFF_TASK.md`
§2). No NEW migration is expected for this round (group/kind/size_presets/
inputs columns already exist).
**Origin:** written from the shipped YouTube spec (`PROMPT_BANK_YOUTUBE_ROUND_TASK.md`)
§9, as directed by `PROMPT_BANK_ROUND3_HANDOFF_TASK.md` §3.

---

## 1. What this is

The roadmap's round 3 is the video-first round, and it landed in two halves.
The YouTube half shipped in `promptBankRound3.ts` +
`imagePromptBankRound3.ts`. This task is the **TikTok half**, three pillars:

1. **`ttshort-` TikTok script frameworks** — TikTok-native viral and value
   structures (Stitch answers, comment replies, green screen receipts, calm
   voiceovers, counters, quiet methods, photo mode) added to the text bank.
2. **`ttimg-` TikTok cover images** — the missing cover sub-bank from the
   roadmap: brand-locked, type-ready 9:16 compositions with TikTok chrome
   safe zones, added to the image bank.
3. **`ttad-` TikTok ad frameworks** — Spark-style native ad scripts
   (`kind: 'ad'`, goal clicks): the ad must survive as an organic post
   first, because on TikTok anything that reads as an ad gets scrolled.

Everything rides the existing recipe shape and the shipped generator
plumbing (batch `style`/rotation, `imageFramework`, Test lab, the
`<FrameworkPicker>` on every generator surface). No new generator internals,
no picker work, no migration. The Generate drawer's image-bank select is
already driven by `imageRecipesFor(platform, kind)` from the live merged
bank, so `ttimg-` covers appear on the tiktok channel automatically.

## 2. What already exists (do not duplicate)

- **TikTok text frameworks (3):** tiktok-3s-hook, tiktok-pov-skit,
  tiktok-storytime-loop (round 1, `promptBank.ts`), plus tiktok
  platformNotes on actionable-authority, challenge-beliefs, analogy,
  niched-entertainment, open-loop, feel-good, signs-list.
- **Cross-posted Shorts (8):** the `ytshort-` set ships with tiktok
  `platformNotes` (loop-answer, three-things, pov-system, myth-flip-15,
  story-loop from the YouTube round; comment-bait, micro-method,
  watch-twice completed in this round). Rule from the YouTube spec §9:
  cross-posted frameworks get tiktok `platformNotes`, never near-duplicate
  `ttshort-` recipes.
- **Photo mode:** TikTok slideshow pieces ship in the catalog
  (`COLORBLOCK_AND_SLIDESHOW_FORMATS_PORT.md`), format `slideshow`.
- **Size presets** (`platformSizes.ts`): `ig-fb-story` ("Story / Reel /
  TikTok 9:16", 1080x1920, platforms include tiktok) and `ad-916` for paid
  9:16. No new preset needed.
- **Pickers (shipped):** once seeded + enabled, every new recipe appears in
  the Generate drawer (tiktok channel, fitsOnly list), Test lab, and the
  image-stage pickers automatically. Nothing to wire.

## 3. Pillar A — `ttshort-` TikTok script frameworks (text bank, +10)

Full recipe shape (3 whyItWorks, beat-structured {Slot} timecoded template,
2 example openers, craft with pacing + retention + sound-off orders, goal,
platforms `['tiktok']`, formats `['video', 'reel']`; photo mode lists
`['slideshow', 'video']`). Where a cross-post is natural, add a
`platformNotes` line for `instagram` instead of duplicating the recipe.

**Viral leaning (5):**

| id | Framework |
| --- | --- |
| `ttshort-stitch-answer` | Stitch her question, answer with the method, hand the thread back (inputs candidate) |
| `ttshort-comment-reply` | Video reply to a real comment: the comment card is the hook (inputs candidate) |
| `ttshort-green-screen-receipt` | Green screen over the proof (the count, the page, the thread) |
| `ttshort-voiceover-reset` | Calm monologue over a real task; the voice is the follow trigger |
| `ttshort-day-count` | Day in the life with a running on-screen counter; the total is the payoff (inputs candidate) |

**Value leaning (5):**

| id | Framework |
| --- | --- |
| `ttshort-stopped-doing` | The quit list: what she stopped doing and what each gave back |
| `ttshort-quiet-method` | No talking, text cards carry the steps, hands prove them |
| `ttshort-ranked-list` | Worst-to-winner ranking; the order is the argument |
| `ttshort-watch-me` | The method in real time, one take, honest timer |
| `ttshort-photo-carousel` | Photo mode essay: one beat per frame, text carries the lesson |

## 4. Pillar B — `ttimg-` TikTok cover frameworks (image bank, +8)

Same recipe shape as the existing thumbnails: scene skeleton with {Slots},
art direction in `craft`, 2 filled example prompts, `kind: 'organic'`,
goal `clicks`, `sizePresetIds: ['ig-fb-story']` (1080x1920), platforms
`['tiktok']`, formats `['video', 'reel']`. **Brand lock holds:** no baked-in
text (the overlay editor carries the cover title), faces off, warm bone /
aubergine / brass palette. Every recipe keeps the bottom quarter (caption +
follow chrome) and the right rail (action icons) quiet and low-detail; the
title zone lives upper-middle left.

| id | Framework | Angle |
| --- | --- | --- |
| `ttimg-cover-title-field` | The workhorse title cover | Calm field + huge clean type zone for one big line |
| `ttimg-series-hero` | Series consistency | Same hero object, same locked composition, episode-safe band |
| `ttimg-split-before-after` | Horizontal split | Chaos on top, calm below, the transformation in half a second |
| `ttimg-object-story` | The telling object | One prop carries the whole story, calm space around it |
| `ttimg-hands-mid-method` | Hands mid-action | The doing, frozen at the most legible moment |
| `ttimg-count-row` | Vertical list rhythm | Three objects in a column, numerals from the overlay |
| `ttimg-quiet-scene` | Cinematic quiet moment | A still from her movie; storytime/confession audience |
| `ttimg-receipt-closeup` | Macro proof | The tally, the ticked boxes, unreadable marks filling the frame |

## 5. Pillar C — `ttad-` TikTok ad frameworks (text bank, +6)

`kind: 'ad'`, goal `clicks`, platforms `['tiktok']`, formats `['video',
'reel']`. Templates are second-by-second native ad structures with the
Spark economics in the craft: hook inside 2 seconds, text on screen for the
muted scroller, brand named late, price in the final-3-second CTA, and a
comment-section plan in every recipe (pin the receipt, answer the first
hour, harvest the next creative from the thread).

| id | Framework |
| --- | --- |
| `ttad-spark-proof` | Spark proof post: the winning organic shape with the CTA bolted on last (inputs candidate) |
| `ttad-ugc-testimonial` | UGC testimonial: mother to mother, receipts on screen (inputs candidate) |
| `ttad-native-problem` | Problem-first native: reads like the For You page, converts like an ad |
| `ttad-demo-realtime` | The 30-second real-time demo, honest timer, no cuts on the work |
| `ttad-comment-offer` | The genuine question ad: the comments sell it, the CTA pins it |
| `ttad-offer-stack` | The $7 stack: everything she gets, item by item, price as arithmetic |

## 6. Custom input fields (round-4 inputs bar)

Same bar as the round-3 set: real material only, each field `{ id, label,
placeholder?, hint?, required? }`, blank falls back to the offer facts.
Five recipes carry inputs this round: ttshort-stitch-answer (question +
answer), ttshort-comment-reply (comment), ttshort-day-count (count),
ttad-spark-proof (post), ttad-ugc-testimonial (testimonial + receipts).
The fields render automatically in the Test lab, the Generate drawer, and
every `<FrameworkPicker>` surface.

## 7. Code + test touch points

- New `src/lib/mothermode/content/promptBankRound4.ts` (16 text recipes),
  spread into `PROMPT_RECIPES` exactly like rounds 2 and 3.
- New `src/lib/mothermode/content/imagePromptBankRound4.ts` (8 cover
  recipes), spread into `IMAGE_PROMPT_RECIPES`.
- `promptBankRound3.ts`: tiktok `platformNotes` added to
  ytshort-comment-bait, ytshort-micro-method, ytshort-watch-twice (the
  other 5 Shorts already carry them). No count changes.
- `tests/lib/prompt-bank.test.ts`: count assertions 105 → 121, round-4
  family coverage (ttshort/ttad ids exist, ad kinds marked, inputs bar,
  ytshort tiktok cross-post notes complete).
- `tests/lib/image-prompt-bank.test.ts`: count assertions 58 → 66, sub-bank
  split gains `ttimg-` 8, round-4 covers carry `ig-fb-story` presets + the
  no-baked-in-text rule, `imageRecipesFor('tiktok', 'organic')` = 8,
  ALL_SEED_RECIPES 163 → 187.
- `scripts/seed-prompt-bank.cjs --dry` lists the new recipes, then real
  seed → expect `upserted 201 recipes` (121 text + 66 image + 14 styles).
- No picker, route, or generator changes. No new migration.

## 8. Build order

1. Author `promptBankRound4.ts` (ttshort viral → ttshort value → ttad),
   full quality bar, voice-safe sweep.
2. Author `imagePromptBankRound4.ts` (8 covers), brand-lock + safe-zone
   sweep.
3. Add the 3 missing tiktok cross-post notes to round-3 Shorts.
4. Update the two test files' count + family assertions; run the two bank
   suites + `prompt-bank-actions` + `tsc --noEmit`.
5. `node scripts/seed-prompt-bank.cjs --dry`, then real seed.
6. Test lab spot-checks: one ttshort, one ttad, two ttimg covers.
   Generate-drawer check: tiktok channel shows the new frameworks
   (fitsOnly list) and the cover select with no code change.
7. Docs: `CONTENT_PROMPT_BANK_SYSTEM_PORT.md` (counts + round-4 family
   lines + tests section), `PROMPT_BANK_ROUND3_HANDOFF_TASK.md` (§1 state,
   §3 TikTok SHIPPED), `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` §8h
   counts, `PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` (progress table +
   taxonomy), the YouTube spec cross-ref, and mark this spec SHIPPED.

## 9. Follow task (write its spec when this one ships)

The roadmap's round 4 is the **commerce layer**: ascension/upsell copy
frameworks, cart abandonment, win-back, seasonal pushes, and offer-specific
ad variants per funnel stage (cold/warm/hot). Same two-file round pattern,
same quality bar. Candidate image companions from the roadmap: `ximg-` X
cards, `pinimg-` Pinterest pins, `blimg-` blog/AEO headers.

## 10. Non-goals

- No generator or picker changes (script frameworks execute through the
  existing video/reel format guides; covers ride `imageFramework`).
- No new database migration (columns already exist).
- No AI-authored recipes (standing rule: bank entries are human-authored).
- No near-duplicate `ttshort-` versions of cross-posted `ytshort-`
  frameworks (tiktok `platformNotes` on the Shorts instead).
- No TikTok API/publishing work (the social pipeline is a separate system).

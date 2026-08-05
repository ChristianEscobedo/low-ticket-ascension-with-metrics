# Prompt Bank: YouTube Round — Thumbnails, Scripts (Short + Long), and YouTube Ads — Task Spec

**Status:** SHIPPED. All three pillars landed exactly as specced:
`promptBankRound3.ts` (8 `ytshort-` + 8 `ytlong-` + 6 `ytad-`, 5 inputs-bar
recipes) and `imagePromptBankRound3.ts` (10 `ytthumb-`, sub-bank 15 → 25),
spread into `PROMPT_RECIPES` / `IMAGE_PROMPT_RECIPES` with no picker, route,
generator, or migration changes. Tests: 40 bank tests green across the two
suites (counts 83 → 105 text, 48 → 58 image, round-3 family + inputs
assertions) plus 17 `prompt-bank-actions`; `tsc --noEmit` clean; dry-run
seed lists all 177. One DB step remains before the bank is live: the
long-standing §2 migration apply in `PROMPT_BANK_ROUND3_HANDOFF_TASK.md`,
then `node scripts/seed-prompt-bank.cjs` → expect `upserted 201 recipes`.
The §9 follow task shipped as the TikTok half:
`PROMPT_BANK_TIKTOK_ROUND_TASK.md` (SHIPPED).

**Status history:** Spec, ready to build → SHIPPED (this round)
**Bank surface:** `promptBankRound3.ts` + `imagePromptBankRound3.ts` (new files,
round-2 pattern), `/admin/prompt-bank` + Test lab for verification
**Prereq:** migrations `20261029000000` (image group) and `20261030000000`
(inputs) applied + the 145-recipe seed re-run (see
`PROMPT_BANK_ROUND3_HANDOFF_TASK.md` §2). No NEW migration is expected for
this round (group/kind/size_presets/inputs columns already exist).
**Follow task (separate, after this one ships):** TikTok same thing — see §9.

---

## 1. What this is

Round 3 of the roadmap (`PROMPT_BANK_1000_AND_TEST_LAB_TASK.md`) is the
video-first round, and it lands in two halves. This task is the **YouTube
half**, three pillars:

1. **More `ytthumb-` thumbnail image recipes** — the most viral thumbnail
   frameworks, added to the image bank.
2. **`ytshort-` + `ytlong-` script frameworks** — the most viral AND the most
   value-based YouTube script structures, Shorts (`reel`) and long-form
   (`long`), added to the text bank.
3. **`ytad-` YouTube ads frameworks** — pre-roll and in-feed ad script
   structures (`kind: 'ad'`, goal clicks), new ad surface for the bank.

Everything rides the existing recipe shape and the shipped generator
plumbing (batch `style`/rotation, Test lab, the `<FrameworkPicker>` on every
generator surface). No new generator internals, no picker work, no
migration.

## 2. What already exists (do not duplicate)

- **YT text frameworks (3):** title+thumbnail pair, retention intro, value
  density (round 1, `promptBank.ts`), plus youtube platformNotes on
  personal-story / actionable-authority.
- **YT thumbnail image recipes (15):** round 1 (curiosity scene, result
  hero, before-after split, big-number hero, versus face-off, peak moment,
  opt-in face close-up) + round 2 (checklist hero, 30-day timeline, minimal
  object, physical chart, mirror split, offer stack, myth busted, day in
  the life).
- **YouTube Studio kit** (`openai-youtube.ts`): A/B titles, SEO description,
  tags, chapters, thumbnail concepts for any piece.
- **Script format guides** (`formatFieldGuide` reel/long) and the dedicated
  `videoScript` generator action.
- **Size presets** (`platformSizes.ts`): `yt-thumb` (1280x720), `yt-long-169`,
  `yt-shorts`.
- **Pickers (shipped):** once seeded + enabled, every new recipe appears in
  the Generate drawer (youtube channel), Test lab, and the image-stage
  pickers automatically. Nothing to wire.

## 3. Pillar A — `ytthumb-` viral thumbnail frameworks (image bank, +10)

Same recipe shape as the existing thumbnails: scene skeleton with {Slots},
art direction in `craft`, 2 filled example prompts, `kind: 'organic'`
(unless noted), `sizePresetIds: ['yt-thumb']`, platforms `['youtube']`,
formats `['long']` (thumbnails sell the long-form click; a couple may also
list `reel`). **Brand lock holds:** no baked-in text, faces soft or absent
(the existing face close-up is the only opt-in), warm bone / aubergine /
brass palette. Text-anchored viral frameworks become **type-ready**
compositions with an explicit safe zone (the overlay editor carries the
words).

Starter backlog (tighten with the owner before authoring):

| id | Framework | Angle |
| --- | --- | --- |
| `ytthumb-contrast-marker` | Circle/arrow annotation | A graphic circle or arrow (never text) points at the one story object |
| `ytthumb-curiosity-gap-object` | Out-of-context object | The wrong-looking, half-hidden prop that demands the click |
| `ytthumb-split-decision` | Two-option split | This-or-that composition with a clear visual winner |
| `ytthumb-countdown-still` | List rhythm | 3 ordered objects as the list's rhythm; the overlay carries numerals |
| `ytthumb-documentary-grab` | Frame-grab feel | Mid-action caught-in-the-act still, slight motion energy |
| `ytthumb-empty-chair` | The absence device | Empty desk/chair/screen implying what just happened |
| `ytthumb-prop-confession` | Damning prop | One incriminating object in hard light (page/screen unreadable) |
| `ytthumb-scale-contrast` | Tiny vs huge | Macro object against a field of negative space |
| `ytthumb-then-now-map` | Timeline diptych | Left chaos, right calm, one shared palette, no words |
| `ytthumb-confessional-light` | Quiet confessional | Window light, hands, steam; face-adjacent but faceless |

## 4. Pillar B — `ytshort-` + `ytlong-` script frameworks (text bank, +16)

Full recipe shape (3 whyItWorks, beat-structured {Slot} template, 2 example
openers, craft with **pacing + retention orders**, goal, platforms
`['youtube']`). Shorts use formats `['reel']`; long-form uses `['long']`.
Where a cross-post is natural, add a `platformNotes` line for `tiktok` /
`instagram` (reel) instead of duplicating the recipe under another platform.

**`ytshort-` Shorts (8):**

| id | Leaning | Framework |
| --- | --- | --- |
| `ytshort-loop-answer` | Viral | Question cold-open, answer lands in the final 3s, loops clean |
| `ytshort-three-things` | Viral | "3 things" rapid list, one beat per item, number on screen |
| `ytshort-pov-system` | Viral | POV: the system watching her (punch at systems, never people) |
| `ytshort-comment-bait` | Viral | The genuine question Short; reply bait, not engagement bait |
| `ytshort-micro-method` | Value | One usable method in 30s, verb-first steps as beats |
| `ytshort-myth-flip-15` | Value | The 15-second myth flip, mechanism in one line |
| `ytshort-story-loop` | Value | Micro-storytime; the lesson is the loop point (candidate for inputs) |
| `ytshort-watch-twice` | Value | Dense save-driven value bomb, fast beats, no filler |

**`ytlong-` long-form (8):**

| id | Leaning | Framework |
| --- | --- | --- |
| `ytlong-retention-essay` | Value | Open-loop chaptered essay; the flagship retention arc |
| `ytlong-ultimate-guide` | Value | Searchable ultimate guide with chapter markers |
| `ytlong-teardown-audit` | Value | Teardown of a system (hers, ours, the culture's) (inputs candidate) |
| `ytlong-experiment-vlog` | Value | "I did X for 30 days", rules + receipts + verdict (inputs candidate) |
| `ytlong-documentary-case` | Value | Mini-documentary case study: one mother, one system, full arc |
| `ytlong-challenge-arc` | Viral | Challenge/reset vlog with day-by-day escalation |
| `ytlong-confession-hour` | Viral | Long confessional sit-down; vulnerability plus competence (inputs candidate) |
| `ytlong-vs-week` | Viral | X vs Y week: two methods tested side by side, verdict |

## 5. Pillar C — `ytad-` YouTube ads frameworks (text bank, +6)

`kind: 'ad'`, goal `clicks`, platforms `['youtube']`, formats `['long',
'reel']`. Templates are second-by-second ad structures (hook window, brand
window, proof, CTA) with the skip economics in the craft. Pairing notes
point at existing `ytthumb-` recipes for the visual (no new image recipes
required this round).

| id | Framework |
| --- | --- |
| `ytad-preroll-pas` | 5-second-hook PAS pre-roll: hook before the skip, brand by :08, CTA at :25 |
| `ytad-preroll-proof` | Proof-first pre-roll: the receipt lands in the first 5 seconds |
| `ytad-preroll-founder` | Founder direct-address pre-roll: calm, calibrated, one offer |
| `ytad-infeed-answer` | In-feed search ad: the script + title brief answers the search verbatim |
| `ytad-demo-walkthrough` | 60-second demo: the system working in real time |
| `ytad-testimonial-ugc` | UGC-style testimonial: mother-to-mother read, receipts on screen (inputs candidate) |

## 6. Custom input fields (round-3 inputs bar)

Round-3+ recipes may declare `inputs` under the same bar as the 18 curated
round-1/2 recipes (see `PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` §5 and the
system port's inputs section): real material only, each field `{ id, label,
placeholder?, hint?, required? }`, blank falls back to the offer facts.
Candidates marked above (ytshort-story-loop, ytlong-teardown-audit,
ytlong-experiment-vlog, ytlong-confession-hour, ytad-testimonial-ugc).
Keep it to ~5; the fields render automatically in the Test lab, the
Generate drawer, and every `<FrameworkPicker>` surface.

## 7. Code + test touch points

- New `src/lib/mothermode/content/promptBankRound3.ts` (22 text recipes),
  spread into `PROMPT_RECIPES` exactly like round 2.
- New `src/lib/mothermode/content/imagePromptBankRound3.ts` (10 thumbnail
  recipes), spread into `IMAGE_PROMPT_RECIPES`.
- `tests/lib/prompt-bank.test.ts`: count assertions 83 → 105, round-3
  family coverage (ytshort/ytlong/ytad ids exist, ad kinds marked), any
  inputs well-formed + voice-safe.
- `tests/lib/image-prompt-bank.test.ts`: count assertions 48 → 58, ytthumb
  split 15 → 25, round-3 thumbnails carry `yt-thumb` presets + the
  no-baked-in-text rule.
- `scripts/seed-prompt-bank.cjs --dry` lists the new recipes, then real
  seed → expect `upserted 177 recipes` (105 text + 58 image + 14 styles).
- No picker, route, or generator changes. No new migration.

## 8. Build order

1. Confirm the starter backlog with the owner (tables in §3-§5), tighten
   angles, mark the inputs candidates.
2. Author `promptBankRound3.ts` (ytshort → ytlong → ytad), full quality bar,
   voice-safe sweep.
3. Author `imagePromptBankRound3.ts` (10 thumbnails), brand-lock sweep.
4. Update the two test files' count + family assertions; run the two bank
   suites + `prompt-bank-actions` + `tsc --noEmit`.
5. `node scripts/seed-prompt-bank.cjs --dry`, then real seed.
6. Test lab spot-checks: one Short, one long-form, one ytad, two
   thumbnails. Generate-drawer check: youtube channel shows the new
   frameworks (fitsOnly list) with no code change.
7. Docs: `CONTENT_PROMPT_BANK_SYSTEM_PORT.md` (counts + round-3 family
   lines + tests section), `PROMPT_BANK_ROUND3_HANDOFF_TASK.md` (§3 +
   backlog), `MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md` §8h counts, and mark
   this spec SHIPPED.

## 9. Follow task (write its spec when this one ships)

**TikTok same thing:** `ttshort-` TikTok script frameworks (viral + value
families mirroring §4), `ttimg-` TikTok cover images (the missing cover
sub-bank from the roadmap), and `ttad-` TikTok ad frameworks (Spark-ads
style native structures). Same two-file round pattern, same quality bar.
Author it as `PROMPT_BANK_TIKTOK_ROUND_TASK.md` using this doc as the
template, and note that cross-posted Shorts frameworks should get tiktok
`platformNotes` rather than near-duplicate recipes.

## 10. Non-goals

- No generator or picker changes (script frameworks execute through the
  existing reel/long format guides and the `videoScript` action).
- No new database migration (columns already exist).
- No AI-authored recipes (standing rule: bank entries are human-authored).
- No YouTube Studio kit changes (titles/descriptions/chapters already
  generate per piece).
- The TikTok round is the NEXT doc, not this one.

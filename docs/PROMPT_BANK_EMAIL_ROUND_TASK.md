# Prompt Bank: Email Ascension Round — Sophisticated, Ultra-Long-Form, Purchase + OTO Nurture, Goal-Driven — Task Spec

**Status:** SHIPPED. All three scopes landed exactly as specced:
`promptBankRound5.ts` (8 `email-` + 6 `emlf-` + 8 `embuy-` + 4 `emgoal-`,
11 inputs-bar recipes incl. the offer + goal custom fields) and
`imagePromptBankRound5.ts` (6 `emimg-` on the `email-header` preset),
spread into `PROMPT_RECIPES` / `IMAGE_PROMPT_RECIPES` with no picker,
route, generator, or migration changes. Scope 2: 6 ascension framework
specs in `email/frameworks/ascension.ts` (buyer-welcome, ascension-bridge,
deep-nurture, oto-ascend, goal-driven, ps-close), the enum extended, the
`pre-post-purchase` campaign remapped (welcome → buyer-welcome, bridge →
ascension-bridge). Scope 3: optional `frameworkRecipeId` on `EmailMessage`
(rides the sequence JSONB, no migration), the kit editor's Bank framework
picker (live merged bank, trigger-matched families first via
`orderEmailRecipesForTrigger`), the expand pass injecting
`recipeCraftBlock` + `recipeInputsBlock` (goal/offer fill from the kit
intake, assignment survives rewrites), and the flow canvas trigger node's
read-only hint chip (`triggerRecipeFamilyLabel`). Tests: 111 green across
`prompt-bank` (147), `image-prompt-bank` (72, split 17/8/25/4/4/8/6),
`prompt-bank-actions` (+3 trigger-wiring cases), `email-kit` (+3 round-5
cases), `email-triggers`, `email-flow`; `tsc --noEmit` clean; dry-run seed
lists all 233. One DB step remains before the bank is live: the
long-standing §2 migration apply in `PROMPT_BANK_ROUND3_HANDOFF_TASK.md`,
then `node scripts/seed-prompt-bank.cjs` → expect `upserted 233 recipes`.

**Status history:** Spec, ready to build → SHIPPED (this round)
**Bank surface:** `promptBankRound5.ts` + `imagePromptBankRound5.ts` (new
files, round-2/3/4 pattern), `/admin/prompt-bank` + Test lab for
verification. Kit surface: `src/lib/mothermode/email/frameworks/*` (+6
specs), `EmailKitEditor.tsx` + flow canvas trigger wiring.
**Prereq:** migrations `20261029000000` (image group) and `20261030000000`
(inputs) applied + the seed re-run (see `PROMPT_BANK_ROUND3_HANDOFF_TASK.md`
§2). No NEW migration is expected: recipe columns already exist, the kit
`EmailMessage` extension rides the sequence JSONB blob.
**Origin:** owner request after the TikTok round shipped; merges the
roadmap's round 4 (commerce layer, email half) and round 5 (email depth)
from `PROMPT_BANK_1000_AND_TEST_LAB_TASK.md` §4.

---

## 1. What this is

The email round, three scopes confirmed with the owner:

1. **Prompt bank recipes** — sophisticated `email-` frameworks,
   ultra-long-form value-forward `emlf-` essays, purchase + OTO nurture
   `embuy-` sequences-emails, and goal-driven `emgoal-` emails, plus the
   `emimg-` email image sub-bank.
2. **Email Kit frameworks** — 6 new per-email framework specs in
   `email/frameworks/*` so kit sequences can assign the new structures per
   role.
3. **Trigger wiring** — bank recipes attachable to kit emails, suggested by
   the sequence's enrollment trigger (`purchase`, `upsell_purchase`,
   `refund`), injected at expand time. Rides the sequence JSONB; no schema
   change.

## 2. What already exists (do not duplicate)

- **Bank email recipes (2):** email-subject-curiosity, email-open-loop-story
  (round 1, `promptBank.ts`).
- **Email Kit** (`email/frameworks/*`): 9 per-email frameworks (soap-opera,
  pas, value-longform, story-lesson, quick-win, founder-note, case-study,
  objection-crusher, listicle) + 8 campaign blueprints
  (`email/campaigns/*`) with per-role framework defaults.
- **Trigger taxonomy** (`email/triggers.ts`): funnel triggers `optin`,
  `page_view`, `sales_page_view`, `checkout_start`, `abandon`, `purchase`,
  `upsell_purchase`, `booking`, `refund`, `tag_added` with funnel pages and
  the cascading `triggerConfig` (page → offer) on the sequence.
- **Sales funnel events** (`sales/types.ts`): upsell1-4 steps, `purchase` /
  `upsell_yes` / `upsell_no` event types.
- **Size preset** (`platformSizes.ts`): `email-header` (1200x600, 2:1).
- **`lf-` ultra-long-form family** (round 2): 8 value-forward structures
  for article/blog surfaces; `emlf-` translates the register to the inbox.
- **Inputs bar** (rounds 3-4): `recipe.inputs` renders in the Test lab, the
  Generate drawer, and every `<FrameworkPicker>`; blank falls back to offer
  facts.

## 3. Pillar A — `email-` sophisticated frameworks (text bank, +8)

Full recipe shape (3 whyItWorks, {Slot} email template, 2 example openers,
craft with inbox economics: subject/preheader orders, one-idea discipline,
PS strategy). `platforms: ['email']`, `formats: ['email']`, organic (no
`kind`).

| id | Framework |
| --- | --- |
| `email-founder-letter` | The plain-text founder letter: one idea, no design, letter register |
| `email-teach-everything` | The full method in one send; the teach-everything trust builder |
| `email-story-receipt` | Narrative arc with the proof embedded mid-story |
| `email-objection-faq` | The top 4 objections answered in one email, fairly |
| `email-honest-last-call` | The deadline email that stays kind; honest scarcity only |
| `email-quick-win` | One 5-minute win, reply-bait close |
| `email-open-loop-tease` | Today teases tomorrow: the sequence-glue email |
| `email-ps-close` | Soft body, the P.S. sells: the postscript-driven email |

## 4. Pillar B — `emlf-` ultra-long-form value essays (text bank, +6)

The `lf-` register translated to the inbox: chaptered, saveable,
worth-the-scroll. Same recipe shape; craft carries chapter discipline and
the save/forward orders.

| id | Framework |
| --- | --- |
| `emlf-ultimate-guide` | The definitive guide in one send, chaptered |
| `emlf-deep-dive` | One system, fully taught, start to finish |
| `emlf-research-report` | We counted; the data email with the so-what |
| `emlf-masterclass` | The free masterclass in one email |
| `emlf-encyclopedia` | The reference email she saves forever |
| `emlf-serial-chapter` | Chapter one of an email serial, cliffhanger close |

## 5. Pillar C — `embuy-` purchase + OTO nurture (text bank, +8)

Mapped 1:1 to the trigger taxonomy so every purchase gets a next-offer
nurture AND a deep nurture follow-up, and OTO buyers get their own path.
`offer` input on the ascension recipes (the offer the email points to);
material inputs on the welcome recipes.

| id | Trigger | Framework |
| --- | --- | --- |
| `embuy-welcome-receipt` | purchase | Confirmation that activates: receipt, access, the first move |
| `embuy-first-win` | purchase | Day-1 activation: get the first result in 20 minutes |
| `embuy-next-offer-seed` | purchase | The nurture bridge to the next offer (inputs: offer) |
| `embuy-deep-nurture-arc` | purchase | The deep nurture follow-up: value series that keeps buyers warm for the next launch (inputs: offer) |
| `embuy-oto-welcome` | upsell_purchase | OTO buyer welcome: the premium receipt, what changed |
| `embuy-oto-ascend` | upsell_purchase | OTO buyer ascension to the core/next offer (inputs: offer) |
| `embuy-refund-save` | refund | The refund save: gracious, fix-it, win-back path |
| `embuy-review-ask` | purchase | The testimonial ask after the first win lands |

## 6. Pillar D — `emgoal-` goal-driven emails (text bank, +4)

The custom-goal family: each declares a `goal` input (book a call, attend
the event, reply, join) plus an `offer` input where the email points to a
paid next step. The template's CTA section fills from the goal.

| id | Goal shape | Framework |
| --- | --- | --- |
| `emgoal-book-call` | book a call | The call invite: who it is for, what happens on it, honest disqualifier (inputs: offer, goal) |
| `emgoal-attend-event` | attend event | The event driver: transformation-first invite, logistics second (inputs: offer, goal) |
| `emgoal-reply-survey` | reply | The reply-goal email: one question, answer-first, research dividend (inputs: goal) |
| `emgoal-community-join` | join | The community invite: belong-first, one clear first action (inputs: offer, goal) |

## 7. Pillar E — `emimg-` email image sub-bank (image bank, +6)

Same recipe shape as the other image sub-banks: scene skeleton with
{Slots}, art direction in `craft`, 2 filled example prompts, `kind:
'organic'`, goal clicks, `sizePresetIds: ['email-header']` (1200x600, 2:1),
platforms `['email']`, formats `['email']`. Brand lock holds: no baked-in
text (the overlay editor or the email HTML carries words), faces off, warm
bone / aubergine / brass. Inbox rendering note in every craft: the image
must read at 600px wide inside an email client, so one focal idea and a
clean text zone.

| id | Framework |
| --- | --- |
| `emimg-header-calm` | The calm header field: type-ready banner for letter emails |
| `emimg-offer-hero` | The artifact hero for offer emails (the page, the binder, the tablet) |
| `emimg-receipt-proof` | Proof macro for case-study and report emails |
| `emimg-welcome-scene` | Warm welcome scene for purchase/onboarding emails |
| `emimg-event-card` | Event header with a date-safe zone (invite emails) |
| `emimg-divider-rule` | The minimal section divider for long essays |

## 8. Scope 2 — Email Kit frameworks (+6)

New specs in `src/lib/mothermode/email/frameworks/*` so kit sequences can
assign the new structures per role:

| key | Used for |
| --- | --- |
| `buyer-welcome` | purchase-triggered welcome/activation emails |
| `ascension-bridge` | the nurture bridge to the next offer |
| `deep-nurture` | the long value essay that keeps buyers warm |
| `oto-ascend` | upsell buyer to core/next offer |
| `goal-driven` | book-a-call / attend-event / join asks |
| `ps-close` | the postscript-driven soft email |

Touch points: `EMAIL_FRAMEWORKS` enum + `EmailFramework` type
(`email/types.ts`), one spec file each, registry in
`frameworks/index.ts`, and two campaign role remaps (`pre-post-purchase`:
welcome → buyer-welcome, bridge → ascension-bridge). Tests: registry
integrity + spec resolution in `tests/lib/email-kit.test.ts`.

## 9. Scope 3 — Trigger wiring (bank recipes ↔ flow triggers)

Optional `frameworkRecipeId?: string` on `EmailMessage` (rides the sequence
JSONB; normalized defensively like the other message fields, so no
migration and full back-compat). The kit editor shows a **Bank framework**
picker per email (email-group recipes from the live merged bank via
`usePromptBankRecipes`, matching `embuy-`/`emgoal-` families suggested
first when the sequence trigger is `purchase` / `upsell_purchase` /
`refund` / `booking`), and the kit's per-email expand pass injects
`recipeCraftBlock(recipe, 'email')` + `recipeInputsBlock(recipe, values)`
when set, exactly how `framework` already rides the content generators.
The flow canvas trigger node gets a read-only hint chip naming the recipe
family that fits the trigger. Tests: normalize/round-trip, expand-time
injection, picker filtering + suggestion order.

## 10. Code + test touch points

- New `src/lib/mothermode/content/promptBankRound5.ts` (26 text recipes),
  spread into `PROMPT_RECIPES`.
- New `src/lib/mothermode/content/imagePromptBankRound5.ts` (6 image
  recipes), spread into `IMAGE_PROMPT_RECIPES`.
- `tests/lib/prompt-bank.test.ts`: counts 121 → 147; round-5 family
  coverage (email-/emlf-/embuy-/emgoal- ids, platforms/formats, inputs
  bar incl. offer + goal fields).
- `tests/lib/image-prompt-bank.test.ts`: counts 66 → 72; sub-bank split
  gains `emimg-` 6; `imageRecipesFor('email', 'organic')` = 6; ALL_SEED
  187 → 219.
- `email/types.ts` + `email/frameworks/*` + `email/campaigns/index.ts` +
  kit editor + kit expand pass (scope 2 + 3); `tests/lib/email-kit.test.ts`
  additions.
- `scripts/seed-prompt-bank.cjs --dry` lists the new recipes, then real
  seed → expect `upserted 233 recipes` (147 text + 72 image + 14 styles).
- No prompt-bank picker, route, or generator changes. No new migration.

## 11. Build order

1. Author `promptBankRound5.ts` (email- → emlf- → embuy- → emgoal-), full
   quality bar, voice-safe sweep.
2. Author `imagePromptBankRound5.ts` (6 emimg-), brand-lock sweep.
3. Wire registries; update the two bank test files; run bank suites.
4. Scope 2: kit frameworks (+6), enum, registry, campaign remap, kit tests.
5. Scope 3: `frameworkRecipeId` plumbing, editor picker, expand injection,
   tests.
6. Full verification: all suites + `tsc --noEmit` + seed `--dry`.
7. Test lab spot-checks: one emlf, one embuy, one emgoal, two emimg.
8. Docs: system port, round-3 handoff §3, master port §8h, roadmap
   (progress table + round 4/5 marking), `EMAIL_MARKETING_KIT_SYSTEM_PORT.md`,
   `EMAIL_TRIGGER_FUNNEL_MAPPING_SYSTEM_PORT.md`, and mark this spec
   SHIPPED.

## 12. Non-goals

- No dispatch/send wiring (enrollment dispatch remains the documented
  future work in `EMAIL_TRIGGER_FUNNEL_MAPPING_SYSTEM_PORT.md` §7).
- No new bank generator or picker internals (recipes ride the existing
  `style`/`imageFramework` params).
- No new database migration (bank columns exist; the kit message extension
  rides the sequence JSONB).
- No AI-authored recipes (standing rule: human-authored only).
- `embuy-`/`emgoal-` stay organic (no `kind: 'ad'`): they are
  transactional/nurture, not paid placement.

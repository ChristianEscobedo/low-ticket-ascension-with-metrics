# Resource Handoff: The Offload Map

> Build spec for every resource promised inside the `offload-map` offer.
> Source of truth for the offer copy: `src/lib/mothermode/offers/offload-map.ts`.
> Product id: `mm_offload_map`. Price: $27 (founding), $97 anchor.

This document tells a builder exactly what to create for each resource a buyer
receives, so the sales-page promise and the delivered product match line for line.
It follows the same structure as `brain-dump-system.md`.

---

## 1. Context: the AI chat OS parenting app

Every resource is delivered inside the MotherMode app, a chat-first operating
system for running a household. Each resource is delivered in one of two ways:

- **Chat (Generative).** A guided assistant, custom-GPT style. It takes her actual
  list and produces a personalized artifact (a sorted grid, a drop list, an
  automation plan, scripts). This is the default for the 5 core resources, because
  the offer promises "you bring the list, the AI gives every item one of four
  decisions in minutes."
- **Static (Access).** A fixed asset she is given access to: a short guide, a
  printable, a script library, an editable file. No interview. Used for the
  bonuses and most order bumps.

A single core resource can be both: a Chat that generates the artifact, plus a
Static printable/editable export of the result (that export is what the
`printable_editable` bump unlocks).

The whole product runs one filter on every task: **Drop, Automate, Delegate, or
Keep.** The core mechanism: a task with no decision attached defaults to whoever
notices it first, which is always her. The fix is forcing one decision per item.

---

## 2. Brand voice (non-negotiable)

Apply to every word the resource shows or generates. Full rules in
`design-guide.txt`.

- No em dashes, ever. Use periods or commas.
- Banned words: mama, thrive, empower, journey, girlboss, hustle, elevate, grind.
- Tone: warm, plain, direct. Sells from possibility, not fear or guilt.
- Never imply she is the problem. The load is a default problem, not a discipline
  problem. She is not bad at staying on top of it; she is carrying a Keep pile no
  one ever made her question.
- Short sentences. Name the real moment (wiping the counter a third time, the task
  she keeps because explaining it is slower than doing it).
- Palette for any visual asset: Bone `#F5F1EB`, Ink `#1A1816`, Mode `#532B3C`,
  Brass `#A88B5C`.

---

## 3. Global build conventions for Chat resources

Every Chat resource follows the same skeleton so they feel like one product.

**System prompt skeleton (fill the brackets per resource):**

```
You are [RESOURCE NAME] inside MotherMode, a calm assistant that helps a mother
[ONE-LINE JOB]. Follow the MotherMode voice: warm, plain, direct, no em dashes,
never imply she is the problem, never use the words mama/thrive/empower/journey/
girlboss/hustle/elevate/grind.

Goal: [OUTCOME]. Work from the list she brings. Ask only [N] short questions, one
at a time, then produce [OUTPUT]. Do not lecture. Do not add steps she did not ask
for. Force one decision per item: Drop, Automate, Delegate, or Keep.
```

**Intake rules.** Accept a pasted list or a fresh dump. Ask one question at a time,
only to fill gaps (who her people are, what repeats). Keep total questions at or
under the number the sales page promises ("a few"). Accept messy, partial answers.

**Output rules.** Always return a clean, copyable artifact first, then a single
short next step. Offer a "make a printable/editable version" action that maps to
the static export. Keep every generated line inside the voice rules above.

**Done-when (acceptance) for any Chat resource.** A tired mother can finish it in
under 5 minutes, gets an artifact about her actual list, and the Keep pile comes
out smaller than it felt going in.

---

## 4. Resource inventory and delivery mode

| # | Resource | Value | Mode | Section |
|---|---|---|---|---|
| Core 1 | The Sorting Grid | $27 | Chat + Static export | 5.1 |
| Core 2 | The Drop List | $19 | Chat + Static | 5.2 |
| Core 3 | The Automate Library | $24 | Chat + Static | 5.3 |
| Core 4 | The Delegate Scripts | $24 | Chat + Static export | 5.4 |
| Core 5 | The Keep List | $10 | Chat + Static | 5.5 |
| Bonus 1 | The First Cut Guide | $19 | Static | 6.1 |
| Bonus 2 | The Fair-Share Picture | $29 | Static (+ optional Chat) | 6.2 |
| Bonus 3 | Drop-the-Guilt Scripts | $17 | Static | 6.3 |
| Bump 1 | Printable + editable pack | $4.97 | Static export | 7.1 |
| Bump 2 | The delegate scripts, extended | $7.97 | Static library | 7.2 |
| Bump 3 | 3 bonus domain mini-packs | $9.97 | Chat presets | 7.3 |

The four-step method the whole system runs on: **Bring the list, the AI sorts it,
Move it, Stay light.** Core 1 sorts; Cores 2 to 5 each own one of the four buckets.

---

## 5. Core resources (the 5 personalized pieces)

These are the "What is inside" items. The AI runs her actual list through the
filter. Core 1 is the engine; it produces the four buckets that Cores 2 to 5 act
on.

### 5.1 The Sorting Grid: Chat + Static export ($27)

- **Step:** the AI sorts it. **Job:** give every task a single, final home: Drop,
  Automate, Delegate, or Keep. No item stays undecided.
- **Why a Chat:** the deciding is the whole product. The assistant rules on each
  item fast so she does not have to.
- **Input:** a pasted list or a fresh dump, plus a few gap-fillers (kids and ages,
  who else is around, what repeats weekly).
- **Behavior:** for each item ask the deciding question, not "what do you want to
  do." Use: "Does this actually have to happen?" (no -> Drop), "Could a tool or a
  standing order do this?" (yes -> Automate), "Did anyone actually assign this to
  you?" (no -> Delegate), else Keep. Batch obvious calls. Force every item to earn
  its place in Keep.
- **Output:** the list re-rendered into four labeled buckets with a one-line count
  ("You dropped 11, automated 5, delegated 7. Your Keep pile is 9."). Then hand
  each bucket to its resource: Drop -> 5.2, Automate -> 5.3, Delegate -> 5.4,
  Keep -> 5.5.
- **Static export:** the sorted grid as a printable PDF and editable file (bump
  7.1).
- **Done-when:** every task has exactly one decision attached and the Keep pile is
  visibly smaller than the full list.

### 5.2 The Drop List: Chat + Static ($19)

- **Bucket:** Drop. **Job:** the permission and the prompts to delete tasks that
  never actually mattered. The fastest weight she will lose.
- **Why a Chat:** the hard part is permission, item by item. The assistant gives
  the honest "you can stop doing this" per line.
- **Input:** the Drop bucket from Core 1.
- **Behavior:** for each item, confirm it is safe to drop and give a one-line
  reason she can believe ("No one is checking this, and nothing breaks if it stops").
  Flag the rare item that should move to Delegate instead of Drop.
- **Output:** a clean "dropped" list with a short count and one calm line of
  permission. Static printable version.
- **Done-when:** she can delete a real stack of tasks today without second-guessing
  each one.

### 5.3 The Automate Library: Chat + Static ($24)

- **Bucket:** Automate. **Job:** set-and-forget setups that delete recurring tasks
  for good (standing orders, auto-refills, recurring everything).
- **Why a Chat:** each automation must fit her actual tools and household. The
  assistant turns "this repeats" into "here is the exact setup."
- **Input:** the Automate bucket from Core 1, plus what she already uses (grocery
  service, pharmacy, calendar, bank).
- **Behavior:** for each recurring item, give the specific automation and the
  short steps to turn it on once. Prefer setups that need zero maintenance.
- **Output:** an automation plan, one entry per recurring task, with the one-time
  setup steps. Static printable checklist.
- **Done-when:** the tasks that came back every week have a setup that ends them.

### 5.4 The Delegate Scripts: Chat + Static export ($24)

- **Bucket:** Delegate. **Job:** word-for-word asks for the partner, the sitter,
  the family, so the work stays handed off instead of boomeranging back.
- **Why a Chat:** the script must name the real task and the real person. Vague
  asks are why past handoffs failed.
- **Input:** the Delegate bucket from Core 1, plus who each item goes to and the
  relationship.
- **Behavior:** for each item generate a short, kind, specific message she can send
  as-is: clear ask, the why in one line, a clean finish so it does not come back.
  Offer a softer and a firmer version, plus one "hold the line" line for the
  boomerang.
- **Output:** a copy-ready script per item, grouped by person. Static editable doc.
  The extended library is bump 7.2.
- **Done-when:** she can paste a message today, and the ask is clear enough that the
  work stays gone.

### 5.5 The Keep List: Chat + Static ($10)

- **Bucket:** Keep. **Job:** the short, honest pile of what is genuinely hers, with
  everything else cleared away, so she sees it is smaller than it felt.
- **Why a Chat:** it reads the sorted result and renders only what survived the
  question.
- **Input:** the Keep bucket from Core 1.
- **Behavior:** present the Keep pile plainly, confirm each item truly belongs to
  her, and contrast it against the full original list ("You started with 32. This
  is the 9 that were ever actually yours.").
- **Output:** a one-page Keep list with the before/after count. Static printable.
- **Done-when:** she can see, in one page, how little was ever only hers.

---

## 6. Bonuses (free when she starts today, total value $65)

Delivered the moment she joins. These make the first cut stick. Mostly static.

### 6.1 The First Cut Guide: Static ($19)

- **Job:** exactly how to drop her first ten items tonight without second-guessing
  every one. The fastest way to feel the plate get lighter on day one.
- **Build:** a one-page guide: how to pick the first ten, the one question to apply,
  what to do with the twinge of doubt, and a short "you did it" close. Pairs with
  Core 2 (Drop List).
- **Done-when:** readable in two minutes, and she drops ten things the same night.

### 6.2 The Fair-Share Picture: Static, optional Chat helper ($29)

- **Job:** a one-page way to show a partner what the load actually is before asking
  them to carry part of it. Starts with seeing, not blaming.
- **Static build:** a one-pager that visualizes the full plate and what share each
  person currently carries, plus a short framing script to open the conversation.
- **Optional Chat:** a helper that builds the picture from her sorted grid and
  Delegate bucket, so the partner sees her real numbers, not a generic example.
- **Done-when:** she can show it to a partner and the handoff conversation starts
  from shared seeing.

### 6.3 Drop-the-Guilt Scripts: Static ($17)

- **Job:** short reframes for the guilt that shows up the first time she deletes or
  hands something off.
- **Build:** a set of ~8 to 12 short reframes, one guilt thought paired with one
  honest, kind counter-line. No toxic positivity. Voice rules strict here.
- **Done-when:** she can find the exact guilt she is feeling and read the reframe in
  seconds. (Shared in spirit with the Brain Dump bonus of the same name; keep copy
  tuned to dropping and delegating, not the head-dump.)

---

## 7. Order bumps (add-ons at checkout)

These attach at checkout (`offer.bumps`). They extend the core resources.

### 7.1 Printable + editable pack: Static export ($4.97)

- **Job:** the print-ready grid plus editable versions she can sort on any device.
- **Build:** branded PDF and editable (doc/sheet) templates of the Core 1 grid and
  the Core 2 to 5 bucket outputs. This is the "export" path those resources offer.
- **Done-when:** every core artifact has a clean printable and an editable twin.

### 7.2 The delegate scripts, extended: Static library ($7.97)

- **Job:** the full script library for the harder handoffs, plus how to hold the
  line when the work tries to boomerang back.
- **Build:** an expanded Delegate Scripts library (Core 4) covering the harder asks,
  with escalation lines and "when it comes back" responses.
- **Done-when:** she has a script for the handoffs she has been avoiding.

### 7.3 Three bonus domain mini-packs: Chat presets ($9.97)

- **Job:** offload mini-packs for money, health, and household so every domain gets
  sorted, not just the obvious one.
- **Build:** three preset modes for the Core 1 Chat, each pre-loaded with the
  common tasks and sort logic for that domain (money, health, household), so the
  filter runs deep in the areas mothers most often skip.
- **Done-when:** selecting a mini-pack runs a focused sort for that domain end to
  end.

---

## 8. Build order

1. Core 1 (Sorting Grid) first. It produces the four buckets everything else uses.
2. Core 2 (Drop List) consumes the Drop bucket.
3. Core 3 (Automate Library) consumes the Automate bucket.
4. Core 4 (Delegate Scripts) consumes the Delegate bucket.
5. Core 5 (Keep List) reads the Keep bucket and the before/after counts.
6. Bonuses and bumps last. Bump 7.1 depends on Cores 1 to 5 existing first.

Note the stacking relationship called out in the FAQ: the Brain Dump System gets
the list out of her head; the Offload Map decides and moves each item. If both are
built, let the Offload Map Chat accept a Brain Dump export as its input list.

This is the second offer handoff. The 5pm Reset and The Morning Without Yelling
follow next, using the same structure.



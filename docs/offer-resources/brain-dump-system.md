# Resource Handoff: The Brain Dump System

> Build spec for every resource promised inside the `brain-dump-system` offer.
> Source of truth for the offer copy: `src/lib/mothermode/offers/brain-dump.ts`.
> Product id: `mm_brain_dump_system`. Price: $7 (founding), $97 anchor.

This document tells a builder exactly what to create for each resource a buyer
receives, so the sales-page promise and the delivered product match line for line.

---

## 1. Context: the AI chat OS parenting app

Every resource in this offer is delivered inside the MotherMode app. The app is a
chat-first operating system for running a household. A "resource" is delivered in
one of two ways. Decide the mode per resource (the table in section 4 fixes it):

- **Chat (Generative).** A guided assistant, custom-GPT style. It interviews the
  mother with a few short questions, then generates a personalized artifact (a
  sorted list, a set of scripts, a one-page map). The output is hers, built from
  her real answers, not a blank template. This is the default for the 5 core
  resources, because the offer promises "you answer a few quick questions, the AI
  builds your personalized system in minutes."
- **Static (Access).** A fixed asset she is given access to: a short guide, a
  printable, a script library, an editable file. No interview. Used for the
  bonuses and most order bumps, where the value is the asset itself, not a
  personalized build.

A single core resource can be both: a Chat that generates the artifact, plus a
Static printable/editable export of the result (that export is what the
`printable_editable` bump unlocks).

---

## 2. Brand voice (non-negotiable)

Apply to every word the resource shows or generates. Full rules in
`design-guide.txt`.

- No em dashes, ever. Use periods or commas.
- Banned words: mama, thrive, empower, journey, girlboss, hustle, elevate, grind.
- Tone: warm, plain, direct. Sells from possibility, not fear or guilt.
- Never imply she is the problem. The load is a design flaw, not a character flaw.
- Short sentences. Name the real moment (11pm, the permission slip, the shoes).
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

Goal: [OUTCOME]. Ask only [N] short questions, one at a time, then produce
[OUTPUT]. Do not lecture. Do not add steps she did not ask for. If she gives a
little, infer the rest and let her correct it.
```

**Intake rules.** Ask one question at a time. Keep total questions at or under
the number the sales page promises ("a few"). Accept messy, partial answers.
Never block on a perfect answer.

**Output rules.** Always return a clean, copyable artifact first, then a single
short next step. Offer a "make a printable/editable version" action that maps to
the static export. Keep every generated line inside the voice rules above.

**Done-when (acceptance) for any Chat resource.** A tired mother at 11pm can
finish it in under 5 minutes, gets an artifact about her actual life, and has
zero homework left over.

---

## 4. Resource inventory and delivery mode

| # | Resource | Value | Mode | Section |
|---|---|---|---|---|
| Core 1 | The Brain Dump Template | $27 | Chat + Static export | 5.1 |
| Core 2 | The Sorting Pass | $24 | Chat | 5.2 |
| Core 3 | The Delegate Scripts | $19 | Chat + Static export | 5.3 |
| Core 4 | The Weekly Reset | $17 | Chat (recurring) + Static | 5.4 |
| Core 5 | The Load Map | $10 | Chat (visual) + Static | 5.5 |
| Bonus 1 | The First Night Guide | $19 | Static | 6.1 |
| Bonus 2 | The Invisible Work Conversation | $29 | Static (+ optional Chat) | 6.2 |
| Bonus 3 | Drop-the-Guilt Scripts | $17 | Static | 6.3 |
| Bump 1 | Printable + editable pack | $4.97 | Static export | 7.1 |
| Bump 2 | The partner conversation, extended | $7.97 | Static library | 7.2 |
| Bump 3 | 3 bonus domain mini-packs | $9.97 | Chat presets | 7.3 |

The four-beat method the whole system runs on: **Get it out, Decide once, Hand
off, Stay light.** Each core resource owns one beat (Core 5 adds "See it").

---

## 5. Core resources (the 5 personalized pieces)

These are the "What is inside" items. The AI builds each from her answers. Build
them in order: each one feeds the next.

### 5.1 The Brain Dump Template: Chat + Static export ($27)

- **Beat:** Get it out. **Job:** pull every open tab out of her head onto one page.
- **Why a Chat:** a blank page is the thing that has failed her before. The
  assistant removes the blank page by prompting category by category.
- **Intake (one at a time):** kids and ages; the domains that apply (school,
  health, home, money, food, social, work, extended family); "what is the one
  thing already nagging you right now." Infer common items per domain and let her
  add or delete.
- **Behavior:** walk each chosen domain with a short prompt ("Anything about
  doctors, refills, or check-ups?"). Capture items as a flat, readable list.
  Never make her categorize yet. That is Core 2's job.
- **Output:** one structured list, grouped by domain, every item one line, plain
  language. End with: "That is the list. It is out of your head and on the page
  now. Want to decide what happens to each one?" (handoff to Core 2).
- **Static export:** the same list as a printable PDF and an editable file (this
  is what bump 7.1 unlocks).
- **Done-when:** she sees a list that feels like "yes, that is what I carry," with
  nothing she had to format herself.

### 5.2 The Sorting Pass: Chat ($24)

- **Beat:** Decide once. **Job:** move each item into Drop, Automate, Delegate, or
  Keep, one time, so it stops re-charging her every night.
- **Why a Chat:** the decision is the hard part. The assistant asks the one
  question that makes the call obvious, item by item, fast.
- **Input:** the list from Core 1 (or a pasted list).
- **Behavior:** for each item ask the deciding question, not "what do you want to
  do." Use: "Does this actually have to happen?" (no -> Drop), "Could a tool or a
  standing order do this?" (yes -> Automate), "Did anyone actually assign this to
  you?" (no -> Delegate), else Keep. Move quickly. Batch obvious ones.
- **Output:** the list re-rendered into four labeled buckets, with a one-line
  count ("You dropped 9, automated 4, delegated 7. Your Keep pile is 12.").
  End by handing the Delegate bucket to Core 3.
- **Done-when:** roughly a third of the list leaves the Keep pile, and she can see
  the count.

### 5.3 The Delegate Scripts: Chat + Static export ($19)

- **Beat:** Hand off. **Job:** write the exact words to hand each delegated item
  to the partner, the sitter, or family, so asking stops being harder than doing.
- **Why a Chat:** the script must name the real task and the real person. Generic
  scripts are why past handoffs failed.
- **Input:** the Delegate bucket from Core 2, plus who each item goes to and the
  relationship (partner, co-parent, sitter, grandparent).
- **Behavior:** for each item generate a short, kind, specific message she can
  send as-is. Clear ask, the why in one line, a clean finish so the work does not
  boomerang. Offer a softer and a firmer version.
- **Output:** a copy-ready script per item, grouped by person. Plus one "holding
  the line" line for when the work tries to come back.
- **Static export:** all scripts as an editable doc. The extended library is bump
  7.2.
- **Done-when:** she can paste a message today without rewriting it.

### 5.4 The Weekly Reset: Chat (recurring) + Static ($17)

- **Beat:** Stay light. **Job:** a ~10-minute weekly rhythm that catches new items
  before the list refills.
- **Why a Chat:** it should feel like a quick check-in, not a new habit to defend.
  The assistant runs the same short pass each week and remembers last week.
- **Intake:** preferred day/time for the reset; anything new since last week.
- **Behavior:** re-run a fast mini brain dump, auto-sort the new items with Core
  2's logic, surface anything from Keep that could now drop or delegate. Keep it
  to a few prompts. Confirm the next reset time.
- **Output:** an updated Keep pile, a short "handled / dropped / handed off this
  week" recap, and the next reset booked.
- **Static:** a one-page printable reset checklist for off-app weeks.
- **Done-when:** under 10 minutes, and the Keep pile does not creep up week over
  week.

### 5.5 The Load Map: Chat (visual) + Static ($10)

- **Beat:** See it. **Job:** a one-page picture of where the weight actually sits,
  so she knows what to cut first.
- **Why a Chat:** it reads her sorted list and renders the distribution. No data
  entry.
- **Input:** the sorted list from Core 2 (counts per domain and per bucket).
- **Behavior:** summarize where the load concentrates (for example "Most of your
  Keep pile is food and school admin"). Name the single heaviest area and the one
  cut that would lighten it most.
- **Output:** a simple one-page visual or structured summary by domain, using the
  brand palette, with the "cut this first" callout. Printable static version.
- **Done-when:** she can point at the page and say "this is what I carry," and
  knows the first thing to put down.

---

## 6. Bonuses (free when she starts today, total value $65)

Delivered the moment she joins. These make the first night stick. Mostly static.

### 6.1 The First Night Guide: Static ($19)

- **Job:** exactly what to do the evening after her first dump so the quiet does
  not evaporate by morning. A short ritual, not more work.
- **Build:** a one-page guide, 4 to 6 short steps for the first night (close the
  loops, where the list now lives, what to ignore until the weekly reset, one line
  to tell herself). Plain, calm, "use it tonight."
- **Done-when:** readable in two minutes, doable the same night.

### 6.2 The Invisible Work Conversation: Static, optional Chat helper ($29)

- **Job:** a one-page way to show a partner what the load actually is, before
  asking them to carry part of it. Starts with seeing, not blaming.
- **Static build:** a one-pager that visualizes the invisible work (the tracking,
  the deciding, the remembering) plus a short framing script to open the
  conversation without it turning into a fight.
- **Optional Chat:** a helper that personalizes the one-pager from her Load Map so
  the partner sees her actual list, not a generic example.
- **Done-when:** she can show it to a partner and the conversation starts from
  shared seeing.

### 6.3 Drop-the-Guilt Scripts: Static ($17)

- **Job:** short reframes for the guilt that shows up the first time she hands
  something off.
- **Build:** a set of ~8 to 12 short reframes, one guilt thought paired with one
  honest, kind counter-line. No toxic positivity. Voice rules strict here.
- **Done-when:** she can find the exact guilt she is feeling and read the reframe
  in seconds.

---

## 7. Order bumps (add-ons at checkout)

These attach at checkout (`offer.bumps`). They extend the core resources.

### 7.1 Printable + editable pack: Static export ($4.97)

- **Job:** print-ready PDFs plus editable versions of the generated artifacts she
  can fill on any device.
- **Build:** branded PDF and editable (doc/sheet) templates of Core 1, 2, 4, 5
  outputs. This is the "export" path referenced by those core resources.
- **Done-when:** every core artifact has a clean printable and an editable twin.

### 7.2 The partner conversation, extended: Static library ($7.97)

- **Job:** the full script library for the harder asks, plus how to hold the
  conversation when it gets tense.
- **Build:** an expanded Delegate Scripts library (Core 3) covering the harder
  handoffs, with escalation lines and "when they push back" responses.
- **Done-when:** she has a script for the conversations she has been avoiding.

### 7.3 Three bonus domain mini-packs: Chat presets ($9.97)

- **Job:** brain-dump mini-packs for money, health, and household so no domain
  gets left in her head.
- **Build:** three preset modes for the Core 1 Chat, each pre-loaded with the
  prompts for that domain (money, health, household), so the dump goes deeper in
  the areas mothers most often skip.
- **Done-when:** selecting a mini-pack runs a focused dump for that domain end to
  end.

---

## 8. Build order

1. Core 1 (Brain Dump Template) first. It produces the list everything else uses.
2. Core 2 (Sorting Pass) next. It produces the four buckets.
3. Core 3 (Delegate Scripts) consumes the Delegate bucket.
4. Core 5 (Load Map) reads the sorted counts.
5. Core 4 (Weekly Reset) reuses Core 1 and Core 2 logic on a schedule.
6. Bonuses and bumps last. Bump 7.1 depends on Cores 1, 2, 4, 5 existing first.

When this offer is approved, the next handoff files follow the same structure for
The Offload Map, The 5pm Reset, and The Morning Without Yelling.



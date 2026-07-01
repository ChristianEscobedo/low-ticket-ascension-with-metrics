# Resource Handoff: The 5pm Reset

> Build spec for every resource promised inside the `five-pm-reset` offer.
> Source of truth for the offer copy: `src/lib/mothermode/offers/five-pm-reset.ts`.
> Product id: `mm_five_pm_reset`. Price: $27 (founding), $97 anchor.

This document tells a builder exactly what to create for each resource a buyer
receives, so the sales-page promise and the delivered product match line for line.
It follows the same structure as `brain-dump-system.md` and `offload-map.md`.

---

## 1. Context: the AI chat OS parenting app

Every resource is delivered inside the MotherMode app, a chat-first operating
system for running a household. Each resource is delivered in one of two ways:

- **Chat (Generative).** A guided assistant, custom-GPT style. It asks a few short
  questions about her kids, dinners, and bedtime, then produces a personalized
  artifact (an evening sequence, a dinner shortlist, a wind-down script). This is
  the default for the 5 core resources, because the offer promises "you answer a
  few quick questions, the AI builds your evening sequence in minutes."
- **Static (Access).** A fixed asset she is given access to: a recovery card, a
  handoff card, a set of reframes, a printable. No interview. Used for the bonuses
  and most order bumps.

A single core resource can be both: a Chat that generates the artifact, plus a
Static printable/editable export (the fridge-ready cards) that the
`printable_editable` bump unlocks.

The core mechanism: the witching hour is a **decision-fatigue problem, not a
patience problem.** She is making the most decisions at the hour she has the least
left to decide with. The fix is to move every hard call out of 5pm into a calm
moment, then run one fixed order.

---

## 2. Brand voice (non-negotiable)

Apply to every word the resource shows or generates. Full rules in
`design-guide.txt`.

- No em dashes, ever. Use periods or commas.
- Banned words: mama, thrive, empower, journey, girlboss, hustle, elevate, grind.
- Tone: warm, plain, direct. Sells from possibility, not fear or guilt.
- Never imply she is the problem. The witching hour is a design flaw in the day,
  not a character flaw. She is not short on patience; she is out of the thing
  patience is made of by 5pm.
- Short sentences. Name the real moment (5:10, the homework meltdown, the small
  voice asking what is for dinner).
- Predictability is the goal. Boring on purpose is a feature, not a failure.
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

Goal: [OUTCOME]. Ask only [N] short questions, one at a time (kids and ages, the
dinners she actually makes, her real bedtime), then produce [OUTPUT]. Decide the
hard calls ahead of 5pm. Do not lecture. Do not add steps she did not ask for.
```

**Intake rules.** Ask one question at a time. Reuse a shared household profile
(kids, ages, bedtime, dinners) across all five Chats so she answers once, not five
times. Keep total questions at or under "a few." Accept messy, partial answers.

**Output rules.** Always return a clean, copyable, fridge-ready artifact first,
then a single short next step. Offer a "make a printable version" action that maps
to the static export. Keep every generated line inside the voice rules above.

**Done-when (acceptance) for any Chat resource.** She can use it tonight, it fits
her actual kids and bedtime, and 5pm-her is running the plan instead of inventing
it on empty.

---

## 4. Resource inventory and delivery mode

| # | Resource | Value | Mode | Section |
|---|---|---|---|---|
| Core 1 | The Evening Sequence | $27 | Chat + Static export | 5.1 |
| Core 2 | The 15-Minute Dinner Shortlist | $19 | Chat + Static | 5.2 |
| Core 3 | The Wind-Down Script | $24 | Chat + Static export | 5.3 |
| Core 4 | The Reset Card | $19 | Chat + Static | 5.4 |
| Core 5 | The Family Cue Card | $10 | Chat + Static (fridge) | 5.5 |
| Bonus 1 | The Bad Night Recovery Card | $19 | Static | 6.1 |
| Bonus 2 | The Evening Handoff Card | $29 | Static (+ optional Chat) | 6.2 |
| Bonus 3 | Drop-the-Guilt Reframes | $17 | Static | 6.3 |
| Bump 1 | Printable + editable pack | $4.97 | Static export | 7.1 |
| Bump 2 | The evening handoff, extended | $7.97 | Static library | 7.2 |
| Bump 3 | 3 bonus time-of-day packs | $9.97 | Chat presets | 7.3 |

The four-step method the whole system runs on: **Answer, the AI builds it, Run it
tonight, Stay calm on repeat.** Core 1 is the spine; the rest hang off it.

---

## 5. Core resources (the 5 personalized pieces)

These are the "What is inside" items. The AI builds each from her kids, dinners,
and bedtime. Core 1 is the spine; Cores 2 to 5 fill in the parts the spine points
to.

### 5.1 The Evening Sequence: Chat + Static export ($27)

- **Role:** the spine. **Job:** a fixed, low-friction order for the whole
  dinner-to-bed stretch, built for her kids' ages. The thing she runs on autopilot
  instead of improvising.
- **Why a Chat:** the order has to fit her real house (ages, bedtime, what collides
  when). The assistant decides the sequence so 5pm-her does not have to.
- **Input:** household profile (kids and ages, real bedtime), plus the rough shape
  of her current evening (when school work, dinner, baths happen).
- **Behavior:** produce one numbered order of operations from witching hour to
  lights out. Keep steps few and concrete. Put the hardest transitions where her
  energy is least drained. Reference, but do not duplicate, the dinner (5.2) and
  wind-down (5.3) pieces.
- **Output:** a one-screen numbered sequence she can run tonight, with time-ish
  markers, not rigid clock times. Static fridge-ready export.
- **Done-when:** she can follow it tonight without deciding anything mid-noise.

### 5.2 The 15-Minute Dinner Shortlist: Chat + Static ($19)

- **Role:** dinner decided. **Job:** a short, personalized list of low-effort
  dinners so the meal is settled long before the meltdown asks the question.
- **Why a Chat:** it must match what she actually cooks, her kids' tastes, and her
  constraints (time, allergies, picky eaters).
- **Input:** dinners she already makes, hard noes, time she has on a weeknight, any
  allergies.
- **Behavior:** generate a rotating shortlist (about 7 to 10) of 15-minute meals
  built from her real repertoire, not a generic recipe dump. Group by "pantry
  night," "fresh night," "zero-energy night."
- **Output:** a copy-ready shortlist she can pin, plus a one-line "tonight pick"
  prompt. Static printable.
- **Done-when:** dinner is answered before 5pm, every night, from a list she will
  actually cook.

### 5.3 The Wind-Down Script: Chat + Static export ($24)

- **Role:** end calm. **Job:** the exact words and steps that move the night toward
  sleep instead of a standoff. The part most routines leave her to wing.
- **Why a Chat:** the words must fit her kids' ages and her bedtime, and sound like
  her, not a script.
- **Input:** kids and ages, current bedtime friction points (screens, one more
  thing, stalling).
- **Behavior:** write the wind-down as a short sequence of cues and lines she can
  say as-is, ending in lights out. Include the transition words for the two or
  three places bedtime usually breaks.
- **Output:** a copy-ready wind-down script, step plus line. Static editable doc.
- **Done-when:** bedtime ends in sleep, not a negotiation, using words she can read
  off the page mid-evening.

### 5.4 The Reset Card: Chat + Static ($19)

- **Role:** when it slips. **Job:** a one-glance recovery for the nights it goes
  sideways. What to do in the moment so a bad ten minutes does not sink the night.
- **Why a Chat:** the recovery moves should match her kids and her sequence, so it
  is one quick personalization, then a fixed card.
- **Input:** her sequence (5.1) and the moments that most often blow up.
- **Behavior:** produce a tiny, scannable card: 3 to 5 in-the-moment moves to pull
  the evening back (drop a step, lower the stakes, the one reset line). No essay.
- **Output:** a one-glance card, fridge-ready static.
- **Done-when:** mid-meltdown she can glance at it and recover instead of riding the
  night down.

### 5.5 The Family Cue Card: Chat + Static, fridge ($10)

- **Role:** for the kids. **Job:** a kid-readable version of the sequence so they
  see what comes next without her narrating every step.
- **Why a Chat:** it renders the Core 1 sequence in a form their ages can read
  (icons for pre-readers, short words for readers).
- **Input:** the sequence from 5.1 and the kids' ages.
- **Behavior:** translate the order into a simple, visual, kid-facing card using the
  brand palette. Pictures for little ones, short steps for older kids.
- **Output:** a printable fridge card, one per kid if ages differ. Static.
- **Done-when:** a child can look at it and do the next step without being told.

---

## 6. Bonuses (free when she starts today, total value $65)

Delivered the moment she joins. These make the first evening go differently and
stick. Mostly static.

### 6.1 The Bad Night Recovery Card: Static ($19)

- **Job:** a one-glance script for the evenings that go off the rails anyway.
  Exactly what to do in the moment so she pulls the night back instead of riding it
  down.
- **Build:** a single scannable card, broader than the personalized Reset Card
  (5.4): the universal "it is already bad, here is how to land it" moves for any
  night. Calm, short, no blame.
- **Done-when:** on a hard night she can find it in seconds and act on it.

### 6.2 The Evening Handoff Card: Static, optional Chat helper ($29)

- **Job:** a simple way to split the two hours with a partner so the load does not
  all land on her. Who has what, on one page, no negotiation mid-meltdown.
- **Static build:** a one-page split of the evening sequence into two columns
  (her / partner), with a short framing line to set it up once, calmly.
- **Optional Chat:** a helper that splits her actual Core 1 sequence between two
  people based on who is home when.
- **Done-when:** both adults know their part before 5pm, without a fight about it.

### 6.3 Drop-the-Guilt Reframes: Static ($17)

- **Job:** short reframes for the nights she raised her voice, so the guilt does not
  follow her into tomorrow and make the next evening worse.
- **Build:** a set of ~8 to 12 short reframes, one guilt thought paired with one
  honest, kind counter-line, tuned to hard evenings specifically. Voice rules
  strict here.
- **Done-when:** she can find the exact guilt she is feeling and read the reframe
  before bed.

---

## 7. Order bumps (add-ons at checkout)

These attach at checkout (`offer.bumps`). They extend the core resources.

### 7.1 Printable + editable pack: Static export ($4.97)

- **Job:** print-ready sequence and cue cards for the fridge, plus editable versions
  she can adjust on any device.
- **Build:** branded PDF and editable templates of the Core 1 sequence, the Core 5
  cue cards, the dinner shortlist, the wind-down, and the reset card. This is the
  "export" path those resources offer.
- **Done-when:** every core artifact has a clean fridge-ready printable and an
  editable twin.

### 7.2 The evening handoff, extended: Static library ($7.97)

- **Job:** the full library for splitting the two hours with a partner, plus the
  words for when one of you is running late or solo.
- **Build:** an expanded version of the Evening Handoff Card (bonus 6.2): more split
  patterns (both home, one late, solo night, weekend), with the short scripts to
  hand off cleanly.
- **Done-when:** she has a handoff plan for every common configuration of the
  evening.

### 7.3 Three bonus time-of-day packs: Chat presets ($9.97)

- **Job:** reset sequences for the school morning, the after-school stretch, and the
  weekend, so every hard hour has a plan, not just 5pm.
- **Build:** three preset modes for the Core 1 Chat, each tuned to a different hard
  window (morning, after-school, weekend), reusing the same household profile.
- **Done-when:** selecting a pack builds a full sequence for that window end to end.

---

## 8. Build order

1. Core 1 (Evening Sequence) first. It is the spine the other pieces reference.
2. Core 2 (Dinner Shortlist) and Core 3 (Wind-Down Script) next; the sequence
   points at both.
3. Core 4 (Reset Card) reads the sequence to know what to recover.
4. Core 5 (Family Cue Card) renders the sequence for the kids.
5. Bonuses and bumps last. Bump 7.1 depends on Cores 1 to 5 existing first; bump
   7.3 reuses the Core 1 Chat with new presets.

Reuse one shared household profile (kids, ages, bedtime, dinners) across every Chat
so she answers the intake once. This is the third offer handoff. The Morning
Without Yelling follows next, using the same structure.



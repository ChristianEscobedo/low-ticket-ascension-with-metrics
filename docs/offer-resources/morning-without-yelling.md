# Resource Handoff: The Morning Without Yelling

> Build spec for every resource promised inside the `morning-without-yelling`
> offer. Source of truth for the offer copy:
> `src/lib/mothermode/offers/morning-without-yelling.ts`.
> Product id: `mm_morning_without_yelling`. Price: $27 (founding), $97 anchor.

This document tells a builder exactly what to create for each resource a buyer
receives, so the sales-page promise and the delivered product match line for line.
It follows the same structure as the other offer handoffs.

---

## 1. Context: the AI chat OS parenting app

Every resource is delivered inside the MotherMode app, a chat-first operating
system for running a household. Each resource is delivered in one of two ways:

- **Chat (Generative).** A guided assistant, custom-GPT style. It asks a few short
  questions about her kids' ages, leave time, and where the morning jams, then
  produces a personalized artifact (a night-before setup, a visual map, an exit
  routine). This is the default for the 5 core resources, because the offer
  promises "you answer a few quick questions, the AI builds your school-morning
  system in minutes."
- **Static (Access).** A fixed asset she is given access to: a recovery card, a
  co-parent split, a set of reframes, wall-ready printables. No interview. Used for
  the bonuses and most order bumps.

A single core resource can be both: a Chat that generates the artifact, plus a
Static printable export (the wall-ready map and launch-pad labels) that the
`printable_editable` bump unlocks.

The core mechanism: the morning is a **load-bearing problem, not a speed problem.**
A morning that depends on her narrating every step will always be run by her. The
fix is to move the work to the night before (where the day has slack) and hand the
visible routine to the kids, so the morning advances without her pushing it.

---

## 2. Brand voice (non-negotiable)

Apply to every word the resource shows or generates. Full rules in
`design-guide.txt`.

- No em dashes, ever. Use periods or commas.
- Banned words: mama, thrive, empower, journey, girlboss, hustle, elevate, grind.
- Tone: warm, plain, direct. Sells from possibility, not fear or guilt.
- Never imply she is the problem. The morning is a design problem, not a willpower
  problem. She is not bad at mornings; she is the only engine in a system that was
  never built to have just one.
- Short sentences. Name the real moment (7:48, saying "shoes" four times, the
  apology in the car).
- Predictability is the goal. Boring leaves on time.
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
leave time, where the morning jams), then produce [OUTPUT]. Move work to the night
before and hand steps to the kids. Do not lecture. Do not add steps she did not
ask for.
```

**Intake rules.** Ask one question at a time. Reuse a shared household profile
(kids, ages, leave time, jam points) across all five Chats so she answers once, not
five times. Keep total questions at or under "a few." Accept messy, partial
answers.

**Output rules.** Always return a clean, wall-ready or copyable artifact first,
then a single short next step. Offer a "make a printable version" action that maps
to the static export. Keep every generated line inside the voice rules above.

**Done-when (acceptance) for any Chat resource.** She can set it up tonight and use
it tomorrow, it fits her actual kids and leave time, and the morning advances on the
kids' effort instead of only hers.

---

## 4. Resource inventory and delivery mode

| # | Resource | Value | Mode | Section |
|---|---|---|---|---|
| Core 1 | The Night-Before Setup | $24 | Chat + Static | 5.1 |
| Core 2 | The Visual Morning Map | $27 | Chat + Static export | 5.2 |
| Core 3 | The Launch Pad Checklist | $14 | Chat + Static (labels) | 5.3 |
| Core 4 | The Calm Exit Routine | $19 | Chat + Static | 5.4 |
| Core 5 | The Independence Cue Cards | $10 | Chat + Static (per kid) | 5.5 |
| Bonus 1 | The Off-Morning Recovery Card | $19 | Static | 6.1 |
| Bonus 2 | The Co-Parent Morning Split | $29 | Static (+ optional Chat) | 6.2 |
| Bonus 3 | Drop-the-Guilt Reframes | $17 | Static | 6.3 |
| Bump 1 | Printable + editable pack | $4.97 | Static export | 7.1 |
| Bump 2 | The morning split, extended | $7.97 | Static library | 7.2 |
| Bump 3 | 3 bonus time-of-day packs | $9.97 | Chat presets | 7.3 |

The four-step method the whole system runs on: **Answer, the AI builds it, Set up
tonight, Stay calm on repeat.** Core 2 (the map) is the spine the kids run; Core 1
front-loads the work; Cores 3 to 5 remove the remaining friction.

---

## 5. Core resources (the 5 personalized pieces)

These are the "What is inside" items. The AI builds each from her kids' ages and
real leave time. Core 1 moves the work to the night before; Core 2 is the map the
kids run; Cores 3 to 5 remove the rest of the friction.

### 5.1 The Night-Before Setup: Chat + Static ($24)

- **Beat:** front-load it. **Job:** a five-minute evening checklist that defuses the
  morning before it starts. Clothes, bags, and breakfast decided while the day still
  has slack.
- **Why a Chat:** the setup must match her kids and the things her mornings actually
  jam on. The assistant builds the checklist from her real friction.
- **Input:** household profile (kids and ages, leave time), plus where the morning
  usually breaks (clothes, bags, breakfast, lost items).
- **Behavior:** produce a short, ordered evening checklist (aim for 5 minutes), each
  item phrased as a concrete action done tonight. Tie each item to the morning
  problem it removes.
- **Output:** a copy-ready, wall-ready night-before checklist. Static printable.
- **Done-when:** she can run it in five minutes tonight and the morning starts
  already half done.

### 5.2 The Visual Morning Map: Chat + Static export ($27)

- **Beat:** make it visible. **Role:** the spine. **Job:** a kid-readable routine
  they follow themselves, built for their ages, so she stops narrating every step.
- **Why a Chat:** the map must render at each kid's reading level (pictures for
  pre-readers, short words for readers) and match her actual sequence.
- **Input:** kids and ages, the morning steps in order, leave time.
- **Behavior:** translate the morning into a visual, kid-facing map using the brand
  palette. One step per row, icon plus short label. Pre-reader and reader versions
  as needed.
- **Output:** a wall-ready visual map, one per kid if ages differ. Static export
  (this and the launch-pad labels are what bump 7.1 unlocks).
- **Done-when:** a child can look at the wall and do the next step without being
  told.

### 5.3 The Launch Pad Checklist: Chat + Static labels ($14)

- **Beat:** no more hunting. **Job:** one landing spot for shoes, bags, and
  everything that goes out the door, set up the night before so nothing is hunted at
  7:50.
- **Why a Chat:** it lists exactly what each kid needs to stage, based on their
  schedule (gym days, library day, lunch vs hot lunch).
- **Input:** what each kid carries, and any day-specific items.
- **Behavior:** produce a per-kid launch-pad list of what lands in the spot each
  night, plus printable labels for the physical spot.
- **Output:** a launch-pad checklist and printable labels. Static.
- **Done-when:** everything that leaves the house has one home, and the frantic
  search is over.

### 5.4 The Calm Exit Routine: Chat + Static ($19)

- **Beat:** out the door. **Job:** the final ten minutes, sequenced, so leaving is
  boring instead of frantic. The handoff from home to door, made automatic.
- **Why a Chat:** the last ten minutes depend on her leave time and who needs what
  (shoes, coats, the goodbye).
- **Input:** leave time, the steps that usually happen in the final stretch, and the
  reliable bottleneck.
- **Behavior:** produce a tight, sequenced final-ten-minutes routine with the one or
  two cue lines that keep it moving, ending at the door on time.
- **Output:** a copy-ready exit sequence. Static printable.
- **Done-when:** she leaves on time without the last-minute panic.

### 5.5 The Independence Cue Cards: Chat + Static, per kid ($10)

- **Beat:** they run it. **Job:** age-appropriate steps each kid owns, so the
  morning advances on their effort, not only hers. The path off being the engine.
- **Why a Chat:** each kid gets a different slice based on age and ability.
- **Input:** the morning map (5.2) and each kid's age.
- **Behavior:** assign each kid the steps they can own, rendered as a small personal
  cue card. Start small for little ones, expand the slice as they grow.
- **Output:** a per-kid cue card, wall- or backpack-ready. Static.
- **Done-when:** each kid moves themselves through their steps instead of waiting to
  be pushed.

---

## 6. Bonuses (free when she starts today, total value $65)

Delivered the moment she joins. These make the first morning go differently and
hold. Mostly static.

### 6.1 The Off-Morning Recovery Card: Static ($19)

- **Job:** a one-glance plan for the mornings that go sideways anyway. The late
  wake-up, the lost shoe, the meltdown. Exactly what to drop so she still leaves on
  time.
- **Build:** a single scannable card with the in-the-moment triage moves: what to
  cut, what to skip, the one line that resets it, so a bad start still ends with an
  on-time drop-off. Pairs with the FAQ promise about mornings that still slip.
- **Done-when:** on a bad morning she can find it in seconds and still leave on time.

### 6.2 The Co-Parent Morning Split: Static, optional Chat helper ($29)

- **Job:** a simple way to divide the morning with a partner so it does not all
  route through her. Who has which steps, on one page, no negotiation at 7am.
- **Static build:** a one-page split of the morning routine into two columns
  (her / partner), with a short framing line to set it up once.
- **Optional Chat:** a helper that splits her actual Core 2 map between two people
  based on who is home and when each leaves.
- **Done-when:** both adults know their steps before the morning starts, without a
  7am argument.

### 6.3 Drop-the-Guilt Reframes: Static ($17)

- **Job:** short reframes for the mornings she raised her voice, so the guilt does
  not ride along to school and set the tone for the next one.
- **Build:** a set of ~8 to 12 short reframes, one guilt thought paired with one
  honest, kind counter-line, tuned to hard mornings specifically. Voice rules strict
  here.
- **Done-when:** she can find the exact guilt she is feeling and read the reframe on
  the drive.

---

## 7. Order bumps (add-ons at checkout)

These attach at checkout (`offer.bumps`). They extend the core resources.

### 7.1 Printable + editable pack: Static export ($4.97)

- **Job:** the print-ready morning map and launch-pad labels for the wall, plus
  editable versions she can adjust on any device.
- **Build:** branded PDF and editable templates of the Core 2 map, Core 3 launch-pad
  labels, Core 4 exit routine, and Core 5 cue cards. This is the "export" path those
  resources offer.
- **Done-when:** every core artifact has a clean wall-ready printable and an editable
  twin.

### 7.2 The morning split, extended: Static library ($7.97)

- **Job:** the full library for dividing the morning with a partner, plus the words
  for when one of you is gone or running late.
- **Build:** an expanded version of the Co-Parent Morning Split (bonus 6.2): more
  split patterns (both home, one travels, solo morning), with the short scripts to
  hand off cleanly.
- **Done-when:** she has a split plan for every common morning configuration.

### 7.3 Three bonus time-of-day packs: Chat presets ($9.97)

- **Job:** systems for the after-school stretch, the bedtime wind-down, and the
  weekend, so every hard hour has a plan, not just the school morning.
- **Build:** three preset modes for the Core 1 / Core 2 Chats, each tuned to a
  different hard window (after-school, bedtime, weekend), reusing the same household
  profile.
- **Done-when:** selecting a pack builds a full system for that window end to end.

---

## 8. Build order

1. Core 2 (Visual Morning Map) is the spine; build it first so the kids have steps
   to run.
2. Core 1 (Night-Before Setup) front-loads the work the map depends on.
3. Core 3 (Launch Pad) and Core 4 (Calm Exit) remove the remaining friction.
4. Core 5 (Independence Cue Cards) reads the map to assign each kid their steps.
5. Bonuses and bumps last. Bump 7.1 depends on Cores 2 to 5 existing first; bump
   7.3 reuses the Core 1 / Core 2 Chats with new presets.

Reuse one shared household profile (kids, ages, leave time, jam points) across every
Chat so she answers the intake once. This is the fourth offer handoff, completing
the ready offers. Drafts in the catalog can follow the same structure when promoted.



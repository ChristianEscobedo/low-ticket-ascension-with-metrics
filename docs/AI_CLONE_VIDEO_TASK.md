# AI Clone Video — TASK (handoff)

**Status: IN PROGRESS. Step 1 shipped 2026-08-07 (see docs/AI_CLONE_VIDEO_PORT.md). Steps 2–6 remain — this doc is the whole plan, pick it up cold.**

> **Step 1 — DONE**: clone entity + character-sheet foundry + Clone tab in the
> studio + clonePlan manifest persistence (types/store/route) + cost tables +
> voice-programming resolvers + tests (tests/lib/clone.test.ts) + changelog
> 2.8.0. What shipped and the anchors it landed on: docs/AI_CLONE_VIDEO_PORT.md.

The Clipping Studio (Reel Studio, /admin/reel-studio) gains an **AI Clone**
aspect: create and use AI avatars, script → storyboard → 5/10/15-second
videos via **muapi + Seedance 2.0/2.5**, as a guided, costed, gated process —
with extend/look-back (build on previous beats) and frameworks for ads,
content, and long-form (VSLs). Priorities in order: **realistic, voice
programming, character consistency, planning scripts + storyboards, video
type with frameworks, cost prediction**.

## The shape (fits this codebase, not a new app)

A **"Clone" tab** in the Clipping Studio running a 6-step guided wizard.
Every generated beat lands as scenes on the existing timeline — captions,
fly-ins, SFX, keyframes, and the Remotion render all work on clone videos
for free. House rules: gated approvals before spend, frame-math rendering,
deterministic plan → render, everything saved to the project JSON.

### Step 1 — The Clone (the asset)

A saved entity: name, 3–5 reference photos, a voice (ElevenLabs clone id or
stock), and a **look bible** — one locked string: wardrobe, backdrop,
lighting, lens. Every prompt downstream quotes it verbatim. This is the
character-consistency anchor.

**The character foundry (default path).** No photos? Generate a **character
sheet with GPT Image 2**: one locked sheet — turnaround grid (front /
three-quarter / profile / close-up) + expression row (neutral, excited,
serious), same face, same wardrobe, neutral backdrop. The sheet's cells
become the clone's reference photos; the sheet is the master. One GPT
Image 2 call (~cents) buys the consistency anchor — the cheapest lever in
the stack. Sheets land in the Media Library tagged `character-sheet` —
reusable cast across reels, ads, VSLs.

### Step 2 — Video type, with frameworks

Hook ad (5/10/15s), UGC testimonial, VSL, tutorial, announcement — each
carries a proven script framework (PAS, AIDA, hook-story-offer, and the
MILLIONAIRE_MINDSHIFT VSL structure already in the repo — see
MILLIONAIRE_MINDSHIFT_VSL.md). Type = defaults for pacing, beat count, and
framework.

### Step 3 — The script

AI writes per-line beats, each capped at ~25 words (≈10s of speech — the
5/10/15s grid is honest). Each line carries **voice programming**: pace,
emphasis words, pause placement, energy — passed as ElevenLabs
stability/similarity/style/speed per beat.

### Step 4 — The storyboard (gate)

Each beat gets a shot: talking-head angle (close/medium/wide), optional
b-roll insert, background — plus the **@reference slots**: @reference 1 =
the character sheet, @reference 2 = an optional variant (wardrobe change,
location still, product-in-hand still). Approve or edit before a dollar is
spent — house gate pattern.

### Step 5 — Generate, per beat

- **Voice**: ElevenLabs per-beat call with that beat's voice params (one
  call per beat = per-beat emotion). Existing: the studio's `voiceover`
  action already generates ElevenLabs audio.
- **Avatar**: muapi talking-head model (OmniHuman-1 class) fed the clone's
  reference image + that beat's audio → a 5/10/15s lip-synced clip.
- **B-roll beats**: Seedance 2.0 default, 2.5 for hero shots — WITH the
  @reference images, so the same character shows up *inside* the footage
  (walks the gym, holds the product), not just between cuts.

Character consistency = same ref images + look bible + same voice id,
every beat.

### Step 6 — Assemble

Beats arrive as scenes on the timeline, in order. Everything else (captions,
cues, render, scheduler) is already built.

## Cost prediction (before anything generates)

The storyboard shows per-beat and total cost: avatar-model $/sec × beat
length + Seedance $/sec per b-roll beat + ElevenLabs $/1k chars + image-gen
$ — with the 2.0↔2.5 toggle showing the delta live. **Same pattern the VEED
presets already use** (`veedCostEstimate` / `veedCostMultiplier` in
src/lib/mothermode/reel/veedPresets.ts). Nothing spends without a number on
screen. The character sheet is one GPT Image 2 call ONCE per character, not
per video — say so on the line.

## Extend / look back

The reel keeps a **beat manifest** (script, storyboard, per-beat generation
ids, clone, voice params) in the project JSON (a `clonePlan` field on
ReelProject, normalized in types.ts like mediaCues). "Extend" = append beats
or re-roll one beat — referencing the **last frame of the previous beat**
(image-to-video continuation for visual continuity) plus the same clone refs
and voice. VSLs are just longer beat chains with the VSL framework.

## The Content Hub shares it

The same sheet builder sits behind the Hub's storyboard flow as "the cast" —
a storyboard picks a character (or generates one), and its beats get the
sheet as @reference automatically. One component, both surfaces.

## Codebase anchors (reuse, don't rebuild)

- **Timeline + render**: src/lib/mothermode/reel/* (types, plan, captions),
  remotion-project + render-worker — beats become ReelClip[] scenes; nothing
  new needed downstream.
- **Cost readout pattern**: src/lib/mothermode/reel/veedPresets.ts
  (veedCostEstimate/veedCostMultiplier) — copy this pattern for avatar +
  Seedance pricing tables.
- **Image generation**: aiGenerateImage in
  src/components/mothermode/content/aiClient.ts (fal-backed, hosts the
  output) — the sheet generator rides it.
- **Media Library ingest**: the cue picker's ingestCueAsset in
  src/app/(fullscreen)/admin/reel-studio/page.tsx — sheets land there tagged
  `character-sheet`.
- **ElevenLabs voiceover**: the studio's `voiceover` action
  (src/app/api/admin/mothermode-reel) — per-beat voice calls extend it with
  per-beat voice params.
- **Seedance**: docs/SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md is the existing
  pipeline; muapi is the provider — check /admin/integrations for the key
  wiring pattern (IntegrationCard + runtime-config).
- **Gates**: the recipe-gate pattern (recipe runs pause for approval) is the
  model for the storyboard approval gate.
- **muapi talking-head**: NEW integration file
  (src/utils/integrations/muapi.ts) — OmniHuman-1-class avatar model:
  ref image + audio → lip-synced clip. Follow the fal-veed.ts pattern
  (queue → poll → hosted URL).

## Build order

1. **Clone asset + character-sheet foundry** — the entity (refs, voice, look
   bible), the GPT Image 2 sheet generator (turnaround + expressions),
   cells → Media Library. New tab scaffold in the studio.
2. **Script + framework picker** — type → framework → beats with voice
   programming per line.
3. **Storyboard + cost readout** — the gate, with @reference slots per beat
   and the full $ breakdown.
4. **Per-beat generation** — voice (ElevenLabs) → avatar (muapi) → Seedance
   with refs → scenes on the timeline.
5. **Extend + re-roll** — the manifest; append beats, re-roll one beat,
   last-frame continuation.
6. **Content Hub cast handoff** — the same sheet behind the Hub storyboard.

## Verify (house style, every step)

- `npx tsc --noEmit` clean.
- New pure logic (beat timing, cost tables, manifest normalization,
  sheet-cell parsing) gets vitest coverage under tests/lib/.
- Changelog entry (src/lib/mothermode/help/seedContent/changelog.ts) + this
  doc flips to a *_PORT.md when each step ships. Commit + push per step.

## Open questions to decide at build time

- muapi avatar model id + exact $/sec (fill the cost table from muapi's
  current pricing at build time; keep the table in one const).
- Sheet layout: 2×2 turnaround + expression strip is the default; allow a
  full-body cell for walking shots.
- VSL beats beyond ~20: consider scene-grouping the manifest so long chains
  stay editable (the timeline handles it; the manifest is what grows).

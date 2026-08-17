# Reel Studio — Stickers, B-roll & the Polish Layer (task brief)

> **Read first:** `docs/REEL_STUDIO_SYSTEM_PORT.md` (the 2026-08-16 caption
> free-place overhaul is the current canvas). This doc is the brief for the
> next initiative — the media layer that makes a reel feel produced, not
> assembled. Five features, in the order that unblocks the most.

The editing canvas is in a good place. The next "feels premium" jump is the
**media layer**: a reaction sticker at the right beat, a stock b-roll cutaway
without a Seedance render, a whoosh on the slam, a progress bar keeping the
viewer, a slow Ken Burns on a still. All five ride systems that already exist
(the media-cue overlay lane, the word-mark `sfx` slot, the motion presets, the
frame-driven composition).

---

## 0 · Is the animated GIF hard? — **No.** (the answer that shapes the order)

Remotion's `<Gif>` component (`@remotion/gif`) is **frame-driven**: it decodes
the GIF and shows the frame for the current `useCurrentFrame()`. So it works
identically in the preview Player AND in `renderMedia` (which screenshots one
frame at a time and gets the right GIF frame each time) — the same "frame
math, never a CSS clock" rule the whole caption layer already follows. The
work is: add the dep to the worker's Docker image, add a `<Gif>` branch to the
cue renderer when the cue URL is a GIF, and the GIPHY search/pick UI. A
**medium** task, not a hard one.

The genuinely hard one is **transparent video** (a webm/mov alpha channel — a
particle burst): Remotion's `<Video>` doesn't composite alpha, so that needs a
separate worker approach. That stays a scoped follow-up, NOT in this task.

---

## 1 · GIPHY stickers + glyphs (the headline)

Search GIPHY's **sticker** API (transparent-background WebP/GIF) → a result
grid → click lands it as a **media cue** on the overlay lane (draggable,
re-timeable, rides the motion presets — the existing cue system).

- **Integration** — `src/utils/integrations/giphy.ts`: `searchGiphyStickers(query)`
  → `{ id, title, stillUrl, gifUrl, webpUrl, width, height }[]`. Reads
  `GIPHY_API_KEY` (free from GIPHY; add to `.env.local` + the worker env).
  House-pattern: lazy client, a clear error when the key is missing, a
  normalized result shape (never leak the raw GIPHY payload).
- **API route** — `GET /api/admin/reel-stickers?q=…` (requireAdminRoute) → the
  normalized results. Keeps the key server-side.
- **The picker** — a "Stickers" section in the cue/media panel: a search box +
  a result grid + click-to-add. Adding writes a media cue (`type: 'image'`,
  the sticker URL) at the playhead on the overlay lane — the SAME path as any
  fly-in, so drag/re-time/motion/z all just work.
- **Static vs animated** — a **static** sticker (the WebP still) renders in the
  cue's existing `<img>` today. An **animated** one (the GIF) renders through a
  new `<Gif>` branch in the cue renderer (see §0 — frame-driven, works in
  preview + render). The cue gets `animated?: boolean` so the renderer picks
  `<Gif>` vs `<img>`; the worker's Docker image adds `@remotion/gif`.
- **Glyph use-case** — small emphasis stickers (an arrow, a "100", a fire) that
  sit next to a caption word. Same cue, smaller scale, a motion preset.

**Verify:** the integration unit-test (the normalizer, the missing-key error,
the query encoding); a cue with a GIF URL renders the `<Gif>` branch; tsc
clean; the worker image builds with the new dep.

## 2 · Pexels b-roll (the faceless-reel win)

Search Pexels **videos** → pick → it lands as a clip or an overlay, no Seedance
render, no upload. Free API, no attribution required.

- **Integration** — `src/utils/integrations/pexels.ts`: `searchPexelsVideos(query)`
  → `{ id, durationSec, width, height, videoUrl, thumbUrl }[]` (pick the
  portrait/HD file from Pexels' `video_files`). Reads `PEXELS_API_KEY`.
- **API route** — `GET /api/admin/reel-broll?q=…` (requireAdminRoute).
- **The picker** — a "B-roll" section: search → a grid of video thumbnails →
  click adds it as an **overlay clip** (the violet lane) at the playhead, or
  as a new **scene** (the clip rail). The pipeline already takes hosted URLs,
  so no new render path — Pexels' CDN URL is the clip `url`.
- **The subtle upgrade** — the Story Agent / Shot Director b-roll suggest can
  offer a Pexels result *alongside* the "render this with Seedance" option.

**Verify:** the integration unit-test; a Pexels URL flows through the compose
payload like any clip; tsc clean.

## 3 · SFX on the word pops (the highest impact-per-effort)

The word mark **already has** `sfx?: { url, volume?: }` — a one-shot sound at
the word's first frame (the composition renders it). It just needs the sounds
+ the picker.

- **A curated SFX pack** — a small set of hosted one-shots (whoosh / pop /
  ding / cash / thud). Host them in Supabase Storage (the existing
  `uploadAudioBuffer` path) or ship a tiny `public/sfx/` set.
- **The picker** — a "Sound" row in the word right-click menu (the shared
  `WordContextMenu`): a few chips, click sets `mark.sfx`. Plays on the word's
  first frame in preview + render.
- **Why first-class:** every slam/pop entrance *lands* with a sound. This is
  the cheapest feature on the list and the one viewers feel most.

**Verify:** a word with `sfx` renders the sound at its frame (the composition
already reads it — confirm the worker's audio mix includes it); tsc clean.

## 4 · The progress bar (the retention hook)

A thin bar at the top that fills as the reel plays. One frame-math line in the
composition (`width: (frame / durationFrames) * 100%`), a toggle + color in the
caption/customize panel, and it renders in preview + MP4. Proven retention
hook on this format.

**Verify:** the bar fills 0→100% across the composition; a test pins the
frame math; tsc clean.

## 5 · Ken Burns on static b-roll (the still-that-feels-alive)

A slow zoom/pan **motion preset** on a static image cue — `kenburns-in`
(slow push in) / `kenburns-pan` (slow drift). Just new entries in
`MOTION_PRESETS` (the existing keyframe system), so they render frame-exact in
preview + MP4 and the keyframe editor fine-tunes after.

**Verify:** the preset round-trips; a static image cue with `kenburns-in`
drifts slowly; tsc clean.

---

## Suggested order

1. **#3 SFX picker** first — the infrastructure exists, it's the cheapest, and
   it's the most felt. De-risks nothing; pure win.
2. **#1 GIPHY stickers** — the headline. Static first (free today), then the
   `<Gif>` branch (§0 — medium, not hard).
3. **#2 Pexels b-roll** — the faceless-reel win; a clean source integration.
4. **#4 progress bar** + **#5 Ken Burns** — the one-line / one-preset polish.

Each ships with: the integration/helper + a unit test + the vendored worker
copy in sync (if the shared layer or a dep changes) + `tsc` clean + the
caption/cue suite green.

## The standing rules (every feature)

- **Frame math, never a CSS clock** — any animation (the GIF, the progress
  bar, the Ken Burns) computes from the frame number, so preview === render.
- **The worker is self-contained** — a new dep (`@remotion/gif`) goes in the
  worker's `package.json` + Dockerfile; a shared-layer change re-syncs the
  vendored copy (`node scripts/sync-vendored-captions.cjs`).
- **Keys stay server-side** — GIPHY/Pexels keys are env vars read by the API
  route, never shipped to the client.
- **A clear error when a key is missing** — the integration says "add
  `GIPHY_API_KEY`", never a cryptic 401.

## Verify (every task)

```
npx tsc --noEmit
npx vitest run tests/lib/<the-new-integration>.test.ts tests/lib/render-vendor-parity.test.ts
node scripts/sync-vendored-captions.cjs   # after touching the shared layer
```

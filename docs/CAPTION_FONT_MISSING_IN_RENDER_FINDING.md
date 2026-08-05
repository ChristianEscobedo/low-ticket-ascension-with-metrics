# Burned captions use the wrong typeface — fonts absent from the render container

**Status:** FIX APPLIED to the render path (code committed, NOT yet verified on
a real MP4 — Railway redeploy is still blocked behind the unpushed commits).
See "Fix as implemented" at the bottom for what actually changed.
**Symptom (user-observed, real MP4):** captions ARE burned in, correctly timed,
positioned, coloured and animated — but the typeface does not match the editor
preview.

## Root cause

`fontStackFor(def)` in `captions.ts` emits:

- `"Anton", Inter, system-ui, sans-serif` (Hormozi, Hormozi 3, Beast, Neon,
  Impact, Big Word, Impact Shake, Kelly 2 …)
- `"Inter", system-ui, sans-serif` (Devin, Tracy, William, Karaoke, Minimal,
  Fade On, Opus, Clean Rise …)

Every shipped preset therefore depends on **Anton** or **Inter**. Neither was
available to the renderer:

1. `render-worker/Dockerfile` installs only `fonts-noto`, `fonts-noto-cjk`,
   `fonts-noto-color-emoji`. No Anton, no Inter.
2. `render-worker/package.json` has no `@remotion/google-fonts`.
3. There is no `@font-face`, `loadFont`, or webfont `<link>` anywhere under
   `render-worker/`.

Headless Chromium cannot resolve the family, silently falls through the stack,
and lands on Noto Sans. Compounding it: presets ask for `fontWeight: 900`, and
the installed Noto Sans has no 900 weight, so Chrome clamps or synthesises the
weight. **Wrong family AND wrong weight.**

## Why the earlier caption work did not fix this

Prior sessions chased parity between `src/lib/mothermode/reel/captions.ts` and
the vendored `render-worker/src/lib/mothermode/reel/captions.ts` (the
`wordSpacing` gate, `whiteSpace: 'pre-wrap'`). That work was correct but
orthogonal. The two files now emit **identical CSS** — and the MP4 is still
wrong, because the divergence is in *font resolution inside the container*, a
layer below anything `captionCssFor` controls.

Consequence: a guard test asserting the two `captions.ts` files produce
identical `captionCssFor` output would **pass** while this bug is live. Such a
test is still worth having, but it cannot catch this class of defect.

Related stale assumption: `assCaptions.ts` carries the comment "must exist on
the worker's fontconfig — Inter ships with ffmpeg-static." That was about the
old ASS/ffmpeg path and was inherited into the Remotion path, where it is false.

## Fix (options considered — superseded by "Fix as implemented")

A Dockerfile line alone is insufficient. `fonts-inter` exists in Debian
bookworm, but **Anton does not** — apt can only fix the Inter presets, leaving
the Anton ones (Hormozi / Beast / Impact / Big Word) still wrong.

Recommended, in order of reliability:

1. **Vendor the font files.** Ship Anton + Inter (`.ttf`/`.woff2`) inside
   `render-worker/`, declare `@font-face`, and gate the render on
   `document.fonts.ready` using Remotion's `delayRender()` /
   `continueRender()`. The gate is mandatory: without it early frames burn the
   fallback font even once the files are present.
2. **`@remotion/google-fonts`.** Handles the load-and-wait correctly out of the
   box; costs a network fetch at render time.

Whichever is chosen, `fontStackFor` should keep a sane final fallback, and the
preset list should be audited so no preset names a family the worker lacks.

## Verification

Render one Anton preset (e.g. Hormozi) and one Inter preset (e.g. Karaoke) and
compare against the preview. Anton is a heavy condensed display face — if it is
resolving correctly the difference from Noto Sans is unmistakable at a glance.

## Fix as implemented

Neither option above was taken verbatim. Vendoring font files (option 1) fixes
only the fonts we chose to ship, and caption styles are user-editable — anyone
naming a family we didn't anticipate would silently get Noto again. So the font
is **resolved in the app and carried in the RenderPlan**, and the worker loads
whatever it is told to load.

| File | Change |
| --- | --- |
| `src/lib/mothermode/reel/captionFonts.ts` | **New.** `captionFontsFor(def)` → `{family, cssUrl, weights}[]`. Honours `def.fontUrl` for self-hosted/custom faces. |
| `render-worker/remotion-project/FontLoader.tsx` | **New.** Injects the stylesheets, then holds `delayRender()` until `document.fonts.load()` resolves for each family/weight. |
| `render-worker/remotion-project/ReelComposition.tsx` | Wraps the tree in `<FontLoader plan={plan}>`. |
| `render-worker/remotion-project/constants.ts` | Adds `RenderFont` + optional `plan.fonts`. |

Three things worth knowing before touching this:

1. **`delayRender` is the load-bearing part, not the `<link>`.** Remotion
   screenshots frames as fast as it can. A stylesheet that arrives one frame
   late doesn't "pop in" later — the fallback face is captured and burned in
   permanently. Same reason the URL uses `display=block`, never `swap`.
2. **Never request a weight a family doesn't publish.** Anton ships a single
   400 face; presets ask it for 900 and the browser synthesises that. Asking
   css2 for `Anton:wght@900` returns HTTP 400, the stylesheet fails, and the
   fallback bug returns silently. Hence the `KNOWN_AXES` table: no `wght` axis
   unless the family is known to have one.
3. **FontLoader degrades gracefully.** If `plan.fonts` is absent (older plans,
   or `plan.ts` not yet emitting it) it derives the font from
   `plan.captionStyle.font`, so the render path is already fixed for every
   shipped preset. A 20s timeout stops a dead CDN from hanging a job.

### Still open

- **`plan.ts` does not yet emit `fonts`.** Shipped presets work via the
  fallback; wiring `captionFontsFor()` into the plan builder is what unlocks
  genuinely custom / self-hosted faces end-to-end. Small, additive.
- **The preview still builds its own Google Fonts URL** in
  `admin/reel-studio/page.tsx` rather than calling `captionFontsFor()`. Two
  resolvers means two things that can drift — exactly the failure mode that
  produced the vendored-`captions.ts` bug. Point it at the shared helper.
- **Unverified on a real MP4.** Everything here is reasoning plus a green unit
  suite; no frame has been inspected. Redeploy is still blocked behind the
  unpushed commits.

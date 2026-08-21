# Lottie Media Cues — Port Doc

**Date:** 2026-08-20
**Scope:** Reel Studio word-triggered media cues now accept Lottie animations (.json) as a third render path next to static images and animated GIFs.
**Tests:** tests/lib/media-cues.test.ts (22 total, +4 lottie) · tests/lib/render-vendor-parity.test.ts (6) · tsc clean.

## What landed

A media cue can now be a **Lottie sticker**: a hosted `.json` animation that flies in when its trigger word is spoken, frame-exact in both the preview Player and the burned MP4.

The change follows the existing `animated?: boolean` (GIF) pattern exactly — one additive flag, copied verbatim through every layer:

| Layer | File | Change |
|---|---|---|
| Project type | `src/lib/mothermode/reel/types.ts` | `ReelMediaCue.lottie?: boolean` + `normalizeMediaCues` passthrough (`o.lottie === true` only; junk drops the key) |
| Render plan | `src/lib/mothermode/reel/render/plan.ts` | `RenderMediaCue.lottie?: boolean` + `shiftMediaCues` passthrough |
| Composition (app) | `remotion-project/ReelComposition.tsx` | `import { Lottie } from '@remotion/lottie'` + a `cue.lottie` branch in `MediaCueLayer` |
| Composition (worker) | `render-worker/remotion-project/ReelComposition.tsx` | byte-identical copy (parity-guarded) |
| Vendored libs | `render-worker/src/lib/mothermode/reel/{types.ts,render/plan.ts}` | re-synced via `scripts/sync-vendored-captions.cjs` |
| Deps | `package.json` + `render-worker/package.json` | `@remotion/lottie` 4.0.505 (matches the pinned Remotion version) |

## Render semantics

- `<Lottie src={cue.src} style={mediaStyle} />` sits in the same wrapper div as `<Gif>`/`<Img>`, so the shared box (x/y/width, radius, shadow, border), the entrance/exit opacity+transform, keyframed `motion`, and `style.ambient` all apply unchanged.
- `@remotion/lottie` is frame-driven: it seeks the animation to `useCurrentFrame()` and fetches via `delayRender`, so preview === render by construction (the same guarantee the `<Gif>` branch gives). No CSS clocks.
- `lottie` **wins over `animated`** when both are set (a .json URL fed to `<Gif>` would render nothing).
- No new system packages in the worker's Docker image — Lottie renders via lottie-web inside the headless Chrome the renderer already runs. **The worker image must be rebuilt/redeployed** so `npm install` picks up `@remotion/lottie`.

## How to use (studio)

Attach a cue whose `url` is a hosted Lottie `.json` and set `lottie: true` on the cue object (same place `animated: true` is set for GIPHY picks). Uploading .json files to the Media Library and a picker affordance is a follow-up UI task — the render pipeline is what's ported here.

## Porting notes (Omega-v2)

1. Copy the four hunks above (types, plan, both compositions) — they are additive and order-independent.
2. Add `@remotion/lottie` pinned to the SAME Remotion version the target repo runs.
3. Re-sync vendored worker copies and rebuild the worker image.
4. Bring the 4 lottie tests in `tests/lib/media-cues.test.ts`; they pin the round-trip, the plan passthrough, and the composition branch in BOTH copies.

## 2026-08-21 — the full animation plays

`SafeLottie` now takes `windowSec` (the cue's on-screen window) and sets
`playbackRate = lottieDuration / windowSec` from the JSON's `ip`/`op`/`fr`,
so a 4s animation in a 1.5s cue plays through instead of cutting off.
Both composition copies carry it — re-sync the vendored worker.

# Reel Studio R25–R28 — Playback Clock, Platform Length Budgets, Fancy Subtitles, Fit-to-Width Timeline (SHIPPED)

**Shipped:** 2026-08-03
**Builds on:** `REEL_STUDIO_SYSTEM_PORT.md` (base), `REEL_PLAYBACK_CLOCK_AND_LAYERS_R25.md` (the clock design doc), `REEL_TIMELINE_UX_DEBT.md` (the debt this round retires)

Four rounds that take the cutting room from "works, with quirks" to "feels like a real editor": one authority for time, the timeline that knows every platform's length rules, a second subtitle engine (veed), and a strip that always fills the canvas.

---

## R25 + R25b — THE PLAYBACK CLOCK, instant cuts, overlay layers

Full design in `REEL_PLAYBACK_CLOCK_AND_LAYERS_R25.md`. What matters for the record:

- **One rAF clock owns the timeline second** (`clockRef`); the `<video>` element is a dumb frame server hard-synced every frame (drift > 0.12s = seek). Overrun past a trim is impossible because the element never decides anything.
- **R25b live mirror** (`clockStateRef`): the rAF chain re-schedules the same closure, so project/total reads go through a ref — trimming mid-play no longer runs the clock to the OLD total.
- **Instant split (S) and instant left-trim** with NO server round-trip: part B rides the same source with `trimStartSec`; compose materializes in-points via the ffmpeg worker (`sourceSeconds: true` split mode) at render time. Undo-safe (50-deep history).
- **Cut tail (C)** at the playhead — non-destructive, instant, Ctrl+Z restores.
- **Overlay (b-roll) layers**: `project.overlays[]` picture-in-picture clips on a violet lane, clock-synced, muted, draggable to re-time. (Compose burn-in for layers is the one follow-up.)

Retires timeline-UX debt items **D1** (stop-motion flipbook — the clock drives ONE element, no per-scene remount fences), **D2** (scrub desync — `syncVideoToClock` seeks the mounted element immediately on any timeline change), **D3** (trim-drag wobble — `scrubToCut` seeks the clock, single source of truth).

## R26 — Platform length budgets

Every post type in `TARGET_GROUPS` carries `targetSec` (the algorithmic sweet spot) + `maxSec` (the hard cap, 0 = none):

| Surface | Sweet spot | Hard max |
| --- | --- | --- |
| YouTube Shorts | 60s | 180s |
| TikTok | 60s | 600s |
| IG / FB Reels | 90s | 90s |
| FB / LI Stories | 15s cards | 15s cards |
| FB Feed | 120s | 240s |
| X | 140s | 140s |
| LinkedIn Feed | 120s | 600s |
| YouTube Feed / Watch | 180s / 480s | — |

- `targetLengthFor(postTarget)` resolves the budget; a per-reel `targetOverride` adjusts it with −/+ (15s steps, ↺ resets; switching targets resets to that platform's default).
- **Toolbar chip** ⏱: amber past the sweet spot, red + "over the X max" past the hard cap.
- **Timeline marker**: when the cut runs long, a dashed amber ⌛ line lands exactly where the platform wants the reel to end.

## R27 — Fancy subtitles (veed) + chrome fixes

- **`src/utils/integrations/fal-veed.ts`**: `veedSubtitles(videoUrl, settings)` — same fal queue lifecycle as `assembleTracks` (submit → poll → result), endpoint `veed/subtitles` (env override `FAL_VEED_ENDPOINT`). Full settings surface: `subtitleType` (word karaoke | line), font, fontSize, fontColor, backgroundColor, backgroundOpacity, position (top/center/bottom), outlineColor, outlineWidth — camelCase → snake_case `style` object, undefined fields omitted so veed defaults apply. `buildVeedSubtitlePayload` is pure and unit-tested.
- **`/api/admin/reel-fancy-captions`**: POST `{ videoUrl, settings }` → veed render → re-host into our storage (fal URLs expire) → `{ success, url }`. `maxDuration = 300`.
- **Captions tab → "Fancy subtitles" card**: 4 presets (karaoke, hormozi, minimal, beast), type + position selects, size + bg-opacity sliders, text/block/outline color wells, burn button — gated on `project.composedUrl` ("Compose first to burn"), opens + copies the result.
- **Lens anchoring fix**: the platform lens caption chrome now anchors to the frame's bottom edge with a tall fade (`bottom-0`, 2.5rem gradient) — the old `bottom-14` short strip was the "weird shadow" floating mid-frame. Rail raised to `bottom-24`.
- **Publish mock players**: native `controls` removed (no play button / settings bar / source timecode) — click to play/pause, karaoke overlay still word-syncs.

## R28 — The timeline always fills the canvas

The strip used to size itself `total × 36px × zoom`, so a 27s reel occupied a fraction of the canvas and looked abandoned. Now:

- The strip container is measured (`ResizeObserver` on `stripScrollRef`).
- **`pxPerSec = max(36 × zoom, stripWidth / total)`** — the fit-to-width floor. Short timelines run at a higher effective zoom; long ones scroll as before. The zoom slider only zooms IN from fit; "fit" returns to exactly full-width.
- `TimeRuler` tick density follows the **effective** zoom (`pxPerSec / 36`) so short reels get 1–2s ticks.
- %-positioned overlays (playhead, R26 target marker, story guides, audio bed, overlay lane) were already reference-consistent and ride the fitted track unchanged.

## Files

| Area | Path | Notes |
| --- | --- | --- |
| Clock + layers + all UI | `src/app/(fullscreen)/admin/reel-studio/page.tsx` | clockRef/clockStateRef/syncVideoToClock, splitAtPlayhead/cutTailAtPlayhead/leftTrimAt, overlay lane, R26 chip+marker, R27 fancy card, R28 fit |
| Split in-points (server) | `src/app/api/admin/mothermode-reel/route.ts` | in-point-aware split + `sourceSeconds` materialize mode |
| veed client | `src/utils/integrations/fal-veed.ts` | queue lifecycle + `buildVeedSubtitlePayload` |
| Fancy captions route | `src/app/api/admin/reel-fancy-captions/route.ts` | veed → re-host into storage |
| Tests | `tests/lib/fal-veed.test.ts` (3) + `tests/lib/reel-trim-playback.test.ts` (10, R24 lock) | payload mapping, undefined-field omission |

## Verification

- `npx vitest run tests/lib/fal-veed.test.ts` — 3 passing (payload builder).
- `npx tsc --noEmit` — clean.

## Follow-ups

- Compose burn-in for overlay (b-roll) layers (fal compose side-by-side/overlay keyframes).
- The next initiative: `docs/AI_CLONE_PUBLISHING_MEDIA_LIBRARY_TASK.md` — AI clone, publishing fixes, and the media library.

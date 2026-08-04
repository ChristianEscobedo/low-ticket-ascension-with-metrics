# CAPTION KARAOKE SYNC + MODERN ANIMATIONS — R22 Task

Follow-on to `docs/CAPTION_PRESET_GALLERY_TASK.md` (R17/R18/R21 shipped, commit `f8b2900`).
Two problems reported from live use. Start a fresh session — this doc is the full brief.

---

## R24 shipped (2026-08-02, second follow-up): trim fence NaN + modern caption tier + publish captions

The user re-tested after R23: the preview STILL ran past the trimmed block —
including clips added seconds earlier. Root cause found in `timeline.ts`:
`effectiveClipDuration` computed `durationSec - Math.max(0, clip.trimEndSec)`
— an **undefined** `trimEndSec` (legacy rows / any partial patch) makes that
NaN, so `clipPlaybackAction`'s `localSec >= NaN` was NEVER true and the fence
silently never fired. Tests always set `trimEndSec: 0`, which is why the
suites were green while the app was broken.

**Trim fixes (all in `timeline.ts` + the stage):**
- `effectiveClipDuration`: `trimEndSec ?? 0` + NaN-duration guard. NaN is now
  impossible.
- `clipPlaybackAction`: a non-finite/zero end → `'stop'` (never roll on).
- Both stage fences (rAF + onTimeUpdate) now HARD-clamp `v.currentTime` back
  to the cut frame on `'stop'`, so the tail can't even flash one repaint.
- Regression tests lock the undefined-trimEndSec + garbage-duration cases
  (`tests/lib/reel-trim-playback.test.ts` — 10 tests).

**Modern caption tier (the "better settings + more modern presets" ask):**
- 7 new word-enter anims: `bounce`, `blurIn`, `riseUp`, `elastic`, `glitch`,
  `typeOn`, `shake` — each ≤220ms, all with keyframes + shorthand
  (`CAPTION_ANIMS` enumerates them).
- 3 new highlight modes: `glow` (accent bloom), `boxGrow` (the box grows in),
  `gradient` (accent gradient clipped to the word).
- 10 new presets: Opus, Neon Pulse, Clean Rise, Impact Shake, Glitch Tape,
  Soft Card (rounded card behind the whole line via new `lineBg`), Mono Beat,
  Bounce Box, Gradient Flow, Type Swift.
- Spacing is first-class: `letterSpacingEm`/`wordSpacingEm` on the def +
  `letterSpacing`/`wordSpacing` customizer overrides (sliders in the gallery),
  merged in `resolveCaptionStyle`, clamped (−0.05–0.3em / 0–0.6em).
- POWER WORDS: `captionOverrides.powerWords` (gallery input, comma-separated)
  — matched via `powerKey`/`isPowerWord`, those words render in the ACTIVE
  style + 1.12× even when idle, on stage AND in the publish mocks.
- `tests/lib/caption-presets.test.ts` gains 4 suites covering all of it.

**Publish view captions (the "not burned in" ask):** `PublishSheet` now takes
`captionWords`/`captionPreset`/`captionOverrides` — the page merges per-clip
Whisper words onto timeline seconds and the vertical mocks (Shorts, TikTok,
Reels, FB Reels/Story, LinkedIn Story) render the LIVE karaoke overlay,
word-synced to the mock's own playback via `MockVideo`.

Verified: 41/41 reel+caption tests green, tsc clean.

## R23 shipped (2026-08-02, follow-up): TRIMMED CLIPS PLAYED THEIR WHOLE SOURCE

The user's live finding on top of R22: a trimmed scene's preview kept playing
the trimmed-away tail — the cut felt cosmetic.

**Root cause:** the trim guard lived only in the rAF playhead loop, which is
armed by React `playing` state and only *flipped state* on advance — it never
called `video.pause()`. Whenever state and the element disagreed (autoplay,
mid-drag re-render, auto-advance), the guard vanished and the source rolled on.

**Fix (one authority, two fences, element-pause-first):**
- `clipPlaybackAction(time, clip, { isLast, epsilonSec? })` in
  `src/lib/mothermode/reel/timeline.ts` → `'play' | 'advance' | 'stop'` — the
  ONE rule: playback ends at `durationSec − trimEndSec` (epsilon 0.08s).
- rAF loop AND `onTimeUpdate` both consult it; on anything but `'play'` they
  `v.pause()` FIRST, then advance or stop. Auto-advance keeps the
  `keepPlayingRef` handshake (next clip's `onLoadedMetadata` fires play).
- `src/lib/mothermode/reel/types.ts` gains the `PlaybackAction` type.
- 8 tests lock the rule (`tests/lib/reel-trim-playback.test.ts`); all 35
  reel-side tests green.

The remaining "timeline feels funky" items (whole-reel playback flipbook, scrub
desync, in-point trim, bed drift, zoom-follow jank) are scoped for the next
session in `docs/REEL_TIMELINE_UX_DEBT.md`.

---

## ✅ Bug 1 — RESOLVED (R22). Root cause: the windowing math.

**Hypothesis #1 in this doc was correct**: "if both slide together, the highlight is
pinned." That is exactly what happened. It was **not** a timing or timebase problem — the
rAF loop and the `ReelWord.start/end` lookup were fine. Both word-slicers returned a window
that *re-centred on the active word*, making the highlighted slot (`activeIdx - windowStart`)
a **constant**. The words scrolled under a stationary lit slot, and at the tail the clamp
parked it on the final word forever.

| fn | before | after |
|---|---|---|
| `captionWindow` | `from: idx - 2, to: idx + 4` (re-centres every word) | `from: floor(idx/perLine)*perLine` (fixed chunk) |
| `captionRows` | `from: idx - (perRow - 1)` (row always ENDS on the active word) | `from: floor(idx/perRow)*perRow` (fixed chunk) |

⚠️ **`captionRows` is the function the live renderer actually calls.** Fixing only
`captionWindow` (the one this doc pointed at) would have changed nothing on screen — worth
remembering, the obvious suspect wasn't the one wired up.

Proof, now locked by tests: the lit slot cycles `0,1,2,0,1,2…` across a 3-word line instead
of sitting at `2,2,2,2`.

**Tests: 14/14 green** in `tests/lib/caption-presets.test.ts`.
Note the pre-existing test had *encoded the bug* (`// 2-word: 1 back, 1 fwd` expected
`{from:3,to:6}` for active 4) — it was updated to chunk semantics, plus 2 new
walk-regression tests (one per slicer) that assert the slot advances and that the active
word is always inside its own line.

### Still open from Bug 1 — burn-in parity
`assFor()` tags **every** word `Style: Active`, so the burned MP4 lights up all words at once
with no idle context (the `Default` style it declares is currently dead weight, referenced by
nothing). It needs one Dialogue per *line chunk* with only the spoken word coloured via an
ASS inline `\c` override, reusing `captionRows` so the burn matches the stage. The preview is
correct now; the burn is still wrong in a different way than reported.

---


## Bug 1 — the active word never moves (preview AND burn-in)

**Symptom:** during playback the highlight sits on the *same slot* the whole time. It is
not walking word-to-word. Reported on both the in-app preview and the ffmpeg burn-in, which
means the fault is almost certainly in **shared logic**, not in the renderer.

### Where to look (in this order)

1. `src/lib/mothermode/reel/captions.ts` → **`captionWindow(totalWords, ...)`**
   - Current signature takes `totalWords` — a *count*, not the active index. Suspect the
     caller derives the window from a count and then highlights a **window-relative index
     that is recomputed to the same value every frame** (e.g. always `0`, or always
     `activeIndex % wordsPerLine` against a window that also slid).
   - The invariant to enforce: `absoluteActiveIndex - windowStart` must be the highlighted
     slot, and `windowStart` must only advance in `wordsPerLine` steps (or per-row), never
     per-word. If both slide together, the highlight is pinned. **That is the classic cause
     of this exact symptom.**
2. `src/app/(fullscreen)/admin/reel-studio/SubtitlePanel.tsx` → the rAF loop.
   - Confirm the active index is found by a **time lookup against `ReelWord.start/end`**
     (`words.findIndex(w => t >= w.start && t < w.end)`), not by an index that resets per
     scene/row. Also confirm `t` is the *media* clock (`video.currentTime`), and that the
     word times are in the **same timebase** — if words are absolute-source-time but `t`
     is trim-relative, add `trimIn` when comparing. A timebase mismatch also reads as
     "stuck highlight" when the lookup keeps failing and falls back to index 0.
   - Guard the "no match" case explicitly: return `-1` and highlight *nothing* rather than
     defaulting to `0`.
3. `assFor(captions, def, opts)` in the same lib → the burn-in path.
   - ASS karaoke must emit **one Dialogue line per window** with `\k`/`\kf` timings per
     word, or one line per active word with the `Active` style applied to *that* word only.
     If the `Active` override is emitted at a fixed position in the string (always the
     first word of the line) the burn shows the same pinned highlight. Verify by eyeballing
     one generated `.ass` for a 6-word line: the highlight span must shift across lines.

### Tests to add (`tests/lib/caption-presets.test.ts`)

- `activeWordAt(words, t)` returns the correct index at boundaries: exactly `start`
  (inclusive), exactly `end` (exclusive), in a gap between words (`-1`), before the first
  and after the last word (`-1`).
- Walking a synthetic 8-word transcript at 60fps across its full duration must produce a
  **strictly non-decreasing** active index that takes **every** value `0..7` — this is the
  regression test that would have caught the pin.
- `captionWindow` + active index: for `wordsPerLine: 3` and active index `4`, the window is
  words `3..5` and the highlighted slot is `1`. For active `6`, window `6..8`, slot `0`.
- `assFor`: the `Active`/`\k` highlight offset must differ between the line covering word 0
  and the line covering word 4 (assert the two dialogue lines are not identical modulo text).

### Definition of done

Preview and burn-in highlight the **same** word at the same timestamp. Scrub to any point,
the lit word matches what is being said. Existing 12 tests stay green.

---

## Bug/Feature 2 — more modern animations

The current set is decent but flat. Keep every existing preset id (back-compat is already
covered by the legacy shim + its test) and **add** a modern tier.

### Extend the primitives

`CaptionAnim` is currently `'' | 'pop' | 'fade' | 'slide' | 'flip' | 'spin'`. Add:

| anim | motion | notes |
|---|---|---|
| `bounce` | overshoot scale 0.6 → 1.12 → 1.0 | spring easing `cubic-bezier(.34,1.56,.64,1)` |
| `blurIn` | `filter: blur(10px)` → `blur(0)` + slight scale | the "Opus Clip" look |
| `riseUp` | `translateY(0.35em)` + fade, per word | clean, works at small sizes |
| `elastic` | scaleX/scaleY counter-wobble | squash-and-stretch, TikTok-ish |
| `glitch` | 2-frame RGB split via dual text-shadow offsets | for the edgy presets only |
| `typeOn` | reveal via `clip-path: inset(0 100% 0 0)` → `inset(0)` | left-to-right wipe |
| `shake` | ±2° rotate + ±2px translate, 3 cycles | emphasis words only |

Each needs a case in **both** `captionAnimKeyframes()` (the `@keyframes` body) and
`captionAnimCss()` (the `animation` shorthand). Keep durations **≤ 220ms** — anything
longer reads as laggy at 30fps and drifts off the word.

### New `HighlightMode` values

Current: `'color' | 'box' | 'sweep' | 'underline' | 'scale'`. Add:
- `'glow'` — animated `text-shadow` bloom in the accent color.
- `'boxGrow'` — the highlight box scales in behind the word instead of hard-cutting.
- `'gradient'` — accent gradient clipped to the active word (`background-clip: text`).

### ~10 new presets to add to `CAPTION_STYLE_DEFS`

Tag them `'new'` so they surface first in `CaptionGallery`. Suggested lineup:

1. **Beast** — one word at a time, huge, `bounce` + `boxGrow`, black stroke.
2. **Opus** — 3-word phrase, `blurIn`, white text, soft `glow` active.
3. **Neon Pulse** — `glow` highlight, cyan/magenta accent, `elastic`.
4. **Clean Rise** — minimal sans, `riseUp`, thin underline active. Good for talking-head.
5. **Gradient Pop** — `gradient` highlight, `pop`, bold rounded font.
6. **Typewriter** — `typeOn`, monospace, no stroke.
7. **Impact Shake** — heavy condensed caps, `shake` + box, for hooks.
8. **Glitch Tape** — `glitch`, slight chromatic offset, dark box.
9. **Soft Card** — semi-transparent rounded card behind the whole line, `fade`, active scale.
10. **Mono Beat** — 1 word, `elastic`, tight tracking, brass accent.

For each: unique `id`, `label`, `hint`, `tag`, plus the font/weight/color/stroke/anim/
highlight fields the interface already requires. The existing test
*"ships ~24 presets with unique ids and required fields"* will need its count bumped, and
*"every preset renders a valid CSS object"* must pass for all new entries unchanged.

### Burn-in parity

ASS cannot express blur or clip-path. For each new anim define a **documented ASS fallback**
in `assFor` (a `\t` transform for scale/move, `\blur` where available, `\fad` for fades,
and plain `Active`-style swap for the rest) so the burned video is a close cousin of the
preview rather than a different design. Add a test asserting every `CaptionAnim` value maps
to a non-empty ASS tag string.

---

## Verify

```
npx vitest run tests/lib/caption-presets.test.ts
npx tsc --noEmit
```

Then eyeball one real reel end-to-end: pick **Beast**, play the preview, burn it, and confirm
the lit word tracks the audio in both.

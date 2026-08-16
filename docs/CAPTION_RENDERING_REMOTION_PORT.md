# Caption Rendering — Remotion Port (Complete)

> **2026-08-14 caption session** (see `REEL_STUDIO_SYSTEM_PORT.md` top note for
> the full record): new default theme `kelly-neon` (the `captionDefFor`
> fallback), build & hold as the default stack mode, tighter letter/word spacing
> clamps, `dropShadowSpread` + `outerGlow.spread` reach dials, "Save as theme"
> (localStorage custom themes), the playhead-restore fix (a caption tweak no
> longer restarts the video), the gallery↔preview selection sync, and the
> `normalizeWordMark` persistence fix — it now preserves `hidden`, `card`,
> `xPct`, `yPct`, so hiding a caption card / a phrase card / a free-place
> position survives save + refresh. The worker vendors the same four files
> byte-identical, so the MP4 renders what the stage shows.

**Goal:** Make captions render EXACTLY as they preview — same words, same timings, same animations, same styles. The preview (Remotion Player) and the export (Railway worker) use the SAME `ReelComposition` + `CaptionLayer` + `buildRenderPlan`. No more "the captions look different in the MP4."

---

## The problem this solves

The old path had TWO caption renderers that never matched:
1. **Browser preview** — CSS karaoke (word-timed highlight, scale pops, blur-in, elastic squash, glitch, box-grow highlights, gradient fills, power words)
2. **ffmpeg burn** — ASS subtitles (`drawtext`/`subtitles` filter) which could only ever draw "text in a colour" — no animations, no per-word effects, no gradient fills

The result: captions looked great in the preview and flat in the export. The ChatGPT answer the user pasted describes exactly this failure mode ("A browser preview built with regular HTML/CSS... A separate backend renderer trying to recreate that preview with FFmpeg. Those two engines will never stay perfectly aligned.").

---

## The fix: ONE composition, TWO consumers

```
buildRenderPlan(project, {fps, width, height}) → RenderPlan
        ↓
ReelComposition (remotion-project/ReelComposition.tsx)
  └─ CaptionLayer (remotion-project/CaptionLayer.tsx)
       └─ captionCssFor(def) + captionRows(words) + captionAnimCss(anim)
       ↙ ↘
@remotion/player (preview)    Railway render-worker (export)
        =
Same frames, same output
```

**The critical rule:** the preview component and the render component are literally the same component. No preview version, no render version.

---

## What changed (the port)

### 1. The composition (`remotion-project/`)

| File | Role |
|------|------|
| `ReelComposition.tsx` | Clips + overlays + audio + captions as frame-exact `<Sequence>`s. `OffthreadVideo` for reliable headless rendering. Motion (Ken-Burns/pan/zoom) interpolated per frame with `interpolate()`. |
| `CaptionLayer.tsx` | The caption renderer. Reads `plan.words` (frame-timed), `plan.captionStyle` (the def), `plan.captionLayout` (position/size), `plan.powerWords`. Renders rows with `captionRows()`, active word with `activeWordIndex()`, animations with `captionAnimCss()` + `captionAnimKeyframes()`. |
| `Root.tsx` | `Composition` with `calculateMetadata` — duration/fps/width/height all driven by the plan. No per-format compositions. |
| `constants.ts` | Self-contained constants for the render-worker (`DEFAULT_FPS`, `RENDER_SIZES`, `RenderPlan` type). The main app's `plan.ts` imports from `@/lib/mothermode/...` which doesn't resolve in the render-worker. |
| `index.ts` | `registerRoot(RemotionRoot)` |

### 2. The plan builder (`src/lib/mothermode/reel/render/plan.ts`)

`buildRenderPlan(project, {fps, width, height})` → `RenderPlan`. The single source of truth:
- `clips[]` — each clip's `fromFrame`, `durationInFrames`, `trimStartSec`, `motion`
- `overlays[]` — same, with `layer`
- `audio` — `src`, `fromFrame`, `durationInFrames`
- `words[]` — frame-timed (`fromFrame`, `toFrame`), sorted monotonic
- `captionStyle` — the resolved def (font, colors, animation, emoji)
- `captionLayout` — position (`xPct`, `positionPct`), size (`sizePx`, `wordsPerRow`, `rows`)
- `powerWords` — the power-word list

Words are shifted per-clip (`shiftWords`) so the karaoke timings are frame-exact across clip boundaries.

### 3. The caption functions (`src/lib/mothermode/reel/captions.ts`)

| Function | Role |
|----------|------|
| `captionDefFor(preset)` | The base def for a preset (karaoke, word-pop, etc.) |
| `resolveCaptionStyle(def, overrides)` | Merge user overrides into the def |
| `captionCssFor(def)` | The CSS for the caption (font, colors, stroke, shadow, gradient) |
| `captionLayoutFor(def, overrides)` | The layout (position, size, wordsPerRow, rows) |
| `captionRows(total, activeIdx, wordsPerRow, rows)` | Slice words into rows around the active word |
| `captionAnimCss(anim)` | The CSS animation for the active word (pop, blur-in, elastic, glitch, etc.) |
| `captionAnimKeyframes(anim)` | The `@keyframes` for the animation |
| `emojiFor(word)` | The emoji for a word (if the preset has emoji enabled) |
| `isPowerWord(word, powerWords)` | Is this word a power word (glows even when idle) |

**Copied into the render-worker** (`render-worker/src/lib/mothermode/reel/captions.ts` + `types.ts`) so the worker's composition uses the SAME functions as the editor.

### 4. The preview (`RemotionPreview.tsx`)

```tsx
<Player
  component={ReelComposition}
  inputProps={{ plan: buildRenderPlan(project, {fps, width, height}) }}
  durationInFrames={plan.durationInFrames}
  compositionWidth={plan.width}
  compositionHeight={plan.height}
  fps={plan.fps}
/>
```

The editor's `previewMode` state (`'remotion' | 'edit'`, default `'remotion'`) toggles between the Remotion Player (true render) and the legacy scrub/trim canvas (edit mode). The toggle is in the stage toolbar.

### 5. The render worker (`render-worker/`)

| File | Role |
|------|------|
| `Dockerfile` | Node 20 + Chromium + ffmpeg + fonts (Noto, CJK, emoji) |
| `server.js` | `POST /render` → `bundle()` (cached) → `selectComposition()` → `renderMedia()` → upload to Supabase → return URL. Supabase client is lazy (created on first use, not at module load). |
| `remotion-project/` | The SAME composition as the preview (copied + self-contained constants) |

---

## Caption features that render identically now

| Feature | Preview | Export |
|---------|---------|--------|
| Word-timed karaoke (active word highlight) | ✅ | ✅ |
| Per-word scale pops | ✅ | ✅ |
| Blur-in | ✅ | ✅ |
| Elastic squash | ✅ | ✅ |
| Glitch | ✅ | ✅ |
| Box-grow highlights | ✅ | ✅ |
| Gradient fills | ✅ | ✅ |
| Power words (glow when idle) | ✅ | ✅ |
| Emoji per word | ✅ | ✅ |
| Custom fonts (Google Fonts) | ✅ | ✅ |
| Stroke + shadow | ✅ | ✅ |
| Position (drag-to-move) | ✅ | ✅ |
| Multi-row captions | ✅ | ✅ |
| Motion (Ken-Burns/pan/zoom per clip) | ✅ | ✅ |

---

## The old path (kept as fallback)

The `compose()` function in `page.tsx` still calls the local ffmpeg compose (`composeTracksLocal`) which honors in-points natively. This is the fallback while the Remotion worker is the primary path. Once the worker is confirmed working for all caption styles, the ffmpeg compose button can be removed.

The ffmpeg path (`burnCaptionsRemote`, `burnAssCaptions`) is still used for the "Caption MP4" button (quick caption burn without a full render). These use the ASS subtitle filter, which is fine for simple captions but doesn't support the modern animations.

---

## Commits (the port)

| Commit | What |
|--------|------|
| `4c675f4` | `RemotionPreview.tsx` — the preview component |
| `50b3b90` | Wire RemotionPreview into the stage (toggle + conditional render) |
| `0ca8e72` | Fix next.config key (`serverComponentsExternalPackages`) + remove ffmpeg-static fallback |
| `3b8bb4a` | Copy remotion-project into render-worker/ (Docker build context fix) |
| `357b421` | Fix Dockerfile paths (relative to render-worker build context) |
| `0f81df2` | Add render-worker/package-lock.json (npm ci needs it) |
| `7b924bf` | Make render-worker self-contained + lazy Supabase client |

---

## Testing the caption render

1. Open `/admin/reel-studio`, pick a reel with clips + captions (transcribe a clip first)
2. Pick a caption style (karaoke, word-pop, etc.) in the right rail
3. The stage shows the Remotion Player — the captions animate exactly as they'll export
4. Go to the **Post** tab → **RenderPanel** → **Render video**
5. The MP4's captions match the preview exactly (same words, same timings, same animations, same styles)

---

## Known limitations

- **Google Fonts** load from the network during render. For maximum stability, bundle the fonts as WOFF2 in the render-worker (`@remotion/fonts` with `staticFile`). The current implementation loads them from Google Fonts at render time, which works but adds a network dependency.
- **Caption animations** are CSS `@keyframes` — they replay on every word change (the `key` prop re-fires the animation). This is intentional (the karaoke sweep effect).
- **The ffmpeg caption burn** (`burnCaptionsRemote`, `burnAssCaptions`) is still available for simple captions but doesn't support the modern animations. Use the Remotion render for anything beyond basic text.

---

## Caption placement: the transform box (2026-08-05)

Placement and size are edited with ONE overlay — `CaptionDragLayer.tsx` — mounted on BOTH preview branches (Remotion Player and the legacy Edit canvas). Drag moves (`xPct`, `positionPct`), corner handles resize (`sizePx`), arrow keys nudge. Live updates stay local; one save fires on release. The box itself is not decorative: it derives its size from the same geometry the caption layer uses — 86% frame width, line-height 1.15 × `rows`, font scaled by `sizePx / CAPTION_STAGE_W × frameWidth` (measured with a ResizeObserver) — so the outline hugs the caption text at any size instead of sitting at a fixed padding. It reads the same `captionOverrides` the render plan reads, so what you drag IS what renders.

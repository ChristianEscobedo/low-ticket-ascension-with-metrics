# Reel Studio — System Port

> **2026-08-16 (latest) — the page.tsx split (the hook half):** the
> caption-edit surface's state + handlers live in
> `src/app/(fullscreen)/admin/reel-studio/useCaptionEdit.ts` now, extracted
> from page.tsx with NO behavior change. The hook owns the nine state slots
> (wordPlaceLocal/wordScaleLocal/stackEditMode/showAllCardWords/wordCtxMenu/
> fxMode/fxWords/fxScope/fxTarget) + the eleven handlers (applyWordMark(s),
> clearWordFx, toggleFxWord, freePlaceWord, removeWordPlace, toggleWordBehind,
> resetCaptionWords, exitStackEdit, onCaptionWordPointerDown/ContextMenu), and
> the four free helpers (timelineStartOf, clipWordIndexFromPlanIndex,
> planWordIndexFromClipIndex, wordStylePatchToMark) live there as the single
> source — the page imports them back (no cycle: the hook never imports the
> page). The page destructures the SAME names its JSX always used, so the body
> is untouched; `ccOn` hoisted up and `clockHit`/`stageClip` computed above
> the hook call to satisfy the ordering. Guard:
> `tests/lib/caption-edit-extraction.test.ts` (5 — the page can't re-inline a
> copy). Verified: `tsc` clean, 383/383 across the 16-file suite. The
> component half (CaptionEditSurface.tsx — the overlay-stack JSX, still two
> inline copies) is the follow-up.
>
> **2026-08-16 (later still) — creator packs + the Script Lab:** two one-click
> surfaces. **Creator packs** — the `EDITOR_PACKS` model in captions.ts grew
> the full creator set (MrBeast / Hormozi / Faceless / Cinematic / Luxury /
> Neon / Podcast), and each pack now carries a `transition?:
> ReelTransitionType`: one click applies the preset + the overrides AND sets
> that transition on every seam (the gallery's new `onApplyTransition` prop
> hands it to the page, which patches every clip after the first; a pack with
> no transition clears the seams — hard cuts are a look too). **The Script
> Lab** — a new **Scripts** tab: variation scripts from the reel's OWN
> transcript, Content-Hub style. `src/lib/mothermode/reel/scriptLab.ts`
> builds the transcript (`transcriptForProject` — every clip's Whisper words
> in timeline order), its hook (first ~14 words), its CTA (last ~14), and the
> grounding guides; `ScriptLabPanel.tsx` runs the Content Hub's amplify flow
> against it — ONE click (`aiAmplifyParts`) fills full script ×2 (bodies),
> hook/intro ×4 (hooks), body ×2 (angles), CTA ×4 (ctas), every variant
> grounded in what is actually said. A variant copies to the clipboard or
> loads into the Scenes panel's voiceover box (the ElevenLabs flow); no
> transcript yet → the panel offers Transcribe first. Tests:
> `tests/lib/script-lab.test.ts` (7 — the transcript builder, hook/CTA
> windows, the pack shape). Verified: `tsc` clean, 378/378 across the
> 15-file reel/caption suite.
>
> **2026-08-16 (later) — scene transitions + the spring entrance:** scenes no
> longer only hard-cut. `ReelClip.transitionIn?: { type: 'crossfade' | 'whip' |
> 'zoom', durationSec }` lives on the INCOMING clip (types.ts +
> `normalizeTransition`); the render plan OVERLAPS the two scenes by the
> transition's frames — the incoming clip's `fromFrame` pulls earlier into the
> outgoing tail, so both `<Sequence>`s are mounted for the window and
> `ReelComposition.tsx`'s `transitionStyleFor` blends them frame-exactly
> (crossfade fades the incoming scene up over the outgoing one; whip pans both
> with a motion blur; zoom pushes the outgoing scene into the camera riding on
> top via zIndex). `transitionOverlapSec` in `timeline.ts` is the ONE overlap
> number every layer reads — the plan, `reelDurationSec`, `clipAtTime`, and the
> editor's `timelineStartOf` — so captions, media cues, and the playhead never
> drift right of the picture by the overlap (it clamps so both scenes keep
> ≥ 0.1s of solo runtime). The timeline strip has a seam dot on every block
> except the first: click cycles off → crossfade → whip → zoom → off,
> right-click cycles 0.3 → 0.5 → 0.8s (undo-safe via `patch`). The spring
> caption entrance (`CaptionAnim` `'spring'`) is a damped overshoot computed
> frame-driven in `entranceStyle` like every other case — never a CSS clock —
> over its own longer window (`SPRING_ENTER_SEC` 0.42s) with RAW linear
> progress from the now-anim-aware `entranceProgress` (pre-easing a spring
> flattens it); it settles at exactly scale(1). `timeline.ts` joined the
> vendored set (sync script + `render-vendor-parity.test.ts`, which now also
> guards `types.ts`); both `ReelComposition.tsx` copies are byte-identical.
> Tests: `tests/lib/reel-transitions.test.ts` (normalize round-trip, overlap
> math, the plan seam, the spring curve). **Also fixed:** `normalizeCaptionPreset`
> compared its fallback to hardcoded `'karaoke'` while the house default had
> moved to `kelly-neon`, so junk preset ids leaked through un-normalized — it
> now compares to `captionDefFor(undefined).id`; three stale tests updated to
> the current intended behavior (the kelly-neon fallback, the wordSpacing
> −0.1em tightening floor, the spring's longer CSS-duration carve-out in the
> ≤220ms entrance guard). Verified: `tsc` clean, 371/371 across the 14-file
> reel/caption suite.
>
> **2026-08-16 — the caption-editing overhaul (the two-level model):** the
> canvas now has two clean editing levels that no longer fight. **Preview
> (default) = edit captions, always on** — the whole-block drag + corner-scale
> box (`CaptionDragLayer`) shows whenever you're NOT in per-word mode (its gate
> moved from `!hasPlaced` to `!stackEditMode`, so it no longer vanishes the
> moment a word is placed). **Words (the toggle, renamed from "Edit") = edit
> per word** — drag + scale + style individual words. The per-word drag is a
> **direct press-drag on the glyph** (`onCaptionWordPointerDown` on the stage
> container): it resolves the word under the pointer via the SAME
> `closest('[data-caption-word]')` + `elementsFromPoint` hit-resolution the
> right-click menu uses (NOT the drag layer's pre-measured boxes, which kept
> failing), moves it relative to the grab point (no jump), and commits via
> `applyWordMark` on release. It only fires in Words mode, so it never hijacks
> the block drag. The **↺ reset** (in the canvas pill) strips the marks on just
> the current timestamp's page (the words showing at the playhead), not the
> whole scene. The pill is **always visible** when the scene has captions.
> **fx fixes:** the gradient/shine (`isGradFill`) shell now carries
> `style.transform` + `style.opacity` — so an fx word scales/moves again, and a
> shine/gradient word stays hidden until its turn on build-and-hold (the shell
> used to drop both). **The highlight stays on the spoken word** in Words mode
> — the overlay's paint ternary dropped `freePlaceEdit`/`isFreePlaced`, so an
> idle placed word keeps the idle color at the full theme weight (the
> `css.line` fallback), and Edit === Preview (no size/color shift on toggle).
> **Two-way caption-card sync:** clicking a word on the SubtitlePanel card
> seeks the video to it (`onSeek(w.start)`); the playhead → highlight +
> auto-scroll already rode the other way. **Player-resize fix:** the
> WordDragLayer's glyph boxes (the scale outline) re-measure on a
> `ResizeObserver` now — a player resize (gene-strip toggle, window, aspect)
> no longer leaves them stale. Verified: `tsc` clean, 19/19 caption tests.
>
> **Caption system — 2026-08-14 session:** the house default + the persistence
> fix. New default theme **`kelly-neon`** (kelly2 base + `neonFlicker` entrance +
> red gradient highlight + red outer glow + `float`/`wiggle` on) — it is the
> `captionDefFor` fallback, so new reels and unknown ids open with it.
> **Build & hold is the default stack mode** (`captionLayer.tsx` `stackMode`
> defaults to `'build'`; `'page'` karaoke is still selectable). **Spacing goes
> tighter** — `letterSpacing` clamps to −0.2em, `wordSpacing` to −0.1em.
> **Shadow/glow spread** — new `dropShadowSpread` + `outerGlow.spread` (0–1)
> scale the blur radius/offset (reach, not just opacity), with "Shadow reach" /
> "Glow reach" sliders in the customizer. **Save as theme** — the customizer's
> "Save as theme" names the current preset + overrides into
> `localStorage['reel-studio:custom-caption-themes']` and lists them under
> "Custom themes" with a live visual; clicking one applies it.
>
> **Three editor fixes:** (1) `RemotionPreview` tracks the current frame in
> `lastFrameRef` and re-seeks after a plan rebuild, so a caption tweak no longer
> restarts the video at frame 0. (2) `CaptionGallery` resolves `currentPreset`
> through `captionDefFor` and highlights tiles by the resolved def id, so a
> legacy id ('karaoke') lights its mapped def — the panel↔preview selection
> sync. (3) **`normalizeWordMark` now preserves `hidden`, `card`, `xPct`,
> `yPct`** — it rebuilds each word's mark field-by-field on save and previously
> dropped all four, so hiding a caption card, a phrase-card assignment, or a
> free-place word position vanished on refresh. This was the root cause of the
> "hide captions doesn't persist" report (and the phrase-card / free-place
> equivalents). The render worker vendors `captions.ts`, `types.ts`,
> `render/plan.ts`, `render/captionLayer.tsx` byte-identical via
> `scripts/sync-vendored-captions.cjs` (enforced by
> `tests/lib/render-vendor-parity.test.ts` + `caption-vendor-parity.test.ts` +
> `caption-layer-geometry-parity.test.ts`, 12 tests), so the MP4 renders the
> same fields the stage shows.
>
> **2026-08-15 — the clean-look round:** three additions. (1) **`accent-pop`**
> preset — the clean single-accent-word look (white Inter 800, ONE word lit in a
> bright sky-blue `#38BDF8` accent, a thin 1px dark outline, a soft drop shadow);
> the light, modern end, tagged new + trend. (2) **Phrase rows** — a new
> `rowMode: 'fixed' | 'phrase'` override + `captionPhraseRows()` in captions.ts:
> each row is a natural speech phrase (breaks on punctuation or a >0.9s pause,
> capped ~8 words) instead of a fixed wordsPerRow chunk — the organic "kinda
> random, not 2-words-2-rows" rhythm. The layer maps frame-timed words into
> phrase rows; a "Phrase rows" toggle in the customizer (under the words/rows
> steppers) flips it. (3) **Per-card layout override** — `setCardLayout()` in
> SubtitlePanel + a `Nw`/`Nr` stepper on a phrase card's button column sets THAT
> card's `card.wordsPerRow` / `card.rows` (1–8 words, 1–4 rows), independent of
> the reel-wide settings — a punchy 1-word card next to a 3-word card. The
> layer's `resolveCardWindow` already reads them; the `normalizeWordMark` fix is
> what makes them persist.
>
> **2026-08-15 (cont.) — two cue entrance presets:** `motion.ts` gains
> **`slide-up-tilt`** ("slide up + tilt") and **`sweep-left`** ("sweep ←") in
> `MOTION_PRESETS` + `presetKeys` — they surface in the cue editor's motion row
> automatically (it iterates the list). `slide-up-tilt` is the full-width image
> entrance: flies in from the bottom fast (`panY 30 → 0` in ~0.28s + a slight
> scale), then settles into a −3° tilt (the lower-right lifts) and holds.
> `sweep-left` slides in from the right edge moving left (`panX 30 → 0` in
> ~0.3s) and holds — pair it with the cue's z = under-text to run an icon/image
> under the captions. Both are keyframe recipes on the existing motion system,
> so they render frame-exact in preview + MP4, and the keyframe editor
> fine-tunes after. Transparent PNG/WebP icons work with these today (the cue
> renders an `<img>`, alpha is free). True transparent-VIDEO (a webm/mov alpha
> channel — a particle burst) is the scoped follow-up: it touches the worker's
> compositing, not just the editor.
>
> **Phases 2–4 shipped:** Phase 2 — the Director (`/api/admin/reel-director`,
> replies + validated trim/remove/move actions that EXECUTE on the timeline) +
> Hook Lab + Variant duplication. Phase 3 — the Cutdown Agent
> (`/api/admin/reel-cutdown`: Whisper → model-picked self-contained segments →
> worker true-trims → one reel per segment). Phase 4 — the loop:
> `mothermode_reel_variants` + `mothermode_reel_variant_metrics`
> (`20261122000000_reel_variants_loop.sql`), `/api/admin/reel-loop` with
> `compose-batch` (content-hash cache — unchanged timelines never re-render),
> manual `record-metrics` (API sync later), `pickWinner` (highest CTR ≥50 imp),
> and `weekly-loop` (winner → three descendant drafts). Loop tab in the editor.
>
> **Phase 1 (v2) shipped:** the ffmpeg worker + captions layer from

> `REEL_STUDIO_V2_AGENTIC_VIDEO_STRATEGY.md`. TRUE split (S key) via
> `utils/integrations/ffmpeg-worker.ts` (`trimRemoteClip` — in-point trim with
> stream-copy then re-encode fallback; binary from `FFMPEG_PATH` →
> `ffmpeg-static`), `split` action on `/api/admin/mothermode-reel` (part A =
> trim-end on the source, part B = worker-trimmed, hosted; part A's stale
> captions are dropped). Captions: `POST /api/admin/reel-captions` (Whisper
> verbose_json word granularity, 25MB cap) → per-clip word timings on
> `project.captions` (same JSONB blob, no migration) → live karaoke overlay on
> the stage (CC button to transcribe, CC toggle in stage controls). Everything
> below remains the v1 truth.


**Status:** shipped (v1) · **Migration:** `supabase/migrations/20261120000000_reel_studio.sql` · **Tests:** `tests/lib/reel-studio.test.ts` (13) + `tests/lib/fal-ffmpeg.test.ts` (3, refactor) · **Upstream docs:** `SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md`, `REEL_ASSEMBLY_SYSTEM_PORT.md`, `VIDEO_VOICEOVER_SYSTEM_PORT.md`

Light timeline editing for the video pipeline. The Reel Director renders
clips one storyboard at a time and assembles them in one shot; **Reel
Studio is the editable last mile**: pull clips in (Seedance render URLs or
uploaded footage — talking head is upload-first), reorder, trim tails, lay
a voiceover over the cut at an offset, and compose the final MP4 through
the same fal ffmpeg backend. The Story Agent + Shot Director suggest
b-roll on demand.

## The honest v1 trim semantics

The compose backend (`fal-ai/ffmpeg-api/compose`) understands keyframes as
`{ url, timestamp, duration }` — **no in-point into a source clip**. So a
clip always plays from its start, and v1 trim is **trim-end only**
(`trimEndSec` cut from the tail). The data model keeps that honest shape
(`durationSec` = source runtime, `trimEndSec` = cut from end,
`effectiveClipDuration = max(0.1, duration − trimEnd)`); a future backend
with in-points can add `trimStartSec` without a migration.

## Pieces

| Piece | Where | What |
|---|---|---|
| Domain types | `src/lib/mothermode/reel/types.ts` | `ReelProject`, `ReelClip`, `ReelAudioTrack`; defensive normalizers; `projectToJson`/`normalizeProjectJson` (only valid clips ever land in the JSONB) |
| Timeline math | `src/lib/mothermode/reel/timeline.ts` | pure: `effectiveClipDuration`, `reelDurationSec`, `moveClip`, `reorderClip`, `trimClipEnd` (clamped), `offsetAudio` (clamped to runtime), `timelineErrors`, `buildStudioComposePayload` (video keyframes sequential + audio keyframe at offset, capped so audio never outlives the reel when its length is known) |
| Store | `src/lib/mothermode/reel/store.ts` | service-role CRUD on `mothermode_reel_projects` (one JSONB `project` column), house-pattern lazy client, `markReelComposed` stamps the composed URL |
| Compose backend | `src/utils/integrations/fal-ffmpeg.ts` | NEW `assembleTracks(body, opts)` — the low-level queue lifecycle for pre-built tracks payloads (per-clip trims, audio offsets). `assembleReel` is now a thin wrapper: `buildComposePayload` → `assembleTracks` (existing callers unchanged, suite still green) |
| Uploads | `src/utils/mothermode/storage.ts` (existing) | `uploadVideoDataUrl` / `uploadAudioBuffer` → Supabase Storage public URL |
| Admin API | `src/app/api/admin/mothermode-reel/route.ts` | `requireAdminRoute`; GET list; POST actions: `save`, `delete`, `compose` (timelineErrors → payload → assembleTracks → markReelComposed), `upload` (video/audio), `voiceover` (ElevenLabs → hosted mp3), `suggest-broll` (generateReelStory → directReelShots, context = existing clip names so suggestions never repeat) |
| Studio UI | `src/app/admin/reel-studio/page.tsx` | project rail + editor: add-by-URL with client-side runtime probe (`<video preload=metadata>`), footage/audio uploads, per-clip trim-end sliders, move/remove, audio offset slider, save/compose, composed preview, b-roll assist with copy-as-Seedance-prompt |
| Nav | `src/app/admin/AdminSidebar.tsx` | "Reel Studio" under Content Hub |

## Data

`mothermode_reel_projects`: `id`, `name`, `project jsonb`
(`{ clips[], audio|null, composedUrl, composedAt }`), timestamps,
`updated_by`. RLS on, no anon policies — service-role only, house default.

## Flow

```
Seedance renders / uploads ──► timeline (reorder, trim-end)
                                     │
Story Agent + Shot Director ──► b-roll concepts (copy → render upstream)
                                     ▼
ElevenLabs VO (hosted mp3) ──► audio bed at offset
                                     ▼
              buildStudioComposePayload ──► assembleTracks (fal compose)
                                     ▼
              composed MP4 stamped on the project (preview + copy link)
```

## Verification

- `npx vitest run tests/lib/reel-studio.test.ts tests/lib/fal-ffmpeg.test.ts` — 16 passing (trim/offset clamps, reorder edges, payload keyframes + audio cap, mapper round-trips, existing fal suite unchanged).
- `npx tsc --noEmit` — clean.


---

## LATEST UPDATES (2026-08-02) — Rounds R3→R16 shipped

The Clipping Studio has moved well past the original port. Read `docs/CLIPPING_STUDIO_R2_HANDOFF.md` (now the consolidated R1–R16 handoff) for the full picture. Highlights: Hook Score badge + auto-cut-silence + caption presets (R3); sprite filmstrips + Cutdown v2 + split-screen reactions + variant link rollup (R4); The Board + Variant Lab + post-target system + Publish view (R6–R11); zoomable time ruler + drag bubbles + waveform lane (R12–R14); **Motion Lab — keyframed pan/zoom/roll with draggable timeline diamonds + slider editor + live canvas preview** and the **ffmpeg-static ENOENT fix** (`serverExternalPackages` in next.config — restart the dev server) (R15–R16).

Next locked task: `docs/CAPTION_PRESET_GALLERY_TASK.md` — Submagic-style named caption preset gallery (structured CaptionStyleDef model, tile gallery tab, per-reel Customize overrides).

---

## LATEST UPDATES (2026-08-03) — Rounds R25→R28 shipped

Read `docs/REEL_STUDIO_R25_R28_PORT.md` for the full record. Highlights:

- **R25 THE PLAYBACK CLOCK** (+R25b live mirror): one rAF clock owns the timeline second; the video element is hard-synced every frame — trim overrun is impossible. Instant split (S) and instant left-trim with no server round-trip (`trimStartSec` in-points, materialized by the worker at compose), Cut tail (C), 50-deep undo, and **overlay (b-roll) layers** on a violet clock-synced lane. Retires timeline-UX debt D1–D3.
- **R26 platform length budgets**: every post type carries `targetSec` (sweet spot) + `maxSec` (hard cap) — Shorts 60/180, TikTok 60/600, IG/FB Reels 90/90, stories 15s cards, X 140/140. Toolbar ⏱ chip (amber past target, red past max, per-reel −/+ override) + a dashed ⌛ marker on the timeline where the platform wants the cut to land.
- **R27 fancy subtitles (veed)**: `src/utils/integrations/fal-veed.ts` + `/api/admin/reel-fancy-captions` burn word-timed karaoke or full-line captions into the composed MP4 with the full style surface (font/size/colors/block/opacity/outline/position) and 4 presets — result re-hosted into our storage. Plus the lens-anchor fix (no more mid-frame shadow) and native-chrome-free Publish mocks.
- **R28 fit-to-width timeline**: `pxPerSec = max(36 × zoom, stripWidth / total)` — a 27s reel and a 3-minute reel both fill the strip exactly; the zoom absorbs length, never the layout. Ruler ticks follow the effective zoom.

Next initiative: `docs/AI_CLONE_PUBLISHING_MEDIA_LIBRARY_TASK.md` — AI clone, publishing fixes, media library.

---

## LATEST UPDATES (2026-08-15) — Behind-the-subject layer + the right-click word menu + the free-place layout fix

Read `docs/CAPTION_BEHIND_SPEAKER_PORT.md` for the full record. Highlights:

- **Behind the subject as a REAL layer.** Removing a scene's background now lands as a `Cutout · <scene>` entry on the violet overlay lane (`ReelOverlayClip.isCutout`) — visible, re-timeable (drag), removable (×). It replaces the invisible `cutouts[]` window, which nothing could re-time or remove. A per-word `mark.behind` sends ONE word UNDER the cutout: the z-stack is clip → behind word (z 5) → cutout (z 6) → caption block (z 10) → front words (z 11). Both compositions (preview + the vendored worker) agree.
- **The right-click word menu.** Right-click any caption word on the canvas (Preview mode) opens the shared `WordContextMenu` (extracted from `WordDragLayer.tsx`): Free-place this word / Remove placement / Behind the subject + the full per-word style editor. The page resolves the clicked glyph's `data-caption-word` index back to the clip's own captions index (`clipWordIndexFromPlanIndex` — the Remotion layer numbers words in the timeline-merged plan list). Edit mode's WordDragLayer owns right-click there (the same menu).
- **The free-place layout fix (fp persistence).** Edit mode no longer collapses the page into one row — it renders the SAME theme rows as Preview/render, so toggling fp off doesn't reflow the un-edited words (they "jumped up") and the drag coords map 1:1. And the free-place overlay reads its type metrics (fontFamily/fontWeight/letterSpacing) off `css.line` — they were never on `css.word`, which is why a placed word rendered thinner once fp toggled off.
- **Round 2/3 polish (same session).** Edit mode now shows just the on-screen caption page by default — the "show every word" behavior moved off `freePlaceEdit` onto a new `showAllWords` plan flag (the `all` pill on the Edit/Preview toggle), so the card no longer scatters; the MP4 never sets it. Right-click works in Preview (a `[data-caption-word]{pointer-events:auto}` rule + an `elementsFromPoint` hit-stack, so it lands on the glyph even under the block-move box). Leaving Edit saves pending placements (`exitStackEdit`). A word click no longer seeks the playhead. And the fly-in drag box shows only while the image is on screen (`cueOnScreen`), with click-to-select + the ⚙ auto-seek.
- **Guards:** `tests/lib/caption-behind-and-freeplace.test.ts` (6 tests) locks the z-stack, the `behind`/`isCutout` round-trips, and the Edit⇄Preview parity. 48/48 caption tests pass, tsc clean, the vendored worker copies are in sync.

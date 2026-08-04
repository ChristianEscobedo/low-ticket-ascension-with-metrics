# Reel Studio — System Port

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

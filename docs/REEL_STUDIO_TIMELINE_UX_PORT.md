# Reel Studio — Timeline UX wave (port doc)

**For the Omega-v2 port.** One doc covering the recent timeline/preview work in
`low-ticket-ascension-with-metrics`. Each section names the commit, the files,
and the idea so it can be carried over without re-deriving it.

Commits, oldest → newest:

| Commit | What |
|--------|------|
| `4a7dee6` | Lottie media cues |
| `a20ae53` | Preview lock-up throttle |
| `64a612d` | Magnetic scrub snapping + ruler playhead |
| `03c6578` | Pause the Player while scrubbing (the shake fix) |
| `bb61f4b` | Per-type timeline lanes (captions + media cues) |

---

## 1. Lottie media cues — `4a7dee6`

Frame-exact `.json` Lottie stickers as a media-cue kind, in preview AND render.

- **Dep:** `@remotion/lottie` added to `package.json` AND `render-worker/package.json`
  (the worker Docker image must be rebuilt for it — Railway does this on push).
- **Data:** `ReelMediaCue.lottie?: boolean` in `src/lib/mothermode/reel/types.ts`
  (wins over `animated` when both set) + normalizer passthrough.
- **Plan:** `RenderMediaCue.lottie?` + `shiftMediaCues` passthrough in
  `src/lib/mothermode/reel/render/plan.ts`.
- **Render:** `MediaCueLayer` in `remotion-project/ReelComposition.tsx` branches
  `lottie ? <Lottie/> : animated ? <Gif/> : <Img/>`. The vendored worker copy
  `render-worker/remotion-project/ReelComposition.tsx` is byte-identical
  (parity-guarded by `tests/lib/render-vendor-parity.test.ts`; re-sync with
  `node scripts/sync-vendored-captions.cjs`).
- **Tests:** `tests/lib/media-cues.test.ts` (+4 lottie cases).
- **Detail doc:** `docs/LOTTIE_MEDIA_CUES_PORT.md`.
- **Follow-up (not done):** the picker UI — Media Library `.json` upload + a
  cue-picker affordance for Lottie. The render pipeline is done; the UI is not.

## 2. Preview lock-up throttle — `a20ae53`

The render plan was rebuilt in a render-time `useMemo` keyed on project identity,
so a drag edit streaming state at ~60Hz forced ~60 full composition re-renders/sec
— the "preview locks up" report.

- **Fix:** the plan is component STATE in
  `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx`, gated by a
  field-level content signature (skips the stringify on playback re-renders) and
  throttled to one rebuild per 100ms with a trailing apply.
- **Lib:** `src/lib/mothermode/reel/previewThrottle.ts` (`PREVIEW_PLAN_MIN_GAP_MS`,
  `planRebuildWaitMs`). **Tests:** `tests/lib/preview-throttle.test.ts`.
- **Detail doc:** `docs/PREVIEW_LOCKUP_THROTTLE_PORT.md`.

## 3. Magnetic scrub snapping + ruler playhead — `64a612d`

- **Snap:** `src/lib/mothermode/reel/scrubSnap.ts` — `snapToTargets(t, targets,
  thresholdSec)` + `timelineSnapTargets(clipStarts, totalSec)` → `[0, ...starts,
  total]`. The `TimeRuler` in `page.tsx` snaps a scrub to a clip boundary within a
  pixel-derived threshold `(10 / rect.width) * totalSec` (tightens as you zoom).
- **Playhead marker:** a brass line + diamond on the ruler (`playheadSec` prop).
- **Tests:** `tests/lib/scrub-snap.test.ts`.
- **Detail doc:** `docs/TIMELINE_SCRUB_SNAP_AND_RULER_PLAYHEAD_PORT.md`.

## 4. Pause the Player while scrubbing (the shake) — `03c6578`

**The bug:** the playhead drag and the Remotion Player were two writers on the
same clock. The drag wrote `playheadSec` → `RemotionPreview` seeked; the playing
Player simultaneously reported a stale frame back through `onPlayerFrame` →
`setPlayheadSec` → the playhead jumped back → shake. Every frame, a fight.

**The fix (1A — pause-while-scrubbing):**

- `page.tsx`: a `scrubbing` state, set `true` on the playhead drag's
  `onPointerDown` and `false` on pointer-up (after the final seek), passed to
  `<RemotionPreview scrubbing={scrubbing} />`.
- `RemotionPreview.tsx`: a new `scrubbing?: boolean` prop. While set, an effect
  pauses the Player (`if (p.isPlaying()) p.pause()`) and the `frameupdate`
  listener ignores reports (`if (scrubbingRef.current) return`). The drag becomes
  the ONLY writer of time. On release, one authoritative seek lands; the user
  resumes with play/Space (the CapCut/Premiere behavior — no auto-resume).

## 5. Per-type timeline lanes — `bb61f4b`

**The gap:** the timeline showed video clips + (sometimes) an overlay lane +
(sometimes) an audio lane. Captions and media cues had NO row — invisible in time.

**The fix:** `src/app/(fullscreen)/admin/reel-studio/TimelineLanes.tsx` (new,
self-contained), mounted in `page.tsx` right after the audio bed lane:

```tsx
<TimelineLanes
  clips={project.clips}
  captions={project.captions ?? {}}
  mediaCues={project.mediaCues ?? []}
  total={total}
  onSeek={seekTimeline}
/>
```

- **captions lane** — one block per transcribed clip, spanning its spoken words
  (clip start + first-word → last-word, minus the in-point trim).
- **media lane** — one block per cue, spanning its trigger word + `holdSec`, with
  an icon distinguishing image / GIF sticker / Lottie.
- Every block is a seek target (`onSeek(block.from + 0.01)`). Timing math mirrors
  `cueOnScreen`/`shiftMediaCues`: a clip's timeline start is the sum of prior
  `effectiveClipDuration`s; the window is word-derived minus `trimStartSec`.
- **Not done (next step):** the lanes show WHERE a caption/cue lands and seek to
  it, but don't yet DRAG to re-time it (the overlay/audio lanes already drag).
  That's the natural follow-up.

---

## Port checklist for Omega-v2

1. `@remotion/lottie` in both the app and the render worker; rebuild the worker image.
2. `types.ts` + `render/plan.ts` + `ReelComposition.tsx` lottie branch (keep the
   vendored worker copy byte-identical).
3. `previewThrottle.ts` + the plan-as-state rewrite in the preview component.
4. `scrubSnap.ts` + the ruler snap + playhead marker.
5. The `scrubbing` prop: page state → preview pauses + ignores frame reports.
6. `TimelineLanes.tsx` + the mount (needs `effectiveClipDuration` from
   `reel/timeline` and the `ReelMediaCue`/`ReelWord` types).

Tests to carry: `media-cues`, `preview-throttle`, `scrub-snap`, and the
`render-vendor-parity` guard.

# Reel Studio — Next Tasks (the highest-leverage three)

> **Read first:** `docs/REEL_STUDIO_SYSTEM_PORT.md` (the 2026-08-16 caption-editing
> overhaul is the current state of the canvas). This doc is the brief for the
> next initiative — three features, in the order that unblocks the most.

The editing canvas is in a good place: a two-level model (Preview = move/scale
the whole caption block; Words = per-word edit), and — as of the 2026-08-16
free-place overhaul — you drag the REAL caption glyph (a rAF loop owns its
transform for the drag, the entrance settles in edit mode, a placed word stays
visible while its page is current, the arrow-nudge moves free, reset strips
the whole scene, the toast floats). These three are the next "feels premium" jump.

---

## 1 · Transitions + a spring entrance — ✅ SHIPPED (2026-08-16)

**What landed:**
- **Scene transitions** — `ReelClip.transitionIn?: { type: 'crossfade' | 'whip' | 'zoom', durationSec }`
  on the INCOMING clip (types.ts + `normalizeTransition`). The plan
  (`render/plan.ts`) OVERLAPS the two scenes by the transition's frames: the
  incoming clip's `fromFrame` pulls earlier into the outgoing tail, so both
  `<Sequence>`s are mounted for the window and `ReelComposition.tsx` blends
  them frame-exactly (`transitionStyleFor` — crossfade fades the incoming
  scene up, whip pans both with a blur, zoom pushes the outgoing scene into
  the camera on top). `transitionOverlapSec` in `timeline.ts` is the ONE
  overlap number every layer reads (plan, `reelDurationSec`, `clipAtTime`,
  the editor's `timelineStartOf`) — so captions, cues, and the playhead never
  drift right of the picture by the overlap. The overlap clamps so both
  scenes keep ≥ 0.1s of solo runtime.
- **The seam picker** — a dot on each timeline block's top-left (every scene
  except the first). Click cycles off → crossfade → whip → zoom → off;
  right-click cycles the duration 0.3 → 0.5 → 0.8s. Undo-safe via `patch`.
- **The spring caption entrance** — `CaptionAnim` gains `'spring'`: a damped
  overshoot (`1 − (1−p)·e^(−4.5p)·cos(11p)`) computed frame-driven in
  `entranceStyle` like every other case (NEVER a CSS clock). It runs its own
  longer window (`SPRING_ENTER_SEC` 0.42s vs the 0.18s standard) and takes
  RAW linear progress — `entranceProgress` is anim-aware; pre-easing a spring
  with the cubic would flatten the overshoot. Settles at exactly scale(1).
- **Parity:** `timeline.ts` joined the vendored set (sync script +
  `render-vendor-parity.test.ts` — which also now guards `types.ts`, which it
  never did). Both `ReelComposition.tsx` copies are byte-identical.
- **Tests:** `tests/lib/reel-transitions.test.ts` — the normalize round-trip,
  the overlap math (zero/duration/solo-floor/duration-shrink/incoming-wins),
  the plan seam (fromFrame pull, transition tag, caption+cue shift), and the
  spring (identity at 1, overshoot mid, raw-linear window).

**Also fixed this session (the suite was red at handoff — pre-existing
in-flight work, not this task):** `normalizeCaptionPreset` compared the
fallback to hardcoded `'karaoke'` while the house default had moved to
`kelly-neon`, so junk preset ids leaked through un-normalized (the round-trip
test caught it) — now compares to `captionDefFor(undefined).id`. Three stale
tests updated to the current intended behavior: the `captionDefFor` fallback
(kelly-neon), the wordSpacing `-0.1em` tightening floor, and the spring's
longer CSS duration carve-out in the ≤220ms entrance guard.

**Verify:** `npx tsc --noEmit` clean; 371/371 across the 14-file reel/caption
suite (incl. `reel-transitions`, both vendor-parity guards, the round-trip).

---

## 2 · Creator-pack themes (one-click restyle) — ✅ SHIPPED (2026-08-16)

**What landed:** the `EDITOR_PACKS` model in `captions.ts` grew the full
creator set — **MrBeast** (beast + slam + punch-in, zoom seams), **Hormozi**
(fill-sweep = the karaoke-fill Hormozi look, whip seams), **Faceless**
(gradient-flow + ghost fade), **Cinematic** (ghost + smooth drift, slow
crossfades), **Luxury** (soft-card rise), **Neon** (the kelly-neon house
look), **Podcast** (minimal type-on, hard cuts). Each pack carries a
`transition?: ReelTransitionType` — one click applies the preset + the
overrides AND sets that transition on every seam (the gallery's new
`onApplyTransition` prop hands it to the page, which patches every clip after
the first; a pack with no transition clears the seams — hard cuts are a look
too). The packs row lives in the gallery's Customize panel.

**+ the Script Lab (same session, user ask):** a new **Scripts** tab —
variation scripts from the reel's OWN transcript, Content-Hub style.
`src/lib/mothermode/reel/scriptLab.ts` builds the transcript
(`transcriptForProject` — every clip's Whisper words in timeline order), its
hook (first ~14 words), its CTA (last ~14), and the grounding guides.
`ScriptLabPanel.tsx` runs the Content Hub's amplify flow against it: ONE
click (`aiAmplifyParts`) fills **full script ×2** (bodies), **hook/intro ×4**
(hooks), **body ×2** (angles), **CTA ×4** (ctas) — every variant grounded in
what is actually said, never invented. Each variant copies to the clipboard
or loads into the Scenes panel's voiceover box (the ElevenLabs flow). No
transcript yet → the panel offers Transcribe first.

**Tests:** `tests/lib/script-lab.test.ts` (7) — the transcript builder
(order/skip/empty), hook/CTA windows, the guides cap, and the pack shape
(unique ids, every presetId a real def, valid transitions).

**Verify:** `npx tsc --noEmit` clean; 378/378 across the 15-file reel/caption
suite.

---

## 3 · Split `page.tsx` — ✅ SHIPPED (2026-08-16, the hook half)

**What landed:** `src/app/(fullscreen)/admin/reel-studio/useCaptionEdit.ts` —
the caption-edit surface's state + handlers, extracted from page.tsx with NO
behavior change. The hook owns the nine state slots (`wordPlaceLocal`,
`wordScaleLocal`, `stackEditMode`, `showAllCardWords`, `wordCtxMenu`,
`fxMode`, `fxWords`, `fxScope`, `fxTarget`) and the eleven handlers
(`applyWordMark`, `applyWordMarks`, `clearWordFx`, `toggleFxWord`,
`freePlaceWord`, `removeWordPlace`, `toggleWordBehind`, `resetCaptionWords`,
`exitStackEdit`, `onCaptionWordPointerDown`, `onCaptionWordContextMenu`), and
the four free helpers (`timelineStartOf`, `clipWordIndexFromPlanIndex`,
`planWordIndexFromClipIndex`, `wordStylePatchToMark`) live there as the
single source — the page imports them back (no circular import: the hook
never imports the page). The page calls `useCaptionEdit({ project, setProject,
currentClip, stageClip, playheadSec, ccOn, post, setNote, setSelectedClip })`
and destructures the SAME names its JSX always used, so the body is
untouched. Two ordering moves made it typecheck: `ccOn` hoisted next to the
other early state (the hook reads it), and `clockHit`/`stageClip` computed
above the hook call (the pointer handlers read them); the edit-mode
auto-pause effect moved down beside the hook (it reads `stackEditMode`).

**The guard:** `tests/lib/caption-edit-extraction.test.ts` (5 tests) pins the
contract — the hook exports the hook + the helpers, the page imports +
destructures the same names, and the page does NOT re-declare a moved state
slot or handler (a future edit can't silently re-inline a copy — two sources
is the drift this killed).

**Verify:** `npx tsc --noEmit` clean; 383/383 across the 16-file reel/caption
suite.

**The component half — ✅ SHIPPED (2026-08-16):** `CaptionEditSurface.tsx`
owns the stage overlay stack — the Words/Preview pill (Remotion branch only),
the edit-shield (Remotion only), `CaptionDragLayer` (both branches, Preview
mode), `WordDragLayer` (both branches, Words mode — the `mapGlyphIndex` +
fxTarget seed differ per surface, preserved exactly), and the `CueDragLayer`s
(identical on both). `CaptionWordContextMenu` owns the right-click word menu
mount (the page renders it once at its root). Both preview branches mount
`<CaptionEditSurface surface="remotion"|"stage" edit={captionEdit} …>` — the
two inline copies that used to drift are one component. The page captures the
hook's return as `captionEdit` and destructures from it (the JSX names are
unchanged). The guard grew to 7 tests: the page mounts the surface for both
branches + the menu once, and no longer mounts the drag layers or the word
menu inline.

**+ the Script Lab round (same session, user ask):** steering + export.
`scriptLab.ts` gains `SOPHISTICATION_LEVELS` (Everyday / Sharp / Expert —
Sharp is the default, no guide line) and `steeredGuides(transcript, {sophistication,
notes})` — the transcript grounding + the level's guide line + the creator's
free notes (capped at 300 chars). `ScriptLabPanel.tsx` rides every amplify
call on the steered guides, and a hook variant's **→ full script** grows it
into a complete script (the picked hook seeds the bodies call with a
"must open with this exact hook" line). Export: any variant opens in the
**Teleprompter** (fullscreen, huge high-contrast text, auto-scroll at a
words-per-minute pace, play/pause + speed + font-size controls, Esc/Space) —
the record-a-new-take view — and the whole lab downloads as one `.txt`
(`scriptToText` — full scripts first, then hook/body/CTA variants).

**Tests:** `script-lab.test.ts` grew to 13 — the steering (default adds no
line, everyday/expert append, notes cap, the dial's three levels) and the
export (section markers, full-first order, empty-section skip).

**Verify:** `npx tsc --noEmit` clean; 20/20 across the two touched suites
(script-lab + caption-edit-extraction). The full suite's 48 failures are all
in `tests/api/create-payment-intent`, `tests/api/webhooks`, and
`tests/utils/receipt*` — Stripe/Resend env-key tests, pre-existing and
untouched by this round.

---

## Suggested order

1. **#3 (split page.tsx)** first if you're about to touch the canvas a lot —
   it de-risks the rest. Otherwise **#1 (transitions + spring)** for the
   visible jump, **#2 (themes)** for the quick win, **#3** when the canvas
   next needs to grow.
2. Each ships with: the shared-layer change + the vendored copy in sync + a
   parity/round-trip test + `tsc` clean + the caption suite green.

## Verify (every task)

```
npx tsc --noEmit
npx vitest run tests/lib/caption-freeplace-persistence.test.ts tests/lib/caption-behind-and-freeplace.test.ts tests/lib/caption-word-marks.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/caption-vendor-parity.test.ts tests/lib/caption-layer-geometry-parity.test.ts
node scripts/sync-vendored-captions.cjs   # after touching the shared layer
```

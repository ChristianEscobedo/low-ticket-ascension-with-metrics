> **[SUPERSEDED 2026-08-05 — word spacing]** Section 3 of this file (word spacing) is WRONG in
> two ways and must not be actioned. It says CaptionLayer.tsx ignores both spacing dials and
> should have them added: it does not ignore them (it imports captionCssFor and spreads
> css.line), and adding them there would duplicate the dials and CREATE the preview/MP4 drift.
> It also proposes gap over wordSpacing on a flex-row premise that is not what the markup does.
> Root cause, the real fix, and the retracted claims: **docs/WORD_SPACING_ROOT_CAUSE_FINDING.md**.
> Items 1, 2, 4 and 5 in this file are unaffected and still current.

# Preview sizing, subtitle controls, render button placement - TASK

Status (2026-08-05, late): item 1 edited (unverified), **item 2 DONE and wired**,
**item 3 DONE** (see the SUPERSEDED banner above), items 4/5 still open.
Baseline note: the suite is 46 failing / 1464 passing at HEAD **before** any of this work —
proven by a stashed comparison. Do not mistake that for a regression. See
`docs/SESSION_HANDOFF_RENDER_BUTTON.md`.


## 1. Platform previews aren't platform-sized - EDITED, NOT VERIFIED

All vertical mocks in `src/app/(fullscreen)/admin/reel-studio/page.tsx` go through
`VerticalFrame` (~line 1119), inside `PlatformMockView` (~line 1054). It was:

```tsx
<div className="relative w-full max-w-[300px] ..." style={{ aspectRatio: '9/19' }}>
  <MockVideo className="absolute inset-0 h-full w-full object-cover" />
```

`9/19` is a **phone-body** ratio, not a video ratio. Shorts / TikTok / IG Reels /
FB Reels are all **9:16**. Changed to `9/16`; `pnpm exec tsc --noEmit` passes.
**Still not seen in a browser.**

Caveat that still stands: the video is already `object-cover`, which *should*
crop-fill even at 9/19 - so if it still letterboxes, the ratio was not the cause
and the real culprit is elsewhere. Check that before stacking more edits.

Consumers: `shorts` (~1143), `fbreels` (~1194), plus TikTok and IG. `ytfeed`
(~1172) is correctly `16/9` and should stay.

Suggested shape: drive the frame from the existing `targetAspect(t)` helper
(~line 856, already returns `'9:16' | '16:9'`) instead of a hardcoded literal, so
preview and render plan can't drift apart.

## 2. Render button next to Caption MP4 - DONE AND WIRED (2026-08-05), unverified in browser


Wanted: render control **beside Caption MP4** with its progress/stage feedback
there; **keep** the one under Post; add it to the **publish previews** too.
Three mount points, one source of truth, **one** polling loop.

### Done this session: `src/app/(fullscreen)/admin/reel-studio/useRenderJob.ts`

All the job state and the poll loop moved out of `RenderPanel` into a
`useRenderJob({ reelId, onRendered })` hook returning a flat `RenderJob` view
model (`available`, `hint`, `aspect`/`setAspect`, `busy`, `progress`, `status`,
`error`, `videoUrl`, `canStart`, `start`). `describeStage`/`formatElapsed`/
`ASPECTS` came along and are exported.

Two decisions worth not re-litigating:

- **Prop, not context.** Call the hook ONCE in `ReelStudioPage` and pass the
  object down. One call = one timer; three components owning their own state
  would mean three timers and three answers to "is it done yet?". A prop also
  makes it visible at each mount site which job a button drives, which matters
  in a 7k-line file.
- **`onRendered` is held in a ref** inside the hook so `poll` has a stable
  identity. The page passes an inline arrow, so without the ref `poll` would be
  rebuilt on every unrelated keystroke in the studio.

**Update: the hook is now imported and driving all three surfaces.** `tsc --noEmit` is clean
and the caption/render suites are 31/31. One deviation from the plan below, and it matters:
`getReelId` is passed as a **thunk**, not a value, because the hook call site sits above the
reel-id binding in this 7,388-line file and passing the value directly is a TDZ crash at
module init. Keep it lazy. Not yet confirmed in a browser — see the handoff doc.

### The four edits below are DONE — kept as the record of what was changed


1. **`RenderPanel.tsx`** — delete its `useState`/`useEffect`/`poll`/`start`
   (lines 17-196) and its local `ASPECTS`/`describeStage`/`formatElapsed`, take
   `job: RenderJob` as a prop, and read from it. The JSX stays as-is; only the
   identifiers change (`busy` → `job.busy`, etc). Import `ASPECTS` from the hook.
   Keep `reelId`/`onRendered` OUT of it — the page owns those now.
2. **`page.tsx` ~2732**, next to `const [publishOpen, setPublishOpen] = useState(false);`
   — add the single `const renderJob = useRenderJob({ reelId: project?.id ?? null, onRendered: ... })`.
   Must sit with the other top-level hooks (unconditional). Move the
   `patch({ composedUrl: url })` + `setNote(...)` currently inline at 6034-6037
   into its `onRendered`.
3. **`page.tsx` 6032** — `<RenderPanel reelId={project.id} onRendered={...} />`
   becomes `<RenderPanel job={renderJob} />`.
4. **New `RenderButton.tsx`** (compact: label + inline bar + stage line, reads
   the same `job`) mounted twice — in the header right after the `Caption MP4`
   button (ends line 4641) and in `PublishSheet`, under the mock in the left
   column (after `</PlatformMockView>`, line 1701). `PublishSheet` needs a
   `renderJob?: RenderJob` prop added to its signature (~1457-1477) and passed at
   its mount site (~7289, next to `onClose={() => setPublishOpen(false)}`).

Note `burnCaptions()` (3252) is a **different** path from the render worker and
stays where it is; item 2 is about placing the *render* control beside it, not
merging the two.

## 3. Word spacing does nothing - DONE (2026-08-05). SECTION CONTENT IS WRONG — SEE BANNER.

> Everything below this heading is the **superseded** analysis, kept only so the wrong turns
> are not repeated. Claim (a) is false and its proposed fix would have caused drift. The real
> root cause was inline-block whitespace trimming, not a flex row. Both fixes live in
> `src/lib/mothermode/reel/captions.ts`. Read
> `docs/WORD_SPACING_ROOT_CAUSE_FINDING.md` instead of the text below.

Two distinct defects, both confirmed by grep this session.


**(a) The burn path ignores both spacing dials.**
`render-worker/remotion-project/CaptionLayer.tsx` contains **zero** occurrences of
`wordSpacing` or `letterSpacing`. So even when preview is correct, the rendered
MP4 cannot match. The earlier handoff listed this as a hypothesis; it is now a
fact.

**(b) `captionCssFor` guards `wordSpacing` on truthiness.**
In `src/lib/mothermode/reel/captions.ts`:

```js
letterSpacing: `${def.letterSpacingEm ?? (def.upper ? 0.03 : 0.01)}em`,
...(def.wordSpacingEm ? { wordSpacing: `${def.wordSpacingEm}em` } : {}),
```

`letterSpacing` is always emitted; `wordSpacing` is dropped whenever
`wordSpacingEm` is `0` - so you cannot explicitly set zero to override a preset
that ships a nonzero default (`Bold Pop` 0.12, `Soft Card` 0.08, `Type On` 0.1).
Should be a `??`/`!= null` check to match `letterSpacing`.

**Most likely why it looks totally dead in preview.** CSS `word-spacing` only
applies to real whitespace text nodes. If `KaraokeLine` (~line 713 of `page.tsx`)
renders each word as its own `<span>` in a flex row, there is no whitespace
character between them and the property is silently inert. That would explain
precisely why letter spacing works and word spacing does not.

**Verify that first** - it decides the fix. If words are flex items, the fix is
`gap: ${wordSpacingEm}em` on the row (and the equivalent in `CaptionLayer.tsx`),
not `wordSpacing`. Do not "fix" (b) and assume it's done; (b) alone will not make
the slider visibly work.

Chain to keep in sync: `CaptionGallery.tsx` (slider, writes `wordSpacing`) ->
`mergeCaptionOverrides` -> `captionCssFor` -> `KaraokeLine` (preview) **and**
`CaptionLayer.tsx` (burn).

## 4. Subtitle lines panel is smooshed - ANCESTOR CHAIN MEASURED (2026-08-05 session 2)

Layout regression. `SubtitlePanel.tsx` (213 lines).

### Measured ancestor chain - the hypothesis below was WRONG

Step 1 of the plan ("inspect the ancestor chain for a missing `min-h-0`, a missing
`flex-col`, or a height that became implicit") has now been done. Mount site is
`page.tsx:5220`. Walking up by indentation:

| Line | Element |
| --- | --- |
| 4581 | `<div className="flex h-full flex-col">` |
| 4583 | `<header className="flex h-14 shrink-0 ...">` |
| 4767 | `<div className="flex min-h-0 flex-1">` |
| 4769 | `<aside className="flex shrink-0 border-r border-bone/10">` |
| 4806 | `<div className="flex w-[330px] shrink-0 flex-col">` |
| 4824 | `<div className="min-h-0 flex-1 overflow-y-auto p-3">` |
| 5218 | `<div className="flex h-full min-h-0 flex-col gap-2">` (inside `{tab === 'captions' && ...}`) |
| 5220 | `<SubtitlePanel ... />` |

**No link in that chain is missing `min-h-0`, missing `flex-col`, or lacking a definite
height.** The chain is sound. So the predicted root cause is not present, and the fix the
plan anticipated does not exist to be made.

### What is actually anomalous

One thing, at the 4824/5218 boundary: the sidebar body at 4824 is a **scroll container**
(`overflow-y-auto`), and the captions tab wrapper at 5218 is **`h-full`**. Those two want
opposite things from the same box:

- Every other tab is plain content and needs the body to scroll - hence `overflow-y-auto`.
- The captions tab is a fixed-height panel with its *own* internal scroller
  (`SubtitlePanel` root is `flex min-h-0 flex-1 flex-col overflow-hidden`, rows at
  `min-h-0 flex-1 overflow-y-auto`) and needs a definite height - hence `h-full`.

`height: 100%` against a scrolling parent pins the panel to exactly the visible height and
denies it the parent's scroll. That is a genuine nested-scroll conflict and it is exactly
the sort of shared-container coupling that regresses when someone adjusts the body for a
*different* tab. It is a plausible mechanism for the smoosh.

**But it is a mechanism, not a confirmed cause.** It is not proven to produce the reported
symptom, and the reasonable-looking fixes (flip 4824 to `overflow-hidden`, or give 5218 a
`min-h-[...]`) either affect every other tab or require inventing a pixel number.

### Do not blind-patch this

The prior session's advice still holds and now has teeth: **a screenshot settles direction
in one look.** Deliberately NOT changed this session, because the measured evidence
eliminated the predicted cause without establishing a replacement, and editing shared
container CSS in a 7,428-line file on a hunch is how the *next* regression gets written.
Next actor: get the screenshot first.

### Original scoping notes (kept for the record — step 1 is now DONE, see above)

> The numbered plan at the end of this block has been executed: step 1 found the chain
> SOUND, which retires the "missing `min-h-0` / missing `flex-col` / implicit height"
> hypothesis. Do not re-run that search expecting to find something. The one correct and
> still-live instruction here is the last line: **get a screenshot.**

**Read this before editing that file: its internal layout looks correct, so the bug is
probably not in it.** The component is a well-formed scroll container —

`flex min-h-0 flex-1 flex-col overflow-hidden` on the root (100), `shrink-0` on the header
(102), clip name (120) and footer (208), and `min-h-0 flex-1 overflow-y-auto` on the rows
(132). The rows themselves are generously padded (`px-2.5 py-2`, `gap-2.5`, `leading-5`).
That is the standard correct recipe, not a smooshed one.

Which points at the **parent**. A `flex-1 min-h-0` child only gets height if its ancestor is
a flex column with a *definite* height. If the panel was moved into a container that is
`h-auto`, or that lost `flex-col`/`min-h-0`, it collapses to roughly content height and every
row crushes together — which matches "smooshed" exactly. So:

1. Find the mount site of `<SubtitlePanel` in `page.tsx` and inspect the **ancestor chain**
   for a missing `min-h-0`, a missing `flex-col`, or a height that became implicit.
2. Only if that chain is sound should you touch `SubtitlePanel.tsx` itself.

Do not start by re-padding rows. That would be treating a symptom, and it will fight whatever
the real container fix turns out to be. A screenshot would settle direction in one look.


## 5. Related, still open

- light-theme / layout regression
- captions not animating in the render (hypothesis: plan `words[]` empty - verify
  `src/lib/mothermode/reel/render/plan.ts` before touching `CaptionLayer.tsx` /
  `ReelComposition.tsx`). Note this is plausibly the *same* root cause family as
  item 3a: the burn component is missing props the preview has.

## Repo state as of this session

> **Updated 2026-08-05 session 2.** The three bullets below about unpushed commits and an
> uncommitted `page.tsx` are now WRONG — corrected inline. Verified with
> `git rev-list --count origin/main..main`.

- Secrets cleanup landed: `56ae41d` untracked `.env.local.bak` and gitignored env
  backups. The three credentials should still be rotated if that hasn't happened.
- ~~13 commits ahead of `origin/main`, unpushed.~~ **PUSHED. `origin/main..main` is now 0.**
  "Merge to main" IS done. The push block (secret scanning) is resolved — see
  `docs/PUSH_BLOCKED_SECRET_CLEANUP_HANDOFF.md`.
- ~~`page.tsx` has one uncommitted change (the `9/16` edit).~~ **Committed.** Working tree is
  clean.
- The async render worker is still **unverified at runtime**. Railway was confirmed serving
  the old synchronous build (`GET /render/:jobId` 404s). **The push was the blocker for
  redeploying, and it is now cleared** — so a Railway redeploy is finally possible and is the
  gate on verifying both the render flow end to end and the caption word-spacing parity in
  the MP4. Nothing in the render path has been observed working yet.


## Ground rules

`page.tsx` is 7,388 lines - read the region before editing, and run
`pnpm exec tsc --noEmit` after each change rather than batching. Safety net is
`git reset --hard backup/pre-restore-main`.

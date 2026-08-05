# Preview sizing, subtitle controls, render button placement — TASK

Status: **item 1 changed (unverified), items 2–5 not started.** One edit landed;
everything else below is findings only.

## 1. Platform previews aren't platform-sized (the screenshot item) — EDITED, NOT VERIFIED


All vertical mocks in `src/app/(fullscreen)/admin/reel-studio/page.tsx` go through
`VerticalFrame` (~line 1119), inside `PlatformMockView` (~line 1054):

```tsx
<div className="relative w-full max-w-[300px] ..." style={{ aspectRatio: '9/19' }}>
  <MockVideo className="absolute inset-0 h-full w-full object-cover" />
```

`9/19` is a **phone-body** ratio, not a video ratio. Shorts / TikTok / IG Reels /
FB Reels are all **9:16**. So the frame itself is taller than the format it claims
to preview, and the reported "not full screen on Shorts" follows from that: the
chrome (`Shorts` badge, action rail, caption block) is positioned in percentages
against a 9:19 box, leaving dead black above and below the video band.

Note the video is already `object-cover`, which *should* crop-fill even at 9/19 —
so if it still letterboxes after the ratio is corrected, the cause is elsewhere
and worth checking in the browser before more edits. Verify against a real reel;
don't trust the mock alone.

Consumers of `VerticalFrame`: `shorts` (~1143), `fbreels` (~1194), plus TikTok and
IG. `ytfeed` (~1172) is correctly `16/9` and should stay.

Suggested shape: drive the frame from the existing `targetAspect(t)` helper
(~line 856, already returns `'9:16' | '16:9'`) instead of a hardcoded literal, so
the preview and the render plan can't drift apart.

## 2. Render button next to Caption MP4

`Caption MP4` button lives in `page.tsx` and calls `burnCaptions()`. `RenderPanel`
is currently mounted much further down. Wanted:
- render control **beside Caption MP4**, with its progress/stage feedback there;
- **keep** the existing one under Post;
- add it to the **publish previews** too.

Three mount points sharing state — lift the render job state (jobId, stage,
progress) into the page or a small context so all three read one source of truth.
Do not duplicate the polling loop three times.

## 3. Word spacing does nothing (subtitles → Customize)

Control exists but has no effect. Trace: `SubtitlePanel.tsx` (214 lines) writes
`CaptionOverrides` → `KaraokeLine` (~line 713) consumes them → and the burn path
in `render-worker/remotion-project/CaptionLayer.tsx` must apply the same value or
preview and output diverge. Check all three; a control that only lands in preview
is the more likely bug given the pattern of the other caption props.

## 4. Subtitle lines panel is smooshed

Layout regression, still open. `SubtitlePanel.tsx`.

## 5. Related, still open from the prior handoff

- light-theme / layout regression
- captions not animating in the render (hypothesis: plan `words[]` empty —
  verify in `src/lib/mothermode/reel/render/plan.ts` before touching
  `CaptionLayer.tsx` / `ReelComposition.tsx`)
- the async render worker changes are committed but **unverified at runtime**;
  they need a Railway redeploy before any of this can be tested end to end.

## Ground rules for the next session

`page.tsx` is 7,388 lines — read the region before editing it, and run
`pnpm exec tsc --noEmit` after each change rather than batching. Safety net is
`git reset --hard backup/pre-restore-main`.

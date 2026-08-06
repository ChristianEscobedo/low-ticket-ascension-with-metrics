# Reel Render Engine (Remotion) — SYSTEM PORT

**Status:** app-side complete (plan + client + route + tests). Needs a one-time
`npm i` + AWS deploy before the button can produce an MP4.

## Why we moved off the fal/ffmpeg burn

| Problem | Cause | Fixed by |
| --- | --- | --- |
| Animations never matched the preview | CSS animations were re-expressed as ffmpeg filters / ASS tags. ASS has no scale-pop, blur-in, gradient fill or box-grow. | Render the **actual React/CSS components** frame by frame. |
| Captions drifted late after a trim | Word times are in **source** seconds; the burn used them as timeline seconds. | `shiftWords()` subtracts `trimStartSec` once, in frames. |
| Renders timed out | ffmpeg ran inside the Vercel request. | Remotion **Lambda**: fan-out render, request only starts + polls. |
| Whole route 500'd when a dep was missing | Top-level import of the render lib. | Dynamic import behind a variable specifier + `configured` probe. |

## Architecture

```
ReelProject (DB)
   │  buildRenderPlan()            src/lib/mothermode/reel/render/plan.ts   (PURE)
   ▼
RenderPlan  { fps, width, height, durationInFrames, clips[], overlays[], audio, words[], captionStyle, captionLayout }
   │  inputProps
   ▼
remotion/ReelComposition.tsx  →  Sequences + OffthreadVideo + Audio + CaptionLayer
   │  renderMediaOnLambda()        src/utils/integrations/remotion-render.ts
   ▼
public MP4 URL
```

**One rule:** the plan is the only truth. Geometry, length, cuts and word timings
are decided once, in frames, in a pure function — so preview, render and tests
can never disagree.

## Files

| File | Role |
| --- | --- |
| `src/lib/mothermode/reel/render/plan.ts` | Pure `ReelProject → RenderPlan`. Frame math, trim-shifted words, validation, cost estimate. |
| `src/utils/integrations/remotion-render.ts` | `isRemotionConfigured`, `startReelRender`, `reelRenderProgress`, `renderReelAndWait`. No hard dependency. |
| `remotion/Root.tsx` | Registers the single `Reel` composition; size/fps/duration come from the plan via `calculateMetadata`. |
| `remotion/ReelComposition.tsx` | Clips (`OffthreadVideo` + keyframed Ken-Burns), overlays, music bed. |
| `remotion/CaptionLayer.tsx` | Karaoke burn using the **same** `captionCssFor` / `captionRows` / power-word helpers as the editor. |
| `src/app/api/admin/reel-render/route.ts` | `GET` availability · `POST {id}` start · `POST {renderId,bucketName}` progress. |
| `tests/lib/render-plan.test.ts` | 13 tests (passing): frame rounding, adjacency, trim-shift, ordering, audio clamp, overlays, validation. |


## One-time setup

```bash
# 1. install
npm i remotion @remotion/cli @remotion/lambda @remotion/player

# 2. preview the composition locally (no AWS needed)
npx remotion studio remotion/index.ts

# 3. AWS: deploy the render function + the bundled site
npx remotion lambda functions deploy
npx remotion lambda sites create remotion/index.ts --site-name=reel-studio
```

Then set:

```
REMOTION_AWS_ACCESS_KEY_ID=
REMOTION_AWS_SECRET_ACCESS_KEY=
REMOTION_AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-...   # printed by step 3
REMOTION_SERVE_URL=https://remotionlambda-....s3.../index.html
```

`GET /api/admin/reel-render` reports exactly which of these is missing, so the
Studio can show the real reason instead of a generic failure.

Re-run `sites create` after any change to `remotion/` or to `plan.ts` — the
Lambda renders the **deployed** bundle, not your working tree.

## Notes

- `OffthreadVideo` (not `<Video>`) — frames are pulled with ffmpeg instead of
  waiting on a `<video>` element to seek. This is what makes headless renders
  reliable instead of hanging or dropping frames.
- Clip audio is muted automatically when a replacement music bed exists.
- Caption font size scales from the 390px preview canvas to the real frame
  width, so exports aren't tiny.
- `renderPlanErrors()` runs **before** a render starts: empty timelines and
  `blob:`/local URLs are rejected for free rather than after ten minutes.

## Next

1. Wire the Studio button to `POST /api/admin/reel-render`, poll every ~3s, then
   save the returned URL with the existing reel save action.
2. Swap the editor stage to `@remotion/player` fed by the same `RenderPlan` —
   at that point preview and export are literally the same component tree.
3. Delete the fal compose + ASS burn paths once the button ships.

## Incident: the job poller went missing (2026-08-06)

Every render reported "the render worker restarted and lost this job" � on
the OLD worker after a deploy (true) AND on the new worker after it was
healthy (false). Root cause: a crash-repair rewrite of render-worker/server.js
had dropped `GET /render/:jobId` entirely. POST /render accepted the job and
the background render ran fine, but the app's progress poll 404\'d � and the
app honestly reads a 404 from an in-memory job registry as "restarted". No
crash, no restart, no lost render; just nothing to poll.

Restored the handler verbatim from git history with a "do not remove" note
in the code, and verified live: a test job 404\'d on poll before the fix and
the process never died (same startedAt across the render). Guard for next
time: the worker has exactly three routes � /health, POST /render,
GET /render/:jobId. If a fourth appears or a third disappears, that is the
finding, not a restart.

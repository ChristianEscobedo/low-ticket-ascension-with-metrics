# Remotion-Only Render Path — Handoff

**Goal:** Make Remotion the SINGLE render engine for the Clipping Studio — preview AND export use the SAME `ReelComposition` + `buildRenderPlan`, so what you see IS what exports. No more fal/ffmpeg compose mismatch.

**Architecture (the ChatGPT answer, implemented):**
```
VideoProject JSON (clips, captions, captionStyle, captionOverrides, overlays, audio)
        ↓
buildRenderPlan(project, {fps, width, height})  →  RenderPlan
        ↓
ReelComposition (remotion-project/ReelComposition.tsx)
       ↙ ↘
@remotion/player (preview)    Remotion Lambda (export)
        =
Same frames, same output
```

---

## What's DONE (pushed to main)

| Commit | What |
|--------|------|
| `4c675f4` | `RemotionPreview.tsx` — renders the SAME `ReelComposition` + `buildRenderPlan` the Lambda renderer uses. Compiles clean. |
| `4c675f4` | `previewMode` state (`'remotion' \| 'edit'`, default `'remotion'`) + dynamic import in `page.tsx` |
| `4c675f4` | Toggle button in the stage toolbar ("Remotion" / "Edit") |
| `4c675f4` | Conditional render: when `previewMode === 'remotion' && project.clips.length > 0`, the stage shows `<RemotionPreview project={project} aspect={...} />` instead of the `<video>` |
| `0a2c1cc` | `@ffmpeg-installer/linux-x64` installed as a real dependency (the Linux binary Vercel needs) |
| `0374c1d` | `next.config` — `serverExternalPackages` for ffmpeg packages + `outputFileTracingIncludes` for the reel routes |
| `b643406` | `ffmpeg-worker.ts` resolver walks every `@ffmpeg-installer+...` pnpm entry (finds the linux-x64 binary) |

**Files created/modified:**
- `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx` — NEW, the preview component
- `src/app/(fullscreen)/admin/reel-studio/page.tsx` — import + state + toggle + conditional render
- `next.config.mjs` — serverExternalPackages + outputFileTracingIncludes
- `src/utils/integrations/ffmpeg-worker.ts` — resolver fix
- `package.json` + `pnpm-lock.yaml` — `@ffmpeg-installer/linux-x64` dep

---

## What's NOT done (the remaining work)

### 1. Fix the type error (1 line)
`page.tsx` line ~6567: `'horizontal'` should be `'landscape'` (the `RENDER_SIZES` key in `plan.ts`).
```ts
// WRONG:
aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'horizontal' : 'square'}
// RIGHT:
aspect={aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'landscape' : 'square'}
```
I attempted this fix but the session crashed before verifying. Check `git diff` — if it's still `'horizontal'`, change it to `'landscape'`.

### 2. Verify the build passes
```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
pnpm run build
```
Both must exit 0. Then commit + push.

### 3. Deploy the Remotion Lambda function + site (one-time CLI)
This produces the 5 env vars the `reel-render` route needs. Run from the repo root:
```bash
npx remotion lambda functions deploy --region=us-east-1
npx remotion lambda sites create remotion-project/index.ts --site-name=reel-render
```
The first command prints the **function name** (`REMOTION_LAMBDA_FUNCTION_NAME`).
The second prints the **serve URL** (`REMOTION_SERVE_URL`).

You also need AWS credentials with Lambda + S3 permissions:
- `REMOTION_AWS_ACCESS_KEY_ID`
- `REMOTION_AWS_SECRET_ACCESS_KEY`
- `REMOTION_AWS_REGION` (e.g. `us-east-1`)

### 4. Set the 5 env vars in Vercel
Go to Vercel → your project → Settings → Environment Variables. Add:
```
REMOTION_AWS_REGION=us-east-1
REMOTION_LAMBDA_FUNCTION_NAME=<from step 3>
REMOTION_SERVE_URL=<from step 3>
REMOTION_AWS_ACCESS_KEY_ID=<your AWS key>
REMOTION_AWS_SECRET_ACCESS_KEY=<your AWS secret>
```
Redeploy after adding them.

### 5. Test the full flow
1. Open `/admin/reel-studio`, pick a reel with clips
2. The stage should show the Remotion Player (not the old `<video>`) — the "Remotion" toggle should be active
3. Scrub/trim in "Edit" mode, then toggle back to "Remotion" — the preview should match
4. Hit "Render video" in the RenderPanel (Post tab) — it should call `renderMediaOnLambda` and return a real MP4 URL
5. The MP4 should match the preview exactly (same captions, same animations, same trims)

---

## Key files to know

| File | Role |
|------|------|
| `remotion-project/ReelComposition.tsx` | THE composition — clips + overlays + audio + captions as frame-exact `<Sequence>`s. Used by BOTH the Player and the Lambda renderer. |
| `remotion-project/CaptionLayer.tsx` | The caption rendering (karaoke, word-timed) |
| `src/lib/mothermode/reel/render/plan.ts` | `buildRenderPlan(project, {fps, width, height})` → `RenderPlan`. The single source of truth. |
| `src/utils/integrations/remotion-render.ts` | `renderMediaOnLambda` wrapper. Needs the 5 env vars. |
| `src/app/api/admin/reel-render/route.ts` | The API route that calls `startReelRender` (Remotion Lambda) |
| `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx` | The preview component (`@remotion/player` + `ReelComposition`) |
| `src/app/(fullscreen)/admin/reel-studio/page.tsx` | The editor — has the `previewMode` toggle + conditional render |

## The old ffmpeg path (kept as fallback)
The `compose()` function in `page.tsx` still calls the local ffmpeg compose (`composeTracksLocal`) which now works on Vercel (the linux-x64 binary ships). This is the fallback while the Remotion Lambda path is being set up. Once Remotion is confirmed working, the fal/ffmpeg compose button can be removed.

## Context
The user was frustrated with the fal/ffmpeg compose not matching the preview (fal can't do in-points, so trims were ignored). The fix is Remotion-only: one `VideoProject` JSON → one `ReelComposition` → both the Player (preview) and the Lambda renderer (export) use the same component. The ChatGPT answer the user pasted describes exactly this architecture.

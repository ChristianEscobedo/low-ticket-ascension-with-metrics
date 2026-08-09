# Render Worker — Railway Setup (Complete Guide)

The render worker is a persistent Docker container on Railway that renders reel MP4s with Remotion (Chromium + ffmpeg). The Next.js app POSTs a RenderPlan to it; the worker renders the MP4 and uploads it to Supabase storage. This replaces Remotion Lambda — no IAM, no S3 serve URLs, no function names.

---

## Architecture

```
Next.js (Vercel)
  └─ POST /api/admin/reel-render
       └─ POST {RENDER_WORKER_URL}/render  { plan, reelId }
            └─ Railway render-worker (Docker: Node + Chromium + ffmpeg + Remotion)
                 ├─ bundle(remotion-project/index.ts)  ← same composition as the preview
                 ├─ renderMedia(plan) → out.mp4
                 └─ upload to Supabase storage (reel-renders bucket) → public URL
```

**Preview === export.** The `@remotion/player` in the editor and the Railway worker use the SAME `ReelComposition` + `buildRenderPlan`. What you see IS what exports.

---

## 1. Deploy the worker to Railway

### Option A: New service (recommended)

1. Go to **railway.app** → **New Project** → **Deploy from GitHub repo**
2. Pick `low-ticket-ascension-with-metrics`
3. During setup, set **Root Directory** to `render-worker`
4. Railway detects the `Dockerfile` automatically
5. Click **Deploy**

### Option B: Existing service

1. Railway → your project → the service → **Settings**
2. **Source** → **Root Directory** → set to `render-worker`
3. **Build** → **Build Method** → **Dockerfile**, **Dockerfile Path** → `Dockerfile`
4. **Save** → **Deployments** → **Redeploy**

---

## 2. Set the env vars in Railway

Railway → your service → **Variables** tab → **Raw Editor** (top right) → paste:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Click **Update Variables**. The service restarts automatically.

**Where to find the values:**
- `SUPABASE_URL`: Supabase dashboard → your project → **Settings** → **API** → **Project URL**
- `SUPABASE_SERVICE_ROLE_KEY`: same page → **Project API keys** → `service_role` (secret, not `anon`)

---

## 3. Create the Supabase storage bucket

Supabase dashboard → **Storage** → **New bucket**:
- **Name**: `reel-renders`
- **Public**: **yes** (so the MP4 URLs are accessible)

---

## 4. Set the worker URL in Vercel

Copy the Railway URL (e.g. `https://reel-render-worker-production.up.railway.app`).

Vercel → your project → **Settings** → **Environment Variables** → add:

```
RENDER_WORKER_URL=https://your-railway-url.up.railway.app
```

Then **redeploy** Vercel.

---

## 5. Test the full flow

1. Open `/admin/reel-studio`, pick a reel with clips
2. The stage shows the **Remotion Player** (the "Remotion" toggle is active by default)
3. Scrub/trim in **Edit** mode, toggle back to **Remotion** — the preview matches
4. Go to the **Post** tab → **RenderPanel** → **Render video**
5. The worker renders the MP4 and uploads it to Supabase. The RenderPanel shows the URL.
6. The MP4 matches the preview exactly (same captions, same animations, same trims).

---

## Files

| File | Role |
|------|------|
| `render-worker/Dockerfile` | Node 20 + Chromium + ffmpeg + fonts |
| `render-worker/package.json` | Express + Remotion + Supabase deps |
| `render-worker/server.js` | `POST /render` → renderMedia → upload to Supabase |
| `render-worker/remotion-project/` | The composition (same as the preview) |
| `render-worker/remotion-project/constants.ts` | Self-contained constants (DEFAULT_FPS, RENDER_SIZES, RenderPlan) |
| `render-worker/src/lib/mothermode/reel/captions.ts` | Caption functions (copied from the main app) |
| `render-worker/src/lib/mothermode/reel/captionFonts.ts` | Caption font registry (copied from the main app — the caption layer imports it) |
| `render-worker/src/lib/mothermode/reel/types.ts` | Caption types (copied from the main app) |
| `src/app/api/admin/reel-render/route.ts` | The Next.js route that POSTs to the worker |
| `src/app/(fullscreen)/admin/reel-studio/RemotionPreview.tsx` | The preview component (`@remotion/player` + `ReelComposition`) |

### Vendored reel libs — keep the set complete

The worker vendors a subset of `src/lib/mothermode/reel/` into
`render-worker/src/lib/mothermode/reel/`. Anything the vendored files import
must be vendored too — the worker has no access to the app's `src/` tree.
`scripts/sync-vendored-captions.cjs` only syncs `captions.ts`; it does NOT
catch new sibling modules.

This bit once already: a Railway deploy failed with
`Type error: Cannot find module '../captionFonts'` because
`render/captionLayer.tsx` (vendored) imports `captionFonts` (not vendored).
Fix was copying `src/lib/mothermode/reel/captionFonts.ts` into the worker.

**When you add/rename a module under `src/lib/mothermode/reel/`:** grep the
worker copy for its import (`findstr /S "captionFonts" render-worker\src`)
and vendor the file if anything references it, then redeploy the worker.

## Health check

`GET {RENDER_WORKER_URL}/health` → `{ ok: true, bundled: true }` when the worker is up and the composition is bundled.

## Cost

Railway persistent worker: ~$5-10/mo (always on). No per-render fees (unlike Lambda).

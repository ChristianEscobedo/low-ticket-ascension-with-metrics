# Render Worker SIGKILL — handoff

Updated 2026-08-13 after the root-cause fix. Read this before touching the worker.

## The symptom (historical)

Reel Studio "Render" failed on a **1-clip, 60-second, 1080×1920 reel**. Worker log:

```
[worker] rendering 1 clips, 1809 frames @ 30fps
[worker] 0%  (repeats, never advances)
[error] Could not extract frame from compositor  Error: Compositor exited with signal SIGKILL
[error] [http://localhost:3000/proxy?src=<SUPABASE_URL>&time=1.766&transparent=false&toneMapped=true]
        Failed to load resource: the server responded with a status of 500
```

Smaller / shorter videos rendered fine on the same 8 GB / 8 vCPU Railway box. Not a total-memory OOM.

## Established facts (still true)

1. **`localhost:3000` is Remotion's internal asset proxy inside the container**, not the user's machine and not the Next app. See `docs/RENDER_LOCALHOST3000_FINDING.md`. The `…/proxy?src=…&time=…&transparent=…&toneMapped=…` URL is `OffthreadVideo`'s signature.
2. **The clip source was reachable** (`curl -r 0-2000` → HTTP 206). The failure was the proxy re-fetch / extract path, not a missing object.
3. **Render path:** `useRenderJob.ts` → `POST /api/admin/reel-render` → `POST {RENDER_WORKER_URL}/render` → `render-worker/server.js` `runRender()` → `@remotion/renderer` `renderMedia` → `ReelComposition` → `<OffthreadVideo src={clip.src}>`.
4. **Do not re-add a `cancelSignal` watchdog.** This Remotion version has no `cancelSignal` on `renderMedia`; it broke two deploys.

## Root cause (confirmed against Remotion docs)

**Hypothesis A was correct.** Remotion does **not** accept bare absolute OS paths in `OffthreadVideo` / `Img` / `Audio` `src`:

- https://www.remotion.dev/docs/miscellaneous/absolute-paths
- https://www.remotion.dev/docs/offthreadvideo

Chrome has no filesystem access. Allowed forms are: remote `http(s)` URL, or `staticFile()` (file inside the bundle `public/` dir).

Commit `268161e` downloaded + transcoded media to `/tmp/…/m0.mp4` and wrote that **absolute path** into `plan.clips[i].src`. Logs then showed `src host: 127.0.0.1:8080` (or a raw path) while the compositor proxy line still showed the **Supabase** URL — the composition never honored the rewrite, so OffthreadVideo kept proxying the remote progressive MP4, the proxy 500'd / hung, compositor SIGKILL.

Hypothesis B (stale inputProps) was a secondary smell: `selectComposition` ran on the pre-localize plan. Fixed by localizing **before** both `selectComposition` and `renderMedia`.

## The fix (in `render-worker/server.js`)

1. **Download** every remote media URL (clips, overlays, audio, mediaCues, SFX) into the job tmp dir.
2. **Transcode** videos to a faststart h264/aac mezzanine (`libx264 veryfast crf23 yuv420p +faststart`); audio to m4a when possible; images served as-is. Preserve real extensions so `<Img>` cues are not forced to `.mp4`.
3. **Rewrite** `plan.*.src` to a **loopback HTTP URL** on the worker's own Express:
   `http://127.0.0.1:${PORT}/__media/${jobId}/m0.mp4`
4. **Serve** those files from a single route `GET /__media/:jobId/:file` backed by a `mediaDirs` Map (no per-job `express.static` leak).
5. **Order:** localize → `getCompositions` / `selectComposition` → `renderMedia`, all with the same rewritten plan.
6. Still: `concurrency: 1`, `timeoutInMilliseconds: 120_000`, `scale: quality==='720' ? 2/3 : 1`.

OffthreadVideo may still route through its internal `/proxy`, but the proxied `src` is now our loopback mezzanine (local, seekable, faststart) — not Supabase.

## Verify after deploy

1. `GET {RENDER_WORKER_URL}/health` → `build.commit` must match the push (Railway auto-deploys `render-worker/` from `main`).
2. Re-render the failing 60s 1080p reel.
3. Worker logs must show:
   - `[worker] localize m0 <- https://…supabase…`
   - `[worker] localize m0 -> http://127.0.0.1:8080/__media/job_…/m0.mp4`
   - `[worker] clip 0: … src host: 127.0.0.1:8080 (localized)`
4. Progress must advance past `0%`. Success → `[worker] done → https://…`.
5. If it still SIGKILLs **and** clip host is `127.0.0.1` with `(localized)`, the remaining issue is mezzanine extraction (hypothesis C) — inspect ffmpeg mezzanine with ffprobe, try 720p scale, or consider `@remotion/media` `Video` for local HTTP sources. Do **not** go back to absolute paths.

## Topology reminder

- Next app → Vercel. Worker → Railway, root dir `render-worker`, auto-deploy on `main`.
- `RENDER_WORKER_URL=https://low-ticket-ascension-with-metrics-production.up.railway.app` (Vercel env).
- See `docs/RAILWAY_WORKER_DEPLOY_STATE.md`.

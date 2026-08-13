# Render Worker SIGKILL — FIXED

**Status: FIXED and verified on a 60s 1080×1920 reel.**  
Commits: `4ca6818` (localize over loopback HTTP) + `31f42cc` (OffthreadVideo cache cap).  
Live on Railway worker root dir `render-worker/`, auto-deploy from `main`.

Do not re-litigate the facts below. Prior sessions burned many rounds re-guessing.

---

## The symptom

Reel Studio "Render" failed on a **1-clip, 60-second, 1080×1920 reel**. Worker log ended with:

```
[worker] rendering 1 clips, 1809 frames @ 30fps
[worker] 0%  (or advanced to ~21%, then died)
[error] Could not extract frame from compositor
        Error: Compositor exited with signal SIGKILL
[error] [http://localhost:3000/proxy?src=…&time=…&transparent=false&toneMapped=true]
        Failed to load resource: the server responded with a status of 500
```

Smaller / shorter videos rendered fine on the same **8 GB / 8 vCPU** Railway box. So the pipeline *could* render; the failure was specific to a large/long source. Upgrading RAM was tried and did not apply as the sole fix.

---

## Established facts (still true — do not re-litigate)

1. **`localhost:3000` is NOT the user's machine and NOT the Next app.** It is Remotion's *internal* asset/static server inside the Railway container. See `docs/RENDER_LOCALHOST3000_FINDING.md`. The `…/proxy?src=…&time=…&transparent=…&toneMapped=…` URL is **Remotion's `OffthreadVideo` asset proxy** (those query params are its signature).

2. **The clip source video was reachable.** `curl -r 0-2000 <supabase mp4 url>` → `HTTP 206`. The bytes were there. (Separately, an earlier reel had a *different* clip that was a dead object — `404 NoSuchKey` — that one needed re-upload. Not the same issue.)

3. **Render path:**
   ```
   useRenderJob.ts (UI)
     → POST /api/admin/reel-render
     → POST {RENDER_WORKER_URL}/render
     → render-worker/server.js runRender()
     → @remotion/renderer renderMedia
     → render-worker/remotion-project/ReelComposition.tsx
     → <OffthreadVideo src={clip.src}>
   ```

4. **Do not re-add a `cancelSignal` watchdog.** This Remotion version (`^4.0.505`) has no `cancelSignal` on `renderMedia`; a watchdog broke two deploys.

5. **Topology:** Next app → Vercel. Worker → Railway, root directory = `render-worker`, auto-redeploys on push to `main`.  
   `RENDER_WORKER_URL=https://low-ticket-ascension-with-metrics-production.up.railway.app` (Vercel env).  
   Verify deploy freshness with `GET {RENDER_WORKER_URL}/health` → `build.commit`.

---

## There were TWO stacked bugs

### Bug 1 — absolute paths are not valid OffthreadVideo srcs

**Commit that introduced the wrong fix:** `268161e`  
**Commit that fixed it:** `4ca6818`

Remotion does **not** accept bare absolute OS paths in `OffthreadVideo` / `Img` / `Audio` `src`:

- https://www.remotion.dev/docs/miscellaneous/absolute-paths
- https://www.remotion.dev/docs/offthreadvideo

Chrome has no filesystem access. Allowed forms: remote `http(s)` URL, or `staticFile()` (file inside the bundle `public/` dir).

What `268161e` did: download + transcode media to `/tmp/…/m0.mp4` and write that **absolute path** into `plan.clips[i].src`. Logs then showed a local-looking host while the compositor proxy line still showed the **Supabase** URL — the composition never honored the rewrite. OffthreadVideo kept proxying the remote progressive MP4 → proxy 500 → hang → SIGKILL.

**The fix (`4ca6818`):**

1. Download every remote media URL (clips, overlays, audio, mediaCues, SFX) into the job tmp dir.
2. Transcode videos to a faststart h264/aac mezzanine; audio to m4a when possible; images as-is. Preserve real extensions so `<Img>` cues are not forced to `.mp4`.
3. Rewrite `plan.*.src` to a **loopback HTTP URL** on the worker's own Express:
   ```
   http://127.0.0.1:${PORT}/__media/${jobId}/m0.mp4
   ```
4. Serve those files from a single route `GET /__media/:jobId/:file` backed by a `mediaDirs` Map (no per-job `express.static` leak on the router stack).
5. **Order matters:** localize **before** both `selectComposition` and `renderMedia`, so both see the same rewritten plan.

After this deploy, logs proved the rewrite took:

```
[worker] localize m0 <- https://…supabase…/….mp4
[worker] localize m0 -> http://127.0.0.1:8080/__media/job_…/m0.mp4
[worker] clip 0: … src host: 127.0.0.1:8080 (localized)
```

And the proxy line flipped from Supabase to loopback:

```
[http://localhost:3000/proxy?src=http%3A%2F%2F127.0.0.1%3A8080%2F__media%2Fjob_…%2Fm0.mp4&time=15.8&…]
```

Progress advanced past 0% (to ~21%) — then still SIGKILL'd. That exposed bug 2.

### Bug 2 — OffthreadVideo default cache OOMs the compositor

**Commit that fixed it:** `31f42cc`  
**Remotion docs:** https://www.remotion.dev/docs/troubleshooting/sigkill

With localize working, the remaining kill was pure memory. Remotion's default OffthreadVideo cache allows itself up to **~50% of free RAM** at render start. On an "empty" 8 GB container that is multi-GB of decoded frames; Chrome + compositor + ffmpeg then allocate on top and the kernel SIGKILLs the compositor process.

**The fix (`31f42cc`) in `renderMedia` opts:**

| Option | Value | Why |
|---|---|---|
| `concurrency` | `1` | One frame at a time (already set) |
| `disallowParallelEncoding` | `true` | Don't render next frame while ffmpeg encodes the last — lower peak RSS |
| `offthreadVideoCacheSizeInBytes` | `64 * 1024 * 1024` (64 MB) | Hard cap decoded-frame cache (was ~50% free RAM) |
| `mediaCacheSizeInBytes` | `32 * 1024 * 1024` (32 MB) | Cap general media cache the same way |
| `scale` | `quality === '720' ? 2/3 : 1` | Output downsample (already set) |
| mezzanine `-vf scale` | maxH 720 or 1080 matching quality | Never decode more pixels than we paint |
| Dockerfile `PUPPETEER_DISABLE_DEV_SHM_USAGE` | `true` | Docker `/dev/shm` is often 64 MB; Chrome OOMs into it |
| Dockerfile `NODE_OPTIONS` | `--max-old-space-size=2048` | Keep Node heap from competing with the compositor |

---

## What the worker does now (end state)

`runRender()` in `render-worker/server.js`:

1. Create job tmp dir; register it in `mediaDirs` under the job id.
2. Bundle once (cached at startup) and serve it from Express at `/__bundle`.
3. **Localize** every remote src → download → mezzanine (scaled to quality) → rewrite to `http://127.0.0.1:${PORT}/__media/${jobId}/mN.ext`.
4. `selectComposition` + `renderMedia` with the rewritten plan and the memory caps above.
5. Upload finished MP4 to Supabase `reel-renders` bucket; return public URL.
6. `finally`: `mediaDirs.delete(jobId)` + `rm -rf` tmp dir.

Still true and intentional:

- Async job API: `POST /render` → 202 + `jobId`; poll `GET /render/:jobId`.
- `concurrency: 1`, `timeoutInMilliseconds: 120_000`.
- No `cancelSignal` watchdog.

---

## How to verify a healthy render

1. `GET {RENDER_WORKER_URL}/health` → `build.commit` matches the push you expect; `bundled: true`.
2. Start a render of a long 1080p reel from Reel Studio.
3. Worker logs must show:
   ```
   [worker] localize m0 <- https://…
   [worker] localize m0 -> http://127.0.0.1:8080/__media/job_…/m0.mp4
   [worker] clip 0: … src host: 127.0.0.1:8080 (localized)
   [worker] renderMedia opts: concurrency=1 scale=… offthreadCache=67108864 …
   [worker] 10%
   [worker] 20%
   …
   [worker] done → https://…
   ```
4. If the proxy line still shows a **supabase** host, the localize rewrite did not take — do not chase memory.
5. If clip host is `127.0.0.1` with `(localized)` and it still SIGKILLs, lower `offthreadVideoCacheSizeInBytes` further or force quality `720`. Do **not** go back to absolute paths.

---

## What NOT to do next time

- Do **not** put bare absolute OS paths in `OffthreadVideo` / `Img` / `Audio` `src`. Remotion will ignore them.
- Do **not** re-add a `cancelSignal` stall watchdog on this Remotion version.
- Do **not** tell the user to "just upgrade RAM" as the first move — the box was already 8 GB; the default cache was the problem.
- Do **not** mount `express.static` per job (leaks middleware forever). Use the `mediaDirs` Map + one `/__media/:jobId/:file` route.
- Do **not** trust a failure log without checking `/health.build.commit` first — several "the fix didn't work" reports this session were renders against a pre-fix build.

---

## Related docs

- `docs/RENDER_LOCALHOST3000_FINDING.md` — why `localhost:3000` is Remotion's internal server
- `docs/RAILWAY_WORKER_DEPLOY_STATE.md` — Vercel app / Railway worker topology
- `docs/RENDER_WORKER_RAILWAY_SETUP.md` — how the worker is deployed
- `docs/REEL_RENDER_ENGINE_PORT.md` — broader render engine port notes
- Remotion: https://www.remotion.dev/docs/troubleshooting/sigkill
- Remotion: https://www.remotion.dev/docs/miscellaneous/absolute-paths

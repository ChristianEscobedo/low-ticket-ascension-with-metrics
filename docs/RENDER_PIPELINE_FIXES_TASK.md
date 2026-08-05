# Render pipeline fixes — evidence from the code, not guesses

Follow-on to `docs/RESTORE_MISSING_FEATURES_TASK.md`. The restore/merge is done
(`e1f00af`). This is the render half. Everything below was read out of the
files named; nothing here is speculation unless it says "unverified".

---

## 1. Light-theme regression — FIXED

**Root cause:** `src/app/layout.tsx` treated "chromeless" as a synonym for
"light". `CHROMELESS_PREFIXES` includes `/admin` and `/share`, and the body was
`bg-bone` (cream) for every chromeless route. So the entire admin app — including
the full-bleed `/admin/reel-studio` — was painted on a cream canvas. The
`(fullscreen)` layout's `bg-ink h-screen` section hides it most of the time,
which is why it reads as an intermittent flash rather than a solid light page:
it shows on overscroll, on short/error pages, and on the pre-hydration paint.

**Fix applied:** added `DARK_PREFIXES = ['/admin', '/share']`; the body is now
`bg-ink` for those, `bg-bone` for the rest of the chromeless brand routes,
`bg-black` otherwise.

**Still worth checking on a live page** (needs a browser, not a file read): if
any *layout* (not just color) is still off inside reel-studio, it's a separate
bug from the canvas color and should be diagnosed against the running app.

---

## 2. Captions: no animation, wrong platform sizing

### The task doc's hypothesis is probably WRONG

The hypothesis was "`plan.words` is empty". Evidence against: `RenderPanel`
already surfaces the word count in its own status line —
`` setStatus(`Queued · ${json.clips} clips · ${json.words} words · ~${json.durationSec}s`) ``
(`RenderPanel.tsx:142`). If `words` were empty the user would be staring at
"0 words" on every render. **Verify that number first** — it's a 5-second check
that either kills or confirms the hypothesis before anyone touches `plan.ts`.

### The likelier cause: CSS animations do not work in Remotion renders

This explains the exact reported symptom — *animations play in the editor
preview but are absent in the MP4*:

- The **preview** uses `@remotion/player` (`RemotionPreview.tsx`), a real
  browser playing in real time. CSS keyframes/transitions run normally there.
- The **render** is `renderMedia()` in `render-worker/server.js`, which
  screenshots discrete frames from a paused page. CSS animation time does not
  advance per frame, so every frame captures the same animation state — i.e.
  no animation, exactly as reported.

**The fix:** drive caption animation from `useCurrentFrame()` +
`interpolate`/`spring`, keyed off each word's `fromFrame`/`toFrame` (both are
already in the plan — see `RenderWord` in
`render-worker/remotion-project/constants.ts`), and delete any CSS
`animation:`/`transition:` used for caption motion. Frame-driven motion is
identical in Player and in the render, which also restores preview===render.

**Read before editing:** `render-worker/remotion-project/CaptionLayer.tsx` and
`ReelComposition.tsx` (not yet read — ran out of context).

### Two more things to check while in there

- **Fonts.** `server.js` bundles and renders with no font loading anywhere.
  Headless Chromium has no Anton/Archivo Black/etc., so caption faces silently
  fall back to a default sans — captions render, but wrong. Fix with
  `@remotion/google-fonts`, or a `<link>` plus `delayRender()` /
  `document.fonts.ready` so the render waits for the font.
- **Platform sizing.** Confirm how caption `fontSize` is derived. If it scales
  off `plan.width` against a 390px vertical-preview reference, then 16:9
  (1920 wide) captions come out ~1.8× too large relative to the frame. Scale
  off a dimension that's stable across aspects (frame height, or
  `min(width, height)`), and add a case to `tests/lib/render-plan.test.ts` for
  all three entries in `RENDER_SIZES`.

---

## 3. The render button is broken, not just complicated

`RenderPanel.tsx` still speaks the **Remotion Lambda** two-call protocol:

1. `POST { id, aspect }` → expects `{ renderId, bucketName }`
2. `POST { renderId, bucketName }` → polls until `{ done, videoUrl }`

But the render path was replaced with the Railway worker
(`render-worker/server.js`), whose `/render` is **synchronous** and returns
`{ success, url, renderId }` — **no `bucketName`, no progress endpoint**. So the
poll fires with `bucketName: undefined` and the second call can't be resolved as
a progress request. The bar sits there or errors out.

Also: `GET /api/admin/reel-render` reports availability via
`isRemotionConfigured()` (`src/utils/integrations/remotion-render.ts:53`), which
only checks the five `REMOTION_*` **Lambda** env vars. With the worker deployed
and Lambda unset, the panel says **"Not configured"** and disables the button
even though rendering works.

**Simplification (this is the "simpler button"):**
- One `POST`, use `json.url` directly; delete the polling machinery, `POLL_MS`,
  the timer ref, and `bucketName` entirely.
- Probe availability against the worker (`RENDER_WORKER_URL` / the worker's
  `/health`), not the Lambda env vars.
- Drop the panel's own 9:16 / 1:1 / 16:9 chips and take `aspect` as a prop from
  the studio stage, which `page.tsx` already computes and already passes to
  `RemotionPreview`. Two independent aspect controls is how preview and export
  drift apart — one control, one source of truth.
- **Watch the timeout:** a synchronous worker render behind a Vercel function
  will exceed the function limit on any real-length reel. If that's happening,
  the worker needs a job id + status endpoint (real async), and the panel goes
  back to polling — but against the *worker's* contract, not Lambda's.

**Unverified:** `src/app/api/admin/reel-render/route.ts` and
`render-worker/remotion-project/Root.tsx` were not read. Confirm the registered
composition `id` in `Root.tsx` matches the `selectComposition({ id: ... })` in
`server.js:64` — `server.js` asks for `'ReelComposition'` while the Lambda
constant `REEL_COMPOSITION_ID` is `'Reel'`. If `Root.tsx` registers `Reel`, every
worker render fails outright with "No composition with the ID".

---

## Safety net

`git reset --hard backup/pre-restore-main` restores the pre-restore state.
Current good commit: `e1f00af`.

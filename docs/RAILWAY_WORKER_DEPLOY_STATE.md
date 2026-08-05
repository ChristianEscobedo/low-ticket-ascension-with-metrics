# Railway / Vercel topology — verified 2026-08-05

Read this before touching deploys. A prior session (mine) got this wrong twice.

## The actual topology

- **Next.js app → Vercel.** Not Railway. Do not look for it on Railway.
- **Render worker → Railway**, deployed from GitHub with **root directory = `render-worker`**.
  - Service name is `low-ticket-ascension-with-metrics`, which is **misleading**. It is the
    worker, not the app. Verified: `/health` returns
    `{"ok":true,"bundled":true,"build":{"commit":"8720531","branch":"main"}}` and logs show
    `[worker] bundling /app/remotion-project/index.ts` / `[worker] listening on :8080`.
  - Because it is GitHub-linked, **it auto-redeploys on push to `main`.** That is the
    intended deploy mechanism. Do not `railway up` local folders.

## Mistakes made this session (corrected)

1. **Created a redundant second Railway service** (`render-worker`,
   `render-worker-production-5c29.up.railway.app`) via CLI upload. It works, but reports
   `commit: "unknown"` — no GitHub link, no auto-deploy, guaranteed to drift from the repo.
   **This service should be deleted.** Nothing points at it anymore.
2. **Misdiagnosed `RENDER_WORKER_URL`.** Claimed it pointed "at the app itself." False — it
   pointed at the real worker. The only genuine defect was a **missing `https://` scheme**,
   which throws `TypeError: Failed to parse URL`. That fix is kept.
3. **Set the env var on the wrong platform.** `RENDER_WORKER_URL` was set on the Railway
   worker service, where it does nothing. **The app runs on Vercel, so the var must be set
   in Vercel's environment** — still unverified there, needs a human to confirm.

## Correct value

```
RENDER_WORKER_URL=https://low-ticket-ascension-with-metrics-production.up.railway.app
```

## Deploy staleness — RESOLVED

**Pushed and confirmed deployed.** `git push origin main` moved `8720531..c5f83c7`, Railway
auto-rebuilt, and `/health` was polled until it reported `commit: c5f83c7, bundled: true`
(~80s). The push was *not* blocked — no secret-scanning rejection, and `.env.local` is
covered by `.gitignore:42` (`.env*.local`), so nothing sensitive went up.

The worker had been at `8720531`, two commits behind:


- `d876bc7` fix(render): stop captions freezing on the last word for the rest of the reel
- `4c17111` fix(reel-studio): restore caption drag on the Remotion preview

Diff touches exactly `render-worker/remotion-project/CaptionLayer.tsx` (+28/−3) and
`render-worker/src/lib/mothermode/reel/render/plan.ts` (+11).

`PUSH_BLOCKED_SECRET_CLEANUP_HANDOFF.md` and `RENDER_WORKER_DEPLOY_BLOCKED_SECRETS.md` are
**stale as of this date** — the push went through with no secret-scanning rejection. Treat
their "push is blocked" framing as historical, not current.

## Still unproven

No one has yet opened a rendered MP4 and confirmed caption word gaps and font are correct.
`tests/lib/caption-vendor-parity.test.ts` proves the app copy and the vendored copy **agree
with each other** — it does not prove the agreed-upon CSS is right. Until an MP4 is
inspected, every claim about the render path is reasoning, not evidence.

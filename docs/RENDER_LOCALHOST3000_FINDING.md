# Finding: "Visited http://localhost:3000/index.html but got no response"

Observed 2026-08-05 by clicking Render in Reel Studio on the **Vercel** app, after the
worker was successfully redeployed to `c5f83c7`.

## This is not an app or env misconfiguration

Three misreadings to kill immediately, because each one costs a session:

1. **It is not `RENDER_WORKER_URL`.** That var is correct and reachable; `/health` returns
   `commit: c5f83c7, bundled: true`. A bad worker URL produces `Failed to parse URL` or a
   fetch error, never this message.
2. **It is not the dead Lambda path.** `REMOTION_SERVE_URL` is unset, and nothing under
   `src/` calls `renderMediaOnLambda` — `remotion-render.ts` is dead code. The only client
   of `/api/admin/reel-render` is `useRenderJob.ts`, which uses the worker.
3. **It is not your local dev server.** `localhost` here resolves *inside the Railway
   container*, not on the developer machine.

## Actual mechanism

`render-worker/server.js`:

```js
bundled = await bundle(entry);          // returns a local DIRECTORY PATH
const serveUrl = await getBundle();
await getCompositions(serveUrl, ...);   // Remotion starts its OWN static server
```

When `serveUrl` is a local path rather than an `https://` URL, Remotion boots an internal
static file server and navigates headless Chrome to `<server>/index.html`. **Remotion's
default port for that server is 3000.** The error is Chrome failing to reach that internal
server. The app merely relays the worker's error string into the UI, which is what made it
look like an app-side problem.

Note `PORT` is set to `8080` for Express in this container. Any interaction between the
platform-provided `PORT` and the port Remotion picks for its internal server is the prime
suspect and should be checked first.

## Next step — get evidence before changing code

The failing job's stack is in the worker's runtime logs. Read them for the render attempt,
not the build:

```
railway logs --service low-ticket-ascension-with-metrics
```

Then the likely fix is to stop leaving the port implicit — pass an explicit free `port` to
`getCompositions`, `selectComposition`, and `renderMedia` in `server.js`.

## Status: UNFIXED

Mechanism identified by reading code; **not** confirmed against a log line, and no fix
applied. Do not claim the render path works until an MP4 exists. Caption gap/font
correctness remains unverified for the same reason.

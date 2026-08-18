# Task: Outstand publishing — post to every platform from the app

**Status:** designed, ready to build. **Build it fresh off this brief.**

## The goal

Integrate **Outstand** (a unified social-media publishing API) so a post can be
published — or scheduled — to the connected social accounts **from inside the
app**, instead of exporting + posting by hand. It lands in two places: the
**Integrations** page (the API key) and **wherever publishing is available**
(the planner's publish flow, and the System Map's content-node peek).

> Note: the service is **Outstand** (`outstand.so`) — the ask said "outrank,"
> but the docs URL is outstand.so. One service.

## The Outstand API (from the docs)

- **Auth:** `Authorization: Bearer <API_KEY>` — the key comes from the Outstand
  dashboard.
- **Publish:** `POST https://api.outstand.so/v1/posts/`
  ```json
  {
    "containers": [{ "content": "The post text", "media": [{ "url": "…", "filename": "…" }] }],
    "accounts": ["x", "linkedin"],
    "scheduledAt": "2026-04-01T09:00:00Z"
  }
  ```
  - `containers[0].content` — the post text. Extra containers publish as replies.
  - `containers[].media[]` — `{ url, filename }` from a prior media upload.
  - `accounts` — an account id, a network name (`"x"`, `"linkedin"`), or a username.
  - `scheduledAt` — ISO 8601; omit (or a past time) for immediate. Up to 30 days out.
- **Response:** `{ success: true, post: { id, publishedAt, scheduledAt, socialAccounts, containers } }`.
- **Platforms:** X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube,
  Pinterest, Google Business Profile, Vimeo, Bluesky.
- (Likely also a `GET /v1/accounts` to list the connected accounts — confirm
  against the docs when building the account picker.)

## The design

**1. The integration (the key).** A new `src/utils/integrations/outstand.ts`:
`outstandPublish({ apiKey, content, mediaUrls, accounts, scheduledAt })` → POSTs
to `/v1/posts/`, returns the post. The API key is stored like the other
integrations (the Integrations page gets an **Outstand** card — paste the key).
Follow the existing integration pattern (`src/utils/integrations/`).

**2. The publish route.** A new `POST /api/admin/outstand-publish`:
`{ pieceId, accounts?, scheduledAt? }` → loads the piece's content + media,
maps the piece's platform to the Outstand account/network, calls
`outstandPublish`, and on success marks the piece published (the planner's
`patchPlan` publishState) with the Outstand post id as the `publishRef`. Admin-gated.

**3. Wherever publishing is available.**
- **The planner's publish flow** — a "Publish with Outstand" option alongside
  the existing publish (the SchedulePanel / the piece's publish control).
- **The System Map's content-node peek** — a "Publish" action on an unpublished
  post (the `ContentActions` in `NodePeekPanel.tsx`) that calls the route, then
  refetches. Detects when it's already published (the piece's publishState).

## The sequencing (each ships value on its own)

1. **The integration + the key** — `outstand.ts` + the Integrations card. Testable
   on its own (a "test the key" call).
2. **The publish route** — `/api/admin/outstand-publish` (piece → Outstand → mark
   published). Testable with a known piece.
3. **The planner + the peek** — the "Publish with Outstand" action in both
   publishing surfaces, with the already-published detection.

## The honest edges

- **Media:** Outstand wants a media *url* from a prior upload — the piece's
  rendered image/video needs to be a public URL Outstand can fetch. If the
  piece's media isn't publicly reachable, the first version publishes text-only
  and says so; the media-upload step is the follow-up.
- **The account mapping:** the piece's platform → the Outstand account. Start
  with the network name (the piece's platform maps to `"instagram"`, `"x"`,
  etc.); the account picker (choosing *which* Instagram account) is the
  follow-up if there are several.
- **The gated pattern:** publishing to a real platform is a real action — the
  first version publishes on an explicit click (never silently), and the
  response (the Outstand post id + the url) shows on the piece.

## The files

- `src/utils/integrations/outstand.ts` — the publish call.
- The Integrations page — the Outstand card (the API key).
- `src/app/api/admin/outstand-publish/route.ts` — the publish route.
- The planner's publish control + `NodePeekPanel.tsx`'s `ContentActions` — the
  "Publish with Outstand" action + the detection.
- `.env.example` — `OUTSTAND_API_KEY` (if it's env-backed) or the Integrations
  store (if it's DB-backed like the others).

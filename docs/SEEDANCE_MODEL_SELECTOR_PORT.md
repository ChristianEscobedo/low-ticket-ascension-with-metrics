# Seedance Model Selector — System Port

**Status:** Shipped
**Scope:** Additive enhancement to the Reel Director (Seedance) render pipeline.
**Builds on:** `docs/SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md`

## Summary

The Reel Director pipeline previously rendered every clip with a single,
env-pinned Seedance model (`MUAPI_SEEDANCE_MODEL`, defaulting to
`seedance-1.0`). This update adds a **per-render model override** so an admin
can pick the Seedance model from the panel at render time — without touching
env or redeploying. The default selection is
`seedance-2-vip-omni-reference-1080p`, with an explicit "Server default" option
that falls back to the env-configured model.

The change is fully additive and default-safe: the `model` field is optional at
every layer, and an empty/absent value preserves the prior behavior (env model
→ `seedance-1.0`).

## Data flow

```
ReelDirectorPanel (model state + <select>)
  → seedanceClient.renderSeedanceClip({ ...input, model })
    → POST /api/mothermode/content/seedance  (body.model)
      → muapi-seedance.submitSeedanceRender({ ...input, model })
        → MUAPI POST {base}/api/v1/{model || MUAPI_SEEDANCE_MODEL || 'seedance-1.0'}
```

## MUAPI contract correction (404 fix)

The first live test returned `MUAPI submit failed (404)`. The integration had
been written against an OpenAI-style single endpoint
(`POST /v1/video/generations` with the model in the body) — but MUAPI
(muapi.ai) uses a **model-slug-in-path** contract. The 404 propagated through
our route, which surfaced as a 404 on `POST /api/mothermode/content/seedance`
in the browser. Corrected in `src/utils/integrations/muapi-seedance.ts`:

| Concern | Before (404) | After (MUAPI native) |
| --- | --- | --- |
| Submit | `POST {base}/v1/video/generations`, model in body | `POST {base}/api/v1/{model}`, model is the path segment |
| Poll | `GET {base}/v1/video/generations/{id}` | `GET {base}/api/v1/predictions/{id}/result` |
| Task id | `task_id` / `id` | adds `request_id` (MUAPI's field) |
| Output | `outputs[0].url` (object) | also reads string `outputs[]` / `data.outputs[]` |

Auth still sends both `x-api-key` and `Bearer` headers. The model selector is
unaffected in behavior — the chosen slug simply becomes the URL path segment
instead of a body field. If a slug is wrong, MUAPI's own error message is now
surfaced verbatim (instead of a bare 404), which makes catalog mismatches
easy to diagnose. `MUAPI_BASE_URL` still overrides the host for staging.


## Layer-by-layer changes

### 1. Integration — `src/utils/integrations/muapi-seedance.ts`
- Added optional `model?: string` to `SeedanceRenderInput`, documented as a
  per-render override that falls back to `MUAPI_SEEDANCE_MODEL` / the built-in
  default when empty.
- The chosen slug — `input.model?.trim() || model()`, where `model()` reads
  `MUAPI_SEEDANCE_MODEL` (default `seedance-1.0`) — becomes the submit URL's
  path segment (`/api/v1/{slug}`), per the MUAPI contract correction above. An
  explicit choice wins; an empty string falls through to the env/default.
- Polling, re-hosting, and timeout behavior are otherwise unchanged (only the
  poll URL was corrected to `/api/v1/predictions/{id}/result`).


### 2. Route — `src/app/api/mothermode/content/seedance/route.ts`
- The POST handler reads `body.model`, trims it, and passes
  `model: <trimmed> | undefined` into `SeedanceRenderInput` for both the
  blocking (`wait: true`) and non-blocking submit paths.
- Admin gating, "not configured" handling, and clip re-hosting are unchanged.

### 3. Browser client — `src/components/mothermode/content/seedanceClient.ts`
- Added optional `model?: string` to `SeedanceSubmitInput`. It flows to the
  route automatically via the existing `post({ ...input })` body spread — no
  other client changes required.

### 4. UI — `src/components/mothermode/content/ReelDirectorPanel.tsx`
- New `SEEDANCE_MODELS` constant listing selectable models:
  - `seedance-2-vip-omni-reference-1080p` — "Seedance 2 · VIP Omni Reference · 1080p" (default)
  - `seedance-1.0` — "Seedance 1.0"
  - `''` — "Server default" (uses `MUAPI_SEEDANCE_MODEL`)
- New `model` state, initialized to `SEEDANCE_MODELS[0].id`.
- New "Model" `<select>` in the global render-controls row (alongside Audio
  wrapper / Aspect ratio / Duration).
- `handleRender` passes `model: model || undefined` into
  `renderSeedanceClip(...)`, so the "Server default" empty value cleanly omits
  the field.

## Configuration

No new env vars. The existing `MUAPI_SEEDANCE_MODEL` continues to define the
server default and is the value used when the "Server default" option is
chosen (or when the field is omitted). To offer additional models in the
dropdown, extend `SEEDANCE_MODELS` in `ReelDirectorPanel.tsx` with the model
slugs from the MUAPI catalog.

## Backward compatibility

- All new fields are optional; existing callers that omit `model` behave
  exactly as before.
- Existing storyboard packs, reviews, and persisted board video fields are
  unaffected.

## Verification

- `tsc --noEmit` — clean (exit 0).
- `vitest run` for `reel-director`, `film-bible`, `brand-bible` — 26/26 passing.
- The pure libs carry no model logic (model is an infrastructure/transport
  concern), so no test changes were required.

## Files touched

- `src/utils/integrations/muapi-seedance.ts`
- `src/app/api/mothermode/content/seedance/route.ts`
- `src/components/mothermode/content/seedanceClient.ts`
- `src/components/mothermode/content/ReelDirectorPanel.tsx`

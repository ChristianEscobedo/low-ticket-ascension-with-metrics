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
- `SEEDANCE_MODELS` is a **curated shortlist** (best quality vs. cost) of the
  Seedance 2 image-to-video / omni-reference tiers rather than the full MUAPI
  catalog. The still is always the source of truth, so only image-driven tiers
  are offered (text-to-video, extend, watermark, training, and "spicy"
  reduced-moderation variants are intentionally excluded):

  | Slug | Label | Est. / clip | Note |
  | --- | --- | --- | --- |
  | `seedance-2-vip-omni-reference-1080p` | SD2 · VIP Omni Reference · 1080p | ≈ $3.38 | **Default** · omni-reference |
  | `seedance-2-vip-omni-reference-4k` | SD2 · VIP Omni Reference · 4K | ≈ $6.75 | Premium · omni-reference · 4K |
  | `seedance-2-omni-reference-no-video-fast` | SD2 · Omni Reference · Fast | ≈ $0.75 | Low cost · omni-reference |
  | `seedance-2.5-image-to-video` | SD2.5 · Image-to-Video · 4K | ≈ $0.60 | Best quality · 4K |
  | `seedance-2.1-image-to-video` | SD2.1 · Image-to-Video · 1080p | ≈ $0.40 | Great value |
  | `seedance-2-mini-image-to-video` | SD2 Mini · Image-to-Video · 720p | ≈ $0.20 | Fastest · cheapest |
  | `''` | Server default | ≈ $3.38 | uses `MUAPI_SEEDANCE_MODEL` |

  The VIP Omni Reference 1080p tier stays the default (per request) because it
  carries the storyboard still **plus** reference stills for character/prop
  consistency across a multi-board reel.
- `model` state is initialized to `SEEDANCE_MODELS[0].id`.
- `handleRender` passes `model: model || undefined` into `renderSeedanceClip(...)`,
  so the "Server default" empty value cleanly omits the field.

## Pricing correction — flat per-clip, not per-second

The initial selector estimated cost as `perSecondUsd × durationSec`, which was
wrong: **MUAPI bills a flat amount per generation (per clip)**, independent of
clip length. The model now carries a single `estUsd` (flat per-clip estimate)
and `estCost(modelId)` returns `≈ $<estUsd>` with no duration multiplier. The
standing cost line and the per-board "Render clip · ≈ $x.xx" button both read
the flat figure, and the copy now says "per clip (flat estimate — MUAPI bills
the actual amount)." These figures mirror MUAPI's published discounted per-clip
prices and are UI-only hints; MUAPI always bills the real charge.

## Dropdown overflow fix

The Model `<select>` labels are long enough that the closed control overflowed
its flex column and clipped ("…om"). Fixes in the panel:
- Labels shortened to a compact `SD2 · … · <res>` form.
- The `<label>` wrapper is `min-w-0` (so it can shrink inside the flex row).
- The `<select>` is `w-full max-w-[16rem] truncate` (fixed max width; the closed
  value truncates with an ellipsis instead of pushing the layout wider).
- A native `title` on the select shows the full selected label + note on hover.

## Configuration

No new env vars. The existing `MUAPI_SEEDANCE_MODEL` continues to define the
server default and is the value used when the "Server default" option is
chosen (or when the field is omitted). To offer additional models in the
dropdown, extend `SEEDANCE_MODELS` in `ReelDirectorPanel.tsx` with the model
slugs from the MUAPI catalog (and give each a rough `estUsd`).

## Backward compatibility

- All new fields are optional; existing callers that omit `model` behave
  exactly as before.
- Existing storyboard packs, reviews, and persisted board video fields are
  unaffected.

## Verification

- `tsc --noEmit` — clean (exit 0).
- `vitest run` for `reel-director`, `film-bible`, `brand-bible` — passing. The
  pure libs carry no model/pricing logic (both are UI/transport concerns), so no
  test changes were required.

## Files touched

- `src/components/mothermode/content/ReelDirectorPanel.tsx` (curated model list,
  flat `estUsd` pricing, overflow-safe Model select)

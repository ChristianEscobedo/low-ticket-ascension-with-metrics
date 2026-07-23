# Seedance Render UX — System Port

**Status:** as-built · commit `ad55d33`
**Scope:** the last three Reel Director updates, shipped together:

1. Default to the **cheapest omni-reference model**.
2. **Longer render timeouts** (server + client) with a friendlier give-up message.
3. Clear **time / cost / progress feedback** in the Reel Director panel.

This doc covers only these deltas. The base pipeline is documented in
`SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md`; model selection in
`SEEDANCE_MODEL_SELECTOR_PORT.md`; omni-reference stills in the pipeline port
doc. Everything here is additive UI + config; no schema or data-model change.

---

## 1. Cheapest omni-reference model as the default

**Where:** `src/utils/integrations/muapi-seedance.ts` → `model()`, and
`.env.example` → `MUAPI_SEEDANCE_MODEL`.

- Server default moved from `seedance-1.0` to
  `seedance-2-vip-omni-reference-1080p`. This is the lowest-cost Seedance tier
  **and** is omni-reference capable, so it is the recommended default for both
  reasons — no reason to run the pricier legacy model by default.
- Still fully overridable: `MUAPI_SEEDANCE_MODEL` wins when set, and the panel's
  per-render model picker can override per clip. An empty model falls back to
  this server default.
- The model id is only ever used as a path segment / body field, so a model bump
  is an env change, not a code change.

```ts
function model(): string {
  // Cheapest Seedance tier and omni-reference capable — the recommended default.
  return process.env.MUAPI_SEEDANCE_MODEL || 'seedance-2-vip-omni-reference-1080p';
}
```

---

## 2. Longer render timeouts

Seedance renders routinely run several minutes, so both the server blocking path
and the browser poll loop now wait generously rather than failing a good render.

**Server** — `muapi-seedance.ts`:
- `MUAPI_POLL_TIMEOUT_MS` default raised `180000` (3 min) → `600000` (10 min).
- `MUAPI_POLL_INTERVAL_MS` unchanged (`3000`).

**Client** — `src/components/mothermode/content/seedanceClient.ts`
`renderSeedanceClip(input, opts)`:
- `intervalMs` default `6000`, `maxWaitMs` default `12 * 60 * 1000` (12 min) —
  intentionally past the server's typical finish so the UI is the patient outer
  bound.
- On timeout the thrown message is explicit that **credits were still spent** and
  what to do next, and includes the task id for MUAPI lookup:

  > `Still rendering after 12 minutes — Seedance is taking longer than usual.
  > Your credits were still spent on this task; leave the tab open and try
  > Re-render, or check MUAPI for task <taskId>.`

`.env.example` documents both the new defaults and the reasoning inline.

---

## 3. Time / cost / progress feedback (Reel Director panel)

**Where:** `src/components/mothermode/content/ReelDirectorPanel.tsx`.

Because rendering is slow and spends credits, the panel is explicit about both
up front and live.

### Cost model (UI-only estimate)
A small `modelMeta` table maps each model id to an editable `perSecondUsd`
estimate — **preview only**; MUAPI bills the real amount.

| model id | label | perSecondUsd | note |
| --- | --- | --- | --- |
| `seedance-2-vip-omni-reference-1080p` | Seedance 2 · VIP Omni Reference · 1080p | `0.03` | Recommended · lowest cost · omni-reference |
| `seedance-1.0` | Seedance 1.0 | `0.06` | Legacy |
| `''` (server default) | Server default | `0.03` | — |

- `estCost(modelId, durationSec)` → `perSecondUsd * durationSec`, formatted
  `≈ $X.XX`. Update `perSecondUsd` if MUAPI pricing changes.

### Live progress
- `startedAt` state records when each in-flight render began (keyed by board
  index); `liveStatus` tracks the last reported status per board.
- A 1-second interval runs **only while something is rendering** to drive the
  elapsed timers; `fmtElapsed(ms)` formats `m:ss`.

### Surfaced UI
- **Standing time + cost banner** (amber, `Clock` icon): "Each clip usually takes
  2–5 minutes (occasionally longer). Keep this tab open until it finishes. Every
  render spends MUAPI credits, so only render boards you intend to use."
- **Est. cost / clip** chip (emerald): `{model label} · {estCost} per {duration}s
  clip (estimate — MUAPI bills the actual amount).`
- **Recompose feedback**: a `recomposedCount` pill (`RefreshCw` icon) makes it
  obvious how many prompts were recomposed.
- **Per-board render button** reflects state:
  - rendering → `{liveLabel(status)} {m:ss elapsed}`
  - already has a clip → `Re-render clip`
  - otherwise → `Render clip · {estCost}`
  - plus an inline hint: "This can take a few minutes — keep the tab open."

---

## Porting checklist

- [ ] Set `MUAPI_SEEDANCE_MODEL` default (or leave unset to inherit
      `seedance-2-vip-omni-reference-1080p`).
- [ ] Confirm `MUAPI_POLL_TIMEOUT_MS` / `MUAPI_POLL_INTERVAL_MS` env defaults.
- [ ] Keep the client `maxWaitMs` ≥ the server timeout so the UI is the outer
      bound.
- [ ] Update `modelMeta.perSecondUsd` when MUAPI pricing changes (estimate only).
- [ ] No migration required — panel state (`startedAt`, `liveStatus`,
      `recomposedCount`) is ephemeral React state.

## Verification
- `tsc --noEmit` clean.
- `vitest` — reel-director, film-bible, brand-bible, muapi-seedance suites green
  (32 tests). The cost/elapsed helpers are pure and the render client contract is
  covered by the fetch-mocked seedance test.

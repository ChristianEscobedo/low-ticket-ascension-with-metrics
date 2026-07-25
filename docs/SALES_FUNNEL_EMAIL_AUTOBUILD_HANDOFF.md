# Sales Funnel → Email Kit Auto-Build — Handoff

## Goal
A sales funnel can bind one email kit per funnel event, but those kits had to be
hand-built first. This work makes the funnel able to *propose and generate* the
right sequence for every event automatically.

## Phase 1 — DONE (planning layer)

**`src/lib/mothermode/sales/emailPlan.ts`** (new, pure, no side effects)

| Export | Purpose |
| --- | --- |
| `SALES_EVENT_CAMPAIGN_MAP` | event → `EmailCampaignType` blueprint |
| `planSalesEmailKit(funnel, event)` | one `SalesEmailKitPlan` (name, slug, intake, contextRefs) |
| `buildSalesEmailPlan(funnel, { events, onlyMissing })` | plan many events |
| `boundSalesEmailEvents(funnel)` | `Set` of events that already have a kit |

Key decisions encoded (and covered by tests):
- `optin` → `leadmag-to-lowticket`, `checkout_start` → `cart-abandonment`.
- **A declined upsell is `nurture-to-offer`, not cart abandonment** — the buyer
  already paid once, so the declined product is re-presented with value first
  instead of nagged about.
- `purchase` / `success` / accepted upsells → `pre-post-purchase`;
  `access` → `community-onboarding`.
- `intake.audience` = funnel audience + funnel stage, because two people with the
  same demographic need different emails depending on whether they have paid.
- `intake.notes` carries product / price / promise / guarantee, and the specific
  upgrade for upsell events. **Blank fields are omitted**, never emitted as
  `Price: ` — an empty label invites the model to invent a number.
- `contextRefs` always include the offer; the lead magnet is attached only to the
  `optin` event, which is the only sequence that has to deliver it.
- `onlyMissing` exists so a bulk generate never clobbers hand-edited copy.
- Legacy `funnel.emailKitId` still counts as the `optin` binding.

**`tests/lib/sales-email-plan.test.ts`** — 20 tests, all passing.
Exported through `src/lib/mothermode/sales/index.ts`. `tsc --noEmit` clean.

```
npx vitest run tests/lib/sales-email-plan.test.ts
```

## Phase 2 — DONE (API action)
Two new files; `emailPlan.ts` stayed the only place mapping decisions live.

`src/lib/mothermode/sales/emailAutobuild.ts` — `autobuildSalesEmailKits(funnel, opts)`
is the effect layer. Per planned event it resolves the plan's context refs into
`ContextPack[]` (`aiGenerateSequence` takes packs, never refs), generates, upserts
the kit, and collects `{ event, ok, kitId, kitSlug, campaignType, emailCount, error }`.

Judgment calls, each pinned by a test in `tests/lib/sales-email-autobuild.test.ts`:
- **Failures are per event.** A rejected promise or `ok: false` becomes a failed
  result; the loop continues and the successful bindings are still saved. A bulk
  run of thirteen events must not lose twelve kits to one rate limit.
- **New kits are written `draft`.** Nobody has read the copy yet. But when
  regenerating over a kit that is already `active`, its status is preserved — an
  autobuild must never silently take a live sequence offline.
- **Existing rows are reused, not duplicated.** Look up by the funnel's bound
  `emailKitId` first, then by the planned slug (catches a kit whose binding was
  dropped), and reuse that row's id and slug so the unique slug does not collide.
- **The funnel is saved once**, after the loop, merging new bindings over the ones
  for events outside this run. `emailKitId` (the legacy single-kit column) is set
  from the `optin` kit only.
- Nothing is written at all when every event failed.

`src/app/api/mothermode/sales-email-kits/route.ts` — admin-guarded, `maxDuration = 300`.
`action: 'plan'` returns `buildSalesEmailPlan` output so the editor can show the
proposed campaign and kit name for free; `action: 'generate'` runs the autobuild and
returns `{ built, failed, results, item }`. `success` is true if anything was built,
so partial failure surfaces without discarding the work.

## Phase 3 — TODO (admin UI)
Call `POST /api/mothermode/sales-email-kits` with `action: 'plan'` on tab open
(free) and `action: 'generate'` with `{ funnelId, events?, onlyMissing? }` on click.
Render `results[]` per event; a `failed > 0` response still carries a saved `item`.

In `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` (Email tab): per-event
"Generate" button, a bulk "Generate missing sequences", the proposed campaign
type + kit name shown from the plan (free to render, no tokens spent), and a
link to the bound kit in `/admin/email-marketing`.

## Phase 4 — TODO
Update `docs/SALES_FUNNEL_SYSTEM_PORT.md`, then full `npx vitest run` +
`npx tsc --noEmit`.

## Notes
- Windows/PowerShell: no `tail`; use `| Select-Object -Last 25`.
- Do not touch the MotherMode catalog funnel.

---

## Phase 3 — Admin UI (COMPLETE)

### Files
- `src/components/mothermode/sales/EmailKitAutobuildPanel.tsx` (new, client component)
- `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` (mounts the panel, adds `adoptGeneratedKits`)

### Where it lives
Inside the existing **Email kits by funnel event** block, directly beneath the per-event
`<select>` grid — the plan/generate controls sit next to the bindings they mutate.

### Judgment calls
1. **No `funnelId` → no generate button.** An unsaved funnel renders an explanatory line
   instead, because the route reads the saved record to write copy and would 400.
2. **Plan auto-loads; generation never does.** `action: 'plan'` is free and pure, so the panel
   fetches it on mount and on funnel change to show campaign type + kit name per event.
   Tokens are only spent on an explicit click.
3. **Server-written bindings are adopted back into editor state.** The route saves the funnel
   itself, so the editor's `emailKitsMap` goes stale the instant generation succeeds.
   `adoptGeneratedKits` merges the returned ids and mirrors `optin` into the legacy
   `emailKitId`, so a later **Save** cannot post a stale map and unbind the kits that were
   just generated. Partial failures still adopt whatever landed.
4. **The bulk button is `onlyMissing: true`** and carries the missing count; it disables at 0.
   A full-funnel overwrite is therefore never one click away. Per-event buttons switch to
   **Regenerate** (with an overwrite title attribute) once a kit is bound.
5. **Result rows merge rather than replace**, so a single-event regenerate doesn't erase the
   result lines from the preceding bulk run.
6. **Response shapes are declared locally** instead of imported from `emailPlan` /
   `emailAutobuild`, keeping the planning, OpenAI, and store chains out of the client bundle.

### Verified
- `npx tsc --noEmit` — no errors in the panel or the editor.
- `npx vitest run tests/lib/sales-email-plan.test.ts tests/lib/sales-email-autobuild.test.ts`
  → **29 passed** (20 plan + 9 autobuild).

### Optional polish left
- Deep-link a generated kit into `/admin/email-marketing` (that page has no kit-selection
  `searchParams` yet, so the panel links to the list view).
- Fold these notes into `docs/SALES_FUNNEL_SYSTEM_PORT.md`.

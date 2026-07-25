# Sales Funnel → Email Kit Autobuild — System Port

Generates a complete, on-brand email kit for every event in a sales funnel (optin, purchase,
upsell declines, success, access, …) and binds each generated kit back onto the funnel's
`emailKits` array, so the funnel's automation wiring is filled in without hand-authoring
ten sequences per funnel.

Status: **complete** (Phases 1–3). 29 tests, `tsc --noEmit` clean.

---

## Files

| File | Role |
| --- | --- |
| `src/lib/mothermode/sales/emailPlan.ts` | Pure planning layer. Funnel record → per-event kit plans. No I/O. |
| `src/lib/mothermode/sales/emailAutobuild.ts` | Server orchestration. Plan → resolved context → OpenAI → `upsertKit` → funnel binding. |
| `src/app/api/mothermode/sales-email-kits/route.ts` | POST endpoint. `action: 'plan' \| 'generate'`. |
| `src/components/mothermode/sales/EmailKitAutobuildPanel.tsx` | Client panel (plan preview, bulk + per-event generate). |
| `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` | Mounts the panel, adopts server-written bindings. |
| `tests/lib/sales-email-plan.test.ts` | 20 tests — mapping + intake shaping. |
| `tests/lib/sales-email-autobuild.test.ts` | 9 tests — orchestration, isolation, binding merge. |

No migration required: the `emailKits` binding column already exists from
`supabase/migrations/20260902000000_sales_funnel_email_kits.sql`.

---

## Phase 1 — Planning layer (`emailPlan.ts`)

Pure functions, so every judgment call is unit-testable without OpenAI or Supabase.

```ts
SALES_EVENT_CAMPAIGN_MAP: Record<SalesEmailEvent, EmailCampaignType>
SALES_CAMPAIGN_FRAMEWORK_MAP: Record<EmailCampaignType, EmailFramework>

boundSalesEmailEvents(funnel): Set<SalesEmailEvent>
planSalesEmailKit(funnel, event): SalesEmailKitPlan
buildSalesEmailPlan(funnel, { events?, onlyMissing? }): SalesEmailKitPlan[]
salesEmailKitFramework(event): EmailFramework
```

`SalesEmailKitPlan` carries `event`, `eventLabel`, `campaignType`, kit `name` + `slug`,
a seeded `intake: EmailKitIntake`, `contextRefs: ContextRef[]`, and `alreadyBound`.

### Judgment calls (each has a test)
1. **A declined upsell maps to `nurture-to-offer`, not cart abandonment.** That buyer already
   paid once — treating them as an abandoner is the wrong emotional register and the wrong ask.
2. **`intake.audience` fuses funnel audience with funnel stage.** "Cold traffic" and "just
   bought the $27 offer" are different readers even inside the same funnel; the stage phrase
   (e.g. `just completed their first purchase`) is appended so the model writes to the actual
   moment.
3. **Blank facts are omitted, never sent empty.** A literal `Price: ` line invites the model to
   invent a number. Missing values drop out of the intake instead.
4. **The lead magnet is attached only to the `optin` event.** It's the only event where the
   magnet is the subject of the email rather than trivia.
5. **`onlyMissing` filters by existing bindings** so a bulk generate can't clobber hand-edited
   copy.

---

## Phase 2 — Server orchestration (`emailAutobuild.ts`)

```ts
autobuildSalesEmailKits(
  funnel: SalesFunnelRecord,
  options?: { events?: SalesEmailEvent[]; onlyMissing?: boolean; updatedBy?: string | null },
): Promise<AutobuildSalesEmailKitsOutput>
// → { results: SalesEmailKitBuildResult[], funnel, built, failed }
```

Per plan, in sequence:
1. `resolveContextRefs(plan.contextRefs)` → `ContextPack[]` — `aiGenerateSequence` wants
   **resolved packs**, not raw refs; this is the binding that most easily mis-compiles.
2. `aiGenerateSequence(intake, campaignType, framework, packs, …)` → emails.
3. `upsertKit(<UpsertKitInput>)` → persisted kit id/slug.
4. Merge the new `SalesEmailKitBinding` into the funnel's `emailKits` and save through
   `UpsertSalesFunnelInput`.

### Judgment calls
- **Failures are isolated per event.** One bad OpenAI call marks that single result
  `ok: false` with an `error`; kits that already succeeded stay saved and stay bound. A
  partial run is reported honestly via `built` / `failed` rather than thrown away.
- **Bindings merge, they don't replace.** The merge helper preserves bindings for events
  outside the current run, so generating one event can't unbind the other nine.
- **Sequential, not parallel.** Ordered token spend and clean per-event error attribution
  matter more here than wall-clock time.

### Route contract — `POST /api/mothermode/sales-email-kits`
- `{ action: 'plan', funnelId }` → `{ plans }`. Free and pure; safe to call on render.
- `{ action: 'generate', funnelId, events?, onlyMissing? }` → `{ built, failed, results, funnel }`.
  Spends tokens and writes.

---

## Phase 3 — Admin UI (`EmailKitAutobuildPanel`)

Lives inside the existing **Email kits by funnel event** block in `SalesFunnelEditor`,
directly under the per-event `<select>` grid — the controls sit next to the bindings they change.

### Judgment calls
1. **No saved `funnelId` → no generate button**, just an explanatory line. The route reads the
   saved record, so generating from an unsaved funnel would 400.
2. **Plan auto-loads; generation never does.** `action: 'plan'` is free, so it runs on mount and
   on funnel change to show campaign type + kit name per event. Tokens require an explicit click.
3. **Server-written bindings are adopted back into editor state** via `adoptGeneratedKits`,
   which merges returned ids and mirrors `optin` into the legacy `emailKitId` field. Without
   this, a later **Save** would post a stale `emailKitsMap` and unbind the kits that were just
   generated. Partial failures still adopt whatever landed.
4. **Bulk defaults to `onlyMissing: true`**, labelled with the live missing count and disabled
   at 0 — a full-funnel overwrite is never one click away. Per-event buttons become
   **Regenerate** (with an overwrite tooltip) once a kit is bound.
5. **Result rows merge rather than replace**, so a single regenerate doesn't erase the result
   lines from the preceding bulk run.
6. **Response shapes are declared locally** in the client file instead of imported from
   `emailPlan` / `emailAutobuild`, keeping the planning, OpenAI, and store chains out of the
   client bundle.

---

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/lib/sales-email-plan.test.ts tests/lib/sales-email-autobuild.test.ts
# 2 files, 29 tests passed (20 plan + 9 autobuild)
```

## Known gaps / optional polish
- The panel links to `/admin/email-marketing` (list view) rather than deep-linking a specific
  generated kit; that page has no kit-selection `searchParams` yet.
- Generation is sequential, so a ten-event funnel is a slow single request. If it ever exceeds
  the platform timeout, batch it per event from the client (the route already accepts `events`).
- No preview-before-write step: generated copy lands in the kit and is edited there.

# Email Sequence Analytics — System Port

Phase 4 of the Email Flow / Testing / Analytics build (see
`docs/EMAIL_FLOW_TESTING_AND_ANALYTICS_HANDOFF.md`). Phases 1–3 shipped the
read-only flow canvas, triggers + A/B, and the inbox-preview surface. This phase
adds the **analytics shape**: pure rate math + roll-ups, a storage table, a thin
canvas overlay, and a stubbed ingestion route — all designed to light up the
moment an ESP integration exists, with a clean empty state until then.

> **Design constraint (unchanged from the handoff):** the kit tool
> *generates/exports* copy; it does **not** send mail or ingest opens/clicks
> today. So analytics is **built now, populated later**. Nothing here assumes a
> live ESP; every surface degrades to a "Connect your ESP to see analytics"
> empty state when no rows exist.

---

## What shipped

### 1. Pure analytics module — `src/lib/mothermode/email/analytics.ts`

Zero server dependencies, fully unit-testable. Mirrors the handoff's proposed
shape and adds defensive normalizers so partial/ESP-shaped payloads coerce
cleanly.

Types:

```ts
export interface EmailStat {
  emailId: string;
  sent: number; delivered: number; opened: number;
  clicked: number; unsubscribed: number; bounced: number;
  revenue?: number;
}
export interface SequenceStats {
  kitId: string;
  byEmail: Record<string, EmailStat>;
  updatedAt: string | null;
}
```

Pure derivations (all **zero-safe** — division by 0 returns 0, never `NaN`/`Infinity`):

- `deliveryRate(stat)` = delivered / sent
- `openRate(stat)` = opened / delivered
- `ctr(stat)` = clicked / delivered  (click-through rate)
- `clickToOpenRate(stat)` = clicked / opened  (CTOR)
- `unsubscribeRate(stat)` = unsubscribed / delivered
- `bounceRate(stat)` = bounced / sent
- `conversionRate(stat)` = (revenue > 0 ? clicked-as-proxy) — modeled as
  `clicked / delivered` when no explicit conversion counter exists; documented as
  a proxy until an ESP supplies conversions.
- `revenuePerEmail(stat)` = revenue ?? 0

Roll-ups:

- `emptyStat(emailId)` — a zeroed `EmailStat` (used as a safe default).
- `normalizeStat(input)` — coerce any partial/unknown object into an `EmailStat`
  (non-negative integers; `revenue` optional float).
- `normalizeSequenceStats(input)` — coerce a stored/ESP payload into
  `SequenceStats` (defensive `byEmail`, ISO `updatedAt` or null).
- `sequenceTotals(stats)` — sum every counter across emails into one `EmailStat`
  (`emailId: '__total__'`) so the panel can show a sequence-level header.
- `hasAnyStats(stats)` — whether any email has `sent > 0` (drives the empty state).

A/B roll-up (composes with Phase 2's `abTest`):

- `abVariantStats(sequence, stats)` → for each `splitId`, the per-variant
  `EmailStat` plus the derived `openRate`/`ctr`, and the **winner** by a
  configurable metric (`open | click | ctor | revenue`, default `open`).
- `pickAbWinner(variants, metric)` — pure winner selection; ties resolve to the
  first variant in weight-desc, then label-asc order; all-zero → no winner
  (`null`).

### 2. Storage — `supabase/migrations/20260810000000_mothermode_email_stats.sql`

```sql
CREATE TABLE mothermode_email_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id       UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  email_id     TEXT NOT NULL,        -- EmailMessage.id inside the sequence JSON
  period       TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'YYYY-MM' bucket
  sent         INTEGER NOT NULL DEFAULT 0,
  delivered    INTEGER NOT NULL DEFAULT 0,
  opened       INTEGER NOT NULL DEFAULT 0,
  clicked      INTEGER NOT NULL DEFAULT 0,
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  bounced      INTEGER NOT NULL DEFAULT 0,
  revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kit_id, email_id, period)
);
```

RLS posture matches the other mothermode tables: **service role only**; all
reads/writes go through the admin API / ingestion route. The `UNIQUE
(kit_id, email_id, period)` key lets the ingestion webhook do idempotent
`upsert`s per email per period.

### 3. Barrel export — `src/lib/mothermode/email/index.ts`

Re-exports the analytics types + helpers so callers use the same
`@/lib/mothermode/email` entry point as the rest of the kit.

### 4. Canvas overlay — `EmailFlowPanel`

The panel accepts an optional `stats?: SequenceStats`. When present and
non-empty, each email node renders compact **open% / CTR** badges and a subtle
heat tint keyed off open rate; A/B split nodes flag the winning variant. When
`stats` is absent or empty, the panel shows a single unobtrusive
**"Connect your ESP to see analytics"** hint and renders exactly as before
(Phases 1–3 behavior is unchanged). All overlay reads go through the pure
derivations so there is no display math in the component.

### 5. Ingestion stub — `src/app/api/admin/mothermode-email/stats/route.ts`

- `GET ?kitId=…` → returns the stored `SequenceStats` for a kit (empty shape when
  no rows), normalized through `normalizeSequenceStats`.
- `POST` → **stub** upsert endpoint: accepts a `{ kitId, stats: EmailStat[] }`
  payload (or a provider-agnostic body), normalizes it, and upserts into
  `mothermode_email_stats`. This is the seam a real ESP webhook
  (SendGrid/Postmark/Resend/GHL) will normalize into; provider-specific mapping
  is intentionally out of scope until a provider is chosen.

---

## Backward-compatibility

- No changes to `EmailMessage` / `EmailSequence` shapes; analytics is a **side
  table** keyed by `(kit_id, email_id)`. Old kits render unchanged.
- `EmailFlowPanel`'s `stats` prop is optional; omitting it preserves current
  behavior. No editor save-path changes.
- All derivations are zero-safe and all normalizers tolerate missing/partial
  input, so an ESP that only reports a subset of counters still renders.

---

## Testing

`tests/lib/email-analytics.test.ts`:

- Rate math (open/ctr/ctor/delivery/unsub/bounce) with known inputs.
- Zero-safe division (0 sent / 0 delivered / 0 opened → 0, never NaN/Infinity).
- `normalizeStat` / `normalizeSequenceStats` coercion of partial + junk input.
- `sequenceTotals` summing and `hasAnyStats` gating.
- A/B `pickAbWinner` for each metric, plus tie-break and all-zero → null.

Verify:

```bash
npx tsc --noEmit
npx vitest run tests/lib/email-flow.test.ts tests/lib/email-kit.test.ts \
  tests/lib/email-preview.test.ts tests/lib/email-analytics.test.ts
```

---

## Deferred (external, out of scope until an ESP is chosen)

- Real webhook signature verification + provider payload mapping into
  `mothermode_email_stats` (the POST route is a normalized stub).
- Period bucketing UI (the table supports a `period` column; the panel shows the
  `'all'` roll-up today).
- Conversion counter: `conversionRate` uses clicks as a proxy until an ESP
  reports true conversions/revenue attribution.

# Email Flow Canvas + Analytics Dashboard + AI Insights — System Port

Status: **shipped & verified** — `vitest` email suites = **78 passing** across 5
files (`email-triggers` 10, `email-enrollment` 26, `email-analytics` 18,
`email-flow` 14, `email-preview` 10).

This is the **complete port doc** for the Email Marketing Kit's interactive
flow canvas, analytics dashboard, enrollment data layer, and AI insights. Use
it to port the full feature into another codebase that already has the base
Email Marketing Kit (sequence types, editor, triggers, export).

> **Design constraint:** the kit tool *generates/exports* copy; it does **not**
> send mail. Analytics + enrollments are **built now, populated later** by an
> ESP webhook. Every surface degrades to a clean empty state when no rows exist.

---

## 0. Where this sits (phase map)

| Phase | What | Status |
| --- | --- | --- |
| 1 | Read-only flow graph derivation (`flow.ts`) + canvas | shipped |
| 2 | Triggers + A/B split nodes on canvas | shipped |
| 3 | Inbox preview | shipped (separate port) |
| 4 | Aggregate stats (`analytics.ts`, `mothermode_email_stats`) | shipped |
| 5a | Enrollment data layer + flow overlay | shipped |
| 5b | Interactive Flow Dashboard (zoom/pan, heat map, live counters) | shipped |
| 5c | Analytics Dashboard (KPI, funnel, table, cohort, A/B) | shipped |
| 5d | AI Insights panel | shipped |
| 5e | **Merge** View flow + Dashboard → single **Flow** button with trigger programming | shipped |

Related prior ports (prerequisites — do not re-port if already present):

- `docs/EMAIL_MARKETING_KIT_SYSTEM_PORT.md` — base kit
- `docs/EMAIL_TRIGGER_AND_UI_UX_UPDATES_PORT.md` / `EMAIL_TRIGGER_FUNNEL_MAPPING_SYSTEM_PORT.md` — trigger model
- `docs/EMAIL_ANALYTICS_SYSTEM_PORT.md` — Phase 4 aggregate stats (subset of this)
- `docs/EMAIL_TESTING_INBOX_PREVIEW_SYSTEM_PORT.md` — inbox preview
- `docs/EMAIL_FLOW_DASHBOARD_MERGE_HANDOFF.md` — merge notes (now complete)

**Post-merge canvas UX (required final shape):**

- `docs/EMAIL_FLOW_CANVAS_UI_UX_SYSTEM_PORT.md` — compact trigger + inspectors,
  select-vs-jump interaction, subject-first cards. Apply this **after** (or
  instead of) any intermediate “inline expandable trigger / click-to-jump”
  behavior described below.


---

## 1. End-state UX (what the admin sees)

Toolbar on `/admin/email-marketing` (EmailKitEditor):

```
[Flow] [Analytics] [AI Insights] [Preview inbox] [Copy text] [Copy HTML]
```

| Button | Component | What it does |
| --- | --- | --- |
| **Flow** | `EmailFlowDashboard` | Interactive canvas: zoom/pan, heat map, live subscriber counters, drop-off badges, node detail popover, **editable enrollment trigger + waterfall mapping** |
| **Analytics** | `EmailAnalyticsDashboard` | KPI cards, funnel chart, per-email performance table, cohort matrix, A/B results |
| **AI Insights** | `EmailInsightsPanel` | AI-generated actionable recommendations with severity badges, apply/dismiss |
| Plus | inline mini-stats | Each email card shows open%, CTR, sent count when stats exist |

---

## 2. File inventory (copy these)

### 2.1 Pure data layer (browser-safe, unit-testable)

| File | Role |
| --- | --- |
| `src/lib/mothermode/email/flow.ts` | `sequenceToFlowGraph` + layered layout → `{ nodes, edges }` with x/y |
| `src/lib/mothermode/email/analytics.ts` | `EmailStat` / `SequenceStats`, rate math, A/B winner, normalizers |
| `src/lib/mothermode/email/enrollment.ts` | Enrollment/event types, funnel, dropoff, cohorts, journeys, normalizers |
| `src/lib/mothermode/email/flowOverlay.ts` | `computeFlowOverlay` — node/edge heat + volume overlays (pure) |
| `src/lib/mothermode/email/triggers.ts` | Trigger enum, labels, groups, funnel pages, `triggerConfig` resolvers *(prerequisite)* |
| `src/lib/mothermode/email/index.ts` | Barrel: re-exports `flow`, `analytics`, `enrollment`, `flowOverlay`, `triggers` |

### 2.2 Server-only stores (service-role Supabase)

| File | Role |
| --- | --- |
| `src/lib/mothermode/email/statsStore.ts` | `readSequenceStats`, `upsertSequenceStats` |
| `src/lib/mothermode/email/enrollmentStore.ts` | `readEnrollmentData`, `readSubscriberEvents`, `upsertEnrollments`, `insertEvents` |

**Do NOT** re-export stores from the browser barrel — they pull the service-role
client. Import them only from API routes.

### 2.3 Migrations

| File | Tables |
| --- | --- |
| `supabase/migrations/20260810000000_mothermode_email_stats.sql` | `mothermode_email_stats` |
| `supabase/migrations/20260820000000_mothermode_email_enrollments.sql` | `mothermode_email_enrollments`, `mothermode_email_events` |

### 2.4 API routes

| File | Methods |
| --- | --- |
| `src/app/api/admin/mothermode-email/stats/route.ts` | `GET ?kitId=` → stats + enrollment; `POST` upsert stats / enrollments / events |
| `src/app/api/admin/mothermode-email/insights/route.ts` | `GET ?kitId=` → stats + enrollment; `POST { kitId, sequence }` → AI insights |

Both use `requireAdminRoute()`.

### 2.5 AI

| File | Role |
| --- | --- |
| `src/utils/integrations/openai-email-insights.ts` | `aiGenerateInsights(sequence, stats, enrollment)`, `EmailInsight`, `EmailInsightsReport`, `emptyInsightsReport` |

Mirrors the provider plumbing in `openai-email.ts` (OpenAI / Anthropic via
runtime config).

### 2.6 UI components (client)

| File | Role |
| --- | --- |
| `src/components/mothermode/email/EmailFlowDashboard.tsx` | **Canonical Flow canvas** (zoom/pan, heat map, live counters, trigger programming) |
| `src/components/mothermode/email/EmailFlowPanel.tsx` | **Deprecated** thin re-export of `EmailFlowDashboard` (keep for back-compat) |
| `src/components/mothermode/email/EmailAnalyticsDashboard.tsx` | Analytics dashboard body (KPI / funnel / table / cohort / A/B) |
| `src/components/mothermode/email/EmailInsightsPanel.tsx` | AI insight cards (severity, apply, dismiss, refresh) |

### 2.7 Editor wiring

| File | Changes |
| --- | --- |
| `src/app/admin/email-marketing/EmailKitEditor.tsx` | Flow / Analytics / AI Insights buttons; fetch stats+enrollment; pass trigger props; inline mini-stats |

### 2.8 Tests

| File | Coverage |
| --- | --- |
| `tests/lib/email-flow.test.ts` | Graph derivation, layout, trigger/split nodes |
| `tests/lib/email-analytics.test.ts` | Rate math, normalizers, A/B winner |
| `tests/lib/email-enrollment.test.ts` | Funnel, dropoff, cohorts, journeys, normalizers |
| `tests/lib/email-triggers.test.ts` | Trigger enum, config, resolvers |
| `tests/lib/email-preview.test.ts` | Preview tokens (prerequisite) |

---

## 3. Schema

### 3.1 `mothermode_email_stats` (Phase 4)

```sql
CREATE TABLE mothermode_email_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id       UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  email_id     TEXT NOT NULL,        -- EmailMessage.id inside sequence JSON
  period       TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'YYYY-MM'
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
-- RLS: service role only
```

### 3.2 `mothermode_email_enrollments` + `mothermode_email_events` (Phase 5)

```sql
CREATE TABLE mothermode_email_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,          -- ESP contact id or hashed email (never raw PII)
  email_id      TEXT NOT NULL DEFAULT '', -- current EmailMessage.id ('' = not yet sent)
  status        TEXT NOT NULL DEFAULT 'enrolled',
  -- enrolled | sent | opened | clicked | completed | dropped | unsubscribed
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (kit_id, subscriber_id)
);
CREATE INDEX idx_enrollments_kit_status ON mothermode_email_enrollments (kit_id, status);
CREATE INDEX idx_enrollments_kit_email  ON mothermode_email_enrollments (kit_id, email_id);
CREATE INDEX idx_enrollments_enrolled_at ON mothermode_email_enrollments (enrolled_at);

CREATE TABLE mothermode_email_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        UUID NOT NULL REFERENCES mothermode_email_kits(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL,
  email_id      TEXT NOT NULL DEFAULT '',
  event_type    TEXT NOT NULL,
  -- enrolled | sent | delivered | opened | clicked | unsubscribed | bounced | purchased | dropped
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_events_kit_subscriber ON mothermode_email_events (kit_id, subscriber_id);
CREATE INDEX idx_events_kit_email      ON mothermode_email_events (kit_id, email_id);
CREATE INDEX idx_events_kit_type       ON mothermode_email_events (kit_id, event_type);
CREATE INDEX idx_events_occurred_at    ON mothermode_email_events (occurred_at);

ALTER TABLE mothermode_email_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothermode_email_events ENABLE ROW LEVEL SECURITY;
```

---

## 4. Pure modules (API surface)

### 4.1 `flow.ts` — structural graph

```ts
export type FlowNodeKind = 'trigger' | 'email' | 'split';
export type FlowEdgeKind = 'trunk' | 'branch' | 'trigger' | 'split';
export const FLOW_TRIGGER_ID = 'trigger';
export const FLOW_NODE_WIDTH = /* number */;
export const FLOW_NODE_HEIGHT = /* number */;

export interface FlowNode {
  id: string;
  emailId: string;
  label: string;
  role: EmailRole;
  subject: string;
  sendOffset: string;
  branch: EmailBranchCondition;
  hasImages: boolean;
  kind: FlowNodeKind;
  trigger?: EmailTriggerEvent;
  triggerCategory?: EmailTriggerCategory;
  triggerLocation?: string;
  triggerBinding?: string;
  weight?: number;           // split nodes
  abVariantCount?: number;   // email nodes with abTest
  x: number;
  y: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: FlowEdgeKind;
}

export interface FlowGraph { nodes: FlowNode[]; edges: FlowEdge[] }

export function sequenceToFlowGraph(sequence: EmailSequence | null | undefined): FlowGraph;
export function layoutFlowGraph(graph: FlowGraph): FlowGraph;
export function flowNodeLabel(email: Pick<EmailMessage, 'role' | 'subject'>): string;
```

**Derivation rule:**
- Trunk = emails with `branch === 'always'` in array order.
- Branch emails (`branch !== 'always'`) fork from `parentId` or the prior trunk email.
- One `trigger` node at the top (from `sequence.trigger` + `triggerConfig`).
- Enabled `abTest` with ≥2 variants → `split` child nodes.

No React Flow / dagre dependency — layout is pure layered positioning.

### 4.2 `analytics.ts` — aggregate rates

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

// Zero-safe rates (0/0 → 0, never NaN)
export function deliveryRate(stat): number;
export function openRate(stat): number;
export function ctr(stat): number;
export function clickToOpenRate(stat): number;
export function unsubscribeRate(stat): number;
export function bounceRate(stat): number;
export function conversionRate(stat): number; // click proxy until ESP supplies conversions
export function revenuePerEmail(stat): number;

export function emptyStat(emailId): EmailStat;
export function normalizeStat(input, fallbackId?): EmailStat;
export function normalizeSequenceStats(input): SequenceStats;
export function emptySequenceStats(kitId): SequenceStats;
export function sequenceTotals(stats): EmailStat;
export function hasAnyStats(stats): boolean;
export function statFor(stats, emailId): EmailStat;

// A/B
export type AbWinnerMetric = 'open' | 'click' | 'ctor' | 'revenue';
export function pickAbWinner(variants, metric): …;
export function abVariantStats(sequence, stats): …;
```

### 4.3 `enrollment.ts` — subscriber-level analytics

```ts
export type EnrollmentStatus =
  | 'enrolled' | 'sent' | 'opened' | 'clicked'
  | 'completed' | 'dropped' | 'unsubscribed';

export interface Enrollment {
  id: string;
  kitId: string;
  subscriberId: string;
  emailId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  lastEventAt: string;
  metadata: Record<string, unknown>;
}

export interface EmailEvent {
  id: string;
  kitId: string;
  subscriberId: string;
  emailId: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface EnrollmentData {
  kitId: string;
  enrollments: Enrollment[];
  // events are loaded on demand for journeys; list endpoint may omit them
}

export interface FunnelStep {
  stage: string;
  count: number;
  rate: number;            // step conversion from previous
  cumulativeRate: number;  // from top of funnel
}

export function enrollmentFunnel(stats): FunnelStep[];
export function activeSubscribers(data): number;
export function totalEnrolled(data): number;
export function countByStatus(data): Record<EnrollmentStatus, number>;

export interface EmailDropoff {
  emailId: string;
  sent: number;
  nextSent: number;
  dropoffRate: number; // [0,1]
}
export function dropoffByEmail(sequence, stats, enrollment?): EmailDropoff[];

export interface CohortBucket {
  label: string;       // e.g. "2026-W12" or "2026-03"
  enrolled: number;
  retention: number[]; // [0,1] per step
}
export function cohortBuckets(sequence, enrollment, period: 'week' | 'month'): CohortBucket[];

export interface JourneyTouchpoint {
  eventType: string;
  emailId: string;
  occurredAt: string;
  label: string;
}
export function journeyForSubscriber(events, sequence): JourneyTouchpoint[];

// Normalizers
export function toEnrollmentStatus(value): EnrollmentStatus;
export function normalizeEnrollment(input): Enrollment;
export function normalizeEvent(input): EmailEvent;
export function normalizeEnrollmentData(input): EnrollmentData;
export function emptyEnrollmentData(kitId): EnrollmentData;
export function hasEnrollments(data): boolean;
```

### 4.4 `flowOverlay.ts` — canvas enrichment

```ts
export type HeatTint = 'good' | 'ok' | 'bad' | 'neutral';
export const HEAT_TINT_THRESHOLDS = { good: 0.4, ok: 0.2 } as const;

export interface NodeOverlay {
  nodeId: string;
  activeCount: number;
  sentCount: number;
  openRate: number;
  ctr: number;
  dropoffRate: number;
  heatTint: HeatTint;
  hasData: boolean;
}

export interface EdgeOverlay {
  edgeId: string;
  volume: number;
  conversionRate: number;
  thickness: number; // [0,1] normalized
}

export interface FlowOverlay {
  nodes: Map<string, NodeOverlay>;
  edges: Map<string, EdgeOverlay>;
  hasData: boolean;
}

export function computeNodeOverlays(graph, stats, dropoff, enrollment): Map<string, NodeOverlay>;
export function computeEdgeOverlays(graph, nodeOverlays): Map<string, EdgeOverlay>;
export function computeFlowOverlay(graph, stats, dropoff, enrollment): FlowOverlay;
export function heatTintForOpenRate(openRate: number): HeatTint;
```

Empty inputs → empty/neutral overlays. Dashboard falls back to structural graph.

### 4.5 Barrel (`index.ts`)

```ts
export * from './types';
export * from './triggers';
export * from './frameworks';
export * from './campaigns';
export * from './export';
export * from './tokens';
export * from './flow';
export * from './preview';
export * from './analytics';
export * from './enrollment';
export * from './flowOverlay';
// NOT store.ts / statsStore.ts / enrollmentStore.ts
```

---

## 5. Server stores

### 5.1 `statsStore.ts`

```ts
export async function readSequenceStats(kitId: string, period = 'all'): Promise<SequenceStats>;
export async function upsertSequenceStats(
  kitId: string,
  stats: EmailStat[],
  period = 'all',
): Promise<number>; // rows written
```

Uses service-role Supabase. `UNIQUE (kit_id, email_id, period)` enables idempotent upserts.

### 5.2 `enrollmentStore.ts`

```ts
export async function readEnrollmentData(kitId: string): Promise<EnrollmentData>;
export async function readSubscriberEvents(kitId: string, subscriberId: string): Promise<EmailEvent[]>;
export async function upsertEnrollments(kitId: string, enrollments: Enrollment[]): Promise<number>;
export async function insertEvents(kitId: string, events: EmailEvent[]): Promise<number>;
```

---

## 6. API routes

### 6.1 `GET/POST /api/admin/mothermode-email/stats`

**GET `?kitId=&period=all`**
```json
{ "success": true, "stats": SequenceStats, "enrollment": EnrollmentData }
```

**POST** (one of three shapes):
```json
// Stats
{ "kitId": "…", "period": "all", "stats": [ EmailStat, … ] }

// Enrollments
{ "kitId": "…", "enrollments": [ Enrollment, … ] }

// Events (append-only)
{ "kitId": "…", "events": [ EmailEvent, … ] }
```

This is the ESP webhook seam. Provider-specific mapping is out of scope until a
provider is chosen — normalize into these shapes first.

### 6.2 `GET/POST /api/admin/mothermode-email/insights`

**GET `?kitId=`** → `{ success, stats, enrollment }`

**POST `{ kitId, sequence }`** → `{ success, report: EmailInsightsReport }`

Sequence is taken from the **request body** (current editor state), not the DB,
so insights reflect unsaved edits. Stats/enrollment are read server-side.

---

## 7. AI insights (`openai-email-insights.ts`)

```ts
export type InsightCategory =
  | 'dropoff-diagnosis' | 'subject-line' | 'pacing'
  | 'content-gap' | 'forecast' | 'recommendation';

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface EmailInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  emailId: string;       // '' for sequence-level
  emailLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: string;    // e.g. 'edit-subject' | 'add-email' | 'shorten-subject'
  estimatedImpact: string;
}

export interface EmailInsightsReport {
  generatedAt: string;
  totalInsights: number;
  bySeverity: Record<InsightSeverity, number>;
  insights: EmailInsight[];
  executiveSummary: string;
}

export function emptyInsightsReport(): EmailInsightsReport;
export async function aiGenerateInsights(
  sequence: EmailSequence,
  stats: SequenceStats | null,
  enrollment: EnrollmentData | null,
): Promise<AiResult<EmailInsightsReport>>;
```

Prompt includes sequence structure + analytics block (funnel, dropoff, rates).
Falls back to empty report when no AI key is configured.

---

## 8. UI components

### 8.1 `EmailFlowDashboard` (canonical Flow)

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Jump to editor — explicit only (inspector button / double-click). */
  onSelectEmail?: (emailId: string) => void;
  stats?: SequenceStats | null;
  enrollment?: EnrollmentData | null;
  onChangeTrigger?: (trigger: EmailTriggerEvent) => void;
  offerOptions?: { id: string; label: string }[];
  contentOptions?: { id: string; label: string }[];
  onChangeTriggerConfig?: (patch: Partial<EmailTriggerConfig>) => void;
}
```

**Features (final UX — see `EMAIL_FLOW_CANVAS_UI_UX_SYSTEM_PORT.md`):**
- Full-height side panel (`max-w-5xl`)
- Zoom (wheel + buttons, 40%–250%) and pan (drag; drag does not select)
- Heat map toggle (node border by open-rate tint)
- KPI bar when enrollments exist (enrolled / active)
- Edges: thickness ∝ volume; **branch/split labels only** (trunk unlabeled)
- **Single-click** = select + inspector (Flow stays open). **Does not** call `onSelectEmail`.
- **Double-click** email/split or inspector **“Open in editor”** → `onSelectEmail`
- Email nodes: subject-first; compact stats `open% · CTR · sent`; kind accent bars
- Selection: strong ring; non-selected nodes dim
- Email/split inspector: stats grid + explicit Open in editor
- **Trigger node always compact** (same `FLOW_NODE_*` size as emails)
  - Click → **Program trigger** side inspector (not inline expansion)
  - Live wiring sentence + grouped event select + stepped waterfall
  - `onMouseDown stopPropagation` on nodes/inspectors so pan doesn’t steal clicks
- Read-only compact trigger when `onChangeTrigger` omitted

**No external canvas library** — SVG edges + absolutely positioned nodes over a
dot-grid background. Positions come from `sequenceToFlowGraph`.


### 8.2 `EmailFlowPanel` (deprecated)

```ts
/** @deprecated Use EmailFlowDashboard instead. */
export { default } from './EmailFlowDashboard';
```

Keep the file so any lingering imports still resolve.

### 8.3 `EmailAnalyticsDashboard`

```tsx
interface Props {
  sequence: EmailSequence;
  stats: SequenceStats | null;
  enrollment: EnrollmentData | null;
  onSelectEmail?: (emailId: string) => void;
}
```

**Sections:**
1. Period selector (`7d` | `30d` | `90d` | `all`) — UI only today; data is `'all'` roll-up until ESP buckets exist
2. KPI cards — enrolled, active, open rate, CTR, revenue (from `sequenceTotals` + enrollment helpers)
3. Funnel chart — `enrollmentFunnel(stats)`
4. Per-email performance table — sortable; click row → `onSelectEmail`
5. Cohort matrix — `cohortBuckets(sequence, enrollment, 'week')` with heat colors
6. A/B results — `abVariantStats(sequence, stats)` with winner highlight

Empty state when `!hasAnyStats(stats) && !hasEnrollments(enrollment)`.

### 8.4 `EmailInsightsPanel`

```tsx
interface Props {
  report: EmailInsightsReport | null;
  busy: boolean;
  onApply?: (insight: EmailInsight) => void;
  onDismiss?: (insightId: string) => void;
  onRefresh?: () => void;
}
```

Severity badges (critical / warning / opportunity / info), executive summary,
per-insight Apply / Dismiss, Refresh button. Parent owns report state + API call.

---

## 9. Editor integration (`EmailKitEditor.tsx`)

### 9.1 State

```ts
const [flowOpen, setFlowOpen] = useState(false);
const [analyticsOpen, setAnalyticsOpen] = useState(false);
const [insightsOpen, setInsightsOpen] = useState(false);
const [insightsReport, setInsightsReport] = useState<EmailInsightsReport | null>(null);
const [insightsBusy, setInsightsBusy] = useState(false);
const [stats, setStats] = useState<SequenceStats | null>(null);
const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
```

### 9.2 Fetch on kit select

```ts
useEffect(() => {
  if (!selectedId) { setStats(null); setEnrollment(null); return; }
  let cancelled = false;
  fetch(`/api/admin/mothermode-email/stats?kitId=${encodeURIComponent(selectedId)}`)
    .then((r) => r.json())
    .then((j) => {
      if (!cancelled && j.success) {
        setStats(j.stats ?? null);
        setEnrollment(j.enrollment ?? null);
      }
    })
    .catch(() => {});
  return () => { cancelled = true; };
}, [selectedId]);
```

### 9.3 Toolbar buttons

```tsx
<button onClick={() => setFlowOpen(true)} disabled={!sequence.emails.length}>
  Flow
</button>
<button onClick={() => setAnalyticsOpen(true)} disabled={!sequence.emails.length}>
  Analytics
</button>
<button onClick={() => setInsightsOpen(true)} disabled={!sequence.emails.length}>
  AI Insights
</button>
```

### 9.4 Flow mount (with trigger programming)

```tsx
<EmailFlowDashboard
  open={flowOpen}
  onClose={() => setFlowOpen(false)}
  sequence={sequence}
  onSelectEmail={focusEmailCard}
  stats={stats}
  enrollment={enrollment}
  onChangeTrigger={(trigger) =>
    setSequence((prev) => ({ ...prev, trigger }))
  }
  onChangeTriggerConfig={patchTriggerConfig}
  offerOptions={sources
    .filter((s) => s.kind === 'offer' || s.kind === 'offer-bonuses')
    .map((s) => ({ id: s.id, label: s.label }))}
  contentOptions={sources
    .filter((s) => s.kind !== 'link' && s.kind !== 'text')
    .map((s) => ({ id: s.id, label: s.label }))}
/>
```

`patchTriggerConfig` already exists for the editor's own trigger-mapping
dropdowns — reuse it:

```ts
function patchTriggerConfig(patch: Partial<EmailTriggerConfig>) {
  setSequence((prev) => {
    const tc: EmailTriggerConfig = { ...(prev.triggerConfig ?? {}), ...patch };
    (Object.keys(tc) as (keyof EmailTriggerConfig)[]).forEach((k) => {
      if (!tc[k]) delete tc[k];
    });
    const any = tc.funnelPage || tc.offerSlug || tc.contentRef || tc.note;
    return { ...prev, triggerConfig: any ? tc : undefined };
  });
}
```

### 9.5 Analytics mount

Wrap `EmailAnalyticsDashboard` in a fixed side panel (same shell pattern as
insights). Pass `sequence`, `stats`, `enrollment`, `onSelectEmail={focusEmailCard}`.

### 9.6 Insights mount

```tsx
<EmailInsightsPanel
  report={insightsReport}
  busy={insightsBusy}
  onApply={(insight) => {
    if (insight.actionType === 'edit-subject' && insight.emailId) {
      focusEmailCard(insight.emailId);
    }
  }}
  onDismiss={(id) => {
    setInsightsReport((prev) =>
      prev
        ? {
            ...prev,
            insights: prev.insights.filter((i) => i.id !== id),
            totalInsights: prev.totalInsights - 1,
          }
        : null,
    );
  }}
  onRefresh={async () => {
    if (!selectedId || insightsBusy) return;
    setInsightsBusy(true);
    try {
      const res = await fetch('/api/admin/mothermode-email/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: selectedId, sequence }),
      });
      const json = await res.json();
      if (json.success) setInsightsReport(json.report);
    } finally {
      setInsightsBusy(false);
    }
  }}
/>
```

### 9.7 Inline mini-stats on email cards

```tsx
{stats?.byEmail?.[email.id] ? (
  <div className="flex items-center gap-2 text-[10px] font-semibold text-bone/60">
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
      {Math.round(openRate(stats.byEmail[email.id]) * 100)}% open
    </span>
    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
      {Math.round(ctr(stats.byEmail[email.id]) * 100)}% CTR
    </span>
    <span className="rounded bg-bone/10 px-1.5 py-0.5 text-bone/50">
      {stats.byEmail[email.id].sent} sent
    </span>
  </div>
) : null}
```

### 9.8 `focusEmailCard`

Used only for **explicit** jump-to-editor (inspector button, double-click,
insights apply). Always close every overlay so panels never compete:

```ts
function focusEmailCard(emailId: string) {
  setFlowOpen(false);
  setAnalyticsOpen(false);
  setInsightsOpen(false);
  requestAnimationFrame(() => {
    const el = document.getElementById(`email-card-${emailId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-brass');
    setTimeout(() => el.classList.remove('ring-2', 'ring-brass'), 1600);
  });
}
```

Email cards need `id={`email-card-${email.id}`}` and `scroll-mt-24`.


---

## 10. Port order (recommended)

Copy in this order so each step compiles:

1. **Migrations** — run `20260810000000_…_stats.sql` then `20260820000000_…_enrollments.sql`
2. **Prerequisites** (if missing) — `triggers.ts`, base `types.ts` (`trigger`, `triggerConfig`, `abTest`), `flow.ts`
3. **`analytics.ts`** + tests
4. **`enrollment.ts`** + tests
5. **`flowOverlay.ts`**
6. **Barrel** — add re-exports to `email/index.ts`
7. **`statsStore.ts`** + **`enrollmentStore.ts`**
8. **API routes** — `stats/route.ts`, `insights/route.ts`
9. **`openai-email-insights.ts`**
10. **Components** — `EmailFlowDashboard`, `EmailAnalyticsDashboard`, `EmailInsightsPanel`; deprecate `EmailFlowPanel` as re-export
11. **Editor wiring** — buttons, fetch, props, mini-stats
12. **Verify**

```bash
npx tsc --noEmit
npx vitest run \
  tests/lib/email-flow.test.ts \
  tests/lib/email-analytics.test.ts \
  tests/lib/email-enrollment.test.ts \
  tests/lib/email-triggers.test.ts \
  tests/lib/email-preview.test.ts
```

---

## 11. Dependencies

| Need | Notes |
| --- | --- |
| React 18+ client components | `'use client'` |
| `lucide-react` | Icons (Zap, GitBranch, FlaskConical, Users, Activity, …) |
| Tailwind | Existing design tokens (`bone`, `brass`, `ink`) |
| Supabase service role | Stores only |
| OpenAI and/or Anthropic | Insights only; empty report if missing |
| **No** `reactflow` / `dagre` / `elkjs` | Layout is pure in `flow.ts` |

---

## 12. Backward compatibility

- No required changes to `EmailMessage` / `EmailSequence` shapes for analytics —
  side tables keyed by `(kit_id, email_id)`.
- All new sequence fields used by the canvas (`trigger`, `triggerConfig`,
  `abTest`) are optional and normalize to safe defaults (see trigger port).
- `stats` / `enrollment` props are optional everywhere — omit → structural
  graph / empty analytics / empty insights.
- `EmailFlowPanel` re-export keeps old imports working.
- Old kits with linear trunks render as a vertical spine; no data → clean empty
  states, never crashes.

---

## 13. Empty-state behavior (important)

| Surface | No stats | No enrollments | No AI key |
| --- | --- | --- | --- |
| Flow canvas | Structural graph only | No KPI bar / no live counters | n/a |
| Analytics | Empty-state message | Funnel/cohort empty | n/a |
| Insights | Can still generate structure-only tips | Same | `emptyInsightsReport` / error toast |
| Mini-stats | Hidden | n/a | n/a |

Never show `NaN%` or broken charts — all rate helpers are zero-safe.

---

## 14. Deferred (out of scope until ESP chosen)

- Real webhook signature verification + provider payload → our shapes
- Period bucketing UI wired to real `period` rows (column exists; UI is cosmetic)
- True conversion counter (today `conversionRate` uses clicks as proxy)
- Journey detail drawer per subscriber (helpers exist: `journeyForSubscriber`)

---

## 15. Quick smoke checklist after port

1. Open a kit with emails → **Flow** opens canvas with compact trigger + trunk
2. **Single-click** email → inspector only; Flow stays open (no editor jump)
3. **Open in editor** / double-click → Flow+Analytics+Insights close; card highlights
4. Click trigger → compact node + Program trigger inspector (no size change)
5. Change event / page / offer in inspector → sequence updates; save persists
6. **Analytics** empty state (no ESP data) — no errors
7. **AI Insights** → Refresh → insights or graceful empty / no-key
8. Seeded stats → compact `open% · CTR · sent` on nodes + heat map
9. Unit tests green (78 across email suites when full kit present)


---

## 16. Design tokens used (map to target theme)

| Token | Role |
| --- | --- |
| `ink` | Panel background |
| `bone` | Primary text / borders (`bone/10`, `bone/15`, `bone/40`) |
| `brass` | Accent (buttons, branch edges, highlights) |
| `#6ea8fe` / `#9cc2ff` | Trigger + A/B blue |
| `emerald-300/500` | Good heat / open rate |
| `amber-500` | OK heat |
| `red-300/500` | Bad heat / drop-off |
| `sky-300` | CTR badges |

---

## 17. One-file mental model

```
EmailSequence (JSON)
        │
        ▼
 sequenceToFlowGraph  ──►  FlowGraph (nodes/edges + x/y)
        │
        ├─ statsStore ──────────► SequenceStats
        ├─ enrollmentStore ─────► EnrollmentData
        │         │
        │         ▼
        │   dropoffByEmail / enrollmentFunnel / cohortBuckets
        │         │
        ▼         ▼
 computeFlowOverlay ──► FlowOverlay
        │
        ▼
 EmailFlowDashboard  ◄── onChangeTrigger / onChangeTriggerConfig
        │
        ├── EmailAnalyticsDashboard (same stats + enrollment)
        └── EmailInsightsPanel ◄── aiGenerateInsights
```

That's the whole system. Port the pure modules first, then stores/routes, then
UI, then editor glue.

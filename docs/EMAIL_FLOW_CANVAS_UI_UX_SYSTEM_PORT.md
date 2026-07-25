# Email Flow Canvas UI/UX Overhaul — System Port

Status: **shipped & verified** — pure email suites still green (`email-flow` 14,
`email-enrollment` 26, `email-analytics` 18, `email-triggers` 10).

This doc ports the **Flow canvas UI/UX redesign** that landed after the
View-flow + Dashboard merge. It assumes the base Flow / Analytics / Insights
system from:

**`docs/EMAIL_FLOW_ANALYTICS_DASHBOARD_SYSTEM_PORT.md`**

is already present (or being ported in the same pass).

---

## 1. Why this exists

After merge, the canvas worked but felt rough:

1. **Click competition** — single-clicking an email node both selected it *and*
   jumped to the editor (`focusEmailCard`), which closed Flow and could leave
   Analytics/Insights fighting the form.
2. **Trigger node** expanded inline into a form (`width + 72`, `minHeight`),
   breaking spine geometry and edge anchors.
3. **Email cards** were badge piles (role, offset, images, A/B, open, CTR, drop)
   instead of subject-first flow nodes.

This overhaul fixes interaction first, then visual hierarchy.

---

## 2. End-state behavior

| Action | Result |
| --- | --- |
| Single-click email / split / trigger | Select node + open **inspector** on canvas. Flow stays open. |
| Double-click email / split | Jump to editor (`onSelectEmail`) |
| Inspector **“Open in editor”** | Jump to editor (explicit) |
| Click trigger | Compact node stays same size; **trigger inspector always opens** (editable controls only if programmable) |
| `focusEmailCard(id)` in editor | Closes **Flow + Analytics + Insights**, then scrolls/highlights card |

Toolbar is unchanged:

```
[Flow] [Analytics] [AI Insights] [Preview inbox] [Copy text] [Copy HTML]
```

---

## 3. Files touched

| File | Change |
| --- | --- |
| `src/components/mothermode/email/EmailFlowDashboard.tsx` | Full UI rewrite: compact trigger, inspectors, card hierarchy, selection model |
| `src/app/admin/email-marketing/EmailKitEditor.tsx` | `focusEmailCard` closes all overlay panels |
| `src/components/mothermode/email/EmailFlowPanel.tsx` | Still deprecated re-export of dashboard (unchanged) |

**No schema, store, API, or pure-module changes.** Layout constants
(`FLOW_NODE_WIDTH` / `FLOW_NODE_HEIGHT`) stay as in `flow.ts`.

---

## 4. Interaction model (port this exactly)

### 4.1 Selection vs navigation

```ts
// Inside EmailFlowDashboard
const selectNode = (nodeId: string) => {
  if (didDrag.current) return; // ignore click after pan
  setSelectedNodeId(nodeId);
  setTriggerInspectorOpen(nodeId === 'trigger');
};

const jumpToEmail = (emailId: string) => {
  onSelectEmail?.(emailId); // parent closes panels + scrolls
};
```

- Email / split nodes: `onClick → selectNode`, `onDoubleClick → jumpToEmail`
- Trigger node: `onClick → selectNode` only (opens programming inspector)
- Node `onMouseDown` calls `e.stopPropagation()` so canvas pan doesn’t steal clicks
- Canvas pan tracks `didDrag` so a drag doesn’t count as a click

### 4.2 Editor `focusEmailCard`

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

Email cards still need `id={`email-card-${email.id}`}` and `scroll-mt-24`.

### 4.3 Props (unchanged contract)

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  sequence: EmailSequence;
  /** Jump to editor — explicit only (button / double-click). */
  onSelectEmail?: (emailId: string) => void;
  stats?: SequenceStats | null;
  enrollment?: EnrollmentData | null;
  onChangeTrigger?: (trigger: EmailTriggerEvent) => void;
  offerOptions?: { id: string; label: string }[];
  contentOptions?: { id: string; label: string }[];
  onChangeTriggerConfig?: (patch: Partial<EmailTriggerConfig>) => void;
}
```

`onSelectEmail` is **no longer** called on mere selection. Callers that assumed
“click node = focus card” must use the inspector button or double-click.

---

## 5. Trigger node (compact + inspector)

### 5.1 Always compact

Trigger uses the **same** `FLOW_NODE_WIDTH` × `FLOW_NODE_HEIGHT` as email nodes.
Never expand the node for form controls.

Visual:
- Background `#141a2e`
- Blue left accent bar (`w-1`, `#6ea8fe`)
- Header: Zap + “Trigger” + optional Settings2 when programmable
- Title: `EMAIL_TRIGGER_LABELS[trigger]`
- Subline: `Fires on · {location}` and optional ` · {binding}`

### 5.2 Trigger inspector (side panel, not inline)

Opens whenever the trigger node is selected — **even if read-only**. Do **not**
gate the whole panel on `onChangeTrigger`; only the editable controls are gated.

Contents (always):
1. **Live wiring sentence**:
   > When **{event}** fires on **{location}** ( **{binding}** ), enroll into this sequence.
2. Description line when read-only

Contents (when `onChangeTrigger` provided):
3. **Enrollment event** `<select>` grouped via `emailTriggerGroups()`
4. **Where it fires** block when `onChangeTriggerConfig` is set:
   - Funnel category → `1 · Funnel page` + `2 · Offer`
   - Content category → `1 · Content asset`

Helpers used (from `@/lib/mothermode/email`):

```ts
emailTriggerLabel
resolveTriggerLocationLabel
resolveTriggerBindingLabel
emailTriggerCategory
EMAIL_TRIGGER_LABELS
EMAIL_TRIGGER_DESCRIPTIONS
emailTriggerGroups
EMAIL_FUNNEL_PAGE_LABELS
```

Inspector sits `absolute bottom-4 right-4`, `onMouseDown stopPropagation`,
`z-30`, blue-tinted border. Must be visible above the canvas (not clipped).


---

## 6. Email card hierarchy

```
┌─ accent bar ─────────────────────────┐
│  #N   ROLE              [A/B] [img]  │  ← top meta only
│  Subject line (2 lines, semibold)    │  ← primary content
│  +1d  [if opened]   42% · 8% · 1.2k  │  ← footer stats
└──────────────────────────────────────┘
```

Rules:
- **Top:** `#order` + `role` only. A/B flask badge and/or image icon right-aligned.
- **Body:** subject, `text-[13px] font-semibold`, 2-line clamp.
- **Footer left:** `sendOffset`; branch chip (`if opened`) when `branch !== 'always'`.
- **Footer right — stats cluster (required when data exists):**
  - Prefer `stats.byEmail[emailId]` via `openRate` / `ctr` from `analytics.ts`.
  - Fall back to `nodeOverlay` from `computeFlowOverlay`.
  - Show when **any** of: stats row present, `overlay.hasData`, `sent > 0`,
    or `activeCount > 0`.
  - Format: `open% · CTR · sent` (+ optional `N live` + drop-off if > 10%).
  - If sequence has *some* stats (`hasAnyStats`) but this email has none, show
    a calm `—` placeholder so the row doesn’t jump.
- **No** separate open/CTR/drop pills fighting for space.
- **Kind accent:** left bar brass for branch, bone/25 for trunk.
- **Selection:** brass ring + glow; non-selected nodes `opacity-55`.
- **Heat map:** still toggles border tint via `heatTintClasses` when on.

Split nodes: dashed blue border, compact A/B header + subject; same select /
double-click model.

### 6.1 Click / pan bugfix (required)

Canvas pan used a `didDrag` ref that was **never cleared** after mouseup, so
after the first pan every subsequent node click (including the trigger) was
ignored. Port must:

```ts
const handleMouseUp = () => {
  isPanning.current = false;
  requestAnimationFrame(() => { didDrag.current = false; });
};
// selectNode: if didDrag, clear it and return; else select
```


---

## 7. Edges

- Trunk edges: unlabeled (cleaner spine).
- Branch / split edges: keep condition or weight labels (+ conversion % when overlay has it).
- Thickness still from `edgeOverlay.thickness`.

---

## 8. Email / split detail inspector

When an email or split is selected:

- Header: role / index + subject
- Stats grid prefers `stats.byEmail[id]` then overlay (same rules as card footer)
- If any numbers: 2×2 grid (Sent, Active, Open, CTR) + drop-off row if > 0
- Else: calm “No engagement data yet”
- Primary CTA: **Open in editor** → `onSelectEmail(emailId)` (only if callback provided)

Do **not** auto-call `onSelectEmail` on open.


---

## 9. Header / chrome copy

- Title: “Sequence flow”
- Subtitle: “Click a node for details. Use “Open in editor” to jump to an email.”
- Heat map + zoom controls unchanged in spirit
- Reset `selectedNodeId` / `triggerInspectorOpen` when `open` becomes false

---

## 10. Port checklist

1. Replace `EmailFlowDashboard.tsx` with the compact-trigger + inspector version
   (or apply the interaction + layout rules above).
2. Update `focusEmailCard` to close Flow **and** Analytics **and** Insights.
3. Confirm `onSelectEmail` is **not** invoked from single-click handlers.
4. Confirm trigger node never changes width/height when programming.
5. Smoke:
   - Click email → inspector only; Flow stays open; footer shows open% · CTR · sent when stats exist
   - “Open in editor” → Flow closes, card highlights, no Analytics flash
   - Click trigger → compact node + **visible** trigger inspector (wiring sentence always)
   - After panning the canvas, click still selects nodes (didDrag reset)
   - Change event / page / offer → sequence state updates; save still works
   - Double-click email → same as Open in editor
   - Pan drag does not select
6. Run:

```bash
npx vitest run \
  tests/lib/email-flow.test.ts \
  tests/lib/email-enrollment.test.ts \
  tests/lib/email-analytics.test.ts \
  tests/lib/email-triggers.test.ts
```

---

## 11. Backward compatibility

- Public props unchanged; **behavior** of `onSelectEmail` is stricter (explicit only).
- Pure graph / overlay / stats APIs unchanged.
- Deprecated `EmailFlowPanel` re-export still points at the dashboard.
- Kits without `onChangeTrigger` get a compact trigger + **read-only** inspector
  (wiring sentence + description; no selects).

---

## 12. Relationship to the full system port

When porting greenfield:

1. Follow `EMAIL_FLOW_ANALYTICS_DASHBOARD_SYSTEM_PORT.md` for data + APIs + shell.
2. Apply **this** doc for the final Flow canvas UX (do not port the older
   “inline expandable trigger + click-to-jump” behavior from intermediate
   handoffs).

If the target already has the pre-overhaul dashboard, this doc is a **delta
port**: swap the dashboard component + `focusEmailCard` only.

# Sales Funnel Editor Refactor — System Port

Port doc for the decomposition of `src/app/admin/sales-funnels/SalesFunnelEditor.tsx`
from a single 1396-line client component into a thin stateful shell plus a family of
stateless tab components under `src/app/admin/sales-funnels/parts/`.

This supersedes the running notes in `SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md` and
`SALES_FUNNEL_EDITOR_REFACTOR_NEXT_SESSION.md` (the latter keeps the per-session log
and the remaining loose ends). Read this file to understand the shape; read that one
to understand what is still unfinished.

---

## 1. Why

The editor had grown to 1396 lines holding fourteen tab bodies, every piece of
`useState` for a ten-page funnel, all AI handlers, and its own copies of the form
primitives. Consequences that actually bit:

- Any edit to one tab required reading (and risking) the whole file. A single
  `read_file` of it costs most of a context window, and `replace_in_file` echoes the
  full file back on every apply.
- The flat tab bar had fourteen buttons in one row with no grouping, so the money
  path (offer stack) sat visually equal to a footer disclaimer.
- Form primitives were defined inline at the bottom, so no other admin screen could
  reuse them.

## 2. Architecture

**Shell** — `SalesFunnelEditor.tsx` (1043 lines). Owns *all* state: the funnel list,
`selectedId`, per-page content objects, the offer stack, the AI intake, `busy`, and
`tab`. Owns every handler (`onGenerate`, `onGeneratePage`, `onFillIntake`,
`onGenerateImages`, `onPickLeadMagnet`, `onCreateLeadMagnet`, the stack mutators, save
/ publish / duplicate / delete, `exportLeadsCsv`). Renders the nav and delegates each
tab body to a part.

**Parts** — `src/app/admin/sales-funnels/parts/`:

| File | Contents |
| --- | --- |
| `ui.tsx` | Shared primitives: `Field`, `Area`, `Collapse`, `RegenerateBar`, `StatChip`, the `btnPrimary` / `btnGhost` / `btnDanger` / `inputClass` / `labelClass` / `panelClass` class constants, and the `linesToList` / `listToLines` helpers. As of step 7 the shell holds **no** local copies of these; `StatChip` is imported from here by the shell's own readiness strip. |
| `OfferTab.tsx` | AI brief, lead-magnet link, offer stack (front-end, bonuses, bumps, upsells 1–4), and links/integrations. Four `Collapse` sections. |
| `SalesTab.tsx` | The sales page body (~200 lines). |
| `UpsellTab.tsx` | One component reused for upsell slots 1–4. |
| `PageTabs.tsx` | `OptinTab`, `VslTab`, `CheckoutTab`, `SuccessTab`, `AccessTab` — the five thin page bodies. |
| `LeadsTab.tsx` | Read-only leads table plus Export CSV. |
| `EmailsTab.tsx` | Email-kit binding per funnel event + the autobuild panel. |
| `EmailStatsTab.tsx` | Email flow analytics dashboard. |
| `ChromeTab.tsx` | The funnel footer: enabled toggle, brand line, disclaimer, links, copyright. Footer-only — see 6.2. |


**The invariant that matters:** every part is stateless. State lives only in the
shell, so unmounting a tab (which the nav does on every switch) can never drop a
half-typed edit. If a future part needs local state, it must be draft-only UI state
that no one would mourn — never a field value.

## 3. Props contracts

Two shapes recur. Keep new parts consistent with them.

**Page tabs** take a content object, a generic field setter, and regeneration wiring:

```
{ optin, setField, onRegenerate, busy }
setField: <K extends keyof T>(key: K, value: T[K]) => void
```

**Offer/Leads tabs** take explicit callbacks rather than setState functions. Where a
part only reads a value (the leads rows, the lead-magnet options) the prop type is
declared *structurally* in the part (`LeadRow`, `LeadMagnetChoice`) rather than
importing the shell's type. This is deliberate: a loose read-only shape cannot
desync, and it keeps parts from depending on store internals. Do **not** apply that
trick on a write path — a structural stand-in around a `setState` updater is unsound
(the return type must be assignable both ways). That is why `ChromeTab` imports the
real `SalesFooterContent` rather than describing it structurally (§6.2).

Offer-stack types (`OfferStack`, `OfferStackBonus`, `OfferStackBump`,
`OfferStackUpsell`) and `SalesAiIntake` all live in
`src/lib/mothermode/sales/aiIntake.ts` — *not* in `sales/types.ts`. That mistake cost
a round trip; the resolution is now scripted.

## 4. Navigation

The flat fourteen-button bar is replaced by a group bar plus a contextual sub-bar:

```
Offer | Pages | Emails | Chrome | Leads
        Opt-in Sales VSL Checkout Upsell1-4 Success Access
        (Emails selected → Kits | Analytics)
```

`tab` remains the single source of truth. `activeGroup` is **derived**:

```ts
const activeGroup = GROUPS.find((g) => g.tabs.includes(tab)) ?? GROUPS[0];
```

Because it is derived rather than stored, handlers that jump straight to a page —
`onGenerate` ends with `setTab('optin')` — light up the correct group with no second
piece of state to keep in sync. Any future grouping change should preserve that; a
`const [group, setGroup]` here would be a bug farm.

`'links'` is gone from the `Tab` union: its five fields are now a `Collapse` inside
the Offer tab, because slugs describe the offer, not a page.

## 5. How the edits were applied (repeatable procedure)

Every step ran as a guarded Node script in `scripts/`, never as an interactive edit:

- `wire-upsell-tab.cjs`, `fix-upsell-import-placement.cjs` — step 1
- `wire-sales-tab.cjs`, `fix-sales-regen-label.cjs` — step 2
- `wire-offer-and-nav.cjs` — steps 3–5 in one pass
- `wire-emails-tab.cjs` — step 6 (Emails group + both parts + shell state)
- `fix-page-regen-disabled.cjs` — the `PageTabs` `disabled` gap

Rules these encode, each learned from a failure:

1. **Never** touch `SalesFunnelEditor.tsx` with `replace_in_file`; the echo alone can
   end a session.
2. Locate tab bodies by their `{tab === '…' && (` opener and scan to the `)}` at the
   same indent. Do not count lines.
3. Assert before writing, and abort with **nothing written** on any surprise: missing
   opener, missing closer, a `const tabs` that does not mention `'build'`, a tab bar
   that is not the expected three-line div, a surviving `tabs.map(`, or unbalanced
   multi-line import blocks.
4. Anchor inserted imports on a specific single-line import (`import SalesTab from
   './parts/SalesTab';`), never on `/^import\b/` — that lands inside a multi-line
   import block.
5. Re-running is a no-op: each script checks for its own marker first.
6. **The field-label guard.** Before deleting an inline body, diff every `label="…"`
   in it against the destination component. If any label is missing, keep the inline
   body and log it. A field that silently loses its editor is invisible to `tsc`, and
   this is the only mechanical defence against it. All five page tabs passed.
7. **Count before you write.** `fix-page-regen-disabled.cjs` asserts it found exactly
   five `RegenerateBar` call sites, five `Common` prop spreads, and five shell call
   sites before touching anything. "Found 4 of 5" is a silently half-wired feature, so
   an exact-count assert is worth the three extra lines.
8. **Before moving a body into an unmount-on-switch tab, check what state it owns.**
   Anything living in an always-mounted region may be silently depending on that.
   Lift the state to the shell in a separate step first (§6.1).

## 6. Result and current state

| Step | Change | Lines |
| --- | --- | --- |
| 1 | Upsell 1–4 → `UpsellTab` | 1396 → 1330 |
| 2 | Sales body → `SalesTab` | 1330 → 1206 |
| 3–5 | Offer + Leads + PageTabs + grouped nav | 1206 → **914** |
| 6 | Emails/kit-binding + analytics → `EmailsTab` / `EmailStatsTab`, `Emails` group | 914 → **1059** |
| 7 | Footer/Chrome body → `ChromeTab` | 1059 → **1043** |

Step 6 made the shell *longer*, and that is the expected shape, not a regression: the
autobuild run state and its fetch moved **into** the shell (§6.1), and two new call
sites pay for ~30 explicit props between them. Line count was never the goal —
"one tab's markup is one file you can open" was. Two bodies left the shell; the state
they needed had to land somewhere, and the shell is the only correct owner.

Verified: `tsc --noEmit` clean; no stale `tabs.map`, no stale `links` region, import
blocks balanced, label guard passed for all five page bodies.

**Not verified: none of this has been exercised in a browser.** "tsc is clean" is not
"the tab renders." The fourteen `Collapse` sections and the new two-row nav have never
been clicked. The ordered manual checklist is **Task A** of
`SALES_FUNNEL_EDITOR_CHROME_MEDIA_TASK.md`, and it should be walked *before* any
further extraction, so that a failure found belongs to work already described here
rather than being tangled with new edits. The two highest-value checks: type into a
field and switch tabs (the stateless-parts invariant), and start an autobuild then
switch sub-tabs (§6.1).

Known gaps, in priority order:

1. ~~The five `PageTabs` bodies receive no `disabled`.~~ **Closed** — `Common` now
   carries `disabled` and the shell passes `disabled={busy !== null}` to all five, so
   Regenerate can no longer fire a second POST on top of an in-flight job.
   (`scripts/fix-page-regen-disabled.cjs`, idempotent, asserts 5/5/5 before writing.)
2. ~~The Chrome/footer body is still inline.~~ **Closed** — extracted to
   `parts/ChromeTab.tsx` (79 lines) by `scripts/wire-chrome-tab.cjs`. The type is
   the real `SalesFooterContent`, imported, not a structural stand-in — the
   `setFooter` write path makes a loose shape unsound. The shell's last local
   `Field` / `Area` / `StatChip` copies went with it; `StatChip` moved to
   `parts/ui.tsx` because the readiness chips still use it. Confirmed there is no
   `setHeader` anywhere in the shell, so "Chrome" is footer-only despite the group
   name — the group is a single tab, not a sub-tab pair (§6.2).
3. ~~The Emails / kit-binding block stays in the always-mounted meta section.~~
   **Closed** — see §6.1.
4. **The Media group does not exist to be built.** Scoped before building, per the
   rule above, and the scoping is the result: `tab === 'media'` appears **zero**
   times in the shell, and `FunnelMediaStudio` is imported **only** by the six
   public funnel page components (`SalesPage`, `VslPage`, `CheckoutPage`,
   `AccessPage`, `UpsellPage`, `SalesOptinPage`) — never by the admin editor.
   Media editing is inline-on-the-page, reached from the live funnel, not from a tab
   here. There is no admin-side media body to extract, so this item is **void as
   written** rather than pending. Anyone reviving it is proposing to *build* a new
   admin media tab, which is a feature, not a refactor step.

### 6.1 The Emails group, and the bug that had to be fixed first

`Emails` is a group with `Kits` / `Analytics` sub-tabs, mirroring `Pages`; the top bar
stays at five items (`Offer | Pages | Emails | Chrome | Leads`) and `activeGroup`
remains derived from `tab`, never stored.

The trap: moving the autobuild panel into an unmounted-on-switch tab *as-is* would have
been a silent regression. The panel owned its own run state, and it only survived a tab
switch because the meta section was always mounted. So the state was lifted **first**:
`EmailKitAutobuildPanel` now takes `autobuild`, `autobuildBusy`, and `onAutobuild` as
props and holds nothing; the run state and the fetch live in the shell. Same invariant
as every other part — **state lives in the shell, parts are stateless** — and here it is
load-bearing, not stylistic. `tsc` cannot see this class of break, and a click-through
looks fine unless you specifically start a run and then switch tabs.

`parts/EmailsTab.tsx` (kit binding + autobuild) and `parts/EmailStatsTab.tsx`
(flow analytics) are both pure props-in/callbacks-out.

### 6.2 Chrome is footer-only, and the brace-matching bug

The group is named "Chrome" but there is no header editor: `setHeader` appears
nowhere in the shell, and the inline body held exactly one content object,
`SalesFooterContent`. So `Chrome` is a single tab, not a sub-tab pair — do not add a
`Header` sub-tab to match the name.

The extraction tripped the one guard that had not fired before. Rule 2 (find the
`)}` at the same indent as the `{tab === '…' && (` opener) is not sufficient when the
body is the **last** tab in the file and is followed by the component's own closing
braces: the naive same-indent scan ran past the body's end and swallowed the shell's
trailing `);` / `}`, leaving orphaned signature remnants that `tsc` reported as a
dozen unrelated syntax errors far from the real cause. The fix in
`wire-chrome-tab.cjs` is to match braces by *depth* from the opener rather than by
indentation, and to assert the extracted region both starts with `{tab ===` and ends
with a balanced `)}` before deleting anything. Indentation is a formatting
convention; brace depth is the actual structure. Prefer depth for any body that might
be last in its file.

## 7. Porting this pattern to another admin editor

`OptinFunnelEditor.tsx`, `EmailKitEditor.tsx`, and `LeadGenEditor.tsx` have the same
shape and the same growth problem. The order that worked:

1. Extract shared primitives to `parts/ui.tsx` first, so later parts import instead
   of duplicating.
2. Extract the most-repeated body next (upsells here) for the best line-per-risk
   ratio.
3. Extract the largest body second, while the mechanics are fresh.
4. Restructure the nav **last**, once the bodies are components — the grouping is
   then a data change, not a JSX surgery.
5. Keep all state in the shell throughout. Never move a field value into a part.

## Grid field collision (Offer / Emails / PageTabs)

Selects and buttons overran their columns on these tabs. Root cause was **grid
items defaulting to `min-width: auto`**, which prevents a track from shrinking
below its content. `ui.tsx` already documents `min-w-0` as load-bearing for the
inputs themselves, but the bare `<div>` wrapping each `<select>` and the
`<div className="flex items-end">` button wrappers never received it, so those
tracks could not compress.

`scripts/fix-grid-item-minwidth.cjs` applies `min-w-0` across 4 files, reverts
an earlier incorrect `h-[38px]` attempt, and rewrites the `selectClass` comment
so the misdiagnosis is recorded rather than reading as intentional. Idempotent;
`tsc --noEmit` exits 0.

**Note for anyone touching these grids:** adding a wrapper element around a grid
child reintroduces the bug unless the wrapper also carries `min-w-0`.

## 2026-07-25 — Visual direction: the brief finally has a writer

`OfferTab.tsx` gained a "Visual direction (drives generated images)" group of
six inputs below the tone notes field, and an amber pre-flight line beside
"Generate missing images" that names the visual fields still unset. Both use the
existing `Field` component and the existing `setIntakeField` prop — no new
props, no editor-level state, so the tab's contract with
`SalesFunnelEditor.tsx` is unchanged.

The warning derives its text from `missingIntakeVisualFields(intake)`, the same
function the tests pin against `assumedVisualFields`, so the message before a
run and the notice after one cannot disagree. Verified by typecheck, not in a
browser.

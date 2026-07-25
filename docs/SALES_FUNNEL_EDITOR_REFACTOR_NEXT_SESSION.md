# Task: finish the `/admin/sales-funnels` tab refactor (steps 2–5)

Paste this whole file as the task for a fresh window. It is self-contained; you
should not need to re-read `SalesFunnelEditor.tsx` end to end.

**Read first:** `docs/SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md` — it has the verified
section map, the state findings, and the tooling traps. Read it before touching code.
Step 1 (`parts/UpsellTab.tsx`) is already done, wired, and type-checks clean.

---

## The three rules that make this safe

1. **Never edit `SalesFunnelEditor.tsx` with `replace_in_file`.** That tool echoes
   the entire 1395-line file back into context on success — ~30k tokens per edit,
   which can end your session in one call. Use a throwaway `scripts/*.cjs` node
   script instead (pattern used all over this repo; see
   `scripts/wire-upsell-tab.cjs` as the working template). It prints only what it
   changed. Reading *slices* with `read_file` + `start_line`/`end_line` is fine.

2. **When a script inserts an import, do not anchor on `/^import\b/`.** This file
   uses multi-line `import { ... } from '...'` blocks, so that regex matches the
   *opening* line and the import lands inside the block → `TS1003`/`TS1005`. This
   already happened once; `scripts/fix-upsell-import-placement.cjs` fixed it.
   Anchor on a closing `} from '...';` or on `'use client';`.

3. **Every script must assert before it writes** — check the region size and a
   content marker, and `process.exit(1)` with a clear message if they don't match.
   A half-applied edit to this file is much worse than a refused one.

Run `npx tsc --noEmit` after each step. The shell is PowerShell, so filter with
`| Select-String "error TS" | Select-Object -First 20`, **not** `findstr`/`more`.

## The one state hazard

All editable content lives in `useState` in the shell (lines 112–148), and the tab
bodies are pure functions of it, so unmounting an inactive tab **cannot** lose a
draft — the existing `{tab === 'x' && ...}` pattern is fine for them.

**The exception is `EmailKitAutobuildPanel`** — it owns `plans`, `results`, `busy`,
`notice` locally and re-fetches on `funnelId` change. If it unmounts, a finished
autobuild run silently disappears. Render it always and hide with a class:
`<div className={group === 'emails' ? '' : 'hidden'}>`, never `{group === 'emails' && ...}`.
This is the one place the CSS-hiding rule is mandatory rather than optional.

## Steps, one commit each

Line numbers below are for the **current 1395-line file** (everything after the old
1384 shifted up by ~163 when `UpsellTab` was extracted). Verify with a slice read
before you cut.

2. **`parts/SalesTab.tsx`** — the ~200-line `tab === 'sales'` body (was 1013–1212).
   Wrap its existing `<h3>`-delimited subsections in `Collapse` from `parts/ui`,
   first one `defaultOpen`. `Collapse` is built on `<details>` specifically because
   a closed `<details>` keeps children mounted, so collapsing can't drop edits.
3. **`parts/OfferTab.tsx`** — the AI intake/brief/lead-magnet/offer-stack body
   (was 808–972) plus the links block (was 1340).
4. **`parts/StudioTabs.tsx`** — `ChromeTab` (was 1331), `LeadsTab` (was 1352),
   `EmailsTab` (kit bindings + `EmailKitAutobuildPanel` — see the hazard above),
   and `MediaTab`, the only genuinely new panel. Media collects
   `optin.coverImageUrl`, `optin.heroVideoUrl`, `vsl.videoUrl`,
   `checkout.productImageUrl`, `access.welcomeVideoUrl`, the sales hero/founder
   images, and each upsell's `imageUrl` / `videoUrl` / `mediaVideoPoster` /
   `gallery`. Binding the same field in two tabs is fine — both read one state.
5. **Shell rewrite.** Keep lines 1–~810 (state, loaders, handlers, meta card, save
   bar). Replace the flat 14-value `type Tab` (line 75) with `group: Group` +
   `pageTab: PageTab`. Groups: **Pages** (optin, sales, vsl, checkout, upsell 1–4,
   success, access) · **Offer** (build + links) · **Emails** · **Chrome** (footer) ·
   **Media** · **Leads**. Render a group bar with a sub-bar inside Pages. Then
   delete the inlined bodies and the local `Field`/`Area`/`StatChip` (was
   1547–1557) **in the same edit** that adds the `parts/ui` import — otherwise
   there are two `Field`s in scope. Also import `parts/PageTabs` here; it holds
   `OptinTab`/`VslTab`/`CheckoutTab`/`SuccessTab`/`AccessTab`, already written and
   compiling but not yet imported by anything.

**Don't miss:** `onGeneratePage(...)` / `onGenerate()` currently set `tab` directly
(e.g. jumping to `'optin'` after a build). Those must set the **group** too, or the
AI build will silently appear to do nothing.

## Verification

After step 5, in the running app: edit a field in every tab, switch away, switch
back, confirm it survived; then save, reload, confirm it persisted. Specifically for
Emails: start an autobuild, switch tabs mid-run, come back, confirm the results are
still listed — that's the regression the `hidden` class exists to prevent. Also
click-verify `Collapse` once (type in a field, collapse the group, reopen, text
still there); that is compile-verified but never actually clicked.

One cosmetic loose end a typecheck can't catch: `RegenerateBar`'s default label in
`parts/ui.tsx` is invented wording, not the original copy. Compare against the
inline bars near the old 973 / 1213 / 1240 / 1281 / 1306 and pass `label` where the
original differed per page.

## Unrelated, still outstanding (not part of this task)

Copy the `anon` and `service_role` keys for the intended Supabase project into
`.env.local`, then re-run `node scripts/db-table-audit.cjs`. It now hard-aborts on
401/403 and names the project it hit, so it will say plainly whether anything is
actually missing. Note the precedence trap documented in
`docs/DB_MIGRATION_AUDIT_SYSTEM_PORT.md`: `.env.local` overrides `.env`, and the
keys must come from the *same* project as the URL. The Vercel-env question in that
doc is still an open hazard, deliberately not silently resolved.


---

## Session log — step 2 complete

**Step 2 is done and typechecks.** `npx tsc --noEmit` is clean.

### What changed

| File | Change |
| --- | --- |
| `src/app/admin/sales-funnels/parts/SalesTab.tsx` | **New.** The whole sales page body, field-for-field. Stateless: takes `sales`, `setField`, `onRegenerate`, `regenBusy`, `disabled`. The fourteen `<h3>` groups are now `Collapse` subsections; "Identity & media" is `defaultOpen`. |
| `src/app/admin/sales-funnels/parts/ui.tsx` | `RegenerateBar` gained an optional `disabled` prop, defaulting to `busy`. Needed to reproduce the original two-state behaviour: the inline bars disabled on ANY in-flight op (`busy !== null`) but only read "Regenerating…" for `busy === 'generatePage'`. `PageTabs.tsx` is unaffected (the prop is optional). |
| `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` | The inlined `{tab === 'sales' && (…)}` body (200 lines) is now a 9-line `<SalesTab …/>` call, plus one import. **1396 → 1206 lines.** |
| `scripts/wire-sales-tab.cjs` | The guarded script that did it. Re-running is a no-op. |

### Read this before step 3

1. **All line numbers in the region map above are now wrong.** Everything after
   the old line 1014 shifted up by 191. Re-derive regions with a search for the
   `{tab === '<name>' && (` opener; do not trust the old numbers.

2. **New guard-script rule, learned the expensive way.** `wire-sales-tab.cjs`
   aborted on its first run with "import landed inside an unclosed multi-line
   import block (5 opens vs 3 closes)" — a **false positive**. The check counted
   `import { useEffect, useMemo, useState } from 'react';` as an *opening*
   brace, because it matched `/^import \{/`. Single-line `import { … } from …;`
   opens and closes on one line. Use
   `/^import \{(?![^\n]*\})/gm` for opens. The guard behaved correctly (it
   wrote nothing), but the pattern is the mirror image of the `/^import\b/`
   anchoring bug from step 1: **both come from treating a multi-line import
   block as if it were one line.**

3. The one real state hazard is unchanged and still applies to step 4:
   `EmailKitAutobuildPanel` owns `plans`/`results` locally, so Emails must be
   hidden with a `hidden` class, never `{group === 'emails' && …}`.

### Loose ends, still loose

- **`RegenerateBar`'s default label is invented copy.** Unchanged from the last
  session, and now there is a second instance of the same problem:
  `SalesTab` passes `label="Rewrite this page from the Offer tab stack."` where
  the original inline bar said **"Build tab"**. That is a deliberate
  forward-reference to the tab being renamed *Offer* in step 5 — but the rename
  has not happened yet, so **right now the sales tab points the user at a tab
  name that does not exist in the UI.** Either finish step 5 or change this
  string back. A typecheck cannot catch either one.
- **`Collapse` is compile-verified but still has never been clicked.** It is now
  on screen fourteen times on the sales tab, so this is the first place to look.
- **`SalesTab` has not been rendered in a browser.** The extraction is
  mechanical and types line up, but "tsc is clean" is not "the tab renders".

### Verification actually performed

- `node scripts/wire-sales-tab.cjs` → reported 200 → 9 lines, one import inserted.
- `npx tsc --noEmit` → no `error TS` lines.
- Not performed: any browser load, any click, `npm test`.

### Still yours, still untouched

Your `.env.local` keys and the DB audit re-run. Reminder of the trap:
**`.env.local` overrides `.env`**, so a stale key in `.env.local` silently wins
over a corrected one in `.env`.

### Suggested next session opener

> Steps 3-5 of docs/SALES_FUNNEL_EDITOR_REFACTOR_NEXT_SESSION.md. Step 2 is
> done. Do NOT re-read SalesFunnelEditor.tsx end to end — read only the region
> for the tab you are extracting, and re-derive its line numbers by searching
> for its `{tab === '…' && (` opener. Use a guarded `scripts/*.cjs` script for
> every edit to that file; `scripts/wire-sales-tab.cjs` is the working template.

---

## Session log - steps 3-5 (Offer tab, Leads tab, grouped nav)

Applied by scripts/wire-offer-and-nav.cjs in one guarded pass. SalesFunnelEditor.tsx: 1206 -> 914 lines. tsc --noEmit printed no error lines.

- build + links -> parts/OfferTab.tsx (165 + 12 lines collapse to a 33-line call site). Links is now a Collapse inside Offer and links is gone from the Tab union.
- leads -> parts/LeadsTab.tsx (27 -> 1).
- optin, vsl, checkout, success, access -> the pre-existing parts/PageTabs components (154 -> 5).
- The flat 14-button bar is now four group buttons (Offer, Pages, Chrome, Leads) plus a Pages sub-bar. tab stays the single source of truth and activeGroup is DERIVED from it, so setTab(optin) inside onGenerate still lights the right group with no extra state to keep in sync.
- SalesTab copy flipped from Build tab to Offer tab now that the rename actually landed.

Guard that earned its keep: before deleting an inline body the script diffs every label attribute in it against the destination file, and for the five page tabs it leaves the body inline if even one label is missing. All five passed, so no field silently lost edit access - tsc cannot catch that class of regression.

### Verified vs not verified

- Verified: typecheck clean, no stale tabs.map, no stale links region, import-block balance asserted.
- NOT verified: nothing rendered in a browser. The fourteen Collapse sections and the new two-row nav have never been clicked.

### Loose ends, highest value first

1. Regenerate semantics on the five PageTabs bodies: they receive busy set to (busy === generatePage) and no disabled prop, so the button is now clickable - not merely mislabelled - while another job runs. Pass the optional disabled prop RegenerateBar already supports: disabled set to (busy !== null).
2. The Chrome (footer) body is still inline on purpose: its content type name was never confirmed this session, and a structural stand-in is unsafe on a write path (setFooter). Extract it after reading the real type; the last local Field/Area/StatChip helpers die with it.
3. The Emails / kit-binding block stays in the always-mounted meta section, which is exactly why autobuild state cannot be unmounted mid-run. Leave it unless that changes.
4. The Media group from the original plan was not started.
5. Untouched as always: .env.local keys and the audit re-run.

# `/admin/sales-funnels` layout refactor — in progress

Continuation of Section 6 of `DB_MIGRATION_AUDIT_SYSTEM_PORT.md`. That section said
"read the file first." This session did that. This file is the map that came out of
the read, so the next window does not have to pay for it again.

**Status: step 1 of 5 complete and type-checking clean.** `SalesFunnelEditor.tsx`
is 1558 → 1395 lines and now imports `parts/UpsellTab`. `parts/ui.tsx` and
`parts/PageTabs.tsx` exist and compile but are **not imported yet** — they land in
steps 2–5. `npx tsc --noEmit` is clean as of this commit.

---

## 1. What landed

- **`parts/ui.tsx`** — `Field`, `Area`, `NumberField`, `StatChip` (lifted verbatim
  from lines 1547–1557), the style constants (`inputClass`, `labelClass`, `btn*`,
  `panelClass`), `linesToList` / `listToLines` (lines 84–85), plus two new pieces:
  - `Collapse` — collapsible subsection built on `<details>`. Chosen specifically
    because a closed `<details>` **keeps its children mounted** and lets the browser
    hide them, so half-typed text in a collapsed group cannot be lost.
  - `RegenerateBar` — the per-page "Regenerate this page" bar.
- **`parts/PageTabs.tsx`** — `OptinTab`, `VslTab`, `CheckoutTab`, `SuccessTab`,
  `AccessTab`. Field-for-field ports of the bodies at lines 973, 1213, 1240, 1281,
  1306. Every value is a prop; none of them hold state.

## 2. The finding that de-risks the rest

All editable content lives in `useState` in the shell, **lines 112–148** — `optin`,
`sales`, `vsl`, `checkout`, `upsell1..4`, `successBlock`, `access`, `footer`,
`intake`, and the meta/link scalars. The existing tab bodies are already pure
functions of that state (they only call `set*Field`).

Consequence: **unmounting an inactive tab cannot discard a draft**, because the draft
does not live in the tab. The trap named in Section 6 does not apply to these
sections, and the existing `{tab === 'x' && (...)}` conditional rendering can stay.

**The one real exception:** `EmailKitAutobuildPanel`
(`src/components/mothermode/sales/EmailKitAutobuildPanel.tsx`) owns
`plans`, `planError`, `busy`, `results`, `notice`. Its fetched plan list and build
results are local. If it is moved into a tab that unmounts, a completed autobuild
run silently vanishes on tab switch — and it re-fetches on `funnelId` change.
**Render the Emails panel always and hide it with a `hidden` class**, e.g.
`<div className={group === 'emails' ? '' : 'hidden'}>`, rather than
`{group === 'emails' && ...}`. This is the one place the CSS-visibility rule from
Section 6 is required rather than optional.

## 3. Section map (verified line numbers, current file)

| Line | Section | Target group |
| --- | --- | --- |
| 75 | `type Tab` — 14 flat values | split into `Group` + `PageTab` |
| 112–148 | all `useState` — stays in the shell | — |
| 808 | `tab === 'build'` — AI intake, brief, lead magnet, offer stack | Offer |
| 973 | `tab === 'optin'` | Pages → done (`OptinTab`) |
| 1013 | `tab === 'sales'` — **the big one, ~200 lines** | Pages, needs `Collapse` |
| 1213 | `tab === 'vsl'` | Pages → done (`VslTab`) |
| 1240 | `tab === 'checkout'` | Pages → done (`CheckoutTab`) |
| 1277–1280 | `upsell1..4` → already delegate to `UpsellTab` | Pages |
| 1281 | `tab === 'success'` | Pages → done (`SuccessTab`) |
| 1306 | `tab === 'access'` | Pages → done (`AccessTab`) |
| 1331 | `tab === 'footer'` | Chrome |
| 1340 | `tab === 'links'` — offer/leadgen/deliverable/product ids | Offer |
| 1352 | `tab === 'leads'` | Leads |
| 1384 | `function UpsellTab` — ~160 lines | move to `parts/UpsellTab.tsx` as-is |
| 1547–1557 | `Field` / `Area` / `StatChip` | delete, import from `parts/ui` |

Proposed grouping: **Pages** (optin, sales, vsl, checkout, upsell 1–4, success,
access) · **Offer** (build + links) · **Emails** (kit bindings + autobuild) ·
**Chrome** (footer) · **Media** · **Leads**.

`Media` is the only genuinely new panel: one place for `optin.coverImageUrl`,
`optin.heroVideoUrl`, `vsl.videoUrl`, `checkout.productImageUrl`,
`access.welcomeVideoUrl`, the sales hero/founder images, and each upsell's
`imageUrl` / `videoUrl` / `mediaVideoPoster` / `gallery`. Binding the same field in
two tabs is fine — both read the same shell state.

## 3a. Tooling constraint — read this before touching the shell

`replace_in_file` echoes the **entire updated file** back into the context on
success. For a 1557-line file that is ~30k tokens per edit, which is enough to
end a session in one call. Two consequences:

- Do the `SalesFunnelEditor.tsx` surgery **first**, in a fresh window, while
  there is room to absorb that echo — not last, after the parts are written.
- Or edit it with a throwaway `scripts/*.cjs` node script (the pattern already
  used all over this repo), which prints only what it changed.

The script route is what worked: `scripts/wire-upsell-tab.cjs` deleted the local
component and added the import in one write, asserting the region size and
content markers first so a mismatch aborts instead of half-applying.

**The trap it fell into, which will bite the next four steps identically:** it
anchored the new import to "the last line matching `/^import\b/`", but this file
uses multi-line `import {` blocks, so that matched the *opening* line of the
`aiIntake` block and the import landed *inside* it — `TS1003`/`TS1005` at line 44.
`scripts/fix-upsell-import-placement.cjs` moved it after the block's closing
`} from '...';`. When steps 2–5 add imports, anchor on a closing `} from '...';`
or on `'use client';`, never on `/^import/`.

## 4. Remaining steps

Do these one at a time and run `npx tsc --noEmit` after each. Each step is small
enough to verify, which is the point.

1. ~~`parts/UpsellTab.tsx` — move lines 1384–1544, wire the shell to it~~
   **DONE and type-checked.** The six `<h3>` groups are now `Collapse`
   subsections (first one `defaultOpen`). The four call sites (`upsell1..4`)
   needed no change — they already passed exactly these props. Note the line
   numbers in the table above are now off by ~163 for everything after 1384.
2. `parts/SalesTab.tsx` — move lines 1013–1212, wrapping its existing
   `<h3>`-delimited subsections in `Collapse`, first one `defaultOpen`.
3. `parts/OfferTab.tsx` — lines 808–972 plus the links block at 1340.
4. `parts/StudioTabs.tsx` — `ChromeTab` (1331), `LeadsTab` (1352), `MediaTab` (new),
   `EmailsTab` (kit bindings + `EmailKitAutobuildPanel`).
5. Rewrite `SalesFunnelEditor.tsx` as the shell: keep lines 1–~810 (state, loaders,
   handlers, meta card, save bar), replace `tab` with
   `group: Group` + `pageTab: PageTab`, render a group bar with a sub-bar inside
   Pages, then delete the inlined bodies and the local `Field`/`Area`/`StatChip`.
   Delete those locals in the **same** edit that adds the `parts/ui` import,
   otherwise there are two `Field`s in scope.

Watch for: `onGeneratePage(...)` / `onGenerate()` currently set `tab` directly
(e.g. jumping to `'optin'` after a build) — those calls must set the group too, or
the AI build will appear to do nothing.

## 5. Verified, and the one thing still open

`npx tsc --noEmit` is clean, so both of the previous session's worries are settled:

- The `paymentType` `<select>` passing `e.target.value` through the generic setter
  **compiles** — the field is typed loosely enough in `sales/types.ts`. Same
  pattern is therefore safe in `CheckoutTab`.
- `parts/ui.tsx` and `parts/PageTabs.tsx` compile, so their prop types line up
  with the shell's state types.

Still open (cosmetic, needs eyes not a compiler): `RegenerateBar`'s default label
is my wording, not the original copy. Check it against the inline bars at ~973 /
1213 / 1240 / 1281 / 1306 and pass `label` if it differed per page. A typecheck
cannot catch wrong button text.

Not yet verified by running the app: the `Collapse` behaviour. Worth doing on the
first upsell tab before repeating the pattern four more times — type in a field
inside a group, collapse it, reopen, confirm the text is still there.

## 6. Verification (from Section 6, unchanged)

Edit a field in every tab, switch away, switch back, confirm the edit survived.
Then save and reload and confirm it persisted. Specifically for Emails: start an
autobuild, switch tabs mid-run, come back, confirm the results are still listed —
that is the regression the `hidden` class exists to prevent.

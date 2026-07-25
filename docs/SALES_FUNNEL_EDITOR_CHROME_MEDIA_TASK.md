# Sales Funnel Editor — Chrome extraction, Media group, browser verification

Next session's task doc. Continues the decomposition described in
`SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md`. Steps 1–6 are done (Upsell, Sales,
Offer/Leads/PageTabs + grouped nav, Emails group). This covers the remaining gaps.

**Read the port doc §5 before writing any script.** Every rule there was learned from
a failure, and §5.1 (`replace_in_file` is banned on `SalesFunnelEditor.tsx`) is
non-negotiable — the echo alone can end a session.

Current shell: `src/app/admin/sales-funnels/SalesFunnelEditor.tsx`, 1059 lines.

---

## Task A — Browser verification (do this FIRST, before any new code)

Nothing from steps 1–6 has been exercised in a browser. `tsc --noEmit` is clean, and
that is not the same claim. Doing this first means any breakage found belongs to work
already described in the port doc, rather than being tangled with new edits.

```
npx next dev   →   /admin/sales-funnels
```

Checklist, in order of how badly a failure would hurt:

1. **State survival.** Type into a field on `Sales`, switch to `Offer`, switch back.
   The text must still be there. Repeat for one `PageTabs` body (`Opt-in`) and one
   `UpsellTab` slot. This is the invariant the whole refactor rests on — parts are
   stateless, the shell owns every value. If this fails, stop and fix before anything
   else.
2. **Autobuild survives a tab switch.** Emails → Kits → start an autobuild, switch to
   `Analytics` and back while it runs. The run must not reset. This is the specific
   regression §6.1 was written to prevent, and `tsc` cannot see it.
3. **Nav grouping.** All five groups (`Offer | Pages | Emails | Chrome | Leads`)
   select; sub-bars appear for `Pages` and `Emails`. Then click `Generate` — it ends
   with `setTab('optin')`, so the `Pages` group must light up on its own (`activeGroup`
   is derived, not stored).
4. **Every `Collapse` opens.** Fourteen of them, four in `Offer` alone. A collapsed
   section that never opens looks identical to a working one until someone needs it.
5. **One page regeneration**, and confirm the other four Regenerate buttons go disabled
   while it runs (the gap closed by `fix-page-regen-disabled.cjs`).
6. Save, reload, confirm persistence.

Log anything found in this file rather than fixing it silently.

## Task B — Extract the Chrome/footer body

This was gap #2 and was blocked on an unknown type name. **That is now resolved** —
verified in the shell:

- State: `const [footer, setFooter] = useState<SalesFooterContent>(defaultMotherModeSalesFooter());` (line 154)
- Type `SalesFooterContent` and `defaultMotherModeSalesFooter()` are already imported.
- Body: `{tab === 'footer' && (` at line 1033, ~9 lines — a checkbox (`footer.enabled`)
  plus `Field`/`Area` calls (`Brand line`, `disclaimer`, others — enumerate them).
- Group: `{ id: 'chrome', label: 'Chrome', tabs: ['footer'] }` (line 866).

Note there is **no** `setHeader` in this file — `grep setHeader` returns zero. "Chrome"
is footer-only despite the group name. Do not invent a header tab; if one is wanted
that is a separate feature, not an extraction.

Create `parts/ChromeTab.tsx`, stateless, following the **page-tab** props shape from
port doc §3:

```ts
{ footer: SalesFooterContent; setField: <K extends keyof SalesFooterContent>(k: K, v: SalesFooterContent[K]) => void }
```

Import `SalesFooterContent` from the same module the shell imports it from — do **not**
declare a structural stand-in. Port doc §3 explains why: a loose shape is safe on a
read-only path (`LeadRow`) but unsound around a `setState` updater, where the type must
be assignable in both directions. This is the reason the footer was skipped originally;
don't reintroduce it.

Then delete the three now-unused shell-local primitives — `Field` (1048), `Area`
(1052), `StatChip` (1056). **`StatChip` needs checking first:** the readiness chips
(line ~533) may still use it, in which case it moves to `parts/ui.tsx` rather than
being deleted, and the port doc's hedge about it gets resolved either way.

Script: `scripts/wire-chrome-tab.cjs`. Must apply the §5 rules, in particular the
**field-label guard** (rule 6): diff every `label="…"` in the inline body against
`ChromeTab.tsx` and abort writing nothing if any is missing. The footer checkbox has no
`label=` attribute, so guard it explicitly by name too — a lost `enabled` toggle means
the footer silently can't be turned off.

## Task C — Media group

Never started. Scope it before building: find what media controls exist today
(`FunnelMediaStudio`, the bulk-image handlers, `onGenerateImages`) and where they
currently live. This is a **new grouping of existing controls**, so treat it as a nav
change plus an extraction, not a feature. If it turns out the controls are scattered
across page tabs and moving them changes behaviour, write that finding down and stop —
regrouping something that works is not worth a regression.

## Definition of done

- [ ] Task A walked in a browser, findings logged here
- [ ] `parts/ChromeTab.tsx` exists, stateless, real `SalesFooterContent` import
- [ ] Shell-local `Field` / `Area` gone; `StatChip` resolved (moved or deleted)
- [ ] `tsc --noEmit` clean
- [ ] Footer verified in browser: toggle `enabled`, edit both text fields, save, reload
- [ ] Port doc updated — gaps 2/4 closed, new script listed in §5, line count corrected
- [ ] A follow-up task doc if Task C is deferred

Do not claim completion on `tsc` alone. The failure mode this refactor keeps producing
is a control that compiles and renders but is no longer wired to anything.

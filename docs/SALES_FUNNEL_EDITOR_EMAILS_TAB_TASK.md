# Task — Emails group for the Sales Funnel editor

Move the email-kit binding and the email analytics out of the always-mounted meta
section of `src/app/admin/sales-funnels/SalesFunnelEditor.tsx` and into their own
navigation group.

Read `SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md` first — this task follows the
same shell/parts split, the same props contracts, and the same scripting rules.

---

## Target shape

```
Offer | Pages | Emails | Chrome | Leads
                Kits  Analytics
```

`Emails` is a group with two sub-tabs, mirroring `Pages`. Rationale for a group
rather than two top-level tabs: it holds the top bar at five items, and the
analytics in question *are* email-flow analytics, so they are not a peer of
`Offer`. Add `'emails'` and `'emailStats'` to the `Tab` union and to the `GROUPS`
table; `activeGroup` stays **derived**, never stored.

## Do this first, or the task creates a bug

**The autobuild panel holds in-flight run state and is currently always-mounted.
That is why it survives today, not an accident.** The nav unmounts a tab on every
switch. So moving the panel as-is buys a regression that `tsc` cannot see and that
looks fine on a click-through: start an autobuild, switch tabs, and the panel
unmounts while the server-side job keeps running — the UI can no longer report the
result.

Order of operations:

1. Lift the autobuild run state (and any polling/interval handle) out of
   `EmailKitAutobuildPanel` into the shell, passing it down as props. Same
   invariant as every other part: **state lives in the shell, parts are stateless.**
2. Only then move the panel into the new `Kits` sub-tab.
3. Verify by starting a run, switching to another tab, and switching back — the run
   must still be reported. This is a manual check; nothing automated covers it.

Analytics has no such constraint (read-only stats fetch) and can move immediately.
Moving it is a small win: its fetch becomes lazy on tab open instead of firing on
every editor load.

## Procedure

Apply with a guarded Node script in `scripts/`, not `replace_in_file` — the shell
file is large enough that the echo alone can end a session. Reuse the rules from
`wire-offer-and-nav.cjs`:

- Locate regions by their `{tab === '…' && (` opener / matching `)}` at the same
  indent. Never count lines.
- Abort writing **nothing** on any surprise (missing opener/closer, unexpected tab
  bar shape, unbalanced import block).
- Anchor new imports on a specific single-line import, never on `/^import\b/`.
- Re-running must be a no-op: check for your own marker first.
- **Field-label guard:** diff every `label="…"` in the region being deleted against
  the destination component; if any label is missing, keep the inline body and log
  it. A field that loses its editor is invisible to `tsc`.

## Definition of done

- [ ] Autobuild state lifted to the shell; `EmailKitAutobuildPanel` stateless
- [ ] `parts/EmailsTab.tsx` + `parts/EmailStatsTab.tsx`, both stateless
- [ ] `Emails` group with `Kits` / `Analytics` sub-tabs; `activeGroup` still derived
- [ ] `tsc --noEmit` clean
- [ ] Manual: autobuild survives a tab switch mid-run
- [ ] Manual: analytics still populates when its tab is opened

## Related loose ends (cheap, do them while you are in here)

- The five `PageTabs` bodies get `busy={busy === 'generatePage'}` and no
  `disabled`, so their Regenerate button is clickable while another job runs. Pass
  the `disabled` prop `RegenerateBar` already supports: `disabled={busy !== null}`.
- The Chrome/footer body is still inline; its content type name was never
  confirmed, and a structural stand-in is unsafe on a `setFooter` write path. Read
  the real type before extracting it.
- Nothing in this editor has been exercised in a browser yet. The two-column field
  layout was just fixed in `parts/ui.tsx` (`min-w-0`) and still needs a visual
  confirmation.

---

## Status: DONE

Shipped via scripts/wire-emails-tab.cjs (Emails group + parts/EmailsTab.tsx +
parts/EmailStatsTab.tsx) and scripts/fix-page-regen-disabled.cjs (the PageTabs
disabled loose end). 	sc --noEmit clean.

One thing worth carrying forward: EmailKitAutobuildPanel had to be made stateless
*before* the move, because it only survived a tab switch by virtue of living in an
always-mounted section. Its run state now lives in the shell. See
SALES_FUNNEL_EDITOR_REFACTOR_SYSTEM_PORT.md §6.1.

Still unverified in a browser: switch to Emails mid-autobuild and confirm the run
survives; click both sub-tabs.

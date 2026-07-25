# DB Migration Audit + Admin Layout — System Port

Covers the migration-drift tooling built while chasing "Could not find the table
'public.mothermode_lead_gen_kits' in the schema cache", the multi-project
mixup that made those errors unreproducible, and the outstanding
`/admin/sales-funnels` layout work.

---

## 1. The bug this tooling exists for

PostgREST reports a table that was never created as:

```
Could not find the table 'public.X' in the schema cache
```

That message reads like a stale-cache problem. It almost never is. It means the
migration declaring that table was never applied to the database you are
pointed at. The old workflow was to discover this one feature at a time, as
each admin page 500'd, and to "fix" it by reloading the schema cache — which
does nothing, because the relation genuinely does not exist.

---

## 2. `scripts/db-table-audit.cjs`

Diffs tables declared in `supabase/migrations/*.sql` against tables that
actually exist in the live database. Read-only: probes each table with
`select=*&limit=0` and never writes.

```
node scripts/db-table-audit.cjs
```

**Classification**

| Result | Meaning |
| --- | --- |
| `200` | present |
| `404`, or body matching `PGRST205\|does not exist\|schema cache` | missing |
| `401` / `403` | **aborts the whole run** (see below) |
| anything else | inconclusive, listed individually |

**Why 401/403 aborts.** An auth failure means the script never got to ask the
database anything. The first version bucketed those 44 failures as
"inconclusive" and printed them *below* a summary that read:

```
Tables declared:    44
Present in DB:      0
MISSING from DB:    0
```

Which scans as "nothing is missing" when in fact nothing had been checked. It
now exits(2) on the first 401/403 with the specific cause, and the summary
always prints `Target project:` and `INCONCLUSIVE:` so a wrong-project or
wrong-key run is visible in the first three lines instead of the last forty.

**Output.** Groups missing tables by the migration file that creates them —
the file is the unit you actually apply — and writes
`supabase/_pending.json` (`missingTables`, `presentTables`, `missingFiles`)
as machine-readable input for the bundler.

---

## 3. `scripts/build-migration-bundle.cjs`

Reads `_pending.json` and concatenates *only* the migrations containing missing
tables into `supabase/_bundle_pending.sql`, for pasting into the SQL Editor.

Two properties that matter:

- **Exactly what's missing**, not "everything after some date." Re-running an
  already-applied migration is how you get spurious conflicts.
- **Idempotent.** `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before
  each `CREATE POLICY`, guarded `CREATE INDEX`. Policies are the sharp edge:
  Postgres has no `CREATE POLICY IF NOT EXISTS`, so an unguarded bundle dies
  partway with `policy ... already exists` and leaves you unsure how much
  applied. The bundle is safe to run repeatedly.

Both files are gitignored (`supabase/_pending.json`,
`supabase/_bundle_pending.sql`) — they are generated snapshots of one
database's state, not source.

---

## 4. The multi-project trap (root cause of the confusing session)

Symptom: the SQL Editor said `relation "integrations" already exists` while the
audit, run seconds later, insisted 25 tables were missing. Both were true.
There were two Supabase projects:

```
.env        -> vxnikdhgwmcmvanqjeug
.env.local  -> fljnvfwyymrivsypnpea
```

`.env.local` takes precedence in Next.js, and `loadEnv()` in the audit script
mirrors that order deliberately (`.env.local` first, then `.env`, first value
wins) so the audit always describes the same database the app talks to. The SQL
had been pasted into the *other* project.

**Then a second instance of the same class of bug:** the URL in `.env.local`
was updated to the intended project but `SUPABASE_SERVICE_ROLE_KEY` was left
behind, producing `401 Invalid API key` on all 44 probes. Supabase keys are
per-project. Changing `NEXT_PUBLIC_SUPABASE_URL` requires replacing the `anon`
and `service_role` keys from that same project's Settings → API.

**Standing hazard.** Two projects with diverging schemas means "works locally"
carries no information about production. Check which ref the Vercel environment
variables use. If one project is dead, delete its credentials outright — that
removes the failure mode rather than documenting it.

---

## 5. Runbook

```bash
node scripts/db-table-audit.cjs        # what's missing (aborts loudly on auth failure)
node scripts/build-migration-bundle.cjs # -> supabase/_bundle_pending.sql
# paste into SQL Editor for the project printed as "Target project:", Run
node scripts/db-table-audit.cjs        # expect MISSING: 0, INCONCLUSIVE: 0
```

---

## 6. OUTSTANDING: `/admin/sales-funnels` page length

**Status: in progress — see `docs/SALES_FUNNEL_EDITOR_LAYOUT_REFACTOR.md`.**
The file has now been read end to end and mapped; the shared primitives and five
of the page tabs are extracted under `src/app/admin/sales-funnels/parts/`.
`SalesFunnelEditor.tsx` itself is still untouched, so the editor is unchanged and
the new files are not yet imported. The remaining steps, the verified line-number
map, and the state-ownership audit are in that file. Read it instead of re-reading
the 1557-line component.

Two findings worth promoting here, because they change the plan below:

- Every draft value lives in `useState` in the shell (lines 112–148), so
  unmounting an inactive tab **cannot** lose an edit. The warning in step 2 below
  turned out not to apply to these sections.
- It does apply to exactly one child: `EmailKitAutobuildPanel` owns its plan list
  and build results locally, so the Emails panel must stay mounted and be hidden
  with CSS.

Original notes follow.

Raised repeatedly, never addressed, and now worse — the
Email Kits autobuild panel was added to the same editor, so the column is
longer than when it was first reported.

`src/app/admin/sales-funnels/SalesFunnelEditor.tsx` is **1557 lines / ~100KB**,
one uninterrupted vertical stack. Every section renders at once: funnel meta,
theme, sales page copy, offer stack, bonuses, proof, VSL, checkout, four
upsells, success/access, chrome (header/footer), media studio, and now email
kits.

This was deliberately **not** attempted in a nearly-full context window.
Restructuring it means relocating large JSX regions, which cannot be done
safely by pattern-matching a file that hasn't been read end to end. A blind
edit here risks breaking a working editor across every funnel page.

**Plan for a fresh window:**

1. Read the file fully first. Map the top-level section boundaries in the
   returned JSX and the state each section touches.
2. Add a tab bar for the coarse split — likely `Pages`, `Offer`, `Emails`,
   `Chrome`, `Media`. Keep all sections mounted if any hold unsaved local state
   and toggle visibility with CSS; only unmount if state is confirmed lifted or
   persisted. Unmounting a section that owns draft edits will silently discard
   them on tab switch.
3. Within the busiest tab, wrap subsections in a collapsible with the first one
   open by default.
4. Verify: edit a field in each tab, switch tabs, switch back, confirm the edit
   survives; then save and confirm it persists.

Prefer extracting each tab's body into its own component file as you go — a
1557-line client component is the reason this is expensive to change at all,
and splitting it is the fix that stops it recurring.

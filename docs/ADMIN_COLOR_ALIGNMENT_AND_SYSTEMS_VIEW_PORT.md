# Admin Color Alignment, Systems View & Nav — System Port

Covers three threads that landed together across the last two sessions, plus the
follow-on manual admin palette sweep:

1. **Color alignment** — every admin shell now speaks one palette (codemods first, then a repo-wide manual sweep across the remaining admin surfaces).
2. **Systems view** — a new Asset Hub tab that answers "is this offer a finished system?"
3. **Admin nav** — the sidebar that routes to all of it.

---

## 1. Color alignment

### The palette

Tokens live in `tailwind.config.js`. Nothing in admin should reference a raw
Tailwind color anymore:

| Token       | Role                                            |
| ----------- | ----------------------------------------------- |
| `ink`       | Page/base dark. Warmer + lighter than `black`.  |
| `mode`      | Brand aubergine. Lifted surfaces inside a card. |
| `mode-deep` | Burgundy. Card gradient origin.                 |
| `bone`      | Text + hairline borders, always at an opacity.  |
| `brass`     | The single accent: emphasis, active, primary.   |

**The card shell** (one string, memorize it):

```
rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-<n>
```

### Two codemods, because there were two problems

`scripts/apply-burgundy-cards.cjs` — **card swap.** Finds shells that already
speak the palette (`border-bone/10|15` **and** `rounded-xl|2xl`) and promotes
them to the burgundy treatment. Result: **10 files, 29 shells.**

`scripts/apply-palette-migration.cjs` — **token migration.** For files the first
codemod could never match, for two distinct reasons:

- **`PlannerWorkspace.tsx`** was never themed at all — raw `neutral-800` /
  `bg-neutral-900` / `text-neutral-400` and plain `rounded`. No bone token, no
  `xl` radius, so the burgundy matcher scored zero hits on 590 lines.
- **`courses` / `course-access`** — their `page.tsx` files are 18-line wrappers
  that render a heading and delegate to `src/components/admin/CoursesPanel.tsx` /
  `CourseAccessPanel.tsx`. The burgundy `TARGETS` only ever scanned
  `src/app/admin/**`, so the real shells were never visited. And they turned out
  to be *legacy* admin palette (`border-white/10`, `bg-black/30`, `bg-amber-500`)
  rather than bone either.

Hence two rule tables (`GREY_RULES`, `LEGACY_RULES`) rather than one: the planner
and the course panels were speaking different dialects, and a single table would
have needed contradictory mappings for the same input.

Greys are mapped **by role, not by number** — `neutral-400` is secondary body
text so it becomes `bone/50`, while `neutral-500` (quietest label) becomes
`bone/40`. Variant-prefixed classes are ordered before their bare forms so
`hover:text-neutral-200` doesn't get rewritten twice.

### What is deliberately *not* a card

After the token pass, a shell is promoted only with a brand border **+** rounding
**+** its own padding. That skips, on purpose:

- buttons/pills (`px-3 py-1`, no `p-*`)
- bare dividers (`border-b`, no rounding)
- inputs/popovers/dropdowns — `rounded-lg` is the *control* radius in this
  design; cards are `rounded-xl`
- modal shells — they keep an opaque fill (`from-mode-deep to-ink`), because a
  translucent gradient lets the page bleed through the dialog
- empty states — they keep the quiet flat fill (`bg-bone/[0.02]`) used by
  `SystemsPanel`, since a confident burgundy card that says "nothing here" reads
  as broken content rather than as an empty list

### Deliberate exception

`text-amber-400` survives in `PlannerWorkspace` — it's the over-capacity warning
(`over ? 'text-amber-400' : 'text-bone/40'` on the per-column card count). Amber
is carrying **semantics** there, not brand. Mapping it to brass would make "you
are over your weekly limit" render identically to ordinary accent text and
silently delete the signal. `EmailInsightsPanel` uses warning amber the same way.
It's recorded in the script's `ALLOWED` set so the leftover scan stays green
without hiding real drift.

### Gotcha worth remembering: multi-line template literals

Three shells survived the first migration run and looked like a rule gap. They
weren't. The matcher only walked **single-line quoted strings** — its body
pattern excludes newlines, so an unclosed backtick never matched:

```tsx
className={`min-h-[84px] rounded border border-neutral-800 p-1 ${
  dim ? 'opacity-40' : ''
}`}
```

The class fragment lives on the *opening line of a template literal*, which was
simply unreachable. Fix was pass 2 in `apply-palette-migration.cjs`: match
`/(className=\{`)([^`\n]*)$/gm` and migrate the head fragment. Matching
line-by-line keeps backtick pairing unambiguous — it never tries to span
`${...}` expressions, which can themselves contain nested template literals.

**If a class string is ever missed again, check whether it's inside a multi-line
template literal before adding rules.**

### Verification

```
node scripts/apply-palette-migration.cjs          # dry run + leftover scan
node scripts/apply-palette-migration.cjs --write   # apply
```

Both codemods are **idempotent** — a second `--write` reports `0` changes,
because promoted shells no longer match the legacy matcher. After that pass, a
manual repo-wide sweep finished the remaining admin/editor surfaces that the
targeted codemods did not cover (`community`, `high-ticket`, `brand-bible`,
`deliverables`, `help`, `lead-gen`, courses/licenses/funnels/receipt/email,
customers/products/subscriptions/stripe, and shared admin components).

Current validation:

- repo-wide scan across `src/app/admin/**` and `src/components/admin/**` for raw
  Tailwind color tokens is clean except for deliberate customer-preview HTML
  strings in `DeliverablesEditor` and `HelpEditor`
- `npx tsc --noEmit` ✅
- `npx vitest run` ✅ — **84 test files, 812 tests passed**

---

## 2. Systems view (Asset Hub)

`src/lib/mothermode/assets/systems.ts` (pure, DB-free, unit-testable) +
`src/app/admin/assets/SystemsPanel.tsx`, wired into `AssetsWorkspace.tsx`.

**Why it exists.** Every other tab answers "what assets of kind X exist?" This
one answers the question an operator actually asks: *is this offer a finished
system?* It regroups the bundle by the thing an asset belongs to, so a funnel,
its pages, the sequences that fire from it, the posts and ads pointing at it, and
the deliverable it hands over read as **one row** instead of being scattered
across seven tabs.

**Grouping** — `systemKeyOf()`: `offerSlug` → else `funnelSlug` → else
`UNASSIGNED_SYSTEM_ID`. Offer wins because one offer can own several funnels, and
operators think in offers ("is Brain Dump finished?") before funnels.

This only became possible once `./attribution` closed the sequence gap: email
kits live on their own table and carried no `offerSlug`/`funnelSlug`, so grouping
them was impossible. Kits still bound to nothing are grouped as **unassigned
rather than guessed** into a system.

**Seven buckets** in fixed display order (`SYSTEM_BUCKETS` is the single source
of truth for the UI): funnels, pages, sequences, organic, ads, deliverables,
kits. `BUCKET_OF_KIND` maps asset kind → bucket; kinds left out aren't part of a
system. The **catalog group (`page`/`blueprint`) is excluded on purpose** — those
rows describe the app's own builders and roadmap, not a customer-facing system,
and folding them in would bury the unassigned bucket in noise.

**Completeness.** `missing` lists fully-empty buckets so a card can say "no
sequences, no ads" instead of making the operator diff seven counts. It's always
empty for the unassigned group — that's a leftovers pile, not a system to finish.

**Labels.** A single-funnel system reads under the funnel's own title; an offer
with several funnels gets `titleizeSlug(id)` so no one funnel claims the group.

**Ranking** (`compareSystems`) matches how an operator triages: revenue desc →
total desc → label asc for stability. Unassigned always sorts last; it's the
inbox, not a priority.

**Filtering.** `filterSystems()` re-derives each system from the surviving items
so the shared search + status bar works here too. Counts, `rollup` and `missing`
are **recomputed** from what survived rather than carried over from the
unfiltered pass — otherwise a filtered view would claim a system is complete on
the strength of hidden rows.

**Metrics.** Each system carries `rollup: FunnelRollup` from
`rollupFunnels(buckets.funnels)` — funnels only, because pages carry no metrics.
`systemsSummary()` feeds the tab header: total systems, complete count,
unassigned item count.

**Wiring note.** `AssetsWorkspace.tsx` keys tab counts as
`Record<AssetTabId, number>`, so adding the tab meant extending `AssetTabId` and
supplying a count for the new key — that map is exhaustive by type, and it will
fail the build rather than silently render a blank badge if a future tab skips
it.

---

## 3. Admin nav

`src/app/admin/AdminSidebar.tsx` — one flat `NAV` array of
`{ href, label }`, rendered as a sticky rail (`lg:sticky lg:top-10`) that
degrades to a horizontally scrolling strip on small screens
(`flex-row lg:flex-col overflow-x-auto`).

Ordering is intentional: **build** (Asset Hub, Content Hub, Brand/Brand Bible,
kits) → **sell** (Lead Gen Funnels, Sales Funnels, Funnel Stats, Planner) →
**operate** (Purchases, Subscriptions, Customers, Products, Courses, Course
Access, analytics, Licenses, Integrations, Stripe).

Active state uses `pathname.startsWith(href)` with an **exact match special-cased
for `/admin`** — without that, Overview would light up on every single admin
page. Active is a brass pill (`bg-brass/[0.12] text-brass border-brass/25`);
inactive keeps a `border-transparent` so the row doesn't shift by 1px when it
becomes active.

---

## Files

**Color alignment**

- `scripts/apply-burgundy-cards.cjs` — card swap (10 files / 29 shells)
- `scripts/apply-palette-migration.cjs` — token migration + leftover scan
- `scripts/audit-burgundy-cards.cjs`, `scripts/inspect-flat-cards.cjs` — audits
- `src/app/admin/planner/PlannerWorkspace.tsx`
- plus the follow-on sweep across remaining admin surfaces and shared admin
  components (`community`, `high-ticket`, `brand-bible`, `deliverables`,
  `help`, `lead-gen`, `email-marketing`, `email-templates`, `funnels`,
  `sales-funnels`, `receipt-log`, `subscriptions`, `stripe`, `customers`,
  `products`, `courses`, `licenses`, and related shared panels/modals)

**Systems view**

- `src/lib/mothermode/assets/systems.ts`, `metrics.ts`, `attribution.ts`
- `src/app/admin/assets/SystemsPanel.tsx`, `AssetsWorkspace.tsx`

**Nav**

- `src/app/admin/AdminSidebar.tsx`

---

## Known gaps / next

- **Nav grouping is cosmetic in source only.** The blank lines between nav
  clusters in `NAV` don't render as separators — the list reads as one flat run
  of ~28 links. If the grouping matters visually it needs real section headers.
- **The codemods still don't enforce this automatically for every future file.**
  The repo is clean now, but a newly added admin file can still reintroduce raw
  Tailwind colors unless the scan is widened or enforced via linting.
- **Scope was admin-only.** Public/funnel surfaces (`src/components/mothermode/**`,
  `src/app/funnel/**`, `src/app/optin/**`) were never in `TARGETS` and were not
  audited this session. Before anyone proposes a repo-wide ban on raw Tailwind
  colors, run an audit over those trees first — the legacy amber accent very
  likely still lives there, and a blanket rule would rewrite customer-facing
  pages that nobody has design-reviewed. **Unverified — do not assume either way.**
- **Preview HTML strings are intentionally exempt.** `DeliverablesEditor` and
  `HelpEditor` still embed literal customer-facing preview colors inside iframe
  `srcDoc` HTML. Those are not admin Tailwind classes and were left alone.

- **Environment note:** inline `node -e` reliably mangles quotes and `[` under
  this PowerShell setup. Write a `.cjs` and run it. Chain commands with `;`, not
  `&&`.


## 2026-08-07 sweep — scripts/theme-dark-sweep.cjs
The reusable token sweeper: light Tailwind tokens (bg-white, text-ink, border-ink, light red/emerald/amber chips, brass-button text-white→text-ink) → the dark house palette. Ran over personalization, experts, recipes (+editor +run detail), skills, media-library, and the ai-twins roster was hand-styled the same round. Re-run it on any page that still shows light cards.


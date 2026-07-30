# Funnel Ascension Architecture — system port

Three modules, all pure and self-contained:

- `src/lib/mothermode/sales/ascension.ts` — the upsell ladder as an outcome
  timeline, with validation, elasticity, and AOV projection.
- `src/lib/mothermode/sales/funnelMap.ts` — the funnel as a graph of pages,
  decisions and emails, rendered to Mermaid or plain text.
- `src/lib/mothermode/sales/intakeAscension.ts` — the adapter that turns a real
  `SalesAiIntake` into `AscensionRung[]`, reporting every value it had to infer.

Tests: `tests/lib/sales-ascension.test.ts`,
`tests/lib/sales-intake-ascension.test.ts`.

## The rule the ladder enforces

Not "each upsell costs more". Each rung must move the buyer forward on the
**outcome timeline of their market**:

| Rung | Horizon |
| --- | --- |
| Front end | The problem they have today |
| OTO 1 | What happens in the next 30-90 days |
| OTO 2 | What happens over the next 1-5 years |
| OTO 3 | Done for them / leverage |

Trade-offs happen on outcomes, never on features or benefits. Escalation is
recorded on four axes — `bigger`, `faster`, `stronger`, `doneForYou` — the
concrete forms of maximize output / minimize input / simplify process. A rung
that raises price without moving on an axis is a second front end wearing a
higher price, and `validateAscension` says so in those words.

`ARCHETYPE_LADDERS` ships 17 reference timelines (weight loss, dating, pain
relief, parenting, MLM, SaaS, dog training, consulting, eldercare, survival,
bizop, and so on). They are outcome timelines, not product lists — format and
price are chosen afterward from the anchors (book $37, course $97, software
$497).

## What `validateAscension` catches

`price-not-ascending`, `no-escalation`, `duplicate-outcome`, `missing-outcome`,
`exceeds-elasticity`, `downsell-not-cheaper`, `stage-out-of-order`. An empty
array means the ladder actually ascends.

## Elasticity and AOV

Upsell elasticity runs to roughly 100x the front-end price. Doubling a price
costs about 28% of conversion and adds 100% of revenue, so the deciding number
is **AOV contribution (price × conversion)**, never conversion rate alone.
`projectAov` returns per-rung contribution; `compareDownsellPlacements` scores
all three structures against the same ladder.

The asymmetry the model encodes, from the source material: an **inline**
downsell earns its own small conversion but depresses every upsell after it
(OTO2 falls 14% → 8%, OTO3 13% → 3%), because it spends decisions early.
Moving downsells **after** the upsell path keeps the upsell rates intact and
still recovers decliners. The test `prefers downsells after the path over
downsells inline` pins that ordering.

## The map

`buildFunnelMap` emits nodes (ad → advertorial → opt-in → VSL → sales →
checkout → upsells/downsells → success → access) plus edges, with `reach`
modelling attention decay and `branch: 'yes' | 'no'` on decisions. Emails
attach to **events**, not pages, so a page can be renamed or reordered without
orphaning its sequence; `orphanedEmails` reports any email bound to an event
nothing emits. `toMermaid` produces a flowchart that renders in GitHub and
most doc tools; `toAsciiMap` is the plain-text fallback.

## The intake adapter

`intakeAscension.ts` is the bridge that gives the model a real funnel to read.
`SalesAiIntake` stores flat `upsell1Name`/`upsell1Price` pairs with no `outcome`
and no `escalates`, so the adapter has to *derive* both rather than copy them:

- `parseIntakePrice` accepts `"$97"`, `"97/mo"`, `"1,997"`, `"free"` and returns
  a number, or `null` when the field is blank or unparseable. It never guesses a
  price — an unparseable non-empty value raises a `price-unparsed` note so the
  operator sees it instead of silently getting `$0`.
- `inferEscalationAxes` matches the name and description against
  `ESCALATION_KEYWORDS` on **word boundaries**, so "done-for-you" implies
  `speed` + `effort` while a word like "everything" no longer trips the `every`
  stem. When nothing matches it returns `[]` and emits `escalation-unknown`
  rather than inventing an axis — an empty `escalates` is exactly what
  `validateAscension` flags as `no-escalation`, which is the honest result.
- `outcome` falls back to the rung name when the intake has no outcome text, and
  records an `outcome-inferred` note. The fallback keeps the ladder validatable;
  the note keeps it from looking authored.

`intakeToAscension` returns `{ rungs, notes }`, never throwing on a half-filled
intake: blank upsell slots are skipped, so a funnel with only `upsell1` and
`upsell3` yields two rungs, not three with a hole. `auditIntakeFunnel` composes
the adapter with `validateAscension` so one call turns raw intake into the
ladder, the derivation notes, and the validator issues.
`buildFunnelMapFromIntake` does the same for the map.

The notes are the point. Every value the adapter had to infer is reported, so a
`no-escalation` issue on a real funnel can be traced back to "the intake never
said how this rung escalates" rather than to a bug in the validator.

## The Architecture tab

`src/app/admin/sales-funnels/parts/ArchitectureTab.tsx` is the surface that
finally calls the audit. It sits in the editor's **Offer** group, beside the
tab where the intake is actually typed, so a verdict and its cause are one
click apart. `SalesFunnelEditor` renders it as
`{tab === 'architecture' && <ArchitectureTab intake={intake} />}` — it receives
the same live `intake` object the Offer tab edits, so editing a price and
returning re-derives the ladder with no save step in between.

The panel is read-only and stateless by design. It runs `auditIntakeFunnel` in
a `useMemo` over the intake and renders four things: the derived rungs with
their prices and escalation axes, the validator issues in plain language
(`ISSUE_LABEL`), the adapter's derivation notes (`NOTE_LABEL`) kept visually
distinct from issues because an inferred value is not a funnel defect, and the
`toAsciiMap` view of the funnel with `orphanedEmails` called out. Nothing on
the screen writes: it reads the operator's own words back and says what the
ladder does and does not support. If a verdict looks wrong, the fix is in the
Offer tab.

Separating the labels from the codes is the part that matters. `no-escalation`
reads as "Nothing escalates" and `escalation-unstated` reads as "Wording named
no escalation", so the operator can tell the difference between *the ladder is
broken* and *the intake never said*. That distinction is exactly what the notes
were built to carry, and it survives to the screen.

## Verification

`npx vitest run tests/lib/sales-ascension.test.ts tests/lib/sales-intake-ascension.test.ts`
— **51 passed, 0 failed** (vitest 4.1.8), of which the intake adapter suite
contributes 20: price parsing across currency/suffix/comma/free/blank forms,
keyword inference including the word-boundary case, the skip-blank-slots case,
each note code, and the end-to-end audit.

The original ascension suite alone is **31 passed, 0 failed**. Coverage: all
seven validator codes, the AOV arithmetic
(`$97 × 0.15 = $14.55`), the inline-vs-after ordering, archetype selection and
fallback, the suggested ladder passing its own validator, elasticity clamping,
map layout and attention decay, both downsell placements, email-to-event
binding, orphan detection, and both renderers. `npx tsc --noEmit` reports no
errors in any of the three modules.

Note the repo as a whole is **not** green — 6 pre-existing suites fail
(Stripe/receipt/webhook infra plus two content-hub logic tests), unrelated to
and untouched by this work.

The tab wiring is checked structurally by `node scripts/verify-architecture-tab.cjs`,
which asserts each anchor actually landed — the `Tab` union carries
`'architecture'`, the import resolves, `OFFER_TABS` drives the Offer group and
its sub-nav, the panel is rendered with `intake`, and the file exists — then
runs `tsc --noEmit` and splits the error count into whole-repo versus the
touched modules. Current output: **7/7 checks pass, 0 tsc errors repo-wide**.

What that script does *not* prove: it never mounts the component. No test
renders `ArchitectureTab` and asserts the issues appear on screen, so "the audit
runs in the browser" rests on the type-checked call site and a manual look, not
on an automated assertion.

## Honestly outstanding

- **No render test covers the tab.** `auditIntakeFunnel` is now called by
  `ArchitectureTab`, so an operator's funnel is validated in practice — but the
  50-odd tests all exercise the library, not the panel. A regression that broke
  the rendering while leaving the adapter intact would pass CI. The structural
  verifier catches a missing anchor, not a broken render.
- **The audit is advisory only.** Nothing blocks a save, nothing warns on
  publish, and no other tab reflects the verdict. An operator who never opens
  the Architecture tab ships an unvalidated ladder exactly as before.
- **The escalation inference is keyword matching, not understanding.** A rung
  described in words outside `ESCALATION_KEYWORDS` reports
  `escalation-unknown` and then trips `no-escalation`. That is deliberately
  loud rather than wrong, but it means the validator's verdict on an
  auto-derived ladder is only as good as the intake's wording. Operator-entered
  `escalates` values, once the UI offers them, should override the inference.
- The adapter never invents a price. An intake with blank upsell prices yields
  rungs the validator will reject; that is the intended signal, not a gap.
- The conversion rates in `DEFAULT_CONVERSION_RATES` are the figures from the
  source material, not measured from this system's own funnels. They are
  planning defaults and are overridable per call.
- No migration: nothing here persists yet. The audit re-derives on every render
  and its result is never stored, so there is no history of what a funnel's
  verdict used to be.
- The Mermaid output is asserted as a string. It has not been rendered.
- ~~The funnel flow in the Architecture tab is ASCII inside a `<pre>`, not a
  diagram.~~ **Done.** `funnelMapLayout.ts` supplies the missing coordinates and
  SVG edge paths, `FunnelFlowCanvas.tsx` renders them, and the ASCII is kept
  behind a text-view toggle. Layout suite: `tests/lib/sales-funnel-layout.test.ts`,
  14 tests.

  Two caveats carried over from `FUNNEL_FLOW_CANVAS_HANDOFF.md`, which is the
  authority on this:
  - The canvas has **no automated coverage** and **has not been opened in a
    browser**. The 14 tests cover the geometry module, not the component.
  - The diagram is drawn from an under-fed map, but not for the reason an
    earlier revision of this doc claimed. The tab never calls `buildFunnelMap`
    at all — it calls `auditIntakeFunnel(intake)` and renders `audit.map`.
    Precisely:
    - **Emails and traffic: wired but unused.** `IntakeFunnelMapOptions` accepts
      `traffic` and `emails`, and `buildFunnelMapFromIntake` forwards both. The
      tab passes no options, so both are absent. A consequence worth naming:
      `orphanedEmails(audit.map)` runs against a map with no emails in it and
      can therefore only ever return empty — the orphan check on screen is
      currently vacuous, not passing.
    - **Downsells: not expressible, and already reported.** `SalesAiIntake` has
      no downsell fields, so this is a schema limit rather than a missed
      argument. The adapter already emits `downsells-not-expressible` and the
      tab already labels it "Intake cannot express downsells". The knock-on is
      that `downsellPlacement` defaults to `'none'`, so
      `compareDownsellPlacements` — the inline-vs-after AOV comparison that much
      of the elasticity model exists to serve — is unreachable from a real
      funnel.
    - **Order bumps: wired.** `orderBump` is passed through from the intake's
      bump, with an `extra-order-bumps` note when there are more than the map
      draws. The earlier "missing every rescue branch" wording was wrong.

# Funnel Brief — Task B step 1 landed, rest handed off

## What shipped

`src/lib/mothermode/sales/funnelBrief.ts` — the `FunnelBrief` type and its pure
helpers. Nothing imports it yet. `tsc --noEmit` exits 0.

Exports:

| Export | Purpose |
| --- | --- |
| `FunnelBrief` + 6 sub-interfaces | identity / audience / promise / voice / visual / offer |
| `blankFunnelBrief()` | all-empty brief, `version: 1`, `source: 'derived'` |
| `normalizeFunnelBrief(raw)` | unknown → `FunnelBrief`, same defensive style as `normalizeSalesFooter` |
| `funnelBriefOfferFromStack(stack)` | denormalizes `OfferStack`; enabled upsells only, sorted by `slot` |
| `funnelBriefFromIntake(intake, opts)` | derives what `SalesAiIntake` actually knows |
| `formatFunnelBriefForPrompt(brief)` | prompt block; **omits empty fields** |
| `funnelBriefGaps(brief)` / `isFunnelBriefComplete(brief)` | dotted paths of what's still empty |

## Field provenance — verified, not guessed

This was the thing the last session stopped rather than fake. Confirmed against
the real files this session:

- `SalesAiIntake` (`sales/aiIntake.ts`): `niche`, `audience`, `pain`,
  `magnetName`, `magnetPromise`, `leadGenSlug`, `offerName`, `offerPrice`,
  `upsell1..4`, `toneNotes`, `offerStack`.
- `OfferStack`: `frontEnd { name, price, originalPrice, promise, deliverables[] }`,
  `bonuses[]`, `bumps[]`, `upsells[]` (each with `slot`, `enabled`, `name`).
- `SalesFunnelRecord` (`sales/types.ts`): per-page content objects
  (`optin`/`sales`/`vsl`/`checkout`/`upsell1..4`/`success`/`access`/`footer`)
  plus the metrics columns.

The intake carries **no** identity. That is why `identity` derives empty and
`funnelBriefFromIntake` takes `brandName` as an explicit opt rather than
inventing one — the whole point of the module is that a hole stays visible.

## Two decisions baked in

1. **Empty fields are omitted from the prompt, not printed as `(not set)`.**
   A model shown `founderName: (not set)` fills it in. Omission plus an explicit
   gap list is the safer shape.
2. **`funnelBriefGaps` returns dotted paths.** So "the brief is complete" is
   assertable by `scripts/audit-ai-fill-coverage.cjs` instead of eyeballed.

## Next session, in order

1. **Persist it.** Add `brief jsonb` to the sales funnel row: new migration
   under `supabase/migrations/`, then `normalizeFunnelBrief` into the row mapper
   in `sales/store.ts` and the write path in
   `src/app/api/admin/mothermode-sales/route.ts`. Re-run
   `scripts/build-migration-bundle.cjs`.
2. **Generate it.** A `brief` mode in `src/utils/integrations/openai-sales.ts` +
   `src/app/api/mothermode/sales-ai/route.ts` that fills only
   `funnelBriefGaps(brief)`, never overwriting `source: 'manual'` fields.
3. **Consume it.** Prepend `formatFunnelBriefForPrompt(brief)` to every existing
   per-page sales-AI prompt, and apply `identity.*` to the six drifting
   `SalesPageContent` fields (`brandLine`, `conversionLine`, `generationalLine`,
   `categoryLine`, `founderName`, `founderRole`) plus
   `footer.brandLine`/`footer.disclaimer`.

Then Task C fills `visual`, and Task D reads the brief into
`scriptStoryboard`/`filmBible`.

## Not done

- No unit test yet. `tests/lib/sales-offer-stack.test.ts` is the pattern; worth
  covering `funnelBriefOfferFromStack` upsell filtering/sorting and
  `normalizeFunnelBrief` on garbage input.
- Not exported from `src/lib/mothermode/sales/index.ts` — deliberate, since
  nothing consumes it. Add the re-export with step 1.

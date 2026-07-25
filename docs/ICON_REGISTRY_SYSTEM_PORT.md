# Icon Registry System Port

Append-only log. Each step records what shipped and how it was verified.

## Step 1 - Icons become data

**Problem.** `GET /` returned 500 with a React serialization error naming
`{$$typeof, render, displayName}`. `MotherModeSalesPage` is a Server
Component; `HeroSection`, `InsidePanel` and `Sidebar` are `'use client'`.
Four interfaces in `src/lib/mothermode/types.ts` typed `icon: LucideIcon`, and
the offer catalogs filled that field with real lucide component references. The
offer object crossed the server/client boundary carrying live `forwardRef`
objects, which React Server Components cannot serialize.

**Fix.** Icons are stored as names and resolved to components on the render
side only.

- `src/lib/mothermode/icons.ts` - `ICON_NAMES` / `IconName` string union,
  `DEFAULT_ICON`, `isIconName`, `toIconName`. No lucide import, so it is safe
  to pull into a Server Component.
- `src/components/mothermode/parts/iconRegistry.tsx` - the name to component
  map, `iconFor(name)` and an `<Icon name=... />` wrapper. Unknown names fall
  back to the default glyph instead of throwing, so a bad value out of the DB
  degrades to a placeholder rather than a 500.

**Producers converted** (`icon: Sparkles` to `icon: 'Sparkles'`):
`types.ts` (4 interfaces), `ascension.ts`, `offers/brain-dump.ts` (12),
`offers/draft.ts` (4 plus the `defaultIcons` rotation),
`offers/five-pm-reset.ts` (12), `offers/morning-without-yelling.ts` (12),
`offers/offload-map.ts` (12), `sales/fromOffer.ts` (4),
`sales/fromAscension.ts` (2). Newly unused lucide imports were pruned.

**Consumers converted** (`const Icon = x.icon` to `const Icon = iconFor(x.icon)`):
`parts/BonusSection.tsx`, `parts/InsideSection.tsx` (2 sites),
`parts/NarrativeSections.tsx`, `upsell/MotherModeUpsellPage.tsx`,
`sales/CheckoutPage.tsx` (the `Check as ...['icon']` casts are gone).

**Considered and rejected.** Mapping `icon: Foo` to `iconNode: <Foo />` on the
server also fixes the error, since React *elements* serialize even though
component references do not. It is a shorter diff but it changes the prop
contract at every call site, so it needs the identical consumer audit. Shorter,
not cheaper, and it leaves components in the data model.

**Out of scope, still using the old pattern.**
`src/components/sales-page/mindshift-sections/constants.ts` declares its own
`icon: LucideIcon` fields. That subtree imports its constants directly rather
than receiving them as props across a boundary, so it is not currently failing.
Convert it if those sections ever start taking data from a Server Component.
Unrelated and untouched: the lowercase `deliveryCards` icon strings resolved by
`SuccessPage`'s own `ICON_MAP`, and the `{ icon: Icon }` prop destructuring in
the rich-text toolbars.

**Verified.** `pnpm exec tsc --noEmit` exits 0. Enumeration came from
`scripts/icon-audit.cjs` (writes `scripts/icon-audit.txt`); the conversion is
`scripts/icon-registry-refactor.cjs` (atomic: stages every edit and asserts
every anchor before writing) plus `scripts/icon-registry-finish.cjs`.

**Not verified in this session.** No browser load of `/`. Run the dev server
and confirm the route returns 200 before treating the incident as closed.

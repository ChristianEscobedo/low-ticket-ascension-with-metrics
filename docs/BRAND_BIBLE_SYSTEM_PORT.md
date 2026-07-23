# Brand Bible — System Port (as-built)

Status: **shipped** as part of the Seedance / Reel Director sprint (Phase 4).
This is the as-built record of the Brand Bible: an admin-editable "visual
identity" record that reskins the entire cinematic pipeline without touching the
engine. Swapping the selected bible changes color language, camera grammar,
emotional tone, and the negative prompt for every generated storyboard and clip.

It is a **specialized, store-backed context source** — it plugs into the same
two-way context system as offers, kits, and inline packs (see
`TWO_WAY_CONTEXT_SYSTEM_PORT.md`), and clamps through the same char caps so a
long brand doc never crowds out the storyboard.

## Files

| Layer | File |
| --- | --- |
| Types + normalization | `src/lib/mothermode/brandbible/types.ts` |
| Supabase store (service-role) | `src/lib/mothermode/brandbible/store.ts` |
| Migration | `supabase/migrations/20260815000000_mothermode_brand_bibles.sql` |
| Context adapter (pure) | `src/lib/mothermode/context/fromBrandBible.ts` |
| Context kind registration | `src/lib/mothermode/context/types.ts` (`'brand-bible'`), `resolve.ts`, `sources.ts` |
| Prompt block for the engine | `src/lib/mothermode/content/reelDirector.ts` → `brandBibleToPromptBlock` |
| Admin CRUD route | `src/app/api/admin/mothermode-brandbible/route.ts` |
| Admin editor | `src/app/admin/brand-bible/page.tsx` + `BrandBibleEditor.tsx` |
| Sidebar entry | `src/app/admin/AdminSidebar.tsx` |
| Tests | `tests/lib/brand-bible.test.ts` (4/4 green) |

## Data model (`brandbible/types.ts`)

```ts
interface BrandBible {
  id: string;              // uuid — the ContextRef pointer
  name: string;            // shown in the picker
  scope?: string;          // optional owning brand ('' = global)
  visualDirection?: string;// film stock, era, lighting, grade, texture
  colorLanguage?: string;  // palette + emotional color use
  emotion?: string;        // the feeling every frame should evoke
  camera?: string;         // lenses, movement, framing, pacing
  negatives?: string[];    // hard "never do this" list → Seedance negative prompt
  createdAt?: string;
  updatedAt?: string;
}
```

- `normalizeBrandBible(value)` — coerces a persisted row or a request body into a
  clean `BrandBible`, or returns `null` when there's no usable `id` + `name` (so
  callers drop malformed rows rather than throwing).
- `normalizeNegatives(value)` — accepts a `string[]` or a newline/comma-delimited
  string, then trims, drops empties, and dedupes case-insensitively.

## Store (`brandbible/store.ts`)

Admin-only, service-role client (bypasses RLS, no anon path — matches the other
mothermode kit stores). Table `mothermode_brand_bibles`; snake_case rows are
remapped to camelCase via `rowToBrandBible` and passed through
`normalizeBrandBible`.

- `listBiblesForAdmin(): Promise<BrandBible[]>` — newest first; returns `[]` on
  any failure.
- `getBibleById(id): Promise<BrandBible | null>`.
- `upsertBible(input: UpsertBibleInput): Promise<BrandBible>` — insert when `id`
  is absent, update in place otherwise; stamps `updated_at` / `updated_by`.
- `deleteBible(id): Promise<void>`.

The service-role client is lazily constructed so the module never throws on
missing env at import time.

## Context adapter (`context/fromBrandBible.ts`)

Pure, deterministic, no I/O — the store + `resolve.ts` fetch the record; this
file only shapes it into a `ContextPack`:

```ts
fromBrandBible(bible: BrandBible): ContextPack // { kind: 'brand-bible', id, title, summary, prompt }
```

The `prompt` is a compact plain-text block:

```
BRAND BIBLE — <name>
Visual direction: …
Color language: …
Emotion to evoke: …
Camera grammar: …
Never: <negatives joined by ", ">
Apply this identity to every storyboard frame and rendered clip without
overriding the creative brief.
```

`summary` is a one-line chip (`Brand Bible: <name> — <emotion>; <colorLanguage>`).

## How it feeds the engine

1. Admin authors a Brand Bible in `/admin/brand-bible`.
2. It's selected as a `'brand-bible'` context source; `resolve.ts` fetches the
   record and `fromBrandBible` turns it into a `ContextPack`.
3. `reelDirector.brandBibleToPromptBlock` composes the brand block that
   `buildSeedancePrompt` injects — **priority #2, right after the storyboard**
   (the storyboard always wins) — and the `negatives` are folded into the
   Seedance `NEGATIVE_PROMPT`.
4. Because it's a swappable record, the same cinematic engine can serve multiple
   brands (MotherMode / Omega / Mass) by switching the selected bible; `scope`
   lets the picker filter the list.

## Seed record — MotherMode brand filter

The first record to seed (see `SEEDANCE_VIDEO_PIPELINE_SYSTEM_PORT.md` for the
full copy):

- **Visual:** editorial intelligence, maternal warmth, modern minimalism,
  magazine-quality photography, quiet luxury, generous negative space. Women as
  protagonists, not ad subjects.
- **Color:** bone neutrals, deep charcoal, aubergine accents, warm natural
  daylight, muted interiors, rich shadows. Avoid oversaturation and pastels.
- **Emotion:** grounded, truthful, quiet confidence, no forced smiles, calm
  authority, permission over persuasion.
- **Negatives:** influencer/Pinterest/Instagram-mom/stock aesthetics, plastic
  skin, hyper-saturation.

## Notes / gotchas

- The table has **no anon policy** — reads and writes are admin-only through the
  service-role client, exactly like the other kit stores. Never expose it on the
  buyer path.
- `negatives` accepts free-form text in the editor (newlines or commas) and is
  normalized on save, so admins don't have to think about array shape.
- Keep the brand block short: it clamps through the shared
  `PACK_CHAR_CAP`/`TOTAL_CHAR_CAP`, so verbose bibles are truncated rather than
  allowed to crowd out the storyboard.

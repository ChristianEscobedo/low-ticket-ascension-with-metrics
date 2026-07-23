# Two-Way Context System — Port Guide

This doc describes how to port the **two-way context** feature to another codebase. It
lets every admin "kit" both (a) **attach** other kits/offers as context sources for its
own AI generation, and (b) **be attached** as a context source by the content generator
and other kits.

The email-marketing kit is the reference implementation; community, high-ticket, and
lead-gen replicate it. It builds on the pre-existing `lib/mothermode/context` module
(offer/kit → `ContextPack` bridge).

---

## 0. Mental model

```
                 buildContextSourceOptions()          resolveContextRefs(refs)
Admin editor  ─────────────────────────────▶  picker  ───────────────────────▶  ContextPack[]
   (saves contextRefs[])                                       │
                                                               ▼
                                        contextPacksToPromptBlock(packs, 'kit'|'content')
                                                               │
                                                               ▼
                                                   prepended to system prompt
```

- **`ContextRef`** — a lightweight pointer the admin saves on a kit: `{ kind, id, label }`.
- **`ContextSourceOption`** — an option shown in the picker, produced by scanning all
  kit stores (`buildContextSourceOptions()`).
- **`ContextPack`** — the resolved, summarized text of a referenced source, injected into
  a prompt via `contextPacksToPromptBlock()`.
- **`ContextSourceKind`** — the union of source types (`'offer' | 'community-kit' |
  'high-ticket-kit' | 'lead-gen-kit' | 'email-kit'`).

---

## 1. Core context module (`src/lib/mothermode/context/`)

These files are the shared plumbing. Confirm each exists and add the new kind.

### `types.ts`
- `ContextRef`, `ContextPack`, `ContextSourceOption` interfaces.
- `ContextSourceKind` string union — **add every kit kind here**, e.g. `'email-kit'`.
- `CONTEXT_SOURCE_KINDS: ContextSourceKind[]` array — **add the same kind here** so the
  picker/validators enumerate it.
- `normalizeContextRefs(input: unknown): ContextRef[]` — defensive normalizer used by
  every store's row→record mapper and by the admin save routes. Drops malformed entries,
  coerces `kind`/`id`/`label` to strings, ignores unknown kinds.

### `sources.ts`
- `buildContextSourceOptions(): Promise<ContextSourceOption[]>` — reads each kit store's
  `listKitsForAdmin()` (and the offer list) and flattens them into options. **Add one
  block per kind**, e.g.:
  ```ts
  const emailKits = await listEmailKitsForAdmin();
  for (const k of emailKits) {
    options.push({ kind: 'email-kit', id: k.id, label: k.name || k.slug });
  }
  ```
  Import from `'@/lib/mothermode/email/store'` etc.

### `fromKits.ts`
- One resolver per kit kind that turns a saved ref into a `ContextPack` by reading the
  kit and summarizing it. **Add an `email-kit` resolver** (reads the email kit, summarizes
  its sequence/emails). Mirror the existing `community-kit`, `high-ticket-kit`,
  `lead-gen-kit` resolvers.

### `resolve.ts`
- `resolveContextRefs(refs: ContextRef[]): Promise<ContextPack[]>` — dispatches each ref
  to the right resolver (`fromOffer` / `fromKits` per kind). Usually needs **no change**
  once `fromKits.ts` handles the new kind (verify the switch/dispatch covers it).

### `prompt.ts`
- `contextPacksToPromptBlock(packs, mode: 'kit' | 'content'): string` — renders packs
  into a prompt-ready block. No change needed.

### `index.ts`
- Re-exports the public API (`ContextRef`, `ContextSourceOption`, `ContextPack`,
  `normalizeContextRefs`, `buildContextSourceOptions`, `resolveContextRefs`,
  `contextPacksToPromptBlock`). Ensure new symbols are exported.

---

## 2. Shared UI: `src/components/mothermode/context/ContextRefEditor.tsx`

A reusable picker/list component. Props:
```ts
{
  refs: ContextRef[];
  onChange: (next: ContextRef[]) => void;
  sources: ContextSourceOption[];
  disabled?: boolean;
}
```
Renders a "add source" dropdown (grouped by kind) + a list of attached refs with remove
buttons. This is the single component every editor mounts; no per-kit copy needed.

---

## 3. Per-kit wiring (8 layers)

Repeat this for **community**, **high-ticket**, **lead-gen** (email is the reference).
Replace `<kit>` with the kit name.

### 3.1 Migration
```sql
alter table mothermode_<kit>_kits
  add column context_refs jsonb not null default '[]'::jsonb;
```
> In this repo all four kits share one migration:
> `supabase/migrations/20260731000000_mothermode_kit_context_refs.sql`.

### 3.2 `lib/mothermode/<kit>/types.ts`
- Add `contextRefs: ContextRef[]` to the **record** interface (e.g. `HighTicketKitRecord`).
- Add `context_refs?: unknown` (or `Json | null`) to the **row** interface
  (`<Kit>KitRow`). **Keep it optional** so existing test fixtures that omit it still
  typecheck.
- In the row→record mapper (`rowTo<Kit>Kit`), set
  `contextRefs: normalizeContextRefs(row.context_refs)`.
- Import `ContextRef` + `normalizeContextRefs` from `'@/lib/mothermode/context'`.

### 3.3 `lib/mothermode/<kit>/store.ts`
- Add `'context_refs'` to the `COLUMNS` select list.
- Add `contextRefs: ContextRef[]` to `Upsert<Kit>KitInput`.
- Add `context_refs: input.contextRefs ?? []` to the upsert row payload.

### 3.4 `utils/integrations/openai-<kit>.ts`
- Thread a `packs: ContextPack[]` param into the generator function(s)
  (`generate`, `regenerate`, etc.).
- Prepend `contextPacksToPromptBlock(packs, 'kit')` to the system prompt.

### 3.5 `app/api/mothermode/<kit>-ai/route.ts`
- Read `body.contextRefs`.
- `const packs = await resolveContextRefs(normalizeContextRefs(body.contextRefs));`
- Pass `packs` into the generator calls.

### 3.6 `app/api/admin/mothermode-<kit>/route.ts`
- Read `contextRefs` from the POST body.
- Persist `contextRefs: normalizeContextRefs(contextRefs)` into the store upsert input.

### 3.7 `app/admin/<kit>/page.tsx`
- `const sources = await buildContextSourceOptions();` (run in parallel with the kit
  list fetch).
- Pass `sources={sources}` into the editor component.

### 3.8 `app/admin/<kit>/<Kit>Editor.tsx`
- Accept `sources?: ContextSourceOption[]` prop (default `[]`).
- Add state: `const [contextRefs, setContextRefs] = useState<ContextRef[]>([]);`
- Reset it in `resetDraft()` (`setContextRefs([])`).
- Hydrate it in `loadKit()` (`setContextRefs(record.contextRefs ?? [])`).
- Include `contextRefs` in the `generate` / `regenerate` / `save` fetch payloads
  (and add `contextRefs` to those `useCallback` dependency arrays).
- Render `<ContextRefEditor refs={contextRefs} onChange={setContextRefs}
  sources={sources} disabled={busy !== null} />` (e.g. just below the Intake card).

---

## 4. Making the content generator see the kits (Part B)

So content generation can attach kits as context:
1. `context/types.ts` — kind already in the union + `CONTEXT_SOURCE_KINDS` (§1).
2. `context/sources.ts` — kit block added (§1).
3. `context/fromKits.ts` — resolver added (§1).
4. `app/api/mothermode/content/generated/route.ts` — **already** resolves
   `contextRefs` and injects `contextPacksToPromptBlock(packs, 'content')`; no route
   change needed. Just confirm the content page picker renders all
   `buildContextSourceOptions()` kinds.

---

## 5. Tests

- `tests/lib/context-packs.test.ts` — exercises `normalizeContextRefs`,
  `buildContextSourceOptions` shape, and `contextPacksToPromptBlock`. Add a case per new
  kind.
- `tests/lib/<kit>-mappers.test.ts` — the row→record mapper now returns
  `contextRefs: []` for rows without `context_refs`. Because the row type field is
  **optional**, existing fixtures still typecheck; runtime assertions that check specific
  fields (not full-object equality) are unaffected. If a test does full `toEqual` on the
  record, add `contextRefs: []` to the expected object.
- `tests/lib/email-kit.test.ts` — reference for the email kit.

Run:
```bash
npx tsc --noEmit
npx vitest run tests/lib/context-packs.test.ts tests/lib/email-kit.test.ts tests/lib/high-ticket-mappers.test.ts
```

---

## 6. Port checklist (per kit)

- [ ] Migration: `context_refs jsonb not null default '[]'`
- [ ] `types.ts`: record `contextRefs`, row `context_refs?`, mapper `normalizeContextRefs`
- [ ] `store.ts`: `COLUMNS` + `UpsertKitInput` + upsert row write
- [ ] `openai-<kit>.ts`: `packs` param + `contextPacksToPromptBlock(packs, 'kit')`
- [ ] `<kit>-ai/route.ts`: `resolveContextRefs` → generators
- [ ] `admin/mothermode-<kit>/route.ts`: save `normalizeContextRefs(contextRefs)`
- [ ] `page.tsx`: `buildContextSourceOptions()` → `sources`
- [ ] `<Kit>Editor.tsx`: state + reset/hydrate + payloads + `<ContextRefEditor>`

## 7. Status in this repo

- **Core context module + `ContextRefEditor`**: done.
- **Email kit (reference)**: done.
- **High-ticket**: done (all 8 layers).
- **Community**: verify all 8 layers wired.
- **Lead-gen**: not started.
- **Part B (`email-kit` as a content/context source)**: verify types/sources/fromKits.

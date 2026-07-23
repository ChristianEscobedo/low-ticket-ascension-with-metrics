# Email Editor: Tokens Toolbar, Image→Body Injection, Prominent Body Trigger, Custom Tokens

Status handoff. One piece is **done and compiling**; the rest is scoped precisely
against the current code so a fresh session can execute without re-discovery.
Context budget in the authoring session was ~86%, so the larger multi-file edits
(which need each big file read in full) were deferred rather than half-applied.

---

## ✅ DONE — Task 3a/b/c: Tokens dropdown in the TipTap toolbar

File: `src/components/mothermode/context/KitRichTextField.tsx`

- Added an exported `RichTextToken` interface `{ token: string; label: string; description?: string }`
  — structurally compatible with `EmailMergeToken` but kept local so the field
  stays decoupled from the email module and reusable by every kit editor.
- Added a `TokenMenu` dropdown component (Braces icon + "Tokens" label) that lists
  tokens and, on pick, inserts the raw `{{token}}` text at the cursor via
  `editor.chain().focus().insertContent(t).run()`.
- `Toolbar` now accepts `tokens?: RichTextToken[]` and renders `TokenMenu` **only
  when `tokens.length > 0`** (so community/high-ticket/lead-gen editors show nothing).
- `KitRichTextField` now accepts `tokens?: RichTextToken[]` and forwards it to `Toolbar`.

Verified: TS error resolved (added `tokens` to the component's prop destructuring).

---

## ⬜ Task 3d — Feed tokens into the email BODY field

In `src/app/admin/email-marketing/EmailKitEditor.tsx`, find the per-email BODY
`<KitRichTextField ... />` (the one bound to each email's `bodyHtml`/`body`) and
pass a `tokens` prop built from the built-in catalog **plus** any custom tokens
(Task 4). Map `EMAIL_MERGE_TOKENS` → `RichTextToken`:

```ts
import { EMAIL_MERGE_TOKENS } from '@/lib/mothermode/email/tokens';
import type { RichTextToken } from '@/components/mothermode/context/KitRichTextField';

const builtInTokens: RichTextToken[] = EMAIL_MERGE_TOKENS.map((t) => ({
  token: t.token, label: t.label, description: t.description,
}));
// later merge with customTokens (Task 4): [...builtInTokens, ...customTokens]
```

Then: `<KitRichTextField value={...} onChange={...} tokens={allTokens} />`.
(Only the email body field should get `tokens`; subject line is a plain input —
optionally add a small token menu there too if desired, but not required.)

---

## ⬜ Task 1 — Make the "write body" trigger easy to see

Symptom: the control that opens/starts body authoring is visually mixed in with
the settings cluster. In `EmailKitEditor.tsx`, locate that trigger (search for the
body toggle / "write"/"compose"/settings row around each email card). Extract it
into a clear PRIMARY action: e.g. a full-width brass button `Write email body`
(or `Edit body`) placed directly above the body editor, separated from the
settings row (delay/subject/funnel-event controls). Keep the existing handler; only
change placement + styling. Reuse existing button classes already in this file for
consistency (brass primary, bone/10 secondary).

---

## ⬜ Task 2 — Inject a created image into the email body

Component: `src/components/mothermode/email/EmailImageStudio.tsx` (generates an
image and currently surfaces download/insert-elsewhere but NOT body insertion).

Plan:
1. `KitRichTextField` already supports images (TipTap `Image`, `allowBase64`) and
   the toolbar has an "Insert image" (URL prompt) path. To inject programmatically
   we need an imperative insert. Two clean options:
   - **A (recommended):** Lift an `onInsertImage(url: string, alt?: string)` callback.
     Have `EmailKitEditor` own a ref to the currently-focused body editor. Expose a
     small imperative handle from `KitRichTextField` via `forwardRef` +
     `useImperativeHandle({ insertImage(src, alt) { editor.chain().focus().setImage({ src, alt }).run(); } })`.
     `EmailKitEditor` passes the ref to the active email's body field and hands
     `insertImage` to `EmailImageStudio` as an "Insert into email body" button.
   - **B (simpler, no ref):** Store the generated image URL into the email's
     `bodyHtml` by appending `<img src="...">` to the current value string and
     calling the existing `onChange`. Less precise (always appends at end) but
     avoids ref plumbing.
2. Add an **"Insert into body"** button in `EmailImageStudio` next to the existing
   actions; wire to the chosen mechanism above.
3. Ensure the inserted `src` is a durable URL (the storage/hosted URL), not a blob:
   check how `EmailImageStudio` obtains the final image URL (it already uploads/serves
   via the image pipeline; reuse that hosted URL so exported emails render it).

---

## ⬜ Task 4 — Admin custom tokens / custom values system

Goal: let an admin define their own tokens (key + label + default value) that show
up in the Tokens dropdown AND resolve at render/export time.

### 4.1 Persistence
Add a table (new migration, next timestamp after `20260731000000`):

```sql
create table if not exists mothermode_custom_tokens (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- bare key, e.g. 'coach_name' (lowercase, [a-z0-9_])
  label text not null,
  description text not null default '',
  default_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table mothermode_custom_tokens enable row level security;
-- add admin-only policies mirroring other mothermode_* admin tables
```

### 4.2 Store + API
- `src/lib/mothermode/email/customTokens.ts` (or `src/lib/mothermode/tokens/store.ts`):
  `listCustomTokens()`, `upsertCustomToken(input)`, `deleteCustomToken(id)`.
  Normalize `key` to `^[a-z0-9_]+$` and derive `token` as `{{key}}`.
- Admin API route `src/app/api/admin/mothermode-custom-tokens/route.ts`
  (GET/POST/DELETE) mirroring the auth + shape of an existing admin route such as
  `src/app/api/admin/mothermode-help/route.ts`.

### 4.3 Admin UI
- Add a small "Custom values / tokens" manager. Cheapest home: a section on the
  email-marketing admin page (`src/app/admin/email-marketing/page.tsx`) — list +
  add/edit/delete rows (key, label, description, default value). Optionally its own
  page + sidebar entry (`src/app/admin/AdminSidebar.tsx`) if you want it global.

### 4.4 Surface in the Tokens dropdown
- `page.tsx` loads `listCustomTokens()` and passes them into `EmailKitEditor`, which
  merges `builtInTokens` + `customTokens.map(t => ({ token:`{{${t.key}}}`, label:t.label, description:t.description }))`
  → the `tokens` prop from Task 3d.

### 4.5 Resolve at render/export
- `applyEmailTokens` (in `src/lib/mothermode/email/tokens.ts`) already substitutes
  from a `values` map and PRESERVES unknown tokens by default. Feed custom tokens'
  `default_value` into the `values` map wherever emails are rendered/exported
  (export path: `src/lib/mothermode/email/export.ts` / `src/utils/email/layout.ts`).
  Merge order: caller-supplied values override custom-token defaults.
- Optional: extend `EMAIL_MERGE_TOKEN_KEYS` awareness so validation/UX that lists
  "available tokens" includes custom keys (read from DB, not the static array).

---

## Verify
`npx tsc --noEmit`
`npx vitest run tests/lib/email-kit.test.ts`
Manual: open an email kit → body toolbar shows **Tokens** dropdown; picking inserts
`{{...}}`; "Write email body" is a clear primary button; EmailImageStudio has
"Insert into body"; admin can add a custom token and see it in the dropdown and in
a rendered/exported preview.

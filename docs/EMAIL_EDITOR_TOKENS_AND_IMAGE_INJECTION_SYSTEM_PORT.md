# Email Editor — Custom Tokens & In-Body Image Injection (System Port)

This doc ports the final round of email-editor upgrades built on top of the
Email Marketing Kit system. It layers four capabilities onto the existing kit
editor without disturbing the community / high-ticket / lead-gen editors that
reuse the same shared components:

1. **A reusable "Tokens" dropdown** in the TipTap toolbar (`KitRichTextField`).
2. **Admin-defined custom merge tokens** (`{{key}}`) — table + store + admin CRUD
   API + a manager panel — merged into that dropdown alongside the static
   `EMAIL_MERGE_TOKENS` catalog.
3. **Custom-token resolution at export/render** via the existing
   `applyEmailTokens`, so a coach's default values are filled on copy/export
   while standard ESP tokens survive untouched.
4. **"Insert into body" image injection** from `EmailImageStudio`, plus a clear
   primary **Write/Rewrite body with AI** button separated from the settings
   cluster.

Everything is admin-authored content behind the admin route guard; nothing here
touches the buyer-facing surfaces.

---

## Files touched / added

| File | Change |
| --- | --- |
| `src/components/mothermode/context/KitRichTextField.tsx` | New exported `RichTextToken` type + optional `tokens?` prop → renders a **Tokens** dropdown that `insertContent`s a `{{marker}}` at the cursor. Only shown when a non-empty `tokens` array is passed. |
| `supabase/migrations/20260801000000_mothermode_custom_tokens.sql` | New `mothermode_custom_tokens` table (service-role RLS only). |
| `src/lib/mothermode/email/customTokens.ts` | New store: `CustomToken` type, `listCustomTokens`, `upsertCustomToken`, `deleteCustomToken`, `normalizeTokenKey`, `customTokenValues`. |
| `src/app/api/admin/mothermode-custom-tokens/route.ts` | New admin CRUD API (`GET` / `POST` / `DELETE`), admin-gated. |
| `src/app/admin/email-marketing/EmailKitEditor.tsx` | Loads custom tokens, merges them with `EMAIL_MERGE_TOKENS` into `bodyTokens`, adds a **Custom tokens** manager panel, wires the body field's `tokens` prop, adds the primary write-body button, wires image injection, and resolves token defaults into the copy/export handlers. |
| `src/components/mothermode/email/EmailImageStudio.tsx` | Optional `onInsertToBody?(src)` prop → per-image **Insert into body** hover action. |
| `src/lib/mothermode/email/export.ts` | `sequenceToText` / `sequenceToHtml` / `sequenceToRows` accept an optional `values` map and resolve tokens via `applyEmailTokens`. |

---

## 1. Reusable token dropdown — `KitRichTextField`

The rich-text field is shared across every kit editor, so the token dropdown is
strictly opt-in. It renders only when a non-empty `tokens` array is passed;
community / high-ticket / lead-gen editors pass nothing and see no change.

```ts
// Exported so every kit editor can build a token list without importing email.
export interface RichTextToken {
  /** The full marker inserted into copy, e.g. '{{first_name}}'. */
  token: string;
  label: string;
  description?: string;
}
```

Toolbar wiring (only mounts when tokens exist):

```tsx
const Toolbar: React.FC<{ editor: Editor; tokens?: RichTextToken[] }> = ({
  editor,
  tokens,
}) => {
  // ...standard mark/heading/list/image buttons...
  {tokens && tokens.length > 0 && (
    <TokenMenu
      tokens={tokens}
      onPick={(t) => editor.chain().focus().insertContent(t).run()}
    />
  )}
};
```

`TokenMenu` is a small dropdown (`Braces` icon + "Tokens" label) listing each
token's marker + label; picking one inserts the bare `{{marker}}` at the cursor.
The `KitRichTextField` prop surface gains:

```ts
/** When provided (non-empty), a "Tokens" dropdown is shown in the toolbar. */
tokens?: RichTextToken[];
```

**Port note:** this is the decoupling seam — the field never imports the email
module. Editors map their own token catalogs into `RichTextToken[]`.

---

## 2. Custom merge tokens

### 2.1 Migration — `mothermode_custom_tokens`

```sql
CREATE TABLE IF NOT EXISTS mothermode_custom_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,          -- bare key, e.g. 'coach_name' ([a-z0-9_])
  label         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  default_value TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_tokens_key ON mothermode_custom_tokens (key);

ALTER TABLE mothermode_custom_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access mothermode_custom_tokens"
  ON mothermode_custom_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
```

RLS posture mirrors `mothermode_kb_articles` / `mothermode_deliverables`: all
reads/writes go through the admin API with the service role (which bypasses
RLS). `key` / `label` / `default_value` are trusted, hand-authored admin content.

### 2.2 Store — `src/lib/mothermode/email/customTokens.ts`

Pure-ish data layer with a lazy service client (never throws at import on missing
env). Key surface:

```ts
export interface CustomToken {
  id: string;
  key: string;         // bare key; the marker is `{{key}}`
  label: string;
  description: string;
  defaultValue: string;
}

export function normalizeTokenKey(input: string): string;      // → [a-z0-9_], trimmed, ≤60
export async function listCustomTokens(): Promise<CustomToken[]>;   // [] on failure
export async function upsertCustomToken(input): Promise<CustomToken>; // insert if no id
export async function deleteCustomToken(id: string): Promise<void>;

/** Build a `{ key: defaultValue }` map for applyEmailTokens. Skips empty defaults. */
export function customTokenValues(tokens: CustomToken[]): Record<string, string>;
```

`customTokenValues` is the bridge to the export layer — only tokens with a
non-empty default contribute a value, so empty ones stay as `{{markers}}`.

### 2.3 Admin API — `src/app/api/admin/mothermode-custom-tokens/route.ts`

All handlers call `requireAdminRoute()` first.

- `GET` → `{ success, admin, items }`
- `POST { id?, key, label, description?, defaultValue? }` → `{ success, item }`
  - 400 if `key`/`label` missing; unique-violation errors are mapped to a
    friendly "That token key is already in use."
- `DELETE ?id=uuid` → `{ success }`

### 2.4 Editor manager panel + dropdown merge — `EmailKitEditor.tsx`

Load once, then merge the static catalog + custom tokens into the shape the field
wants:

```tsx
const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);

useEffect(() => {
  fetch('/api/admin/mothermode-custom-tokens')
    .then((r) => r.json())
    .then((j) => Array.isArray(j?.items) && setCustomTokens(j.items))
    .catch(() => {});
}, []);

const bodyTokens = useMemo<RichTextToken[]>(() => {
  const base = EMAIL_MERGE_TOKENS.map((t) => ({
    token: t.token, label: t.label, description: t.description,
  }));
  const custom = customTokens.map((t) => ({
    token: `{{${t.key}}}`, label: t.label,
    description: t.description || `Custom token (default: ${t.defaultValue || '—'})`,
  }));
  return [...base, ...custom];       // merge order: static first, custom after
}, [customTokens]);
```

The body field is wired with `tokens={bodyTokens}`. A dedicated **Custom tokens**
section lists existing tokens (with Remove) and a 3-field add row
(`key` / `label` / `default value`) that POSTs and optimistically updates state.

---

## 3. Resolution at export / render

`applyEmailTokens` already existed (from the Tokens & Brand HTML port). The three
public export renderers now take an optional `values` map and post-process their
output so markers with a supplied value resolve, and unknown ones survive for the
ESP:

```ts
export function sequenceToText(seq, values: Record<string,string> = {}): string {
  const out = /* ...built bundle... */;
  return applyEmailTokens(out, values);
}

export function sequenceToHtml(seq, values: Record<string,string> = {}): string {
  const html = /* ...brand-styled stack... */;
  return applyEmailTokens(html, values, { escapeHtml: true }); // escape substituted values
}

export function sequenceToRows(seq, values: Record<string,string> = {}): EmailExportRow[] {
  const t = (s: string) => applyEmailTokens(s, values);
  return seq.emails.map((e, i) => ({ /* ...t(subject), t(preview), t(body)... */ }));
}
```

Because `values` defaults to `{}`, existing callers/tests are unchanged (unknown
tokens are preserved). The editor threads the custom-token defaults into the copy
buttons:

```tsx
const tokenValues = useMemo(() => customTokenValues(customTokens), [customTokens]);
const plainText   = useMemo(() => sequenceToText(sequence, tokenValues), [sequence, tokenValues]);
// Copy HTML:
copyToClipboard(sequenceToHtml(sequence, tokenValues), 'HTML');
```

**Merge order / precedence:** static ESP tokens (`{{first_name}}`, …) carry no
value in `tokenValues`, so they always pass through intact for send-time fill.
Only custom tokens with a stored default resolve on export.

---

## 4. In-body image injection + write-body UX

### 4.1 `EmailImageStudio` — `onInsertToBody`

```tsx
/** When provided, each gallery image shows an "Insert into body" hover action. */
onInsertToBody?: (src: string) => void;

// per tile, on hover:
{onInsertToBody && (
  <button type="button" onClick={() => onInsertToBody(src)} title="Insert into email body">
    {/* insert icon */}
  </button>
)}
```

### 4.2 Editor append helper (no imperative editor handle needed)

We chose the simpler controlled-value append over a `forwardRef`/`useImperativeHandle`
`insertImage()`, because `KitRichTextField` is controlled and repaints from the new
`value`:

```tsx
function appendImageToBody(body: string, src: string): string {
  const img = `<img src="${src}" alt="" />`;
  const current = (body || '').trim();
  if (!current) return `<p>${img}</p>`;
  return `${body}<p>${img}</p>`;
}

<EmailImageStudio
  /* ...images, onChange, hook, context... */
  onInsertToBody={(src) =>
    patchEmail(active.id, { bodyText: appendImageToBody(active.bodyText, src) })
  }
/>
```

On export, `emailBodyHtml` already whitelists `<img>` and inlines brand styling
(`max-width:100%;height:auto;border-radius:8px;display:block;margin:16px 0`), so
injected images render correctly in the ESP output.

### 4.3 Primary "Write body" button

The body write/rewrite action is now a clear `btnPrimary` button separated from
the per-email settings selects, with contextual label:

```tsx
<button className={btnPrimary} onClick={() => handleExpand(email)} disabled={busy !== null}>
  {busy === `expand-${email.id}`
    ? 'Writing…'
    : email.bodyText.trim() ? '✍ Rewrite body with AI' : '✍ Write body with AI'}
</button>
```

---

## Reuse guidance (other kit editors)

To add a token dropdown to any other kit editor:

1. Build a `RichTextToken[]` from that kit's token/merge catalog.
2. Pass it to `<KitRichTextField tokens={...} />`.
3. (Optional) If the kit exports through a renderer, add an optional `values`
   map param and pipe it through `applyEmailTokens` the same way.

Custom tokens (§2) are currently email-scoped but the table/store/API are generic
`{{key}}` markers — they can be surfaced in any editor by loading the same list.

---

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/lib/email-kit.test.ts
```

Expected: `tsc` clean; **13/13** email-kit tests pass (normalizers, campaign/
framework catalogs, and the export renderers — `sequenceToText`,
`sequenceToHtml` with bullets/CTA/script-strip/rich-body+images, and
`sequenceToRows`). The added `values` params default to `{}`, so no existing
test assertions change.

Manual smoke:
- Open the email editor → **Custom tokens** panel → add `coach_name` with a
  default → confirm it appears in the body editor's **Tokens** dropdown and that
  **Copy text/HTML** output has it filled while `{{first_name}}` stays literal.
- Open **Image Studio** on an email, hover a generated/uploaded image, click
  **Insert into body**, and confirm it lands as a trailing `<p><img></p>`.

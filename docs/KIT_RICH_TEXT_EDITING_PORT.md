# Kit Rich-Text Editing — Port Guide

Lets admins fine-tune generated kit copy with a full TipTap rich-text editor
(bold, italic, bullet + numbered lists, links) while keeping prompts and exports
clean. Kit fields store **HTML**; anywhere that text feeds a model prompt or a
flat export it is flattened to readable plain text with `htmlToPromptText()`.

TipTap is already a dependency (`@tiptap/react`, `@tiptap/starter-kit`,
`@tiptap/pm`, `@tiptap/extension-placeholder`).

---

## 0. Design decision

- The content hub's existing `RichTextField`
  (`src/components/mothermode/content/RichTextField.tsx`) serializes to **plain
  text** because platform posts need plain text.
- Kit editing is different: admins want formatting preserved, so kit fields use
  a **separate** HTML-emitting field, `KitRichTextField`, and we sanitize at the
  boundaries (prompt + export) instead of at storage time.

---

## 1. Foundation (done in this repo)

### `src/lib/mothermode/richtext.ts` (new)
Server-safe, DOM-free HTML → text:
- `htmlToPromptText(html)` — blocks/`<br>`/`<li>` → newlines, `<li>` → `- `
  bullets, `<a href>` → `text (href)`, strips other tags, decodes entities,
  collapses whitespace. Plain text passes through unchanged.
- `looksLikeHtml(s)` — cheap tag sniff.
- `kitTextForPrompt(s)` — flattens if HTML else trims; null-safe.

### `src/lib/mothermode/context/prompt.ts` (edited)
`clampPack()` now runs `htmlToPromptText(pack.prompt)` before `tidy()`, so any
kit HTML injected as context is neutralized. **No behavior change for plain
text** — verified by `tests/lib/context-packs.test.ts` (still green).

### `src/components/mothermode/context/KitRichTextField.tsx` (new)
The HTML-emitting editor. Props:
```ts
{ value: string; placeholder?: string; minHeight?: string;
  disabled?: boolean; onChange: (html: string) => void }
```
- Accepts stored HTML **or** legacy plain text (wraps bare text in `<p>`).
- Empty editor emits `''` (not `<p></p>`), so blank fields stay blank.
- Toolbar: bold, italic, bulleted list, numbered list, undo/redo.

### `tests/lib/richtext.test.ts` (new)
11 cases covering the sanitizer. `npx tsc --noEmit` and the targeted vitest run
are green.

---

## 2. Per-editor wiring — ALL kits (the full rollout)

Every admin editor that shows **generated, editable output prose** gets the same
treatment: swap the free-text `<textarea>` for `KitRichTextField`. This is the
authoritative rollout list — the goal is that *all editable output text in every
kit* is rich-text, while short structured inputs stay plain.

```tsx
import { KitRichTextField } from '@/components/mothermode/context/KitRichTextField';

// before:
<textarea value={kit.pinnedPost}
  onChange={(e) => patch({ pinnedPost: e.target.value })} />

// after:
<KitRichTextField
  value={kit.pinnedPost}
  placeholder="Pinned welcome post…"
  disabled={busy !== null}
  onChange={(html) => patch({ pinnedPost: html })}
/>
```

### The rule (applies to every kit)
- **Convert:** any multi-line **prose output** the AI writes and an admin edits —
  bodies, scripts, descriptions, posts, section/block text, article body.
- **Leave plain:** short single-line/structured inputs — names, titles, slugs,
  prices, URLs, CTA labels, subject/preview lines, option lists, tags,
  dates/offsets, enum selects.
- **No type or migration change.** Stored values stay `string`; the `str()`
  normalizers pass HTML through untouched, and each kit already persists these
  fields inside its JSON column. Only the editor component and the export/prompt
  sanitizers change.
- **Nested/array prose** (e.g. script lines, offer stack blocks, doc blocks) gets
  a `KitRichTextField` per item, patched by id/index exactly like the flat case.

### Complete editable-output inventory (convert these)

| Kit / surface | Editor | Prose fields → `KitRichTextField` |
|---------------|--------|-----------------------------------|
| **Email Marketing** | `EmailKitEditor.tsx` | each `sequence.emails[].bodyText` (DONE — see `EMAIL_KIT_ADVANCED_FEATURES_PORT.md` §1) |
| **Community** | `CommunityEditor.tsx` | `description`, `pinnedPost`, `dmScript.stages[].message`, `salesCallScript.phases[].lines[]`, `leadForm.description`, `leadForm.completionDescription`, `ad.primaryText` |
| **High-Ticket** | `HighTicketEditor.tsx` | `offer.iHelpStatement`, `problems[].problem` / `.angst` / `.solution`, `offerScript[].body`, `sevenAs.*` prose, `giveaway`/value-resource prose, sales/triage script lines |
| **Lead-Gen** | `LeadGenEditor.tsx` | every format section prose block (`sections[].blocks[]` paragraph/list/note/example text for guide/ebook/SOP/course/etc.) — leave block *type* + headings as inputs |
| **Deliverables** (optional) | `DeliverablesEditor.tsx` | admin-overridable buyer copy blocks (prose only) |
| **Help Center** (optional) | `HelpEditor.tsx` | article `body` (already markdown-ish; convert if you want WYSIWYG) |

Leave-plain examples (do **not** convert): Community names/URLs and the
qualifying-question option lists; High-Ticket price/payment/timeline/guarantee
one-liners and program name; Lead-Gen title/subtitle/format select and section
headings; Email subject/preview/CTA label+url.

### Per-kit wiring notes
- **Arrays of prose** (Community script lines, High-Ticket `offerScript[]`,
  Lead-Gen `sections[].blocks[]`): render one `KitRichTextField` per element and
  patch by index/id; the parent save payload already sends the whole array.
- **Disabled state**: pass `disabled={busy !== null}` so fields lock during any
  generate/regenerate call, matching the existing editors.
- **Regenerate flow**: when a section is regenerated the new HTML flows back
  through `value`; `KitRichTextField`'s controlled sync (compare incoming `value`
  to the editor's `getHTML()`) repaints it without disturbing an active cursor.


---

## 3. Export sanitization (still to do)

Wherever a kit field is written into a flat export, wrap it in
`htmlToPromptText()` (or `kitTextForPrompt()`):

- `src/lib/mothermode/email/export.ts`
- `src/lib/mothermode/community/export.ts`
- `src/lib/mothermode/highticket/export.ts`
- `src/lib/mothermode/leadgen/export.ts`
- content exports in `src/lib/mothermode/content/export/*` if they ever emit kit
  fields directly.

```ts
import { htmlToPromptText } from '@/lib/mothermode/richtext';
lines.push(htmlToPromptText(email.body));
```

The AI generators need **no change** — they receive kit HTML only via context
packs, which `clampPack()` already flattens (§1).

### Rendering HTML in-app (optional)
If a delivery/preview page should render the formatting (not flatten it), use
`dangerouslySetInnerHTML` **only** with a sanitizer. Since the HTML is authored
by admins (trusted) via StarterKit (a constrained tag set), it is low-risk, but
prefer a sanitize pass if the surface is ever buyer-facing.

---

## 4. Verify

```bash
npx tsc --noEmit
npx vitest run tests/lib/richtext.test.ts tests/lib/context-packs.test.ts \
  tests/lib/email-kit.test.ts tests/lib/community-mappers.test.ts \
  tests/lib/high-ticket-mappers.test.ts
```

Add an export test asserting HTML is flattened, e.g.
`expect(exported).not.toContain('<p>')`.

---

## 5. Status in this repo

- **Foundation** (`richtext.ts`, `KitRichTextField`, prompt sanitize, tests): done.
- **Also fixed**: `context_refs` row field made optional in `community/types.ts`
  and `highticket/types.ts` (two-way-context work had it required, which broke
  the mapper test fixtures — now `context_refs?: unknown`).
- **Per-editor field swaps**:
  - **Email** (`EmailKitEditor`, `sequence.emails[].bodyText`): DONE — see
    `EMAIL_KIT_ADVANCED_FEATURES_PORT.md` §1.
  - **Community / High-Ticket / Lead-Gen** (and optionally Deliverables + Help):
    documented as the full inventory in §2 above; apply the same swap. Each is
    prose-only, no store/migration change.
- **Export sanitization**: wrap kit prose fields in `htmlToPromptText()` in each
  `export.ts` per §3 (email path lands with the email work; the other kits follow
  their editor swap). Prompt path is already covered by `clampPack()`.

> This doc is the authoritative rich-text rollout guide for **all** kits. The
> Email Kit is the reference implementation; port the remaining editors against
> the §2 inventory so every editable output field is rich-text.



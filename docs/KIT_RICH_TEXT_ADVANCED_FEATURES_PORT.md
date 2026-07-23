# Kit Rich-Text — Advanced Features Port

Adds a full formatting toolbar to the shared admin kit editor and makes that
formatting survive all the way into the rendered/exported email HTML.

## What changed

### 1. `src/components/mothermode/context/KitRichTextField.tsx`
The shared kit editor now registers, on top of the existing StarterKit
(which bundles Link + Underline) and Placeholder:

- `@tiptap/extension-text-style` + `@tiptap/extension-color` — brand-palette text color
- `@tiptap/extension-highlight` (multicolor) — brand-palette highlight
- `@tiptap/extension-text-align` (heading + paragraph) — left / center / right
- `@tiptap/extension-image` (`inline:false`, `allowBase64`) — inline images

New toolbar (dark-theme, ink/bone/brass): H2, H3, bold, italic, underline,
strike, text-color swatches, highlight swatches, bullet + ordered lists,
blockquote, horizontal rule, align left/center/right, link (prompt-based),
unlink, image (prompt for URL + alt), undo, redo.

Color and highlight are constrained to small brand swatches (not a free color
wheel) to protect the Editorial Warm look. The controlled-sync `useEffect`
(compare against the editor's own `getHTML()`) is preserved so AI rewrites and
kit loads paint without the cursor jumping mid-typing.

### 2. `src/utils/email/layout.ts`
`EmailDoc` gained an optional `bodyHtml?: string`. When present, `renderEmail`
injects it (inside a brand font/color wrapper) in place of `intro` + `sections`,
so admin formatting reaches the recipient. `renderText` gets a stripped-tags
fallback for the plaintext part.

### 3. `src/lib/mothermode/email/export.ts`
New exported `emailBodyHtml(input)` converts kit-editor HTML into
email-client-safe HTML with **inline** CSS:

- strips `<script>` / `<style>`
- inlines brand styling on `h2/h3/p/blockquote/hr/ul/ol/li/a/img`
- preserves `text-align` from the editor's inline style
- keeps only `color` on `<span>`; converts `<mark>` to an inline background span
- keeps basic marks (`strong/b/em/i/u/s`) as-is
- drops any tag outside a whitelist (keeps inner text)
- leaves `{{token}}` markers intact for the send pipeline

`emailToEmailDoc` now branches on `looksLikeHtml(email.bodyText)`: rich HTML
bodies flow through `emailBodyHtml` (`bodyHtml`), while legacy plain-text bodies
still render as brand `sections` via `htmlToPromptText` → `bodyTextToSections`.
`sequenceToText` / `sequenceToRows` are unchanged (still flatten for CSV/GHL).

## Flatten path (unchanged, still used elsewhere)
`htmlToPromptText()` in `src/lib/mothermode/richtext.ts` continues to flatten
kit HTML to plain text wherever a prompt or flat export needs it. No change
was required there — its generic tag-strip already handles the new span/mark
elements.

## Tests
`tests/lib/email-kit.test.ts` — the former "flattens rich body" case was
updated to assert **preservation** instead: scripts are still stripped
(`<script>`, `bad()`, `&lt;script&gt;` all absent) while `<strong>Hi</strong>`
and an inline image `src` survive.

## Verify
```
npx tsc --noEmit
npx vitest run tests/lib/richtext.test.ts tests/lib/email-kit.test.ts
```
Result: tsc clean; 24 tests pass (11 richtext + 13 email-kit).
```
```

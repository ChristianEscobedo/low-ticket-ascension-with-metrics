# Kit Rich-Text (TipTap) Editor — Tools & Full Capability Port

**Status:** Shipped. This is a *system port* / reference doc describing the
current capabilities of the shared admin rich-text editor so it can be re-created
faithfully in another codebase (or extended safely here).

**Primary file:** `src/components/mothermode/context/KitRichTextField.tsx`
**Companion helpers:** `src/lib/mothermode/richtext.ts` (HTML ↔ prompt/plain-text),
`src/utils/email/layout.ts` + `src/lib/mothermode/email/export.ts` (HTML preserved
for email sends), `src/lib/mothermode/email/tokens.ts` +
`src/lib/mothermode/email/customTokens.ts` (merge tokens).

---

## 1. Purpose & positioning

`KitRichTextField` is the **admin-side** rich-text editor used by every kit
editor (Email Marketing, Lead Gen, High Ticket, Community, Deliverables, etc.).
It serializes to **HTML** and keeps that markup so admins can fine-tune
formatting that survives all the way to an email send.

It is deliberately distinct from the content hub's `RichTextField`, which
serializes to **plain text** for social-platform posting. Two editors, two
serialization targets, one mental model:

| Editor | File | Serializes to | Used by |
| --- | --- | --- | --- |
| `KitRichTextField` | `context/KitRichTextField.tsx` | **HTML** | Admin kit editors |
| `RichTextField` (content) | content hub | **plain text** | Social post composer |

The stored HTML is flattened back to plain text wherever it feeds a prompt or a
flat export via `htmlToPromptText()` in `@/lib/mothermode/richtext`. The email
exporter preserves the markup through `emailBodyHtml()` so recipients see the
styling.

**Theme:** styled for the admin **dark** theme (ink / bone / brass tokens) so it
sits inside kit editors without a jarring light surface.

---

## 2. Dependencies (TipTap v3)

```
@tiptap/react              // useEditor, EditorContent, Editor type
@tiptap/starter-kit        // paragraph, headings, bold, italic, lists, quote,
                           // hr, history (undo/redo), AND (v3) Link + Underline
@tiptap/extension-placeholder
@tiptap/extension-image
@tiptap/extension-text-align
@tiptap/extension-text-style   // required carrier mark for Color
@tiptap/extension-color
@tiptap/extension-highlight
```

Icons come from `lucide-react`.

> **v3 gotcha (important):** StarterKit v3 **bundles Link and Underline**.
> Do NOT also register `@tiptap/extension-link` / `@tiptap/extension-underline`
> as separate extensions — you'll get "duplicate extension" warnings and broken
> commands. Configure Link *through* `StarterKit.configure({ link: {...} })`
> instead (see §4).

---

## 3. Supported marks / nodes (full capability list)

| Capability | TipTap source | Toolbar control |
| --- | --- | --- |
| Headings **H2 / H3 only** | StarterKit `heading: { levels: [2,3] }` | `Heading2`, `Heading3` |
| Bold | StarterKit | `Bold` |
| Italic | StarterKit | `Italic` |
| Underline | StarterKit (v3 bundled) | `Underline` |
| Strikethrough | StarterKit | `Strikethrough` |
| Bullet list | StarterKit | `List` |
| Ordered list | StarterKit | `ListOrdered` |
| Blockquote | StarterKit | `Quote` |
| Horizontal rule | StarterKit | `Minus` |
| Text color (brand palette) | TextStyle + Color | `Palette` swatch flyout |
| Highlight (brand palette, multicolor) | Highlight | `Highlighter` swatch flyout |
| Paragraph alignment (L/C/R) | TextAlign (`heading`, `paragraph`) | `AlignLeft/Center/Right` |
| Link (add/remove, autolink) | StarterKit link | `Link2` / `Link2Off` |
| Inline image (URL + alt, base64 allowed) | Image (`inline:false`, `allowBase64:true`) | `ImageIcon` |
| Merge tokens `{{token}}` | insertContent | `Braces` "Tokens" dropdown (conditional) |
| Undo / Redo | StarterKit history | `Undo2` / `Redo2` (disabled-aware) |

### Brand-safe palettes
Text color and highlight are **constrained to a small palette** (not a free
color wheel) to protect the Editorial-Warm look and keep every send on-brand:

- **Text colors:** Ink `#211d17`, Brass `#c9a24b`, Clay `#a6532f`, Sage `#5b6b4f`, Slate `#3b4a5a`
- **Highlights:** Brass `#f3e6c4`, Sage `#dfe7d5`, Sky `#d7e6f0`, Blush `#f4dcd4`

Each swatch flyout also has a **Clear** action (`unsetColor` / `unsetHighlight`).

---

## 4. Editor configuration (exact)

```ts
useEditor({
  immediatelyRender: false,          // SSR-safe (Next.js) — avoids hydration mismatch
  editable: !disabled,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,          // don't navigate away while editing
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    Placeholder.configure({ placeholder: placeholder ?? '' }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false, allowBase64: true }),
  ],
  content: toInitialHtml(value),
  editorProps: {
    attributes: {
      class: 'kit-rte-content w-full px-3 py-2 text-sm text-bone focus:outline-none',
      style: `min-height:${minHeight}`,
    },
  },
  onUpdate: ({ editor }) => {
    // Emit '' for a truly-empty editor (but keep image-only bodies).
    const html = editor.getText().trim() === '' && !editor.getHTML().includes('<img')
      ? ''
      : editor.getHTML();
    onChangeRef.current(html);
  },
});
```

---

## 5. Merge tokens (`{{token}}`)

The toolbar shows a **Tokens** dropdown *only when* the field is given a
non-empty `tokens: RichTextToken[]` prop, so non-email kit editors never see it.
Picking a token inserts the raw `{{token}}` marker at the cursor via
`editor.chain().focus().insertContent(t).run()`.

```ts
export interface RichTextToken {
  token: string;        // full marker inserted into copy, e.g. '{{first_name}}'
  label: string;        // short human label for the menu
  description?: string; // optional helper text under the label
}
```

`RichTextToken` is structurally compatible with the email module's
`EmailMergeToken` but kept **local** to the field so it stays decoupled from the
email module and reusable by any kit editor. The email editor feeds it the union
of built-in tokens (`tokens.ts`) and admin-defined custom tokens
(`customTokens.ts`).

---

## 6. Three tricky behaviors worth copying exactly

These are the parts that took iteration; port them verbatim.

### 6a. Legacy plain-text → HTML on load (`toInitialHtml`)
Older kits stored bare plain text. On load, wrap it in paragraphs (splitting on
blank lines, converting single newlines to `<br>`, and HTML-escaping) — but if
the value already looks like HTML, pass it through untouched:

```ts
function toInitialHtml(value: string): string {
  if (!value) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;      // already HTML
  return value
    .split(/\n{2,}/)
    .map((b) => `<p>${b
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');
}
```

### 6b. Stable `onChange` via ref (don't recreate the editor)
Keep the latest `onChange` in a ref so the editor's `onUpdate` closure always
calls the current handler **without recreating the editor** on every render:

```ts
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;
// ...onUpdate: () => onChangeRef.current(html)
```

### 6c. Controlled sync that never jumps the cursor
The killer detail: to reconcile external `value` changes (AI rewrites, kit
loads) **without** stealing the cursor mid-typing, compare the incoming value
against the editor's OWN serialized HTML — not a "last emitted" ref:

```ts
useEffect(() => {
  if (!editor) return;
  const incoming = toInitialHtml(value);
  const currentRaw = editor.getHTML();
  const current = currentRaw === '<p></p>' ? '' : currentRaw;
  const normalizedIncoming = incoming === '<p></p>' ? '' : incoming;
  if (normalizedIncoming === current) return;   // no-op while the user types
  editor.commands.setContent(normalizedIncoming);
}, [value, editor]);
```

A user's own keystrokes produce a `value` that equals `editor.getHTML()`, so
this is a no-op mid-typing (cursor never jumps); an external replacement always
differs and is applied. Also keep editability in sync:

```ts
useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
```

---

## 7. Toolbar component structure

- `ToolButton` — icon button with `active` (aria-pressed), `disabled`, and
  `onMouseDown={e => e.preventDefault()}` so clicking a button does **not** blur
  the editor / lose the selection.
- `Divider` — thin vertical separator.
- `SwatchMenu` — click-outside-closing flyout of brand swatches + Clear
  (used for both text color and highlight).
- `TokenMenu` — click-outside-closing dropdown of merge tokens (conditional).
- `Toolbar` — lays out the groups: headings · text marks + color/highlight ·
  lists/quote/hr · alignment · link/image · tokens · undo/redo.

Link/image prompts use `window.prompt` (URL, then optional alt text for images);
empty URL on the link action unsets the link.

---

## 8. Styling (scoped, via `styled-jsx global`)

Content styles are scoped under `.kit-rte .kit-rte-content …`: paragraph
spacing, H2/H3 sizes, disc/decimal list padding, brass-bordered blockquote,
hairline `hr`, rounded responsive images (with a brass outline on the selected
image node), brass underlined links, rounded `mark` highlights with dark text,
and the empty-editor placeholder via `p.is-editor-empty:first-child::before`
using `attr(data-placeholder)`.

---

## 9. Public props

```ts
KitRichTextField: React.FC<{
  value: string;                 // stored HTML (or legacy plain text)
  placeholder?: string;
  minHeight?: string;            // default '6rem'
  disabled?: boolean;
  tokens?: RichTextToken[];      // non-empty => show Tokens dropdown
  onChange: (html: string) => void;
}>
```

---

## 10. Porting checklist

- [ ] Install the 8 TipTap packages above (v3) + `lucide-react`.
- [ ] Register Link/Underline **through StarterKit**, not as separate extensions.
- [ ] Add `TextStyle` before `Color` (Color needs the textStyle carrier mark).
- [ ] Set `immediatelyRender: false` for SSR frameworks (Next.js).
- [ ] Copy `toInitialHtml`, the onChange ref, and the controlled-sync effect verbatim.
- [ ] Constrain color/highlight to a brand palette; wire Clear actions.
- [ ] Gate the Tokens dropdown on a non-empty `tokens` prop.
- [ ] Provide an HTML→plain-text flattener for prompt/flat-export paths.
- [ ] Preserve HTML on the email-send path (don't flatten there).
- [ ] Recreate the scoped content CSS (or map to your design tokens).
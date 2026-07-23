# Email Images In-Body, Studio Text/Overlay, & Funnel Asset Library — Port Guide

Three related upgrades to the Email Marketing Kit + a cross-kit asset system:

1. **Insert a generated/edited image into the email body** at the cursor (a
   trigger in the Image Studio and a `[[image]]` slash command in the editor).
2. **Open any gallery image back in the Studio to add text / overlays / edits**
   (round-trip an existing image, not just generate/edit fresh ones).
3. **Store email sequences in a library and attach them to funnels as assets** —
   a polymorphic `funnel_assets` join that works for every kit type, resolving
   through the existing Context Bridge.

Status: **the prompt/export sanitizer already handles `<img>`** (done in
`src/lib/mothermode/richtext.ts` — `htmlToPromptText()` collapses `<img>` to
`[image: alt]`). Everything else below is the implementation plan, with exact
code, verified against the current files.

---

## Part 1 — Insert image into the email body

### 1a. Add an opt-in Image node to `KitRichTextField`

`KitRichTextField` (`src/components/mothermode/context/KitRichTextField.tsx`)
today runs `StarterKit` + `Placeholder`. StarterKit does **not** include images,
so add `@tiptap/extension-image`.

```bash
npm i @tiptap/extension-image
```

Make images **opt-in** so only the email editor renders them (other kits stay
text-only):

```tsx
import Image from '@tiptap/extension-image';
import { ImageIcon } from 'lucide-react'; // optional toolbar button

export const KitRichTextField: React.FC<{
  value: string;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  onChange: (html: string) => void;
  /** Enable inline images (email kit only). */
  allowImages?: boolean;
  /** Called when the toolbar image button is pressed (opens the Studio). */
  onRequestImage?: () => void;
  /** Imperative handle so the parent can insert a URL at the cursor. */
  editorRef?: React.MutableRefObject<Editor | null>;
}> = ({ value, placeholder, minHeight = '6rem', disabled, onChange,
        allowImages, onRequestImage, editorRef }) => {
  ...
  const editor = useEditor({
    ...
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      ...(allowImages
        ? [Image.configure({ inline: false, allowBase64: false })]
        : []),
    ],
    ...
  });

  // expose editor to parent for imperative insert
  useEffect(() => {
    if (editorRef) editorRef.current = editor ?? null;
  }, [editor, editorRef]);
```

> `allowBase64: false` enforces the "hosted URL only" rule — the studio always
> returns a public URL from `aiHostImage`/`aiGenerateImage`, never a data URL,
> which is what inbox clients and ESP imports need.

Add an image button to the `Toolbar` (only when `allowImages`), wired to
`onRequestImage`, so the admin can open the Studio to pick/insert:

```tsx
{allowImages && onRequestImage && (
  <ToolButton icon={ImageIcon} label="Insert image"
    onClick={onRequestImage} />
)}
```

Style the node so it doesn't blow out the dark editor:

```css
.kit-rte .kit-rte-content img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}
.kit-rte .kit-rte-content img.ProseMirror-selectednode {
  outline: 2px solid var(--brass, #c9a24b);
}
```

### 1b. "Insert into body" trigger in the Studio

`EmailImageStudio` (`src/components/mothermode/email/EmailImageStudio.tsx`)
already keeps `images[]` and renders a gallery. Add an optional callback and a
tile action:

```tsx
interface Props {
  ...
  /** When provided, gallery tiles show an "Insert into body" action. */
  onInsertIntoBody?: (url: string) => void;
}
```

In each gallery tile's hover action row (next to Set-hero/Download/Remove):

```tsx
{onInsertIntoBody && (
  <button type="button" onClick={() => onInsertIntoBody(src)}
    className={tileBtn} title="Insert into email body">
    <CornerDownLeft className="h-3.5 w-3.5" />
  </button>
)}
```

### 1c. Wire it in `EmailKitEditor`

The editor owns the email being edited (subject/body/images). It already renders
the body via `KitRichTextField` and opens `EmailImageStudio`. Add an editor ref
and pass both callbacks:

```tsx
const bodyEditorRef = useRef<Editor | null>(null);

function insertImageIntoBody(url: string) {
  const ed = bodyEditorRef.current;
  if (!ed) return;
  ed.chain().focus().setImage({ src: url, alt: '' }).run();
  // body onChange fires via the editor's onUpdate → patches email.bodyText
  setStudioOpen(false);
}

<KitRichTextField
  value={email.bodyText}
  allowImages
  editorRef={bodyEditorRef}
  onRequestImage={() => setStudioOpen(true)}
  onChange={(html) => patchEmail(email.id, { bodyText: html })}
  disabled={busy !== null}
/>

<EmailImageStudio
  open={studioOpen}
  images={email.images}
  onChange={(next) => patchEmail(email.id, { images: next })}
  onInsertIntoBody={insertImageIntoBody}
  onClose={() => setStudioOpen(false)}
  hook={email.subject}
  context={{ theme: kit.theme, tone: kit.tone }}
/>
```

Optional: register a `[[image]]` input rule / slash command that calls
`onRequestImage()`. Simplest version — a keyboard shortcut in the editor config
(`addKeyboardShortcuts`) or a small regex `InputRule` that opens the studio when
the admin types `[[image]]`. The toolbar button covers the primary path; the
slash command is a nice-to-have.

### 1d. ESP HTML export keeps the `<img>`

`src/lib/mothermode/email/export.ts` renders the sequence to ESP-ready HTML. The
body HTML already contains `<img src="https://…">` from the editor — just make
sure the export **does not** run the body through `htmlToPromptText()` (that path
is for flat/CSV/text exports and prompts, which correctly collapse to `[image]`).
For the HTML export, inline a width cap so Outlook/Gmail behave:

```ts
// when emitting HTML email body, post-process <img> to add inline styles:
bodyHtml = bodyHtml.replace(
  /<img\b([^>]*?)>/gi,
  '<img$1 style="max-width:100%;height:auto;display:block;margin:12px 0;" />',
);
```

Plain-text / CSV / GHL exports keep using `htmlToPromptText()` → `[image: alt]`.

### 1e. Tests
Extend `tests/lib/richtext.test.ts`:
```ts
expect(htmlToPromptText('<p>Hi</p><img src="x.png" alt="Hero shot">'))
  .toBe('Hi\n\n[image: Hero shot]'.trim());
expect(htmlToPromptText('<img src="x.png">')).toContain('[image]');
```

---

## Part 2 — Round-trip a gallery image back into the Studio (text/overlay/edit)

Goal: click an existing image and re-open it as the **seed** on the Edit tab so
you can add text, overlays, or further AI edits — then the result appends to
`images[]` like any other edit.

`EmailImageStudio` already supports a seed on the Edit tab and defaults it to the
primary image. Add an explicit "Edit this" action on each gallery tile:

```tsx
<button type="button"
  onClick={() => { setSeed(src); setTab('edit'); }}
  className={tileBtn} title="Edit in studio">
  <PenLine className="h-3.5 w-3.5" />
</button>
```

### Text overlays (two options)

- **AI text (fastest, no new UI):** the Edit tab already sends `editPrompt` to
  `aiEditImage`. Instruct via prompt ("add the headline 'Doors close Friday' in
  bold across the top third"). Works today once 2's "Edit this" button exists.
- **Deterministic overlay (crisp text, reuses existing code):** the content hub
  already has an overlay compositor — `src/lib/mothermode/content/imageOverlay.ts`
  (+ `OverlayPanel.tsx`, tested in `tests/lib/image-overlay.test.ts`). To give the
  email studio the same precise text/badge overlay:
  1. Add an **"Overlay" tab** to `EmailImageStudio` beside Generate/Edit.
  2. Reuse `imageOverlay.ts` to composite headline/subhead/badge onto the seed on
     a `<canvas>`, then `aiHostImage(canvasDataUrl)` to get a hosted URL and
     append to `images[]`.
  3. Keep the same field styling (`labelCls`/`fieldCls`) for consistency.

Recommended: ship the AI-prompt path with the "Edit this" button first (tiny),
then port the deterministic overlay tab from `imageOverlay.ts` for pixel-accurate
text. See `docs/IMAGE_OVERLAY_SYSTEM_PORT.md` for the compositor's API.

---

## Part 3 — Email sequence library + funnel assets

The kit table is already the **library**; add one polymorphic join for **funnel
attachment** that works for every kit, resolving through the Context Bridge.

### 3a. Migration — `supabase/migrations/20260805000000_mothermode_funnel_assets.sql`

```sql
create table if not exists mothermode_funnel_assets (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null,
  asset_type text not null
    check (asset_type in
      ('email-kit','lead-gen','community','high-ticket','offer')),
  asset_id uuid not null,
  label text not null default '',
  position int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_id, asset_type, asset_id)
);
create index if not exists mothermode_funnel_assets_funnel_idx
  on mothermode_funnel_assets (funnel_id, position);
```

> Polymorphic on purpose: the same table attaches ANY kit to a funnel later, not
> just email. It mirrors the `ContextRef` shape already used by the two-way
> context work, so a funnel asset and a context ref speak the same language.

### 3b. Types + store — `src/lib/mothermode/funnel-assets/`

`types.ts`:
```ts
export type FunnelAssetType =
  | 'email-kit' | 'lead-gen' | 'community' | 'high-ticket' | 'offer';

export interface FunnelAsset {
  id: string;
  funnelId: string;
  assetType: FunnelAssetType;
  assetId: string;
  label: string;
  position: number;
}

// row → record mapper mirrors the other kits (str()/num() helpers).
```

`store.ts` (mirror `email/store.ts` patterns — service client, `COLUMNS`,
`listAssetsForFunnel(funnelId)`, `attachAsset(input)`, `detachAsset(id)`,
`reorderAssets(...)`).

### 3c. Resolver — reuse the Context Bridge

A funnel asset resolves to a `ContextPack` through the SAME path as a
`ContextRef`. In `src/lib/mothermode/context/`:
- Map `FunnelAsset → ContextRef` (`{ kind: assetType+'-kit', id: assetId }`) and
  feed the existing `resolveContextRefs()` in `context/resolve.ts` /
  `context/fromKits.ts`. No new resolver logic — just an adapter.
- This means an attached email sequence can immediately feed the content
  generator or any other kit that lists context sources.

### 3d. Library UI (email)
On `src/app/admin/email-marketing/page.tsx` the kit list IS the library. Add a
search box + `status` filter (`draft|active|archived`, already on the row). No
new table.

### 3e. Attach UI
- In `EmailKitEditor`, add an **"Attach to funnel"** control: pick funnel +
  optional label + position → `attachAsset({ funnelId, assetType:'email-kit',
  assetId: kit.id, ... })`.
- On the funnel page, render `listAssetsForFunnel(funnelId)` with reorder +
  detach. The funnel holds only a **reference**; editing the kit updates
  everywhere, nothing is duplicated.

### 3f. Route
Add `src/app/api/admin/mothermode-funnel-assets/route.ts` (GET list by funnel,
POST attach, DELETE detach, PATCH reorder) following the existing admin route
auth pattern.

---

## Build order (recommended)

1. **Part 1** (in-body image): package install + `KitRichTextField` opt-in image
   + Studio "Insert into body" + editor wiring + HTML-export width cap + tests.
   Self-contained, no migration.
2. **Part 2a** ("Edit this" seed round-trip): trivial once Part 1 lands.
3. **Part 2b** (deterministic overlay tab): port `imageOverlay.ts` into a new
   Studio tab.
4. **Part 3** (funnel assets): one migration + `funnel-assets/` module + Context
   Bridge adapter + route + attach UI. Unlocks attaching every kit type.

## Verify
```bash
npm i @tiptap/extension-image
npx tsc --noEmit
npx vitest run tests/lib/richtext.test.ts tests/lib/context-packs.test.ts \
  tests/lib/email-kit.test.ts tests/lib/image-overlay.test.ts
```

## Cross-links
- Reference implementation: `docs/EMAIL_KIT_ADVANCED_FEATURES_PORT.md`,
  `docs/EMAIL_IMAGE_STUDIO_HANDOFF.md`.
- Rich-text foundation: `docs/KIT_RICH_TEXT_EDITING_PORT.md`.
- Overlay compositor: `docs/IMAGE_OVERLAY_SYSTEM_PORT.md`.
- Context Bridge: `docs/TWO_WAY_CONTEXT_SYSTEM_PORT.md`,
  `docs/OFFER_KIT_CONTEXT_BRIDGE_SYSTEM_PORT.md`.
</content>
<parameter name="task_progress">## Image-in-email + Studio overlay + Funnel library
- [x] Read core files (KitRichTextField, EmailImageStudio, richtext, export, editor)
- [x] richtext.ts: handle <img> in htmlToPromptText (DONE, live)
- [x] Write comprehensive port doc (in-body insert trigger, studio round-trip/overlay, funnel assets)
- [ ] Cross-link from master doc
- [ ] Verify richtext test still green
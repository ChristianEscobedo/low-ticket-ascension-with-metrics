# Email Kit — per-email Image Studio (generate / edit / multi-seed) — HANDOFF

Goal: from an image placeholder on each email in the Email Marketing Kit editor,
open a popup where the admin can (a) write/AI-generate an image prompt then
generate an image, or (b) upload/add an image and edit it with AI, using
**multiple images for seeding/context**. Store the resulting images on the email.

This is a UI + type-field task. **No new API route or DB migration is needed** —
the AI endpoint already supports everything, and email images ride inside the
existing `sequence` JSON column.

## Verified building blocks (already exist, reuse them)

- `POST /api/mothermode/ai` (`src/app/api/mothermode/ai/route.ts`) supports:
  - `action:'image'` → `{ prompt, format?, model? }` → `{ image }` (hosted URL)
  - `action:'imageEdit'` → `{ prompt, seed, references?[≤4], format?, model? }` → `{ image }`
  - `action:'imagePrompts'` → `{ count, hook, guides?, avoid?, context? }` → `{ prompts:string[] }`
  - `action:'hostImage'` → `{ dataUrl }` → `{ image }` (host a local upload/data URL)
- Client wrappers in `src/components/mothermode/content/aiClient.ts`:
  - `aiGenerateImage(prompt, format?, model?)`
  - `aiEditImage({ prompt, seed, references?, format?, model? })`
  - `aiImagePrompts({ count, hook, guides?, avoid?, context? })`
  - `aiHostImage(dataUrl)`
- Image model constants in `@/lib/mothermode/content`: `IMAGE_MODELS`,
  `EDIT_IMAGE_MODELS`, `AUTO_MODEL`, `MAX_EDIT_REFERENCES` (=4).
- `readFileAsDataUrl` pattern + AI busy/error UX (`useAiAction`, `Spinner`,
  `AiError`, `aiBtnSolid`, `aiBtnGhost` from `./AiControls`) — see
  `ImageStudioModal.tsx` for the exact copy/paste-able patterns.

## Step 1 — data field on the email (confirmed shapes)

File: `src/lib/mothermode/email/types.ts`

- In `EmailMessage` (ends ~line 265, after `psFramework: EmailPsFramework;`) add:
  ```ts
  /** Hosted image URLs attached to this email (first = primary/hero). */
  images: string[];
  ```
- In `blankEmail()` (ends ~line 289) add `images: [],` to the returned object.
- In `normalizeEmail(...)` (lines 321–468 range — read that half first) add a
  normalizer that keeps only non-empty strings:
  ```ts
  images: Array.isArray(raw.images)
    ? raw.images.filter((s): s is string => typeof s === 'string' && !!s.trim())
    : [],
  ```
  Match the exact destructure/guard style already used in that function.

Because the sequence is persisted as JSON in `store.ts`, **no migration** and
**no store change** is required — `images` serializes automatically. (Confirm by
reading `email/store.ts` sequence write; it stringifies the whole sequence.)

Optional (nice-to-have, not required): include images in `email/export.ts`
HTML render so exported emails show the hero image. Add a test in
`tests/lib/email-kit.test.ts` for `normalizeEmail` dropping malformed `images`.

## Step 2 — build the modal

New file: `src/components/mothermode/content/EmailImageStudio.tsx` (client
component). Self-contained; model it on `ImageStudioModal.tsx` but simplified —
no `ContentPiece`/`PieceReview` coupling. Props:

```ts
{
  open: boolean;
  onClose: () => void;
  images: string[];                 // current email.images
  onChange: (next: string[]) => void; // write back to email.images
  /** For the "AI write prompt" seed. */
  hook?: string;                    // email.subject || email.summary
  context?: { theme?: string; tone?: string };
}
```

Two tabs (`generate` | `edit`), plus a gallery:

- **Generate tab**: prompt `<textarea>`; a "✨ Write prompt with AI" button that
  calls `aiImagePrompts({ count:1, hook: hook||'', context })` and drops the
  first result into the textarea; model `<select>` (Auto + `IMAGE_MODELS`);
  "Generate" → `aiGenerateImage(prompt, 'feed', model||undefined)` then
  `onChange([...images, url])`. Use `format:'feed'` (email hero ≈ 4:5/landscape;
  'feed' is fine — or omit for default).
- **Edit tab**: a **seed** picker (choose from `images` or upload via
  `readFileAsDataUrl` → `aiHostImage`), a **references** multi-upload
  (up to `MAX_EDIT_REFERENCES`, each hosted the same way — these are the
  "multiple images for seeding/context"), an edit-instruction `<textarea>`,
  model `<select>` (Auto + `EDIT_IMAGE_MODELS`); "Edit" →
  `aiEditImage({ prompt, seed, references, model })` then append the URL.
- **Gallery**: grid of `images`; per-tile actions = set-as-primary (move to
  index 0 via `onChange`), download (`downloadUrl` from
  `@/utils/mothermode/download`), remove. Reuse the AI busy/error controls.

Keep uploads hosted: always run local files/data URLs through `aiHostImage`
before storing, so saved kit URLs are public and stable (same reasoning the AI
route hosts its own renders).

## Step 3 — wire into the editor

File: `src/app/admin/email-marketing/EmailKitEditor.tsx` (read in full first).

For each email card:
1. Add an **image placeholder** block: if `email.images.length` show the primary
   thumbnail (with a small "N images" badge); else a dashed "Add image" tile.
   Clicking either opens the studio for that email.
2. Track which email's studio is open, e.g. `const [imageFor, setImageFor] =
   useState<string | null>(null)` (store the email id).
3. Render one `<EmailImageStudio open={imageFor===email.id} ... />` (or a single
   instance keyed to the active email) with:
   - `images={email.images}`
   - `onChange={(next) => patchEmail(email.id, { images: next })}` — reuse the
     existing per-email patch helper (the same one `psFramework`/`branch` use).
   - `hook={email.subject || email.summary}`
   - `context={{ theme: intake.audience, tone: intake.tone }}`
4. Confirm the save payload already sends the whole `sequence` (it does — emails
   are saved as a unit), so `images` persists with no extra plumbing.

## Verify

```
npx tsc --noEmit
npx vitest run tests/lib/context-packs.test.ts tests/lib/email-kit.test.ts
```

(Windows PowerShell: redirect to a temp file and read it, e.g.
`npx tsc --noEmit > tsc.txt 2>&1; type tsc.txt`; an empty file = no errors.)

## Notes / gotchas

- `MAX_EDIT_REFERENCES` = 4; enforce it in the references uploader (mirror the
  `room = MAX_EDIT_REFERENCES - references.length` guard in `ImageStudioModal`).
- `aiGenerateImage`/`aiEditImage` already return **hosted** URLs; only local
  uploads/data URLs need `aiHostImage`.
- Don't import `ImageStudioModal` directly — it's bound to `ContentPiece`; the
  new `EmailImageStudio` is the lean, email-shaped version.

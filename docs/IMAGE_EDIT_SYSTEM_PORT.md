# Image Edit System — Port Checklist

Use this to copy the seed-based image edit feature into a sibling codebase that already has the MotherMode content hub Image Studio (text-to-image only).

## Feature summary

| Area | What was added |
|------|----------------|
| UI | Image Studio **Generate** / **Edit** tabs |
| Seed | Use gallery image or upload as base for edit |
| References | Multi-add up to **4** extra images (character, logo, product, etc.) |
| Presets | One-tap prompt injections (colors, character, context, environment, text, lighting, restyle, remove, logo) |
| API | New action `imageEdit` on `/api/mothermode/ai` |
| Providers | OpenAI GPT Image edits + Gemini multi-image edit |
| Models | Edit only on models with `supportsEdit: true` (not DALL·E 3) |

Edited results still go into the existing review gallery via `onAddImages` (no DB migration).

### Also used from Generate review

`BatchPanel` mounts this same studio during the **review drafts** phase (before library save). Parent supplies a synthetic `PieceReview` from local `draftImages` and wires `onAddImages` / `onRemove` / `onSetIndex` / `onUpload` to that local state. On **Save to library**, BatchPanel calls `setReviewImages` so frames land on the real piece gallery.

**Seed prompt effect** must reset when `piece.id` changes (not only on first open), or switching focused drafts leaks the previous prompt:

```ts
useEffect(() => {
  if (!open) return;
  const scene = piece.media?.prompt ?? piece.visual ?? '';
  setPrompt(scene);
}, [open, piece.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

Full Generate + image bridge port: `docs/CONTENT_GENERATE_SYSTEM_PORT.md`.

---


## Files changed (6)

Copy or re-apply changes in this order.

### 1. `src/lib/mothermode/content/models.ts`

**Add to `ImageModelOption`:**
```ts
/** When true, the model can take a seed image (and optional refs) for edits. */
supportsEdit?: boolean;
```

**On edit-capable models in `IMAGE_MODELS`:**
```ts
{ id: 'gpt-image-2', ..., supportsEdit: true },
{ id: 'gemini-2.5-flash-image', ..., supportsEdit: true },
// dall-e-3: leave supportsEdit undefined/false
```

**Export:**
```ts
export const EDIT_IMAGE_MODELS: ImageModelOption[] = IMAGE_MODELS.filter(
  (m) => m.supportsEdit,
);
```

Already re-exported via `export * from './models'` in `src/lib/mothermode/content/index.ts` if that pattern exists.

---

### 2. `src/lib/mothermode/content/constants.ts`

**Add after `buildImagePrompt`:**

- `ImageEditPreset` interface (`id`, `label`, `inject`)
- `MAX_EDIT_REFERENCES = 4`
- `IMAGE_EDIT_PRESETS` array with presets:

| id | label |
|----|--------|
| `colors` | Change colors |
| `character` | Add character |
| `context` | Change context |
| `environment` | Change environment |
| `text` | Change text |
| `lighting` | Adjust lighting |
| `restyle` | Restyle |
| `remove` | Remove object |
| `logo` | Add logo |

Each preset has a long `inject` string appended into the edit prompt when the chip is selected.

**Do not break existing exports** (`PLATFORM_LABEL`, `FORMAT_LABEL`, `TONE_LABEL`, etc.). In this repo `TONE_LABEL` is:

```ts
wedge / confidante / authority / movement / system
```

---

### 3. `src/utils/integrations/openai-content.ts`

**New public API:**
```ts
export interface ImageInput {
  mime: string;
  base64: string;
  name: string;
}

export async function editContentImage(
  prompt: string,
  size: ImageSize,
  seed: string,              // data URL or https URL
  references?: string[],     // same
  model?: string,
): Promise<AiResult<string>>  // base64 data URL
```

**Helpers:**
- `resolveImageInput(src, label)` — data URL or fetch https → `{ mime, base64, name }`; ~12MB cap
- `extForMime(mime)`
- `editOpenAiImage` — `POST /v1/images/edits` multipart:
  - fields: `model`, `prompt`, `size`, `n`
  - repeated `image` parts: seed first, then references
  - body: `Blob` from `Uint8Array(Buffer.from(base64))`
- `editGeminiImage` — `generateContent` with parts: seed inlineData, ref inlineData(s), then text prompt

**Model fallback:** if requested model lacks `supportsEdit`, force `gpt-image-2` / OpenAI.

---

### 4. `src/app/api/mothermode/ai/route.ts`

**Import:** `editContentImage` from openai-content.

**New branch after `action === 'image'`:**

```ts
if (action === 'imageEdit') {
  // require prompt + seed
  // references: string[] max 4
  // fullPrompt = `${prompt}. Keep the seed composition as the base. ${IMAGE_STYLE}`
  // editContentImage(fullPrompt, size, seed, references, model)
  // hostGeneratedImage(result.data)
  // return { ok: true, image }
}
```

Update the file header comment to document `imageEdit`.

---

### 5. `src/components/mothermode/content/aiClient.ts`

**Add:**
```ts
export async function aiEditImage(args: {
  prompt: string;
  seed: string;
  references?: string[];
  format?: string;
  model?: string;
}): Promise<string> {
  const json = await postAi({ action: 'imageEdit', ...args });
  if (typeof json.image !== 'string') throw new Error('No image was returned');
  return json.image;
}
```

---

### 6. `src/components/mothermode/content/ImageStudioModal.tsx`

**Replace / extend** the left rail (keep gallery, primary, download, remove).

**Imports to add:**
- `EDIT_IMAGE_MODELS`, `IMAGE_EDIT_PRESETS`, `MAX_EDIT_REFERENCES`
- `aiEditImage`
- `Wand2` icon
- `useMemo` if not already imported

**State:**
- `tab: 'generate' | 'edit'`
- separate `editPrompt`, `editModel`, `editCount`
- `seed: string | null`
- `references: string[]`
- `presetIds: Set<string>`

**Behavior:**
- Generate tab = previous text-to-image UI
- Edit tab:
  - seed picker (gallery thumbs + upload seed)
  - multi reference upload (max 4)
  - preset chips (toggle append injects)
  - freeform instructions
  - variants + model select from `EDIT_IMAGE_MODELS` only
  - Edit button → `aiEditImage` × N → `onAddImages`
- Default seed = primary gallery image when studio opens
- Gallery hover: “Use as seed” when on Edit tab
- Compose prompt: selected preset injects + freeform, joined with `\n\n`

**Helpers:**
- `readFileAsDataUrl(file)`
- `StudioTabs` segmented control

`ImagesCard.tsx` does **not** need changes if it still mounts `ImageStudioModal` with the same props.

---

## No changes required

- DB / Supabase migrations
- `reviewClient` / review store (still `onAddImages`)
- `ImagesCard.tsx` (unless you want a different entry point)
- Amplify composer image axis (separate generate path)

---

## Quick verify on the other codebase

1. Open content piece → **Open image studio**
2. **Generate** still creates images from text
3. **Edit** tab appears
4. With a gallery image (or uploaded seed): pick preset + instruction → **Edit**
5. Optional: add 1–2 reference images → edit again
6. New frames appear in gallery; set primary works
7. DALL·E 3 not listed on Edit model dropdown
8. Missing seed or empty prompt disables Edit / shows error

---

## API contract (for manual testing)

```http
POST /api/mothermode/ai
Content-Type: application/json

{
  "action": "imageEdit",
  "prompt": "Shift palette cooler. Keep composition.",
  "seed": "https://... or data:image/png;base64,...",
  "references": ["data:image/png;base64,..."],
  "format": "feed",
  "model": "gpt-image-2"
}
```

Response: `{ "ok": true, "image": "https://...public storage url..." }`

---

## Port strategy options

1. **Copy the 6 files** from this repo if the other codebase is nearly identical.
2. **Diff-apply** if the other repo has local edits to Image Studio / openai-content — merge carefully around `generateContentImage` and the studio left rail.
3. **Minimum surface:** models + constants + openai-content edit helpers + route + aiClient + ImageStudioModal.

---

## Dependencies / runtime notes

- Node runtime for the AI route (`export const runtime = 'nodejs'`) — already required for image gen
- OpenAI key for GPT Image edits; Google/Gemini key for Nano Banana multi-image
- `FormData` + `Blob` available in modern Node (Next.js nodejs runtime)
- No new npm packages

---

## Source of truth in this repo

| Piece | Path |
|-------|------|
| Models | `src/lib/mothermode/content/models.ts` |
| Presets | `src/lib/mothermode/content/constants.ts` |
| Provider edit | `src/utils/integrations/openai-content.ts` (`editContentImage`, `editOpenAiImage`, `editGeminiImage`) |
| Route | `src/app/api/mothermode/ai/route.ts` (`imageEdit`) |
| Client | `src/components/mothermode/content/aiClient.ts` (`aiEditImage`) |
| UI | `src/components/mothermode/content/ImageStudioModal.tsx` |

# Content Generate System — Port Checklist

Use this to copy the upgraded MotherMode **Generate** drawer into a sibling codebase that already has the content hub (catalog, Amplify, generated-content table, and a basic batch generator).

## Feature summary

| Area | What was added |
|------|----------------|
| UI | Generate drawer: **compose** → **review** (select / preview / save) |
| Prompt styles | Curated viral craft recipes (11pm text, Storytime, Short-form script, etc.) |
| Writer model | Explicit selector over `TEXT_MODELS` (Claude Opus / GPT-5.5 / Auto) |
| Brand voice | Full brand-system voice rules (not a 4-line stub) |
| Offer context | Rich offer-page facts (scene, mechanism, method, old/new way, outcomes) |
| Short-form | Script craft for `video` / `reel` (hook → relate → reframe → soft CTA) |
| API | Generate **without** auto-save; separate **save** for selected drafts |
| Amplify | Still one-shots full posts with `persist: true` |
| **Image bridge** | In review: **Create image** from hook-anchored `media.prompt`, **Image studio**, attach to gallery on save |

**Flow change (important):**

```
Before: Generate → insert all → close → pieces lost in library
After:  Compose → Generate → Review & select → (optional Create image / Studio) → Save N to library
```

No DB migration. Drafts (and their images) are client-side until save. Saved rows still use `mothermode_generated_content` via `insertGeneratedBatch`; images attach via `setReviewImages`.

---

## Prerequisites in the target repo

- Content hub with `ContentHub` + Generate button opening a batch panel
- `/api/mothermode/content/generated` (or equivalent) that calls `generateContentBatch`
- `src/utils/mothermode/generated-content.ts` (`insertGeneratedBatch`, list, delete)
- Offer catalog (`getOffer` / `MotherModeOffer`) with problem, mechanism, method, oldWay, newWay, inside
- `TEXT_MODELS` / `IMAGE_MODELS` / `AUTO_MODEL` in `src/lib/mothermode/content/models.ts`
- Platform previews (`PlatformPreview`) for the review pane
- Image Studio + `aiGenerateImage` (see `IMAGE_EDIT_SYSTEM_PORT.md` if missing)
- `reviewClient` (`setReviewImages`, `loadReviews`) for attaching images on save
- Amplify panel that calls `generateBatch` for full posts (optional; keep `persist: true`)

---

## Files changed (8)

Copy or re-apply in this order.

### 1. `src/lib/mothermode/content/promptStyles.ts` (**new file**)

Client-safe catalog of prompt styles. Copy the whole file from this repo.

**Exports:**

```ts
export interface PromptStyle {
  id: string;
  label: string;
  hint: string;
  craft: string;
  platforms?: ContentPlatform[];
  formats?: ContentFormat[];
  shortFormDefault?: boolean;
}

export const AUTO_STYLE = 'auto';
export const PROMPT_STYLES: PromptStyle[];

export function getPromptStyle(id?: string | null): PromptStyle | undefined;
export function stylesFor(platform?: ContentPlatform, format?: ContentFormat): PromptStyle[];
export function resolvePromptStyle(
  id: string | undefined,
  platform: ContentPlatform,
  format: ContentFormat,
): PromptStyle;
export function styleCraftLine(
  id: string | undefined,
  platform: ContentPlatform,
  format: ContentFormat,
): string;
```

**Style ids (keep stable if you already store them):**

| id | label | Notes |
|----|--------|--------|
| `auto` | Auto | Server resolves by platform/format |
| `eleven-pm` | 11pm text | Confidante late-night |
| `storytime` | Storytime | Confession arc |
| `pov-tabs` | POV / open tabs | Native POV |
| `hot-take` | Hot take | Wedge + calibrate |
| `list-invisible` | Invisible list | Numbered load items |
| `grwm-rant` | GRWM / car rant | Spoken short-form |
| `reply-comment` | Reply to comment | Tutorial reply |
| `scene-reframe` | Scene reframe | Time-of-day scene |
| `make-visible` | Make it visible | Handoff / partner |
| `battle-cry` | Battle cry | Movement register |
| `authority` | Authority thesis | Category claim |
| `short-form-script` | Short-form script | Full video architecture |
| `carousel-truth` | Carousel truth | Slide stack |
| `email-confidante` | Email confidante | Letter email |

**Auto resolution (`resolvePromptStyle`):**

- `video` / `reel` → `short-form-script`
- `email` → `email-confidante`
- `carousel` / `idea` → `carousel-truth`
- `blog` / `answer` / `article` / aeo → `authority`
- else → `eleven-pm`

---

### 2. `src/lib/mothermode/content/index.ts`

**Add export:**

```ts
export * from './promptStyles';
```

Place next to `export * from './amplify'` / `models` so UI and server can import from `@/lib/mothermode/content`.

---

### 3. `src/utils/integrations/openai-content.ts`

#### 3a. Import style helper

```ts
import { styleCraftLine } from '@/lib/mothermode/content/promptStyles';
```

#### 3b. Expand `VOICE_RULES`

Replace the short 4-line stub with the full brand-system block:

- 11pm voice definition
- Truth + Calibration + Permission + Mission
- No em/en dashes; periods over `!`; no ALL CAPS
- Full NO-list (mama, thrive, journey, self-care, hustle, empower, …)
- Anti-generic lines (no “you’ve got this”, bath bombs, etc.)
- Brand idioms (system is broken, refuse to disappear, both are true, …)
- Hard lines (no punch-down, no fear-sell, no weaponizing kids)
- Numerals for time; soft CTAs; specific > abstract

This block is shared by rewrite, amplify, image prompts, and batch generation.

#### 3c. Expand `BatchOfferContext`

```ts
export interface BatchOfferContext {
  name: string;
  category?: string;
  tagline?: string;
  audience?: string;
  promise?: string;
  scene?: string;
  problemIntro?: string;
  problemPoints?: string[];
  cost?: string;
  mechanismLabel?: string;
  mechanism?: string;
  mechanismPoints?: string[];
  insideOutcomes?: string[];
  methodSteps?: string[];
  oldWay?: string[];
  newWay?: string[];
  priceLabel?: string;
  url: string;
}
```

#### 3d. Extend `BatchInput`

```ts
/** Prompt style id from the Generate drawer. Empty/auto resolves server-side. */
style?: string;
```

#### 3e. Upgrade `buildBatchSystem`

- Lead with “sophisticated, modern, viral… not generic social copy”
- Category line: Mental Load Infrastructure
- Inject all new offer fields (scene, mechanism, method, old/new way, …)
- Close with “could only be MotherMode” bar + JSON-only instruction

#### 3f. Upgrade `formatFieldGuide` for short-form

For `reel` and `video`, use a long script field guide:

- 5–8 beats `{ at, onScreen, voiceover, visual }`
- Hook 0–3s works with sound off via `onScreen`
- Spoken voiceover, unpolished visuals, soft bio CTA on last beat

#### 3g. Upgrade `buildBatchUser`

Add:

- `PLATFORM_NORMS[platform]`
- `styleCraftLine(input.style, platform, format)`
- Anti-generic bar string
- Keep perspective / sophistication / guides / source / schema

---

### 4. `src/app/api/mothermode/content/generated/route.ts`

#### 4a. Richer `offerContext(offer)`

Map from `MotherModeOffer`:

| Field | Source |
|-------|--------|
| scene | `offer.problem?.scene` |
| problemIntro | `offer.problem?.intro` |
| mechanismLabel | `offer.mechanism?.label` |
| mechanism | `offer.mechanism?.paragraphs?.join(' ')` |
| mechanismPoints | `points` as `"title: description"` |
| methodSteps | `"n. title: description"` |
| oldWay / newWay | `offer.oldWay?.items` / `newWay?.items` |
| insideOutcomes | `outcome` or `title: description` |
| (existing) | name, tagline, audience, promise, problemPoints, cost, priceLabel, url |

#### 4b. Split generate vs save

**POST body `action`:**

| action | Behavior |
|--------|----------|
| `generate` (default) | Run `generateContentBatch`. Persist **only if** `persist === true`. |
| `save` | Validate `pieces[]`, `insertGeneratedBatch`, return saved pieces. |

**Generate defaults:**

```ts
const persist = body.persist === true; // default false for review-first UI
```

Pass through:

```ts
style: str(body.style),
model: str(body.model),
// ...existing fields
```

**Generate response:**

```json
{
  "ok": true,
  "pieces": [ /* ContentPiece[] */ ],
  "batchId": "<only if persisted>",
  "model": "<model id used>",
  "persisted": false
}
```

**Save request:**

```json
{
  "action": "save",
  "pieces": [ /* selected ContentPiece[] */ ],
  "offerSlug": "brain-dump-system",
  "guides": "...",
  "model": "claude-opus-4-8",
  "sourcePieceId": "optional",
  "batchId": "optional"
}
```

**Save response:** `{ "ok": true, "pieces": [...], "batchId": "..." }`

Mark saved pieces `generated: true` before insert.

---

### 5. `src/components/mothermode/content/generatedClient.ts`

Replace / extend the client wrappers.

```ts
export interface GenerateBatchArgs {
  offerSlug: string;
  mode: 'batch' | 'variations';
  count: number;
  platform: string;
  format: string;
  kind: 'organic' | 'ad';
  tone: string;
  theme?: string;
  guides?: string;
  source?: ContentPiece;
  perspective?: Perspective;
  sophistication?: Sophistication;
  model?: string;
  style?: string;
  /** true = insert immediately (Amplify). false/omit = review first. */
  persist?: boolean;
}

export interface SaveGeneratedBatchArgs {
  pieces: ContentPiece[];
  offerSlug?: string;
  sourcePieceId?: string;
  guides?: string;
  model?: string;
  batchId?: string;
}

export async function generateBatch(args: GenerateBatchArgs): Promise<ContentPiece[]>;
export async function saveGeneratedBatch(args: SaveGeneratedBatchArgs): Promise<ContentPiece[]>;
// listGenerated, deleteGenerated unchanged
```

**Critical:** `generateBatch` must send `persist: args.persist === true` so Amplify can opt in and Generate stays review-first.

---

### 6. `src/components/mothermode/content/BatchPanel.tsx`

Rewrite the Generate drawer as a two-phase panel.

#### Compose phase (narrow drawer, ~`max-w-md`)

Controls:

- Offer, mode (distinct / variations), optional source piece
- Channel, format, type, tone
- **Prompt style** chips (`PROMPT_STYLES` / `stylesFor`)
- **Writer model** select (`TEXT_MODELS` + Auto)
- Count slider, theme, guides
- Generate → `generateBatch({ ..., style, model, persist: false })`

Smart style defaults on format change:

- `video` / `reel` → `short-form-script`
- `email` → `email-confidante`
- `carousel` / `idea` → `carousel-truth`

#### Review phase (wider drawer, ~`max-w-3xl`)

- List of drafts with checkboxes (default: all selected)
- Focus one draft → `PlatformPreview` + hooks + body/script + image prompt
- Actions: Back to compose, All / None, Discard all, **Save N to library**
- Save → `saveGeneratedBatch` → attach draft images → `onGenerated(saved)` → `onClose()`
- **Do not** call `onGenerated` until save

#### Image bridge (review only)

Drafts are not in the library yet, so images live in **local state** until save:

```ts
const [draftImages, setDraftImages] = useState<Record<string, string[]>>({});
const [draftImageIndex, setDraftImageIndex] = useState<Record<string, number>>({});
const [imgModel, setImgModel] = useState(AUTO_MODEL);
const [imgCount, setImgCount] = useState(1);
const [studioOpen, setStudioOpen] = useState(false);
const [imgBusyId, setImgBusyId] = useState<string | null>(null);
```

**Prompt used for one-click create** (same as copyable image prompt card):

```ts
function fullImagePrompt(p: ContentPiece): string | undefined {
  const scene = p.media?.prompt ?? p.visual;
  if (!scene) return undefined;
  return buildImagePrompt(scene, p.hook); // hook-anchored editorial prompt
}
```

**One-click create** → existing `aiGenerateImage(prompt, format, imgModel)` (1–4 variants).  
**Image studio** → mount `ImageStudioModal` with a synthetic review:

```ts
const reviewFor = (id: string): PieceReview => {
  const images = draftImages[id] ?? [];
  if (images.length === 0) return {};
  return { images, imageIndex: draftImageIndex[id] ?? 0 };
};
```

Wire studio callbacks to local helpers (`addImagesFor`, `removeImageFor`, `onUploadFor`, `setDraftImageIndex`) — **not** `reviewClient` until save.

**UI blocks in the focused draft column:**

1. **Visual** card (when prompt or images exist): image model select, variant count (1–4×), **Create image**, **Image studio**
2. **Image prompt** card: full prompt text, **Copy**, **Create**
3. `PlatformPreview piece={focused} review={focusedReview}` so renders show in the mock post
4. Draft list meta: `· N images` when gallery non-empty

**On save** (after `saveGeneratedBatch`):

```ts
await loadReviews(offerSlug);
for (const p of finalPieces) {
  const local =
    chosen.find((c) => c.id === p.id) ??
    chosen.find((c) => c.title === p.title);
  const localId = local?.id ?? p.id;
  const imgs = draftImages[localId] ?? [];
  if (imgs.length > 0) {
    setReviewImages(offerSlug, p.id, imgs, draftImageIndex[localId] ?? 0);
  }
}
```

Match by id first, then title, in case the server rewrites ids on insert.  
Clear `draftImages` / studio on new generate and on discard.

Imports needed:

```ts
import { generateBatch, saveGeneratedBatch } from './generatedClient';
import { setReviewImages, loadReviews } from './reviewClient';
import { type PieceReview } from '@/lib/mothermode/content/review';
import { PlatformPreview } from './previews/PlatformPreview';
import { ImageStudioModal } from './ImageStudioModal';
import { aiGenerateImage } from './aiClient';
import {
  PROMPT_STYLES,
  AUTO_STYLE,
  stylesFor,
  TEXT_MODELS,
  IMAGE_MODELS,
  AUTO_MODEL,
  buildImagePrompt,
  // ...existing labels / formats
} from '@/lib/mothermode/content';
```

`ContentHub` can stay as-is if it still mounts:

```tsx
{showPanel && (
  <BatchPanel
    pieces={basePieces}
    onClose={() => setShowPanel(false)}
    onGenerated={onGenerated}
  />
)}
```

---

### 7. `src/components/mothermode/content/AmplifyPanel.tsx`

Where Amplify creates full posts via `generateBatch`, pass:

```ts
generateBatch({
  // ...existing args
  persist: true, // keep one-shot library insert
})
```

Without this, Amplify posts would generate but never save (new default is `persist: false`).

---

### 8. `src/components/mothermode/content/ImageStudioModal.tsx`

Small fix so review drafts work when the focused piece changes while the studio is open:

```ts
// Seed the generate prompt from the piece's art direction when the studio opens
// or the focused piece changes (e.g. review drafts). Reset on piece change so
// freeform edits from a previous draft do not leak across.
useEffect(() => {
  if (!open) return;
  const scene = piece.media?.prompt ?? piece.visual ?? '';
  setPrompt(scene);
}, [open, piece.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

No new props. Studio still uses `onAddImages` / `onRemove` / `onSetIndex` / `onUpload` from the parent — BatchPanel supplies local-state versions during review.

If the sibling already has Image Studio from `IMAGE_EDIT_SYSTEM_PORT.md`, only this seed effect needs updating.

---

## No changes required

- DB / Supabase migrations (`mothermode_generated_content` schema unchanged)
- `insertGeneratedBatch` / list / delete helpers (same table shape)
- Image **API** / `aiClient` (`aiGenerateImage`, `aiEditImage`) — reuse as-is
- Amplify refine path (`aiAmplifyParts`) — text variants only

---

## API contracts (manual testing)

### Generate (no save)

```http
POST /api/mothermode/content/generated
Content-Type: application/json

{
  "action": "generate",
  "offerSlug": "brain-dump-system",
  "mode": "batch",
  "count": 3,
  "platform": "tiktok",
  "format": "video",
  "kind": "organic",
  "tone": "confidante",
  "style": "short-form-script",
  "model": "claude-opus-4-8",
  "persist": false
}
```

Response: `{ "ok": true, "pieces": [...], "persisted": false, "model": "..." }`  
Confirm: no new rows in `mothermode_generated_content`.

### Save selected

```http
POST /api/mothermode/content/generated
Content-Type: application/json

{
  "action": "save",
  "offerSlug": "brain-dump-system",
  "pieces": [ /* 1+ pieces from generate response */ ]
}
```

Response: `{ "ok": true, "pieces": [...], "batchId": "..." }`  
Confirm: rows appear; hub lists them with Generated badge.

### Amplify-style one-shot

Same as generate with `"persist": true` → pieces inserted immediately.

---

## Quick verify on the other codebase

1. Content hub → **Generate**
2. Pick offer + TikTok + video → style defaults to **Short-form script**
3. Pick writer model (or Auto) → Generate
4. Review panel opens; drafts listed; preview works; **library count unchanged**
5. Focus a draft with an image prompt → **Create image** (or **Create** on the prompt card) → spinner → image appears in preview; list shows `· N images`
6. **Image studio** opens with the draft’s scene prompt; generate/edit still works; closing keeps images on the draft
7. Deselect one → **Save N to library** → only selected appear in hub; saved pieces show the images in the hub Edit gallery
8. Discard all → nothing saved; back to compose; draft images cleared
9. Amplify → New posts still lands pieces in the hub without a review step
10. Generated copy: no em dashes, no NO-list words, specific scenes, soft CTA
11. Video pieces include `script[]` with `at` / `onScreen` / `voiceover` / `visual`

---

## Port strategy options

1. **Copy the 8 paths** from this repo if the sibling hub is nearly identical.
2. **Diff-apply** if the other repo customized `BatchPanel` or `openai-content` batch prompts — merge carefully around `VOICE_RULES`, `buildBatchSystem`, `buildBatchUser`, and the generated route POST handler.
3. **Minimum surface for quality only** (no review UI): `promptStyles.ts` + openai-content voice/offer/style + route `offerContext` + pass `style` from a simple select. Keep auto-persist if you skip review.
4. **Minimum surface for review only**: split generate/save in route + client + BatchPanel review phase, without new styles (still worth porting voice rules).
5. **Image bridge only** (if review already exists): BatchPanel local galleries + `aiGenerateImage` + `ImageStudioModal` + `setReviewImages` on save + ImageStudio seed-on-`piece.id` effect. Requires Image Studio + `aiClient` already ported.

Recommended: port **all 8** so quality, review UX, and image bridge land together.

---

## Dependencies / runtime notes

- Node runtime on the generated-content route (already required for AI)
- Anthropic and/or OpenAI keys for text models in `TEXT_MODELS`
- No new npm packages
- Brand PDF is **not** loaded at runtime; voice rules are inlined in `VOICE_RULES`
- Offer facts come from the in-code offer catalog (`getOffer`), not from scraping the live page

---

## Source of truth in this repo

| Piece | Path |
|-------|------|
| Prompt styles | `src/lib/mothermode/content/promptStyles.ts` |
| Barrel export | `src/lib/mothermode/content/index.ts` |
| Voice + batch prompts | `src/utils/integrations/openai-content.ts` (`VOICE_RULES`, `BatchOfferContext`, `BatchInput`, `buildBatchSystem`, `buildBatchUser`, `formatFieldGuide`) |
| Route | `src/app/api/mothermode/content/generated/route.ts` (`generate` / `save`, `offerContext`) |
| Client | `src/components/mothermode/content/generatedClient.ts` (`generateBatch`, `saveGeneratedBatch`) |
| Generate UI + image bridge | `src/components/mothermode/content/BatchPanel.tsx` |
| Image studio (seed on piece change) | `src/components/mothermode/content/ImageStudioModal.tsx` |
| Image client | `src/components/mothermode/content/aiClient.ts` (`aiGenerateImage`) |
| Review gallery attach | `src/components/mothermode/content/reviewClient.ts` (`setReviewImages`, `loadReviews`) |
| Hook-anchored prompt helper | `src/lib/mothermode/content/constants.ts` (`buildImagePrompt`) |
| Amplify persist flag | `src/components/mothermode/content/AmplifyPanel.tsx` |
| Brand reference (human) | `private/brand/mothermode-brand-system.pdf` |
| Quality bar examples | `src/lib/mothermode/content/tiktok.ts`, `instagram.ts` |

---

## Related docs

- Image edit port: `docs/IMAGE_EDIT_SYSTEM_PORT.md` (Image Studio Generate/Edit tabs, seed edits). The Generate review bridge **reuses** that studio; port image edit first if the sibling only has text-to-image.





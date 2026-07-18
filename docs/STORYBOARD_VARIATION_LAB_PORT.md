# Storyboard Packs + Variation Lab — Port Checklist

Use this to copy **cinematic storyboard packs** and the full **Variation Lab** (brief → prompts, creative-test matrix, fal smart-resize) into a sibling codebase that already has Image Studio (Generate + Edit) and the content hub AI route.

Master overview: `docs/CONTENT_HUB_FEATURES_PORT.md`  
Video scripts (optional prereq for b-roll storyboard seeds): `docs/VIDEO_SCRIPT_SYSTEM_PORT.md`  
Image Edit prereq: `docs/IMAGE_EDIT_SYSTEM_PORT.md`  
Commit: `1ab71dd`

---

## Feature summary

### Storyboard packs

| Area | What |
|------|------|
| Edit UI | `StoryboardPanel` — plan 1–4 boards, narrative or b-roll mode, character + product refs |
| AI | `storyboardPlan` — connected boards with lookback continuity |
| Studio | **Board** tab — render contact sheets via image gen/edit + `STORYBOARD_SYSTEM` |
| State | `PieceReview.storyboard: StoryboardPack` |

### Variation Lab

| Area | What |
|------|------|
| Studio | **Lab** tab — Brief / Vary / Resize sub-rails |
| Entry | ImagesCard **Lab** button → `initialTab="lab"` |
| Brief | Creative brief → master prompt + alts + optional carousel/story frame pack → generate |
| Vary | Dimension chips → plan edit instructions → seed-based `imageEdit` loop |
| Resize | fal-ai/smart-resize to platform WxH (presets, packs, custom, full fal settings) |
| Env | **`FAL_KEY`** required for Resize only |

No DB migration. Gallery still uses `onAddImages` / review images.

---

## Prerequisites

- [ ] Image Studio with Generate + Edit (`aiGenerateImage`, `aiEditImage`, seed, refs)
- [ ] `EDIT_IMAGE_MODELS`, `MAX_EDIT_REFERENCES`, `IMAGE_EDIT_PRESETS`
- [ ] `hostGeneratedImage` for data-URL → public URL
- [ ] `review.ts` / `reviewClient.ts` (extend for storyboard)
- [ ] Text models + `resolveTextModel` (key-aware preferred)
- [ ] Optional: `videoScript` on review for b-roll storyboard seeds

---

## Part A — Shared types & exports

### A1. `src/lib/mothermode/content/review.ts`

Add storyboard types (in addition to any video types):

```ts
export type StoryboardMode = 'narrative' | 'broll';
export type StoryboardCount = 1 | 2 | 3 | 4;

export interface StoryboardBoard {
  index: number;              // 1-based
  title: string;
  scenes: string[];
  imagePrompt: string;        // full contact-sheet prompt body
  videoPrompt?: string;
  lookbackSummary: string;    // fed into next board
  brollNotes?: string;
  imageUrl?: string;          // after render
}

export interface StoryboardPack {
  boardCount: StoryboardCount;
  mode: StoryboardMode;
  guides?: string;
  characterRef?: string;
  referenceImages?: string[];
  boards: StoryboardBoard[];
  model?: string;
  generatedAt?: string;
}
```

On `PieceReview`:

```ts
storyboard?: StoryboardPack;
```

Helpers:

- `withStoryboard(prev, pack)` / `withoutStoryboard(prev)`
- `patchStoryboardBoard(prev, boardIndex, patch)` — merge fields onto one board (e.g. `imageUrl`)
- `isEmptyReview` — non-empty pack (boards length > 0) is not empty

### A2. `src/components/mothermode/content/reviewClient.ts`

```ts
setReviewStoryboard(offerSlug, id, pack)
clearReviewStoryboard(offerSlug, id)
patchReviewStoryboardBoard(offerSlug, id, boardIndex, patch)
```

### A3. `src/lib/mothermode/content/constants.ts`

Add:

- `MAX_STORYBOARD_REFERENCES = 3` (product/env refs; character is separate)
- `STORYBOARD_SYSTEM` — long cinematic multi-panel contact-sheet system prompt (copy wholesale from this repo)
- `buildStoryboardImagePrompt(boardPrompt: string): string` — prepends `STORYBOARD_SYSTEM` + board-specific expansion

### A4. New lib modules (copy wholesale)

| File | Role |
|------|------|
| `src/lib/mothermode/content/variationLab.ts` | Dimensions, default dims by format, `VARIATION_BRIEF_SYSTEM`, `VARIATION_PLAN_SYSTEM` |
| `src/lib/mothermode/content/platformSizes.ts` | `PLATFORM_SIZE_PRESETS`, packs, `parseSizeString`, `resolveTargetSizes`, `defaultPresetIdsForFormat`, `isMultiFrameFormat` |

### A5. `src/lib/mothermode/content/index.ts`

```ts
export * from './platformSizes';
export * from './variationLab';
```

(constants already re-exported via `export * from './constants'`)

---

## Part B — Server: storyboard + variation + fal

### B1. `src/utils/integrations/fal-smart-resize.ts` (**new**)

Server-only fal queue client:

- Auth: `Authorization: Key ${FAL_KEY}` (also accepts `FAL_API_KEY`)
- Endpoint: `fal-ai/smart-resize` via `https://queue.fal.run`
- Flow: submit → poll status → fetch result
- Input: `image_url`, `target_sizes[]` (WxH), optional `prompt`, `num_images_per_size`, `resolution`, `output_format`, `safety_tolerance`, `seed`, `sync_mode`
- Output: flat `images[]` URLs + `results` rows + description
- Validate sizes (64–8192), max 10 targets
- Timeouts with clear 504-style error

Copy the whole file from this repo.

### B2. `src/utils/integrations/openai-content.ts`

Import variation systems from `variationLab.ts`.

Add public functions:

#### `generateStoryboardPlan(input)`

Input:

```ts
{
  piece: { hook, hooks?, caption?, body?, script?, theme, tone, platform, format, brollSeeds? },
  boardCount: 1|2|3|4,
  mode: 'narrative' | 'broll',
  guides?: string,
  hasCharacterRef?: boolean,
  hasReferenceImages?: boolean,
  model?: string,
}
```

- System: film director / storyboard artist + voice rules
- User: mode line, continuity/lookback rules, source summary, board count
- Parse boards: index, title, scenes[], imagePrompt, videoPrompt?, lookbackSummary, brollNotes?
- Require ≥1 board

#### `generateVariationBrief(input)`

```ts
{
  brief: string,
  platform?, format?, hook?, theme?, tone?,
  altCount?: number,      // default ~3
  frameCount?: number,    // 0 for single; 3–N for carousel/story
  guides?: string,
  model?: string,
}
```

Returns `{ masterPrompt, altPrompts[], frames: { index, role, prompt }[], model }`

#### `generateVariationPlan(input)`

```ts
{
  dimensions: string[],   // VariationDimensionId values
  perDimension?: number,  // 1–4
  seedDescription?: string,
  platform?, format?, hook?, theme?, guides?, model?,
}
```

Returns `{ items: { id, dimension, label, editPrompt }[], model }`

Each item is one image-edit instruction changing primarily that dimension.

### B3. `src/app/api/mothermode/ai/route.ts`

Wire three actions (plus existing):

#### `storyboardPlan`

- Validate `body.piece`, `boardCount` (1–4), `mode`
- Call `generateStoryboardPlan`
- Return `{ ok, boards, boardCount, mode, model }`

#### `variationBrief`

- Require non-empty `brief`
- Call `generateVariationBrief`
- Return `{ ok, masterPrompt, altPrompts, frames, model }`

#### `variationPlan`

- Require `dimensions[]` length ≥ 1
- Call `generateVariationPlan`
- Return `{ ok, items, model }`

#### `smartResize`

```ts
// 1. Resolve image_url: if data: URL, hostGeneratedImage first
// 2. Normalize target_sizes (array of "WxH")
// 3. runSmartResize({ image_url, target_sizes, prompt, num_images_per_size, resolution, output_format, safety_tolerance, seed, sync_mode })
// 4. Optionally re-host fal CDN URLs if you want them in your bucket (this repo returns fal URLs / hosted as implemented)
// 5. Return { ok, images: string[], description?, results?, sourceUrl? }
```

Import `runSmartResize` from `@/utils/integrations/fal-smart-resize`.

Document actions in the route header comment block.

### B4. `.env.example`

```bash
# fal.ai key: required for Variation Lab smart-resize (fal-ai/smart-resize).
# https://fal.ai/dashboard/keys
FAL_KEY=
```

Set the same in Vercel Production.

---

## Part C — Browser clients

### C1. `src/components/mothermode/content/aiClient.ts`

Add:

```ts
aiGenerateStoryboardPlan({ piece, boardCount, mode, guides?, hasCharacterRef?, hasReferenceImages?, model? })
aiVariationBrief({ brief, platform?, format?, hook?, theme?, tone?, altCount?, frameCount?, guides?, model? })
aiVariationPlan({ dimensions, perDimension?, seedDescription?, platform?, format?, hook?, theme?, guides?, model? })
aiSmartResize({
  imageUrl,
  targetSizes: string[],
  prompt?, numImagesPerSize?, resolution?, outputFormat?,
  safetyTolerance?, seed?, syncMode?,
})
```

Types: `AiStoryboardBoard`, `AiVariationFrame`, `AiVariationPlanItem`.

---

## Part D — UI panels

### D1. `StoryboardPanel.tsx` (**new**)

Edit-tab planner. Props:

```ts
{
  piece: ContentPiece;
  review: PieceReview;
  offerSlug: string;
  model?: string;
  onReviewChange: (next: PieceReview) => void;
  onOpenStudio?: () => void;  // open Image Studio on Board tab
}
```

UI:

- Board count 1–4
- Mode: narrative | b-roll
- Guides textarea
- Character ref upload (single)
- Reference images (up to `MAX_STORYBOARD_REFERENCES`)
- Generate plan → `setReviewStoryboard`
- List boards: title, scenes, lookback, image thumb if `imageUrl`
- Clear pack
- “Open studio to render” → parent sets `initialTab: 'storyboard'`

B-roll mode: when `review.videoScript` exists, pass beat `brollPrompt`/`broll` strings as `brollSeeds` into the planner.

### D2. Wire `SheetForms.tsx`

```tsx
import { StoryboardPanel } from './StoryboardPanel';

// After images / video script:
<StoryboardPanel
  piece={piece}
  review={review}
  offerSlug={offerSlug}
  model={model}
  onReviewChange={onReviewChange}
  onOpenStudio={() => openStudio('storyboard')}  // if parent supports it
/>
```

Storyboard is available for **all** formats (not only video).

### D3. `VariationLabPanel.tsx` (**new**)

Compose rail for Lab tab. Props:

```ts
{
  piece: ContentPiece;
  images: string[];
  activeImage: string | null;
  seed: string | null;
  onSeedChange: (url: string | null) => void;
  onAddImages: (urls: string[]) => void;
}
```

Three internal sub-tabs:

#### Brief

- Textarea for creative brief (seed from hook/theme/visual if empty)
- Alt count, frame count (multi-frame formats default higher)
- Model picker
- “Plan prompts” → `aiVariationBrief`
- Show master + alts + frames; buttons to generate each via `aiGenerateImage`
- Results → `onAddImages`

#### Vary

- Seed picker (gallery thumbs + current seed)
- Dimension chips from `VARIATION_DIMENSIONS` / `defaultDimensionsForFormat(piece.format)`
- Per-dimension count
- “Plan variations” → `aiVariationPlan`
- “Run edits” → for each item, `aiEditImage({ prompt: editPrompt, seed, format })`
- Collect URLs → `onAddImages`

#### Resize

- Source: primary / selected / bulk all gallery images
- Preset chips from `PLATFORM_SIZE_PRESETS` + packs from `PLATFORM_SIZE_PACKS`
- Defaults from `defaultPresetIdsForFormat(piece.format)`
- Custom WxH via `parseSizeString`
- Resolve with `resolveTargetSizes({ presetIds, customSizes, max: 10 })`
- Fal settings: resolution 1K/2K/4K, output jpeg/png/webp, safety 1–6, seed, sync, optional prompt, num per size
- Call `aiSmartResize` per source image (or sequential bulk)
- `onAddImages` with results

Copy the panel from this repo and adjust imports if paths differ.

### D4. `ImageStudioModal.tsx`

1. Extend tab type:

```ts
export type StudioTab = 'generate' | 'edit' | 'storyboard' | 'lab';
```

2. `StudioTabs` — four segments: Generate, Edit, Board, Lab (icons: Sparkles, Wand2, LayoutGrid, Layers).

3. When `tab === 'lab'`, render:

```tsx
<VariationLabPanel
  piece={piece}
  images={images}
  activeImage={images[active] ?? null}
  seed={seed}
  onSeedChange={setSeed}
  onAddImages={onAddImages}
/>
```

4. When `tab === 'storyboard'`, board picker + render button:

- Read `review.storyboard`
- Select board index
- Show scenes / prompt preview
- Show pack characterRef + referenceImages
- Model = edit-capable models
- **Render:**  
  - `full = buildStoryboardImagePrompt(board.imagePrompt)`  
  - Seed preference: prior board `imageUrl` → characterRef → first ref  
  - Refs: character + extras (dedupe seed)  
  - If seed: `aiEditImage` with continuity instructions  
  - Else: `aiGenerateImage(full, format)`  
  - `onAddImages([url])`  
  - `patchReviewStoryboardBoard(..., { imageUrl: url })` when `offerSlug` + `onReviewChange` provided

5. Gallery: seed badge + “use as seed” for **both** `edit` and `lab` tabs.

6. Honor `initialTab` when `open` / `piece.id` changes.

### D5. `ImagesCard.tsx`

```ts
const [initialTab, setInitialTab] = useState<StudioTab | undefined>();

const openStudio = (tab?: StudioTab) => {
  setInitialTab(tab);
  setOpen(true);
};

// Lab shortcut + Open image studio
// ImageStudioModal initialTab={initialTab}
// onClose clears initialTab
```

### D6. Optional BatchPanel

If Generate review mounts Image Studio, pass through `initialTab` only if needed; Lab is optional there.

---

## Part E — Data flow diagrams

### Storyboard

```
Edit: StoryboardPanel
  → aiGenerateStoryboardPlan
  → setReviewStoryboard(pack)

Image Studio Board tab
  → buildStoryboardImagePrompt
  → aiEditImage | aiGenerateImage
  → onAddImages + patchReviewStoryboardBoard(imageUrl)
```

### Variation Lab Brief

```
brief → aiVariationBrief → prompts
  → aiGenerateImage (×N) → onAddImages
```

### Variation Lab Vary

```
seed + dimensions → aiVariationPlan → editPrompts
  → aiEditImage (×N) → onAddImages
```

### Variation Lab Resize

```
image (data URL?) → API hosts if needed → fal smart-resize
  → images[] → onAddImages
```

---

## File checklist (copy order)

```
1.  src/lib/mothermode/content/variationLab.ts          (new)
2.  src/lib/mothermode/content/platformSizes.ts         (new)
3.  src/lib/mothermode/content/constants.ts             (STORYBOARD_*)
4.  src/lib/mothermode/content/review.ts                (storyboard types)
5.  src/lib/mothermode/content/index.ts                 (re-exports)
6.  src/utils/integrations/fal-smart-resize.ts          (new)
7.  src/utils/integrations/openai-content.ts            (3 generators)
8.  src/app/api/mothermode/ai/route.ts                  (4 actions)
9.  .env.example                                        (FAL_KEY)
10. src/components/mothermode/content/reviewClient.ts
11. src/components/mothermode/content/aiClient.ts
12. src/components/mothermode/content/StoryboardPanel.tsx
13. src/components/mothermode/content/VariationLabPanel.tsx
14. src/components/mothermode/content/ImageStudioModal.tsx
15. src/components/mothermode/content/ImagesCard.tsx
16. src/components/mothermode/content/SheetForms.tsx
```

---

## Platform size presets (reference)

Common targets in `platformSizes.ts`:

| id | size | use |
|----|------|-----|
| ig-feed-45 | 1080×1350 | IG feed 4:5 |
| ig-fb-feed-11 | 1080×1080 | square |
| ig-fb-story | 1080×1920 | story/reel/TikTok |
| ig-carousel-square / 45 | 1080×1080 / 1350 | carousel |
| fb-feed-landscape | 1200×630 | link preview |
| x-blog-aeo | 1600×900 | long-form |
| pinterest-pin | 1000×1500 | pin |
| email-header | 1200×600 | email |
| ad-11 / ad-45 / ad-916 | ads |

Packs: `ig-organic`, `ig-carousel`, `story-vertical`, `fb-set`, `ads-core`, `longform`, `pinterest`, `all-social`.

---

## Variation dimensions (reference)

From `VARIATION_DIMENSIONS`: headline, hook, format_structure, color, action_placement, device_mockup, crop_framing, lighting_mood, background, text_treatment, cta_badge, carousel_continuity, story_sequence.

Defaults depend on format (`defaultDimensionsForFormat`).

---

## Smoke tests

### Storyboard

- [ ] Plan 1 board narrative → pack on review
- [ ] Plan 3 boards → each has lookbackSummary; board 2+ references prior
- [ ] Character + product refs persist on pack
- [ ] Board tab render → gallery image + board.imageUrl
- [ ] Re-render board 2 uses board 1 image as seed when present
- [ ] B-roll mode with video script seeds (if video ported)
- [ ] Clear pack removes storyboard without wiping images

### Variation Lab

- [ ] Lab tab visible in studio; ImagesCard Lab opens it
- [ ] Brief → master prompt → generate 1 image
- [ ] Carousel format → frame pack → multiple frames
- [ ] Vary with 2 dimensions × 2 → 4 edit variants
- [ ] Resize single image to 1080×1350 and 1080×1920 with `FAL_KEY`
- [ ] Bulk resize 3 gallery images
- [ ] Custom size `1080x1350` accepted; garbage rejected
- [ ] Missing `FAL_KEY` → clear error on Resize only

---

## Common pitfalls

| Issue | Fix |
|-------|-----|
| Board render ignores cinematic layout | Must call `buildStoryboardImagePrompt`, not raw `imagePrompt` alone |
| Continuity breaks board-to-board | Pass prior `imageUrl` as edit seed + lookback text in plan |
| fal 401 | `FAL_KEY` missing/wrong; header must be `Key …` not Bearer |
| fal rejects data URL | Host with `hostGeneratedImage` in smartResize action first |
| Lab seed stuck | Share studio `seed` state; default from primary gallery image |
| Types not found in client | Re-export platformSizes + variationLab from content `index.ts` |
| Review loses storyboard | `isEmptyReview` + persist path |

---

## Minimal manual port (if UI diverged)

1. Copy all **new** server + lib files.  
2. Merge AI actions + aiClient helpers.  
3. Extend `PieceReview` + reviewClient.  
4. Drop in `StoryboardPanel` + `VariationLabPanel`.  
5. Add two studio tabs that only mount those panels + board render handler.  
6. Set `FAL_KEY` and smoke-test Resize last.

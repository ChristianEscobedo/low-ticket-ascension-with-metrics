# Video Script + Final-Cut Upload — Port Checklist

Use this to copy **second-by-second production scripts**, **b-roll prompts/stills**, and **final-cut video upload** into a sibling codebase that already has the MotherMode content hub Edit sheet and `/api/mothermode/ai`.

Master overview: `docs/CONTENT_HUB_FEATURES_PORT.md`  
Commit: `f176727` (+ preview fixes `1658559`, `96ec8e1`; Auto fix `b62812e` is separate but recommended)

---

## Feature summary

| Area | What was added |
|------|----------------|
| UI | Edit-tab **Production script** panel on `reel` / `video` pieces |
| AI | Action `videoScript` → contiguous second-by-second beats (VO, shot, action, on-screen, b-roll + b-rollPrompt) |
| B-roll | Per-beat still generation via existing `image` action + `brollPrompt` |
| Upload | `POST /api/mothermode/content/video` multipart → Supabase Storage public URL |
| State | `PieceReview.videoScript`, `PieceReview.video` (localStorage via reviewClient) |
| Previews | Reel/story frames fill correctly (absolute-fill + fixed width) |

No DB migration.

---

## Prerequisites

- [ ] Content sheet Edit tab (`SheetForms` / `ContentSheet`)
- [ ] `review.ts` + `reviewClient.ts` with image gallery helpers
- [ ] `/api/mothermode/ai` + `openai-content.ts` with `resolveTextModel`
- [ ] `aiGenerateImage` client helper (for b-roll stills)
- [ ] `src/utils/mothermode/storage.ts` with Supabase service-role client
- [ ] Admin auth on API routes

---

## Files (10)

Copy or re-apply in this order.

### 1. Preview fill fix — `src/components/mothermode/content/previews/shared.tsx`

**Problem:** Vertical reel/story surfaces use `PreviewMedia` with `className="absolute inset-0"` *and* `aspect-[9/16]`. Applying both collapses or overflows the frame.

**Fix:** When `className` includes both `absolute` and `inset-0`, drop the aspect class and use full height/width:

```tsx
const fills =
  className.includes('absolute') && className.includes('inset-0');
const frame = fills
  ? `h-full w-full overflow-hidden bg-black ${className}`
  : `${aspect} w-full overflow-hidden bg-black ${className}`;
const emptyFrame = fills
  ? `flex h-full w-full items-center justify-center ${className}`
  : `${aspect} flex w-full items-center justify-center ${className}`;
```

Image inside still uses `h-full w-full object-cover`.

### 2. Fixed-width vertical parents

On Instagram / Facebook / TikTok **reel** and **story** (and TikTok main vertical) wrappers:

```tsx
// BEFORE (collapses): aspect only, no width
<div className="relative mx-auto aspect-[9/16] max-w-full …">

// AFTER
<div className="relative mx-auto aspect-[9/16] w-[280px] max-w-full overflow-hidden rounded-xl bg-black text-white">
  <PreviewMedia
    … 
    aspect="aspect-[9/16]"
    className="absolute inset-0"
  />
```

Files:

- `src/components/mothermode/content/previews/InstagramPreview.tsx` (Reel + Story)
- `src/components/mothermode/content/previews/FacebookPreview.tsx` (vertical surfaces)
- `src/components/mothermode/content/previews/TikTokPreview.tsx`

### 3. Types — `src/lib/mothermode/content/review.ts`

Add:

```ts
export interface VideoScriptBeat {
  startSec: number;
  endSec: number;
  shot?: string;
  onScreen?: string;
  voiceover: string;
  action?: string;
  broll?: string;
  brollPrompt?: string;
  brollImage?: string;
}

export interface VideoScript {
  totalSeconds: number;
  beats: VideoScriptBeat[];
  model?: string;
  generatedAt?: string;
}
```

On `PieceReview`:

```ts
video?: string;
videoScript?: VideoScript;
```

Helpers:

- `withVideoScript(prev, script)` / `withoutVideoScript(prev)`
- `withVideo(prev, url)` / `withoutVideo(prev)` (or equivalent clear helpers)
- Update `isEmptyReview` so non-empty `video` or `videoScript.beats` counts as content

### 4. Client store — `src/components/mothermode/content/reviewClient.ts`

```ts
export function setReviewVideoScript(offerSlug, id, script): PieceReview
export function clearReviewVideoScript(offerSlug, id): PieceReview
export function setReviewVideo(offerSlug, id, url): PieceReview
export function clearReviewVideo(offerSlug, id): PieceReview
```

Pattern: read → pure helper → `persist` → return next.

### 5. Storage — `src/utils/mothermode/storage.ts`

```ts
const VIDEO_EXT_BY_MIME = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
};
export const ALLOWED_VIDEO_MIMES = Object.keys(VIDEO_EXT_BY_MIME);

export async function uploadVideoBuffer(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  folder = 'mothermode-video',
): Promise<string>
```

Upload to same public bucket as images; return `getPublicUrl`.

### 6. Upload API — `src/app/api/mothermode/content/video/route.ts` (**new**)

- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60`
- Admin guard
- Multipart field `file`
- Validate MIME against `ALLOWED_VIDEO_MIMES`
- Max **100 MB**
- `uploadVideoBuffer` → `{ ok: true, url }`

### 7. Provider — `src/utils/integrations/openai-content.ts`

Add:

- `VideoScriptInput`, `VideoScriptBeatOut`
- `buildVideoScriptUser` — duration, pacing rules, source piece summary, JSON shape
- `normalizeBeats` — sort, clamp, make contiguous 0…durationSec (no gaps)
- `generateVideoScript(input)` using `resolveTextModel` + JSON parse

**System craft (intent):** production shooting script for social short-form; exact spoken VO paced to seconds; b-roll beats include ready-to-render image prompts; no em dashes; return JSON only.

Expected JSON shape:

```json
{
  "totalSeconds": 30,
  "beats": [
    {
      "startSec": 0,
      "endSec": 3,
      "shot": "Talking head, direct to camera",
      "onScreen": "optional",
      "voiceover": "exact words",
      "action": "lean in",
      "broll": "optional plain description",
      "brollPrompt": "optional full scene prompt for image model"
    }
  ]
}
```

### 8. AI route — `src/app/api/mothermode/ai/route.ts`

```ts
if (action === 'videoScript') {
  // body.piece: { hook, hooks?, caption?, body?, script?, theme, tone, platform, format }
  // body.durationSec: number (default e.g. 30, clamp 6–120)
  // body.guides?: string
  // body.model?: string
  const result = await generateVideoScript(…);
  return { ok: true, beats, totalSeconds, model };
}
```

### 9. Browser client — `src/components/mothermode/content/aiClient.ts`

```ts
export interface AiVideoScriptBeat { … }

export async function aiGenerateVideoScript(args: {
  piece: { hook; hooks?; caption?; body?; script?; theme; tone; platform; format };
  durationSec: number;
  guides?: string;
  model?: string;
}): Promise<{ beats; totalSeconds; model? }>
```

Posts `{ action: 'videoScript', ... }`.

### 10. UI — `VideoScriptPanel.tsx` + wiring

**New:** `src/components/mothermode/content/VideoScriptPanel.tsx`

Capabilities:

- Duration selector (e.g. 15 / 30 / 45 / 60)
- Optional guides textarea
- Model picker (Auto + TEXT_MODELS)
- Generate / regenerate script
- Beat list: time range, VO, shot, action, on-screen, b-roll fields (editable)
- Per-beat “Generate b-roll still” → `aiGenerateImage(brollPrompt)` → store `brollImage` on beat
- Copy full script as plain text
- Final-cut upload (`FormData` → `/api/mothermode/content/video`) + clear
- Video preview when `review.video` set

**Wire in** `SheetForms.tsx`:

```tsx
const isVideo = piece.format === 'reel' || piece.format === 'video';

{isVideo && (
  <VideoScriptPanel
    piece={piece}
    review={review}
    offerSlug={offerSlug}
    model={model}
    onReviewChange={onReviewChange}
  />
)}
```

Ensure `ContentSheet` passes `offerSlug` + `onReviewChange` into forms if not already.

---

## Auto model key-aware fix (recommended same pass)

Commit `b62812e`. In `openai-content.ts`:

1. `availableTextProvider(preferred?)` — only return a provider that has a key; prefer Anthropic when both exist.
2. `textConfig()` — honor overrides only if catalog model’s provider has a key; else frontier default for available provider.
3. `resolveTextModel(requested?)` — if requested model’s provider has no key, **fall back** to `textConfig()` instead of hard-failing.

This prevents Auto generation from dying when `MOTHERMODE_AI_TEXT_PROVIDER=anthropic` but only OpenAI is configured (or the reverse).

---

## Smoke tests

- [ ] Reel piece → Production script panel visible
- [ ] Feed piece → panel hidden
- [ ] Generate 30s script → beats contiguous, VO present
- [ ] Edit VO → persists after sheet close/reopen (same offer)
- [ ] B-roll still on one beat lands in beat + optionally gallery if you wire that
- [ ] Upload mp4 → public URL; refresh keeps video
- [ ] Reject .exe / huge file with clear error
- [ ] IG/FB/TT reel+story previews fill frame

---

## Dependencies for later features

Storyboard **b-roll mode** can read `review.videoScript.beats` for `brollPrompt` seeds. Port video script before or with storyboard if you want that path.

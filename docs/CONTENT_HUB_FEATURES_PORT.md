# Content Hub Features — Master Port Guide

Use this to bring a **behind** sibling codebase up to the current MotherMode content hub feature set: reel/story preview fixes, video production scripts, Auto model reliability, storyboard packs, and Variation Lab (including fal smart-resize).

**Source of truth commit range (this repo):** `27687b9..1ab71dd`  
**Tip commit:** `1ab71dd` — `feat(content): storyboard packs + Variation Lab with fal smart-resize`

Related older ports (do these first if missing):

| Doc | Feature |
|-----|---------|
| `docs/IMAGE_EDIT_SYSTEM_PORT.md` | Image Studio Generate / Edit tabs, seed + refs |
| `docs/CONTENT_GENERATE_SYSTEM_PORT.md` | Generate drawer compose → review → save + image bridge |
| `docs/CONTENT_EXPORT_SYSTEM.md` | Export panel (CSV, Metricool, GHL, Sheets) |

Focused checklists for *this* wave:

| Doc | Feature |
|-----|---------|
| `docs/VIDEO_SCRIPT_SYSTEM_PORT.md` | Second-by-second scripts, b-roll, final-cut upload |
| `docs/STORYBOARD_VARIATION_LAB_PORT.md` | Storyboard packs + Variation Lab + fal |
| `docs/COMPLIANCE_AGENT_SYSTEM_PORT.md` | Brand + platform compliance score/fix agent |


---

## Feature map

| # | Feature | Commits | DB migration? | New env |
|---|---------|---------|---------------|---------|
| 1 | Reel/story preview fill | `1658559`, `96ec8e1` | No | — |
| 2 | Video scripts + final-cut upload | `f176727` | No | Supabase Storage (existing) |
| 3 | Auto model key-aware | `b62812e` | No | — |
| 4 | Storyboard packs | `1ab71dd` | No | — |
| 5 | Variation Lab + fal smart-resize | `1ab71dd` | No | **`FAL_KEY`** |
| 6 | Compliance agent (brand + platform) | (this wave) | No | — |


All of these store extra state on **piece review** (localStorage via `reviewClient`), not in Postgres. No new Supabase migrations for this wave.

---

## Prerequisites in the target repo

Confirm these exist before porting:

- [ ] Content hub: `ContentHub`, `ContentSheet`, `SheetForms`, platform previews
- [ ] Image Studio (`ImageStudioModal`) with Generate + Edit (see Image Edit port)
- [ ] `/api/mothermode/ai` admin route + `openai-content.ts` provider layer
- [ ] `review.ts` + `reviewClient.ts` (images, edits, metrics)
- [ ] `hostGeneratedImage` / `uploadImageDataUrl` in `src/utils/mothermode/storage.ts`
- [ ] Supabase Storage public bucket (`SUPABASE_MEDIA_BUCKET` or `media`)
- [ ] Admin route guard (`requireAdminRoute`)
- [ ] Text + image model catalogs (`TEXT_MODELS`, `IMAGE_MODELS`, `AUTO_MODEL`, `EDIT_IMAGE_MODELS`)

Optional but recommended:

- [ ] Content Generate drawer (compose → review → save)
- [ ] Amplify panel

---

## Recommended port order

```
1. Preview fill fix          (small, unblocks QA of vertical formats)
2. Auto model key-aware      (small, unblocks generation with one key)
3. Video script + upload     (medium; types + API + panel)
4. Storyboard packs          (medium; depends on Image Studio + review types)
5. Variation Lab + fal       (largest; depends on image gen/edit + FAL_KEY)
```

Cherry-pick path (if histories align):

```bash
git cherry-pick 1658559 96ec8e1 b62812e f176727 1ab71dd
```

File-copy path: follow the focused docs in order; use this master for env + smoke tests.

---

## Environment variables

Add to `.env.example` / Vercel Production (and Preview if needed):

```bash
# Existing content AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=          # or GOOGLE_API_KEY
MOTHERMODE_AI_TEXT_PROVIDER=
MOTHERMODE_AI_TEXT_MODEL=
MOTHERMODE_AI_IMAGE_MODEL=

# NEW — Variation Lab smart-resize (fal.ai)
# https://fal.ai/dashboard/keys
FAL_KEY=

# Existing storage (video final-cut + hosted images)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_MEDIA_BUCKET=media
```

**Notes:**

- `FAL_KEY` is only required for **Resize** in Variation Lab. Brief / Vary / Storyboard / Video script work without it.
- Video upload uses the same Storage bucket as AI images; ensure the bucket is **public** (or URLs are otherwise fetchable by fal when resizing hosted images).
- fal smart-resize needs a **public http(s) URL**. The AI route hosts data URLs via `hostGeneratedImage` before calling fal.

---

## AI route actions (complete list after port)

`POST /api/mothermode/ai` body: `{ action, ... }`

| action | Purpose |
|--------|---------|
| `image` | Text-to-image |
| `imageEdit` | Seed + refs edit |
| `rewrite` | Hook/caption/body rewrite |
| `amplify` / `amplifyParts` / `imagePrompts` | Amplify pipeline |
| **`videoScript`** | Second-by-second production script |
| **`storyboardPlan`** | 1–4 connected contact-sheet boards |
| **`variationBrief`** | Brief → master/alt prompts + frame pack |
| **`variationPlan`** | Dimension matrix of edit instructions |
| **`smartResize`** | fal-ai/smart-resize to exact WxH |
| **`complianceScore`** | Brand + platform policy scorecard |
| **`complianceFix`** | AI rewrite of non-compliant fields |


Also:

| Route | Purpose |
|-------|---------|
| `POST /api/mothermode/content/video` | Multipart final-cut upload → public URL |

---

## File inventory (this wave)

### New files

```
src/components/mothermode/content/VideoScriptPanel.tsx
src/components/mothermode/content/StoryboardPanel.tsx
src/components/mothermode/content/VariationLabPanel.tsx
src/lib/mothermode/content/platformSizes.ts
src/lib/mothermode/content/variationLab.ts
src/utils/integrations/fal-smart-resize.ts
src/app/api/mothermode/content/video/route.ts
```

### Patched files

```
.env.example
src/lib/mothermode/content/review.ts
src/lib/mothermode/content/constants.ts
src/lib/mothermode/content/index.ts
src/components/mothermode/content/reviewClient.ts
src/components/mothermode/content/aiClient.ts
src/components/mothermode/content/ImageStudioModal.tsx
src/components/mothermode/content/ImagesCard.tsx
src/components/mothermode/content/SheetForms.tsx
src/components/mothermode/content/ContentSheet.tsx
src/components/mothermode/content/previews/shared.tsx
src/components/mothermode/content/previews/InstagramPreview.tsx
src/components/mothermode/content/previews/FacebookPreview.tsx
src/components/mothermode/content/previews/TikTokPreview.tsx
src/app/api/mothermode/ai/route.ts
src/utils/integrations/openai-content.ts
src/utils/mothermode/storage.ts
```

---

## PieceReview shape (after port)

Extra fields on `PieceReview` (see `src/lib/mothermode/content/review.ts`):

```ts
interface PieceReview {
  // …existing: image, images, imageIndex, notes, edits, metrics
  video?: string;                 // hosted final-cut URL
  videoScript?: VideoScript;      // second-by-second beats
  storyboard?: StoryboardPack;    // 1–4 boards + refs
}
```

`isEmptyReview` must treat non-empty `video`, `videoScript`, and `storyboard` as **non-empty** so they are not dropped on persist.

---

## Image Studio tabs (after port)

```
Generate | Edit | Board | Lab
```

| Tab | Role |
|-----|------|
| Generate | Text-to-image |
| Edit | Seed edit + refs + presets |
| Board | Render planned storyboard contact sheets |
| Lab | Variation Lab: Brief / Vary / Resize |

`initialTab?: 'generate' | 'edit' | 'storyboard' | 'lab'` opens a specific tab (StoryboardPanel → Board, ImagesCard Lab → Lab).

---

## Smoke-test checklist

### 1. Reel / story previews

- [ ] Open an Instagram **reel** piece → preview is a tall phone frame (~280px wide), image fills edge-to-edge
- [ ] Instagram **story** same
- [ ] Facebook story / reel (if present) same
- [ ] TikTok vertical same
- [ ] Empty state still shows “Add an image…” without collapsing the frame
- [ ] Feed/carousel square previews unchanged

### 2. Auto model

- [ ] With **only** `OPENAI_API_KEY` set, Generate batch with model **Auto** succeeds
- [ ] With **only** `ANTHROPIC_API_KEY` set, Auto text succeeds
- [ ] Explicit model still works when its key is present
- [ ] Missing all keys returns a clear 501-style error, not a crash

### 3. Video script + upload

- [ ] Open a **reel** or **video** piece → Edit shows **Production script** panel
- [ ] Generate script → beats cover 0…N seconds with VO, shot, optional b-roll prompts
- [ ] Edit a beat; regenerate b-roll still for one beat
- [ ] Copy script as text
- [ ] Upload mp4/webm/mov final cut → URL stored; clear works
- [ ] Non-video formats do **not** show the video script panel

### 4. Storyboard

- [ ] Any piece Edit → **Storyboard** panel
- [ ] Plan 2 boards, narrative mode → boards have titles, scenes, imagePrompt, lookback
- [ ] Add character ref + product ref
- [ ] Open Image Studio → **Board** tab → Render contact sheet → image in gallery + board.imageUrl
- [ ] Board 2 render uses board 1 image as continuity seed when present
- [ ] B-roll mode can seed from video-script b-roll prompts when script exists

### 5. Variation Lab

- [ ] ImagesCard **Lab** or Studio **Lab** tab
- [ ] **Brief**: write brief → master + alts → Generate into gallery
- [ ] Carousel/story: frame pack generates multiple frames
- [ ] **Vary**: pick seed + dimensions → Plan → Run edits → variants in gallery
- [ ] **Resize** (needs `FAL_KEY`): pick IG 4:5 + story 9:16 → resized images in gallery
- [ ] Bulk resize over multiple gallery images
- [ ] Without `FAL_KEY`, Resize errors clearly; Brief/Vary still work

---

## Common failure modes

| Symptom | Likely cause |
|---------|----------------|
| Reel preview is a thin strip / empty | `PreviewMedia` still applies `aspect-*` under `absolute inset-0`; parent missing fixed width |
| Auto generate 501 / wrong provider | `resolveTextModel` / `availableTextProvider` not key-aware |
| Video upload 413 / fail | Body size limit; raise `maxDuration` / platform limit; check 100 MB client guard |
| Storyboard render generic | Missing `STORYBOARD_SYSTEM` + `buildStoryboardImagePrompt` |
| fal resize “invalid image_url” | Data URL not hosted first; Storage not public |
| Lab tab missing | `StudioTab` / `StudioTabs` not updated; `VariationLabPanel` not imported |
| Review wiped after refresh | `isEmptyReview` drops video/script/storyboard; or reviewClient helpers not wired |

---

## Quick copy strategy

If the clone is a near-fork of this repo:

1. Copy the **new files** list wholesale.
2. Diff-merge the **patched files** (prefer taking this repo’s version of `review.ts`, `aiClient.ts`, `openai-content.ts` AI additions, `ImageStudioModal.tsx` if the clone’s studio is not heavily customized).
3. Set `FAL_KEY` in Vercel.
4. Run smoke tests above.

If the clone diverged heavily on Image Studio UI, port **types + API + panels** first, then re-wire tabs manually using `STORYBOARD_VARIATION_LAB_PORT.md`.

---

## Out of scope (this wave)

These live on `main` but are **not** part of the content-hub creative wave:

- Deliverables admin + buyer resource workspaces (`44e1021` and related)
- Courses subsystem
- Funnel / receipts / email sequences

Port those separately if the clone needs them.

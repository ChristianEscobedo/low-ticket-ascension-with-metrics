# Content Hub — Next Tasks (paste into a fresh task)

Seven follow-ups for the mothermode Content Hub. Each lists intent, key files, and approach. Do them one at a time; run `npx vitest run` + `npx tsc --noEmit` after each.

---

## 1. Primary-text variation AI (editor text, not image) — ✅ DONE
> Implemented: `generateTextVariations` (`openai-content.ts`), `text-variations`
> route action (`ai/route.ts`), `aiTextVariations` client wrapper
> (`aiClient.ts`), and the "Variations" UI in `OverlayPanel.tsx` (count
> selector 3/5/10, Regenerate, clickable chips that load into the editor).
> Text-only — never touches the image. Verified: `tsc` clean; overlay/frame-pack
> tests pass.


**Goal:** In the Text editor (`OverlayPanel.tsx`), add a "Variations" button next to the Primary text field. User picks how many (e.g. 3/5/10); AI rewrites the **editor** `overlay.text` into that many alternatives. Show them as clickable chips; clicking one loads it into the editor. This is plain text output — it does NOT touch the image.
- **Files:** `src/components/mothermode/content/OverlayPanel.tsx` (UI + state), `src/components/mothermode/content/aiClient.ts` (add `aiTextVariations(text, count, context)`), `src/app/api/mothermode/ai/route.ts` (new action `text-variations` → OpenAI text completion), `src/utils/integrations/openai-content.ts` (prompt builder).
- **Approach:** New AI action returns `string[]`. Render chips under Primary text; keep last set in local state; "Regenerate" + count selector. Reuse `AiError`/`Spinner` from `AiControls`.

## 2. Fix burned-in render width vs preview (renders slightly narrower) — ✅ DONE
> Root cause + fix: the burn-in read narrower because `wrapLines` packed more
> characters per line than the DOM preview — it measured natural glyph width but
> ignored `letter-spacing` (tracking). Canvas wrap + block-width now fold
> `trackingPx` into the per-line advance (`wrapLines`/`measureBlockWidth` in
> `imageOverlay.ts`), matching the preview's `width: max-content` + CSS
> `letter-spacing`. Everything else already matched by construction: the canvas
> wraps at `maxWidthPct * exportW` while the DOM wraps at `maxWidthPct *
> previewW` (same fraction), and the preview font is exactly the canvas font
> scaled by `previewH / exportH`. Added a unit test
> (`tests/lib/image-overlay.test.ts` → "layout block content width tracks the
> preview max-content ratio") asserting `layoutOverlay().blockWidth / frameW`
> equals the preview's content-width ratio (tracking folded in). Verified: `tsc`
> clean; image-overlay tests pass (12).

**Goal:** Burned-in PNG text is a touch narrower than the live preview.

- **Files:** `src/lib/mothermode/content/imageOverlay.ts` (`renderOverlayToDataUrl` / layout math), compare to `OverlayPanel.tsx` `blockStyle` (preview uses `width: max-content; maxWidth: maxWidthPct` + `letterSpacing`, `lineHeight`).
- **Approach:** Audit the canvas text measurement: canvas likely wraps at a max width computed from `maxWidthPct` but ignores letter-spacing / uses a different font metric than the DOM. Match the canvas `maxWidth` and per-line advance (including tracking) to the DOM's `max-content` behavior. Add a unit test asserting canvas content width ≈ preview ratio.

## 3. Downloads must actually download (all triggers) — ✅ DONE
> Implemented: shared `downloadUrl(url, filename)` helper
> (`src/utils/mothermode/download.ts`) — `fetch → blob → createObjectURL →
> synthetic <a download> click → revoke`, with a data-URL fast path and a
> new-tab fallback when the fetch is blocked (CORS/offline). Every remote-image
> ("Supabase/fal CDN") trigger now routes through it: `OverlayPanel.tsx`
> ("Download last save" is a `<button>` → `downloadUrl`) and
> `ImageStudioModal.tsx` (per-tile download → `download()` → `downloadUrl`).
> `ImagesCard`/`StoryboardPanel`/`FramePackPanel` have no direct download
> triggers (image work is delegated to the studio). `ExportPanel` downloads CSV
> via a local `Blob` object-URL (which `<a download>` handles natively), and its
> Google Sheets link is an "Open Sheet" `<a target="_blank">`, not a file
> download. Verified: `tsc` clean; frame-pack/image-overlay/content-export tests
> pass.

**Goal:** Every "Download" currently opens the Supabase image (right-click to save). Force a real file download.
- **Files:** `OverlayPanel.tsx` ("Download last save" `<a download>`), any download in `ImagesCard.tsx`, `StoryboardPanel.tsx`, `ExportPanel.tsx`, `FramePackPanel.tsx`.
- **Approach:** Cross-origin `<a download>` is ignored, so add a shared helper `downloadUrl(url, filename)` in a util (e.g. `src/utils/mothermode/download.ts`): `fetch(url) → blob → URL.createObjectURL → <a download> click → revoke`. Replace all direct `<a href download>` on remote URLs with a button calling this helper.


## 4. Preview tab: toggle hook variants off — ✅ DONE
> Implemented: an optional `showHookText` flag threaded through the preview
> pipeline. `PreviewView` gained the field (`previews/shared.tsx`);
> `PlatformPreview` accepts a `showHookText?: boolean` prop (default `true`) and
> merges it into the computed view (`previews/PlatformPreview.tsx`). The
> surfaces that paint hook/caption text *on top of the image* now gate that
> layer on `view.showHookText !== false`: Instagram `Story` (centered hook) and
> `Reel` (caption), and `TikTokPreview` (caption + hashtags). Feed/blog/email
> keep copy below the media, so they're unaffected. `ContentSheet.tsx` adds
> local UI state (`showHookText`, default on, not persisted) and a "Show hook
> text over image" checkbox in the Preview tab, shown only when the piece
> actually overlays type (TikTok, or story/reel format), wired into
> `<PlatformPreview showHookText={…} />`. Verified: `tsc --noEmit` clean.

**Goal:** In the piece Preview (`ContentSheet.tsx` Preview tab / the platform previews), add a toggle to hide the hook-variant text overlay so it doesn't cover on-image type (see screenshot: story with burned text + hook overlay stacked).

- **Files:** `src/components/mothermode/content/ContentSheet.tsx` (Preview tab, hook-variant chips + FRAME selector), `previews/*Preview.tsx` (`InstagramPreview`, `TikTokPreview`, etc. that render the overlay text).
- **Approach:** Add a "Show hook text" on/off switch near the "HOOK VARIANT" row; when off, previews render only the base image (and any burned-in image), skipping the caption/hook overlay layer. Local UI state is fine (no persistence needed) unless we want it saved to review.

## 5. Frame pack for slides: editor-text vs AI-in-prompt — ✅ DONE
> Implemented: a per-frame `textSource: 'editor' | 'ai-prompt'` on the frame
> model (`framePack.ts`), defaulting to `editor` (`DEFAULT_FRAME_TEXT_SOURCE`,
> `frameTextSource()` normalizer). `frameImagePrompt()` keeps the prompt clean
> for `editor` frames (copy is burned in as an overlay later) and folds the
> slide's words into the image prompt for `ai-prompt` frames (nothing overlaid);
> `continuityEditPrompt()` mirrors the same branch, and `slideCopyAt()` returns
> empty overlay copy for `ai-prompt` frames so type never double-stacks.
> `withPlannedFrames()` persists `ai-prompt` and normalizes `editor` back to
> `undefined`. `FramePackPanel.tsx` renders the per-slide editor/AI-prompt
> segmented toggle (`updateFrame({ textSource })`) with a helper line, and both
> render paths call `frameImagePrompt(frame)` into `aiGenerateImage`. Added five
> cases to `tests/lib/frame-pack.test.ts` (default source, editor-clean vs
> ai-prompt-folded prompts, planned-frame persistence, `slideCopyAt` gating).
> Verified: `tsc` clean; frame-pack (13) + image-overlay (12) tests pass.

**Goal:** Per slide in the frame pack, let the user choose: (a) place the Text-editor text onto the slide (overlay), or (b) let AI write the text directly into the image generation prompt.

- **Files:** `src/lib/mothermode/content/framePack.ts` (per-slide model: add `textSource: 'editor' | 'ai-prompt'`), `src/components/mothermode/content/FramePackPanel.tsx` (per-slide toggle UI), generation call in `aiClient.ts` / `ai/route.ts`.
- **Approach:** When `editor`, reuse overlay burn-in with the editor text; when `ai-prompt`, inject the line into the image prompt and don't overlay. Default keep current behavior. Update `tests/lib/frame-pack.test.ts`.

## 6. Generate-content sheet on Channels: show platform logo — ✅ DONE
> Implemented: a reusable `PlatformIcon` component + `PLATFORM_BRAND` color map
> (`src/components/mothermode/content/PlatformIcon.tsx`) — brand glyphs per
> channel that tint via `currentColor` or an explicit brand color. The batch
> "Generate content" sheet (`BatchPanel.tsx`) renders the target channel as a
> `<PlatformIcon>` + `PLATFORM_LABEL` chip in the header, tinted with
> `PLATFORM_BRAND[platform]`. The same icon/color pair is reused across the
> Channels view: `ContentHub.tsx` (channel picker + group headers) and
> `ContentCard.tsx` (per-card platform badge + top accent bar). Verified: `tsc`
> clean.

**Goal:** The "Generate content" sheet/form on the Channels view should display the target platform's logo.

- **Files:** `src/components/mothermode/content/SheetForms.tsx` and/or the Channels generate entry (`ContentHub.tsx` / `BatchPanel.tsx`). Platform metadata in `src/lib/mothermode/content/constants.ts` (platform list) — check for existing icon map; the previews already show platform chrome so an icon/logo map may exist in `previews/shared.tsx`.
- **Approach:** Add/read a platform→logo map (lucide or brand SVGs in `/public`), render the logo in the sheet header next to the platform name.

## 7. Slides/Stories + Carousel multi-slide support (in previews/sheet) — ✅ DONE
> Implemented: the preview pipeline now paginates across the *larger* of the
> rendered image gallery and the slide list, so multi-slide carousels/stories
> flick through frames even before every slide has its own image.
> `PlatformPreview.buildView` already clamps `imageIndex` across
> `Math.max(images, slides, 1)` and exposes `view.slides`; the Instagram `Feed`
> (carousel) now sizes its `CarouselDots` by that frame count and leads the
> caption with the active slide's on-frame line, and the Instagram + Facebook
> `Story` surfaces size the segmented progress bar by frame count and render the
> active slide's `text`/`sub` (falling back to the hook) instead of a static
> hook on every frame. `ContentSheet.tsx` computes the Frame selector count as
> `Math.max(images, slides)` for deck formats (carousel/story/idea) — so
> "FRAME n OF N" shows for carousels too — and `setImageIndex` persists the
> active frame for slide-only decks (no image variant yet) while still promoting
> the gallery for true A/B image sets. Verified: `tsc` clean; frame-pack (13) +
> image-overlay (12) tests pass.

**Goal:** Bring the multi-slide (frame) support to Stories/Slides and Carousel formats in the Preview/sheet, matching the frame selector already shown for stories (screenshot shows "FRAME 5 OF 5").

- **Files:** `ContentSheet.tsx` (frame selector wiring), `previews/InstagramPreview.tsx` + `TikTokPreview.tsx` (carousel/story multi-slide rendering), `framePack.ts` (slide array is the source of truth), `StoryboardPanel.tsx`.
- **Approach:** Ensure carousel format also renders an N-slide selector + swipeable/previewable frames from the frame pack; reuse the story frame logic. Confirm export (`export/*`, `ContentSheet` Schedule/Amplify) handles multiple slide images.

---

### Global notes
- AI actions go through `src/app/api/mothermode/ai/route.ts` (server) + `aiClient.ts` (client fetch). Follow existing action-name pattern.
- Persisted piece state = `PieceReview` in `src/lib/mothermode/content/review.ts` (use `toStoredOverlay`, don't clobber gallery).
- Run: `npx vitest run` and `npx tsc --noEmit -p tsconfig.json` before each attempt_completion.

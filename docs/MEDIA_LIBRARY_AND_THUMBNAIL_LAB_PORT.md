# Media Library + Thumbnail Lab — System Port

**Date:** 2026-12-02 · **Scope:** one searchable home for every asset + per-variant thumbnails with AI generation/editing + the shared platform mock in the schedule sheet.

This chat shipped two connected systems plus a schedule-sheet overhaul:

1. **The Media Library** — one Supabase-backed home for every asset the app touches (uploads, Content Hub renders, reel composites, Thumbnail Lab exports), with folders, tags, search, and an admin surface. The point: AI prompts and other surfaces can finally use prior media as context.
2. **The Thumbnail Lab** — per-variant thumbnails built on the SAME text overlay editing system as the Content Hub's image studio (`imageOverlay.ts`), with 7 text style templates, a 16:9/9:16 canvas toggle, and AI background create/edit seeded from the library.
3. **The schedule sheet** — rebuilt as a full-width two-column modal rendering the exact same pixel-faithful platform mock as the Publish view, live as you edit.

---

## 1. The Media Library

### Schema — `supabase/migrations/20261202000000_media_library.sql`

Two tables. ONE table for assets, not one per surface: vault assets, reel clips, hub renders, and thumbnails are all the same shape (named URL + kind + tags). Every surface is a filtered VIEW of the same library — the Vault becomes `kind=video + tag hook/outro/reaction`, Thumbnail Lab exports land as `source=thumbnail-lab`, hub renders as `source=generated`.

- `mothermode_media_folders` — id, name, parent_id (nested), color
- `mothermode_media_assets` — id, name, url (unique), kind (`video|image|audio`), source (`upload|generated|thumbnail-lab|vault|external`), duration_sec, thumbnail_url, folder_id, tags (text[] — array-contains, no join table), ref_id/ref_kind (provenance), timestamps

Tags are `text[]` on the asset because tag queries here are "filter by one or two tags on a grid" — array-contains handles it fine, and the tag UI does suggestions from a distinct-tag rollup instead of managing tag rows.

### Store — `src/lib/mothermode/reel/mediaLibrary.ts`

House pattern: lazy service client, degrades to empty arrays, never throws on missing env/table.

- **Folders:** `listMediaFolders`, `createMediaFolder`, `renameMediaFolder`, `deleteMediaFolder`
- **Assets:** `listMediaAssets` (filter by kind/source/folderId/tag/refId), `ingestMediaAsset` (**upsert by URL — ingest is idempotent**, the same render never double-lists), `patchMediaAsset` (rename/move/retag/rethumb), `deleteMediaAsset`
- **Pure helpers** (unit-tested): `normalizeTags` (lowercase, dashes, dedupe), `assetMatches` (name/tag/source/kind search), `folderCounts` (per-folder counts incl. empty), `folderTree` (roots with children), `tagRollup` (most-used first)

### API — `src/app/api/admin/media-library/route.ts`

GET returns the whole library in one payload (folders + assets, filterable by `?kind=&source=&tag=`). POST dispatches on an `action` discriminator: `ingest`, `patchAsset`, `deleteAsset`, `createFolder`, `renameFolder`, `deleteFolder`. Admin-gated; degrades gracefully when the migration isn't applied.

### Admin surface — `src/app/admin/media-library/page.tsx`

Registered in the sidebar right after Asset Hub (`AdminSidebar.tsx`).

Three columns:
- **Left** — folder tree (All assets / Unfiled / folders with counts, nested children, create folder inline, delete with confirm), tag rollup chips with counts, kind filter (image/video/audio)
- **Center** — asset grid (image previews, inline video players, source badges, tag chips); search across name + tag
- **Right** — detail panel: preview, copy URL, move to folder, add/remove tags, delete

Upload goes through the reel signed-url route then ingests with provenance and the active folder.

---

## 2. The Thumbnail Lab

### Pure module — `src/lib/mothermode/reel/thumbnailLab.ts`

The composition model the canvas editor renders. The editor's job is drawing; THIS module's job is deciding WHAT to draw — the layer list, the templates, the safe zone. Pure so the same composition renders in the editor, in tests, and later server-side (ffmpeg burn-in) without a DOM.

- `ThumbnailComposition` — 1280×720 reference size, backgroundUrl, treatment (`none|darken|blur|vignette`), textLayers, badges
- `THUMBNAIL_TEMPLATES` — bold-left, center-stat, question-hook (WATCH badge + sub-line), episode (EP badge)
- `SAFE_ZONE` — keep text inside the middle 84% (platform chrome eats the edges); `clampToSafeZone`
- `compositionFromTemplate`, `variantStampComposition` (alternates layouts per variant), `fitLayer` (auto-shrinks font until the text fits the safe zone), `estimateTextWidthPx`, `layerFits`

### Editor — `src/app/(fullscreen)/admin/reel-studio/ThumbnailLabSheet.tsx`

Uses the SAME text overlay editing system as the Content Hub's image studio text tab (`src/lib/mothermode/content/imageOverlay.ts`): font (sans/serif/display/condensed/rounded/mono), style (shadow/glow/outline/pill/box/scrim/brass-line/bar), size (S/M/L/XL), weight, color (named swatches + custom hex), case transform, tracking, leading, max-width %, and freeform x/y placement (drag the block anywhere, or snap with the 3×3 position grid). Primary + sub line. Canvas render mirrors `renderOverlayToDataUrl` exactly.

Extras on top of the Hub's system:
- **7 text style templates** (`TEXT_TEMPLATES`) — one click fills the whole recipe: Bold hook, Center stat, Question, Episode, Neon pop, Minimal, Brass rule
- **Orientation toggle** — 16:9 feed (1280×720) vs 9:16 video (720×1280); `drawAll` takes dynamic dims
- **AI background** — create (`aiGenerateImage`) or edit (`aiEditImage`) with TWO library pickers: an **edit seed** (which library image the AI edits — sets the canvas background) and **reference images** (style/character seeds, up to 4)
- **Background** — video frame / library image / upload + darken/vignette treatments
- **Export** — canvas → JPEG blob → signed-url upload → ingest into the library tagged `thumbnail + variant` → URL back to the Scoreboard row

### Wiring — `src/app/(fullscreen)/admin/reel-studio/page.tsx`

- A `thumb` button on every Scoreboard variant row opens the Lab with the variant's hook + composed MP4 frame; exported thumbnails track per-variant in `thumbByVariant`
- The Scoreboard row is `flex-wrap items-center gap-x-2 gap-y-1.5` so the 4 action buttons (schedule / thumb / + link / + result) wrap to their own line instead of squeezing the metrics text

---

## 3. The schedule sheet overhaul

The `ScheduleSheet` in `page.tsx` was rebuilt from a narrow single-column form into a full-width two-column modal:

- **Shared `PlatformMockView`** — all 11 pixel-faithful platform mocks (shorts, ytfeed, youtube watch, tiktok, reels, fbreels, fbstory, fbfeed, listory, x, linkedin) extracted from `PublishSheet` into one component (playable video + karaoke captions + per-platform chrome). `PublishSheet` now uses it too — its old inline mocks and dead helpers were removed.
- **The modal** — `max-w-5xl h-[88vh]`, header row, two columns: the full `PlatformMockView` on the left (updates LIVE as you edit copy or switch platforms), the schedule form on the right (post assets, all 6 platform picker with post types, settings checklist, thumbnail picker, date/time, the Content Hub's funnel/lead-magnet/custom-URL link creation flow).

---

## Tests

- `tests/lib/media-library.test.ts` — 5 tests (normalizeTags, assetMatches, folderCounts, folderTree, tagRollup)
- `tests/lib/thumbnail-lab.test.ts` — 11 tests (templates, safe zone clamping, composition build, variant stamping alternation, text width estimation, fitLayer)
- **51/51 passing** — 16 new + 35 existing (reel-schedule, variant-links, reel-studio), zero regressions

## Files

| File | What |
|------|------|
| `supabase/migrations/20261202000000_media_library.sql` | folders + assets tables |
| `src/lib/mothermode/reel/mediaLibrary.ts` | store + pure helpers |
| `src/lib/mothermode/reel/thumbnailLab.ts` | pure composition model + templates |
| `src/app/api/admin/media-library/route.ts` | admin API (GET + 6 actions) |
| `src/app/admin/media-library/page.tsx` | the admin surface |
| `src/app/(fullscreen)/admin/reel-studio/ThumbnailLabSheet.tsx` | the canvas editor |
| `src/app/(fullscreen)/admin/reel-studio/page.tsx` | thumb button + PlatformMockView + schedule sheet + flex-wrap row |
| `src/app/admin/AdminSidebar.tsx` | nav entry |
| `tests/lib/media-library.test.ts` | 5 tests |
| `tests/lib/thumbnail-lab.test.ts` | 11 tests |


## Theme alignment (2026-08-07)
/admin/media-library swept onto the dark house palette via scripts/theme-dark-sweep.cjs (6 token swaps: remaining bg-white cards + ink text → bone/ink). tsc clean.


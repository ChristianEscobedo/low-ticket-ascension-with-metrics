# Content Hub — Next Tasks, Round 2 (paste into a fresh task)

Five follow-ups building on `docs/CONTENT_HUB_NEXT_TASKS.md` (tasks #1–#7 done).
Each lists intent, key files, and approach. Do them one at a time; run
`npx vitest run` + `npx tsc --noEmit -p tsconfig.json` after each.

> **Already fixed in the session that wrote this doc** (no work needed):
> - Preview "Show hook text over image" toggle now also gates the **Facebook
>   Story** centered hook + sub (`previews/FacebookPreview.tsx` — the earlier
>   #4 pass only covered Instagram Story/Reel + TikTok). Instagram/Facebook Reel
>   and TikTok were already gated.
> - Text-variation chips now carry a matching **sub** line, not just primary
>   text (`aiClient.ts` `AiTextVariation`, `ai/route.ts` `text-variations`,
>   `OverlayPanel.tsx` chips). Server `generateTextVariations` already returned
>   `{ text, sub }[]`.

---

## 8. Platform logo inside the Generate-sheet dropdown (not just the header chip)

**Goal:** The "Target channel" picker on the batch **Generate content** sheet
should show each platform's logo next to its name **in the dropdown list**, and
in the selected/closed state — matching the header chip added in task #6.

**Blocker to know:** The picker is a native `<select>` (`BatchPanel.tsx` →
local `Select` component rendering `<option>{PLATFORM_LABEL[p]}</option>`).
Native `<option>` elements **cannot** contain SVG/`<img>`/icon markup per the
HTML spec, so logos can't be shown in a native dropdown list. This requires
replacing the native select with a small custom popover dropdown.

- **Files:**
  - `src/components/mothermode/content/BatchPanel.tsx` — the `Select` helper +
    the "Target channel" usage. The header already renders
    `<PlatformIcon>` + `PLATFORM_BRAND[platform]`.
  - `src/components/mothermode/content/PlatformIcon.tsx` — reuse `PlatformIcon`
    + `PLATFORM_BRAND`.
  - Optional shared: consider extracting a `PlatformSelect` component so
    `AmplifyPanel.tsx` (cross-post target) and `SheetForms.tsx` can reuse it.
- **Approach:** Build a headless dropdown: a trigger `<button>` showing
  `<PlatformIcon>` + label + chevron, and a popover `<ul>` of options each with
  the icon + label, tinted by `PLATFORM_BRAND`. Keyboard support (Up/Down/Enter/
  Esc), click-outside to close, `role="listbox"`/`role="option"`, and it must
  emit the same `ContentPlatform` value the current `<select>` does so callers
  don't change. Keep the native select as a fallback only if quick.

---

## 9. Add YouTube platform (short-form + long-form)

**Goal:** New `youtube` platform that supports **both** short-form (Shorts,
9:16 vertical) and long-form (16:9 landscape video/thumbnail) formats.

- **Files (audit each place `ContentPlatform`/`PLATFORM_LABEL` is enumerated):**
  - `src/lib/mothermode/content/constants.ts` — add `youtube` to the platform
    union/`PLATFORM_LABEL`, `PLATFORM_ORDER`, and `PLATFORM_FORMATS` (map to
    formats: e.g. `reel`/`short` for Shorts, plus a long-form `video` format if
    one doesn't exist — check `FORMAT_LABEL`/format union first; may need a new
    `video`/`long` format).
  - `src/lib/mothermode/content/platformSizes.ts` — export sizes for YouTube:
    Shorts `1080×1920` (9:16), long-form thumbnail `1280×720` (16:9).
  - `src/components/mothermode/content/PlatformIcon.tsx` — add a YouTube glyph +
    `PLATFORM_BRAND.youtube = '#FF0000'`.
  - `src/components/mothermode/content/previews/PlatformPreview.tsx` — route
    `youtube` to a new `previews/YouTubePreview.tsx` (build it: Shorts vertical
    surface like TikTok, long-form landscape player w/ title + channel row).
  - `src/components/mothermode/content/previews/shared.tsx` — any platform lists
    used by preview chrome.
  - Export adapters: `src/lib/mothermode/content/export/metricool.ts`,
    `ghl-basic.ts`, `ghl-advanced.ts`, `csv.ts`, `schedule.ts` — ensure the new
    platform maps to the exporter's channel column/value (check
    `tests/lib/content-export.test.ts` for the expected channel keys).
  - `src/lib/mothermode/content/promptStyles.ts` / `models.ts` — any
    per-platform prompt/style hints.
- **Approach:** Long-form vs short-form is a **format** distinction under the
  one `youtube` platform. Decide: reuse existing `reel`/`carousel` formats where
  they fit, and add a `video`/`long` format for 16:9 long-form. Default the
  Shorts path to the existing vertical-story frame logic. Add/extend tests in
  `tests/lib/content-export.test.ts` and `tests/lib/platform-compliance.test.ts`.

---

## 10. Add LinkedIn platform (all post types)

**Goal:** New `linkedin` platform supporting all its post types: text post,
single-image, multi-image/document carousel (PDF-style), article, and video.

- **Files:** same enumeration checklist as task #9:
  - `constants.ts` (platform + `PLATFORM_FORMATS.linkedin` covering
    text/image/carousel/article/video), `platformSizes.ts` (LinkedIn image
    `1200×627` 1.91:1 feed, `1080×1080` square, carousel/document `1080×1350`),
    `PlatformIcon.tsx` (LinkedIn glyph, `PLATFORM_BRAND.linkedin = '#0A66C2'`),
    `previews/PlatformPreview.tsx` → new `previews/LinkedInPreview.tsx`
    (professional feed card: name/headline/time, reactions bar with LinkedIn
    reaction glyphs, "…and N others", document/carousel pager for multi-slide),
    export adapters, `promptStyles.ts`.
- **Approach:** Model LinkedIn's feed card once (`Feed`), then branch surfaces
  by `format` (image vs multi-image document carousel vs article vs video), the
  way `FacebookPreview` branches Story/Reel/Feed. Reuse the `view.slides`
  multi-slide pager from task #7 for document carousels. Tests as in #9.

> **Shared note for #9 + #10:** grep the whole repo for the platform union so
> nothing is missed: `grep -rn "instagram\|facebook\|tiktok" src/lib/mothermode/content`.
> Adding a platform touches: type union, label/order/formats maps, sizes,
> icon+brand color, preview router + surface, export adapters, prompt hints,
> and tests. Keep each platform in its own commit; run tsc+vitest between.

---

## 11. Compliance: "Apply fix" for recommendations

**Goal:** The Compliance tab surfaces issues + recommended fixes but is
read-only. Add the ability to **apply** a recommendation — write the corrected
copy back into the piece (caption/hook/body/hashtags) so the user doesn't have
to hand-edit.

- **Files:**
  - `src/components/mothermode/content/CompliancePanel.tsx` — add an "Apply fix"
    button per issue (and/or an "Apply all") next to each recommendation.
  - `src/lib/mothermode/content/compliancePass.ts` /
    `src/lib/mothermode/content/platformCompliance.ts` — the pass currently
    returns issues + suggestions; extend the result shape so each issue carries
    a machine-applicable patch (which field to change + the fixed value), not
    just prose. If the model returns a full corrected draft, capture it.
  - `src/utils/integrations/openai-compliance.ts` +
    `src/app/api/mothermode/ai/route.ts` — the compliance action should return
    structured `{ field, before, after }` fixes (or a full corrected piece), so
    the client can apply deterministically. Follow the existing action-name
    pattern; reuse `AiError`/`Spinner`.
  - Persist via `PieceReview` in `src/lib/mothermode/content/review.ts` (write
    caption/hook/body/hashtags overrides — do **not** clobber the gallery/
    overlay recipe). Mirror how other panels persist overrides.
- **Approach:** Prefer structured field-level patches so "Apply" is a pure
  merge into the review overrides (undoable). If only a full rewritten draft is
  available, apply it into the editable copy fields and re-run the pass to
  confirm the issue clears. Add a unit test in
  `tests/lib/platform-compliance.test.ts` asserting an applied fix removes the
  corresponding issue on re-check.

---

## 12. Stories/Reels autoplay in the preview (like the platform)

**Goal:** In the Preview tab, multi-frame Stories/Reels (and carousels) should
**auto-advance** through frames like they do natively, with the segmented
progress bar animating — instead of only advancing when the user clicks the
FRAME selector.

- **Files:**
  - `src/components/mothermode/content/ContentSheet.tsx` — owns `imageIndex` +
    the FRAME selector. Add an autoplay timer (e.g. `setInterval` ~3–4s/frame)
    that advances `imageIndex` across `Math.max(images, slides)` and loops.
    Pause on hover/focus and when the user manually picks a frame; a small
    play/pause control is a plus. Respect `prefers-reduced-motion`.
  - `src/components/mothermode/content/previews/shared.tsx` — `StoryProgress`
    currently renders a static segmented bar; make the active segment animate
    its fill over the frame duration (CSS transition/animation keyed to the
    active index + duration) so it reads like a real story timer.
  - `previews/InstagramPreview.tsx`, `previews/FacebookPreview.tsx`,
    `previews/TikTokPreview.tsx`, and the new YouTube/LinkedIn previews — ensure
    they render whatever `imageIndex` the autoplay drives (they already read
    `view.imageIndex` / `view.slides[view.imageIndex]`).
  - `previews/PlatformPreview.tsx` — `buildView` already clamps `imageIndex`
    across frames; no logic change expected, just confirm.
- **Approach:** Keep autoplay state local to the Preview tab (not persisted).
  Only autoplay for deck/vertical formats (story/reel/carousel) with >1 frame.
  Clean up the interval on unmount/tab-change. Feed/blog/email stay static.
  No new tests strictly required (UI timing), but keep `tsc` clean.

---

### Global notes (unchanged)
- AI actions go through `src/app/api/mothermode/ai/route.ts` (server) +
  `aiClient.ts` (client fetch). Follow the existing action-name pattern.
- Persisted piece state = `PieceReview` in
  `src/lib/mothermode/content/review.ts` (use `toStoredOverlay`; don't clobber
  the gallery).
- Run `npx vitest run` and `npx tsc --noEmit -p tsconfig.json` before each
  `attempt_completion`.

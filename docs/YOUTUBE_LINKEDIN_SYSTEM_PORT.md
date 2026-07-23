# YouTube + LinkedIn System — Documentation & Port Guide

How the two new content surfaces work end to end, and exactly how to move them
into another codebase. Pairs with the copy-authoring spec in
`YOUTUBE_LINKEDIN_CONTENT_ROUND_1.md` and the suite overview in
`MOTHERMODE_CONTENT_SUITE_MASTER_PORT.md`.

> Voice rules apply to all copy and all generated strings: no em dashes, no en
> dashes, no NO-list words, periods over exclamation points, soft $7 CTA.

---

## 1. What this feature is

Two things:

1. **Platform surfaces** — `youtube` and `linkedin` are first-class platforms in
   the content hub, with their own catalogs, previews, formats, sizes, and
   brand tinting. This lets the hub plan, preview, compliance-check, and export
   YouTube and LinkedIn posts like any other channel.
2. **YouTube Studio kit** — a server generator that turns any piece into a
   publish-ready YouTube kit: A/B titles, an SEO description, search tags, valid
   chapter markers, and thumbnail concepts (prompt + overlay text).

---

## 2. File inventory

Library / data:
- `src/lib/mothermode/content/types.ts` — `youtube` + `linkedin` added to
  `ContentPlatform`; formats `long`, `reel`, `feed`, `carousel`, `article`,
  `video` in `ContentFormat`; `ContentPiece.script`/`body`/`slides`/`media`.
- `src/lib/mothermode/content/constants.ts` — `PLATFORM_LABEL`, `FORMAT_LABEL`,
  `PLATFORM_FORMATS` entries for both channels.
- `src/lib/mothermode/content/platformSizes.ts` — aspect/dimension source of
  truth: YT `long` 1280x720 (16:9), YT `reel` 1080x1920 (9:16), LinkedIn `feed`
  1200x627, `carousel` 1080x1350, `article` cover 1200x627, `video` 1920x1080.
- `src/lib/mothermode/content/platformCompliance.ts` — per-platform hard limits.
- `src/lib/mothermode/content/youtube.ts` — 2 long-form + 3 Shorts (see §3).
- `src/lib/mothermode/content/linkedin.ts` — 5 native post types (see §4).
- `src/lib/mothermode/content/index.ts` — both spread into `allContent` in
  `PLATFORM_ORDER` position; `countByPlatform` includes both keys.

UI / previews:
- `src/components/mothermode/content/previews/YouTubePreview.tsx`
- `src/components/mothermode/content/previews/LinkedInPreview.tsx`
- `src/components/mothermode/content/previews/PlatformPreview.tsx` — routes to
  the right surface by platform/format.
- `src/components/mothermode/content/PlatformIcon.tsx` — `PLATFORM_BRAND` tints.
- `src/components/mothermode/content/YouTubeStudioPanel.tsx` — the kit UI.

Server / API:
- `src/utils/integrations/openai-youtube.ts` — the kit generator.
- `src/lib/mothermode/content/review.ts` — `YouTubeChapter`, `YouTubeThumbnail`,
  and the per-piece review slot that stores the generated kit + thumbnail URLs.
- `src/app/api/mothermode/ai/route.ts` — exposes the `youtube-kit` action
  (alongside compose/compliance/storyboard).

---

## 3. YouTube catalog (`youtube.ts`)

Search-and-watch-time driven. Two content shapes:

- **Long-form** (`format: 'long'`, 16:9): a titled watch page. Uses `script[]`
  for chaptered beats (`at`, `onScreen`, `voiceover`, `visual`) and `body[]` for
  the video description, where the second `body` paragraph is the
  timestamped-chapter list (`0:00 ...`, `1:12 ...`). `media.type: 'video'`,
  `aspect: 'aspect-video'`, `hint: '1280 x 720'` thumbnail prompt.
- **Shorts** (`format: 'reel'`, 9:16): fast payoff loops with the hook in the
  first 2 seconds. `script[]` beats are second-ranged (`0-2s`, `2-8s`, ...);
  `media.aspect: 'aspect-[9/16]'`, `hint: '1080 x 1920'`.

Audience spans overwhelmed mothers and working/career women arriving via search.
Every CTA routes to the $7 Brain Dump. 2 long-form + 3 Shorts in round 1.

---

## 4. LinkedIn catalog (`linkedin.ts`)

All in the **founder's first-person POV** ("I built and use MotherMode"),
targeting career and business women, framing the mental load as an operations
problem. One of each native type:

| id | format | media | notes |
|----|--------|-------|-------|
| `li-text-1` | `feed` | none | text-only feed post |
| `li-image-1` | `feed` | image 1200x627 | single-image post |
| `li-carousel-1` | `carousel` | image 1080x1350 | document carousel, `slides[]` (7) |
| `li-article-1` | `article` | cover 1200x627 | `body[]` essay, `hook` = title |
| `li-video-1` | `video` | video 1920x1080 | talking-head, `script[]` beats |

For the text-only post, omit `media` entirely so the Feed surface renders copy
only. Carousel uses `slides[]` of `{ text, sub }`. Article uses `hook` as the
title, `caption` as the intro post copy, and `body[]` as the essay paragraphs.

---

## 5. YouTube Studio kit generator

`openai-youtube.ts` (`generateYouTubeKit`), server-only.

Input (`YouTubeKitInput`): a `piece` (`hook`, `hooks?`, `caption?`, `body?`,
`script?` VO lines, `theme`, `tone`), plus `durationSec?`, `titleCount?` (2-6),
`thumbnailCount?` (1-4), `guides?`, `model?`.

Output (`YouTubeKitResult`): `titles[]`, `description`, `tags[]`, `chapters[]`,
`thumbnails[]`, `model`.

Key behaviors to preserve when porting:
- **Provider/key resolution** mirrors `openai-content.ts`: prefers an explicit
  model, then admin overrides, then whichever provider has a key
  (`getOpenAiKey`/`getAnthropicKey`). JSON-mode on OpenAI, `messages` on
  Anthropic. `AiResult<T>` union for typed success/error.
- **Chapters** are only requested when `durationSec >= 120`. They are normalized
  to be YouTube-valid: sorted, first forced to `startSec: 0`, strictly
  increasing, capped at 20.
- **Thumbnails** are *concepts* (`concept`, `prompt` for a 16:9 render with
  negative space for text, `overlayText`). The actual image render reuses the
  client `aiGenerateImage` action; the resulting URL is stitched into the kit
  and stored on the piece's review slot.
- **VOICE_RULES** are prepended to the system prompt.

The kit persists on the piece via `review.ts` review state so it survives
reloads and rides along on export/handoff.

---

## 6. Port steps

1. **Types + labels + sizes**: add `youtube` and `linkedin` to `ContentPlatform`
   and the new formats to `ContentFormat` in `types.ts`; add label/format/size
   entries in `constants.ts` + `platformSizes.ts` + `platformCompliance.ts`;
   add `PLATFORM_BRAND` tints in `PlatformIcon.tsx`.
2. **Previews**: port `YouTubePreview.tsx` + `LinkedInPreview.tsx`, then wire
   both into `PlatformPreview.tsx`'s platform/format switch.
3. **Catalogs**: port `youtube.ts` and `linkedin.ts`. Keep `CORE_HASHTAGS` and
   `IMAGE_STYLE` imports from `constants.ts`.
4. **Wire into `index.ts`**: import both, spread into `allContent` in
   `PLATFORM_ORDER` position (youtube then linkedin), and confirm
   `countByPlatform` + `PLATFORM_ORDER` include both.
5. **Kit generator**: port `openai-youtube.ts` and the `YouTubeChapter` /
   `YouTubeThumbnail` types + review slot in `review.ts`; add the `youtube-kit`
   action to `/api/mothermode/ai/route.ts`; port `YouTubeStudioPanel.tsx`.
6. **Verify**:
   - `npx tsc --noEmit` exits 0.
   - `npx vitest run tests/lib/content-export.test.ts tests/lib/platform-compliance.test.ts` green (export + compliance both walk `allContent`, so they cover the new catalogs).
   - Scan `youtube.ts` + `linkedin.ts` for em/en dashes, exclamation points, and NO-list words in copy fields (should be zero).

---

## 7. Gotchas

- The single NO-list phrase risk is in `script[].visual` shot directions (e.g.
  "lean in"). Those fields are not compliance-scanned, but keep them clean to
  avoid confusion (use "move closer").
- `PLATFORM_FORMATS[platform]` must list every format a catalog uses, or the
  Generate drawer's format picker will not offer it.
- For LinkedIn text-only posts, do not set `media`; the Feed surface keys off
  its presence.
- Chapters below the 120s threshold return `[]` by design; do not treat that as
  an error.

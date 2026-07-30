# Text Overlay + Twitter Screen Grab — System & Port Guide

Status: **BUILT** (spec `TEXT_OVERLAY_AND_TWEET_FORMATS_TASK.md`).

Two **native text-render formats** added to the content hub. Like the FB
color-block before them, the visual renders natively in the browser (style
helpers + canvas PNG) with **no image model call**, and every surface of the
hub — catalog, cards, sheet, previews, compliance, AI batch, export — treats
them as first-class formats.

- `textpost` — the viral big-text-on-screen post (reels, TikTok slides,
  stories, feed squares).
- `tweet` — the Twitter screen-grab card (tweet chrome posted to IG/FB/TikTok).

## 1. File map

```
src/lib/mothermode/content/types.ts            ContentFormat + TextPostStyle / TweetCardStyle
src/lib/mothermode/content/constants.ts        FORMAT_LABEL, PLATFORM_FORMATS,
                                               TEXT_POST_MAX_CHARS (220), TWEET_MAX_CHARS (280),
                                               DEFAULT_TWEET_NAME / DEFAULT_TWEET_HANDLE
src/lib/mothermode/content/textPost.ts         Style resolution, auto-scale, aspect, canvas render
src/lib/mothermode/content/tweetCard.ts        Chrome resolution, themes, canvas card render
src/lib/mothermode/content/platformSizes.ts    defaultPresetIdsForFormat cases
src/lib/mothermode/content/platformCompliance.ts  formatIssues for both formats
src/lib/mothermode/content/index.ts            Barrel + pieceToText blocks
src/utils/integrations/openai-content.ts       formatFieldGuide entries + normalizePiece validators
src/components/mothermode/content/TextPostPanel.tsx   Style composer + render-to-gallery
src/components/mothermode/content/TweetPanel.tsx      Chrome composer + render-to-gallery
src/components/mothermode/content/ContentSheet.tsx    Panel mounts (edit tab)
src/components/mothermode/content/ContentCard.tsx     Card visuals + format icons
src/components/mothermode/content/previews/FacebookPreview.tsx  TextPost + TweetGrab surfaces
src/components/mothermode/content/previews/TikTokPreview.tsx    TextPost + TweetGrab surfaces
src/lib/mothermode/content/facebook.ts, tiktok.ts     Example catalog pieces
tests/lib/textpost-tweet.test.ts               15 pins
```

## 2. The native-render pattern (reuse for any text-render format)

1. **Types**: add the format to `ContentFormat` and a `*Style` interface to
   `ContentPiece` (optional field; absent = defaults).
2. **Constants**: `FORMAT_LABEL`, `PLATFORM_FORMATS` (which platforms offer
   it), char caps, identity defaults.
3. **Lib module**: pure helpers (`*StyleFor(piece)`, background/text-color
   resolution, length-based `*FontScale`, `fits*`), plus a browser-only
   `render*ToDataUrl` that throws outside the browser (tests assert the throw).
   All canvas, no server imports.
4. **Editor panel**: live DOM preview + style controls + "render PNG to
   gallery" via `setReviewImages` (data URL upgraded to hosted by `aiHostImage`
   when available), mounted in `ContentSheet` next to `ColorBlockPanel`.
5. **Cards + previews**: a `*Visual` in `ContentCard` (shown in place of the
   media frame when no gallery image exists) and platform-chrome surfaces in
   `FacebookPreview` / `TikTokPreview`.
6. **AI + compliance + export**: `formatFieldGuide` entry (how the model
   writes the format), `normalizePiece` validator (accept the style block,
   validate hex/aspect/theme, drop malformed), `formatIssues` rules,
   `pieceToText` block, `defaultPresetIdsForFormat` case.

## 3. textpost specifics

- Style: `{ bg, gradient?, fontScale?, aspect: '9:16' | '1:1', showHandle?,
  align? }`. Defaults: charcoal (`#1C1917`), aspect by platform (tiktok →
  vertical, others → square), watermark on, centered.
- Auto-scale steps down as the line approaches `TEXT_POST_MAX_CHARS` (220);
  explicit `fontScale` (0.8–1.4) multiplies the step, clamped 0.55–1.4.
- Render: gradient background, word-wrapped bold text at the aspect's pixel
  size, optional `@handle` watermark bottom-center.

## 4. tweet specifics

- Style: `{ name?, handle?, verified?, theme: 'light' | 'dark', showMetrics?,
  showTimestamp? }`. Every field optional; brand identity is the default.
- Themes (`tweetThemeColors`) share avatar + badge colors across light/dark so
  the card stays on-brand either way.
- Render: backdrop, rounded card, avatar circle with the initial letter, name
  + drawn verified check, handle, word-wrapped text, timestamp, engagement
  row, 1080×1080.

## 5. Port order (sibling codebase)

1. `types.ts` + `constants.ts` additions.
2. `textPost.ts` + `tweetCard.ts` (both pure except the browser canvas call).
3. `index.ts` barrel + `pieceToText` blocks.
4. Panels → ContentSheet mount → ContentCard visuals/icons → previews.
5. `openai-content.ts` field guide + normalizer; `platformCompliance.ts`
   issues; `platformSizes.ts` cases.
6. `tests/lib/textpost-tweet.test.ts`, then `npx tsc --noEmit`.

### Verification

- `npx tsc --noEmit` exits 0.
- `npx vitest run tests/lib/textpost-tweet.test.ts` — 15 green.
- Smoke: open a textpost piece in the sheet, flip the swatch/aspect, render to
  gallery; open a tweet piece, flip dark theme, render. Batch-generate either
  format and confirm `textPost` / `tweetCard` style blocks validate through.

## Follow-ups

- Instagram preview surface for both formats.
- "Notes app" textpost layout variant; numbered tweet-thread card stack.

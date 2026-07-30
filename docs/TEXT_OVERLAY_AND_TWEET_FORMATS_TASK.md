# Text Overlay + Twitter Screen Grab Formats — Task

Status: **SHIPPED** (2026-07-28). System & port guide:
`TEXT_OVERLAY_AND_TWEET_FORMATS_PORT.md`.

Two asks, both shipped as two new native text-render formats in the content
hub (modeled on the colorblock precedent):

1. **Native viral text overlay posts** for reels, TikTok slides, stories, and
   feed posts.
2. **The Twitter screen grab post**.

No migrations, no changes to existing formats.

---

## 1. `textpost` — the viral text overlay

Big auto-scaling bold text on a brand background (solid or gradient, reusing
the colorblock swatch set), rendered natively — no image model. One format
with a surface toggle:

- **Vertical 9:16** (reel / TikTok slide / story, 1080×1920) or **square 1:1**
  (feed post, 1080×1080).
- Optional `@mothermode` watermark, center/left alignment, 80–140% text-size
  slider on top of the length-based auto-scale (full size short, steps down
  toward the 220-char ceiling, `TEXT_POST_MAX_CHARS`).
- Default look: charcoal field, bone type (the dark viral look); TikTok
  defaults vertical, other platforms square.

Available on `tiktok`, `instagram`, and `facebook` (`PLATFORM_FORMATS`).

## 2. `tweet` — the Twitter screen grab

The screenshot-of-a-tweet card for posting to IG / FB / TikTok. Full tweet
chrome rendered natively: avatar circle with initial letter, display name,
verified badge, `@handle`, the tweet text (≤280, `TWEET_MAX_CHARS`),
timestamp, and engagement row — on a clean light or dark themed card with
screen-grab padding. Every field is editable per piece; defaults are the
MotherMode identity (`DEFAULT_TWEET_NAME` / `DEFAULT_TWEET_HANDLE`).

Available on `instagram`, `facebook`, and `tiktok`.

## 3. Integration points (colorblock map, both formats)

| Area | What shipped |
| --- | --- |
| Types | `'textpost'` / `'tweet'` in `ContentFormat`; `TextPostStyle` / `TweetCardStyle` on `ContentPiece` |
| Constants | `FORMAT_LABEL`, `PLATFORM_FORMATS`, char caps, tweet identity defaults |
| Lib modules | `content/textPost.ts` (style resolution, auto-scale, aspect, canvas PNG render) and `content/tweetCard.ts` (chrome resolution, themes, canvas card render) |
| Sizes | `defaultPresetIdsForFormat` cases (textpost → story + square, tweet → square) |
| Compliance | `formatIssues` for both (over-ceiling hooks, ignored media) |
| AI generation | `formatFieldGuide` entries (textpost ≤220 big line + style fill; tweet ≤280 standalone, no hashtags) and `normalizePiece` validators for `textPost` / `tweetCard` |
| Editor UI | `TextPostPanel` + `TweetPanel` (live preview + style controls + render PNG to gallery, mirroring `ColorBlockPanel`), mounted in `ContentSheet`; `ContentCard` visuals + `Type` / `MessageSquare` icons |
| Previews | `TextPost` + `TweetGrab` surfaces in `FacebookPreview` (feed chrome) and `TikTokPreview` (9:16 chrome) |
| Examples | `fb-textpost-1` / `fb-tweet-1` (facebook.ts), `tt-textpost-1` / `tt-tweet-1` (tiktok.ts) |
| Prompt bank | `fb-colorblock-conversation` recipe now fits `textpost` and `tweet` |
| Barrel/export | `index.ts` re-exports both modules; `pieceToText` prints TEXT OVERLAY / TWEET SCREEN GRAB blocks |

## Verification

- `npx tsc --noEmit` — clean.
- New `tests/lib/textpost-tweet.test.ts` — **15/15 green** (registration,
  style resolution, aspect mapping, font scaling, char ceilings, chrome
  resolution, themes, render guards).
- Neighbor suites green: prompt-bank (30), image-prompt-bank (15),
  colorblock-slideshow (12), platform-compliance (5), amplify-logic (13).
  The only 2 failures anywhere are the pre-existing mothermode
  review-logic / compliance-pass assertions already failing before this
  round.

## Follow-ups

- Instagram preview surface for textpost/tweet (FB + TikTok previews ship;
  IG falls back to Feed chrome today).
- A second textpost layout ("notes app" style) and a thread variant of the
  tweet card (numbered 1/2/3 stacked cards) if the formats earn their keep.

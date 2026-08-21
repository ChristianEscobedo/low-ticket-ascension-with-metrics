# Timeline Thumbnails + Lottie Library — Port Doc

**Date:** 2026-08-21
**Scope:** Reel Studio — the timeline reads like react-video-editor's (every
block shows its content), and the Media tab's Lottie section is a real
library: upload, paste, YOUR saved lotties, and a searchable LottieFiles
database.
**Tests:** tests/lib/lottiefiles.test.ts (3) · tsc clean.

## 1. Timeline thumbnails + names (TimelineBoard.tsx)

- **Media lanes** — `mediaBlocks` now carries `url` + `name` (filename from
  the URL). The block paints the asset's own 20px thumbnail (`<img>` for
  image/sticker cues, a Sparkles chip for lottie) + the truncated filename.
  The trigger word moved to the tooltip.
- **Caption blocks** — carry `preview` (the first 5 words joined) and show
  the caption's TEXT on the block, RVE-style, with the word count at the end.
- **Overlay (b-roll) lanes** — a 20px thumb left of the name: `<img>` for
  image URLs (extension sniff), `StripFrame` (the reel-thumbnail API) for
  videos.
- The video lane already had the 4-frame SpriteStrip filmstrip + name chip.

## 2. Lottie on image fly-ins — already worked

The composition's cue wrapper applies the entrance/exit/motion transforms to
lottie cues identically to images ("the wrapper's entrance/exit/motion
transforms apply either way" — remotion-project/ReelComposition.tsx), and
SafeLottie re-times the animation into the cue window (the 2026-08-21
playbackRate fix). No render-path change was needed — what was missing was a
way to FIND lotties.

## 3. The lottie library (MediaPanel.tsx Lottie section)

- **My lotties** — the Media Library's `lottie` kind. `uploadFile` gained a
  `kind` param; lottie .json uploads now ingest as `kind: 'lottie'` (they
  used to land as images). The "My lotties…" grid lists them (plus legacy
  .json URLs) and attaches on click.
- **LottieFiles search** — `src/utils/integrations/lottiefiles.ts` runs the
  same unauthenticated GraphQL query LottieFiles' own site runs
  (`searchPublicAnimations` against `https://graphql.lottiefiles.com/2022-08`),
  normalized by `normalizeLottieFile` (drops nodes without a playable
  jsonUrl). The server route `GET /api/admin/reel-lottie?q=` proxies it
  (12s timeout, 502 on failure — the upload/paste paths still work if the
  endpoint shifts). A clicked result attaches its jsonUrl as a lottie cue at
  the playhead's word AND ingests into the library (source 'lottiefiles'), so
  it shows up in My lotties next time.

## Carry-over checklist

1. `TimelineBoard.tsx` — the three block-content swaps + the `mediaBlocks` /
   `captionBlocks` mapping fields.
2. `src/utils/integrations/lottiefiles.ts` + `src/app/api/admin/reel-lottie/route.ts`.
3. `MediaPanel.tsx` — the `kind` param on `uploadFile`, the lottie state +
   `loadLotties`/`searchLottie`/`attachSearchedLottie`, and the Lottie
   section's search + My lotties UI.
4. `tests/lib/lottiefiles.test.ts` pins the normalizer.

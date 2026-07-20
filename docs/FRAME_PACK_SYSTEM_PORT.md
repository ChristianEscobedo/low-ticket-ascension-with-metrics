# Frame pack system (carousel / story / idea)

Multi-slide packs for MotherMode content hub: ordered frames with roles, on-slide copy, image prompts, lookback continuity, and gallery binding by index.

## Model

- `src/lib/mothermode/content/framePack.ts` — `FramePack`, `FramePackFrame`, helpers (`emptyFramePack`, `withPlannedFrames`, `withFrameImages`, `continuityEditPrompt`, `buildStripPrompt`, `splitStripImage`).
- Stored on `PieceReview.framePack` (`review.ts` + `reviewClient.setReviewFramePack`).
- Formats: `carousel`, `story`, `idea` (`supportsFramePack` / `isMultiFrameFormat`).

## AI plan

- `generateFramePackPlan` in `openai-content.ts`
- API action `framePackPlan` on `/api/mothermode/ai`
- Client: `aiGenerateFramePackPlan` in `aiClient.ts`

## UI

- `FramePackPanel` on Edit tab (`SheetForms`) for multi-frame pieces:
  - Plan pack (slide count 2–10, aspect, frames vs strip mode)
  - Edit per-frame text / prompt
  - **Mode A:** Build all frames (frame 1 generate → 2..N edit from seed + lookback)
  - **Mode B (carousel):** Strip → split into N panels, host, write gallery
  - Single-frame regen
- Gallery `images[i]` ↔ pack frame `i` (1-based index on frames)
- Overlay suggest uses active gallery index + pack frame text (`imageOverlay.suggestOverlayText`)

## Tests

- `tests/lib/frame-pack.test.ts`

## Related

- Storyboard packs (cinematic contact sheets) are separate: `storyboard` on review.
- Variation Lab brief can also emit lightweight frames; dedicated pack is the production path.

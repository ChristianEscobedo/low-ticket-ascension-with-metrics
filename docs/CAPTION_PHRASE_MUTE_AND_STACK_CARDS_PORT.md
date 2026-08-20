# Caption Phrase Mute + Stack Cards — System Port

> Mute any phrase off the screen without touching the transcript, and pin a
> phrase into a stacked "card" that builds word-by-word and holds — the
> big-hero-word block look — straight from the subtitle timestamps. Three
> commits: `fb81ab9` (2026-08-13, build-hold stack + mute ranges + show/hide
> toggle), `51f9cd5` (2026-08-13, phrase mute + stack cards on subtitle rows),
> `c09b911` (2026-08-14, the stack Edit/Preview toggle).

## The pieces

| Piece | Where | What |
|---|---|---|
| Global stack + visibility | `CaptionOverrides` in `src/lib/mothermode/reel/captions.ts` | `stackMode: 'page' \| 'build'` (page = whole page visible, karaoke highlight walks; build = words appear as spoken and HOLD until the page flips), `captionsOn` master switch, `muteRanges: { fromSec, toSec }[]` in project-clock seconds |
| The visibility predicate | `isCaptionVisibleAt(sec, overrides)` in `captions.ts` | One place decides "do captions paint at this second": `captionsOn === false` hides everything; a range hit `[fromSec, toSec)` hides; bounds are min/max-normalized and malformed entries are skipped. Default is visible |
| Per-word marks | `ReelWordMark` in `src/lib/mothermode/reel/types.ts` | `hidden?: boolean` (phrase mute — timing stays, the transcript/editor shows the word dimmed) and `card?: { id, mode: 'build' \| 'page', rows?, wordsPerRow?, anim? }` — contiguous words sharing `card.id` render as ONE stacked page with optional local layout + entrance |
| The layer mirror | `CaptionWordMark` in `render/captionLayer.tsx` | The layer keeps its own structural copy of the mark (no import back into captions.ts); `hidden` + `card` are mirrored there and in the vendored `render-worker/src/lib/mothermode/reel/*` copies |
| Card grouping | `resolveCardWindow` + `cardRows` in `captionLayer.tsx` | Walking outward from the active word, contiguous same-`card.id` words form the window; `cardRows` paginates the window into `rows × wordsPerRow` pages as speech advances (rows clamp 1–4, wordsPerRow clamp 1–8) |
| The subtitle-row UI | `SubtitlePanel.tsx` | Each timestamp row gets an Eye/EyeOff (mute the whole phrase — `toggleMutePhrase` sets/clears `mark.hidden` across the row's word range) and a Layers toggle (`toggleStackCard` assigns one stable `card_<time>_<rand>` id across the phrase; re-click dissolves the card), plus the build/page mode flip (`setCardMode`). `wordMarkSummary` chips surface `muted` / `card build` on the row |
| The gallery controls | `CaptionGallery.tsx` | "Captions: Shown/Hidden" pill (writes `captionsOn`), the "Stack mode" pair (Karaoke page / Build & hold → `stackMode`), and the mute-range editor |
| The Edit/Preview toggle | `page.tsx` + `RemotionPreview.tsx` (`c09b911`) | `stackEditMode` state: Edit shows EVERY card word at full weight with drag handles (the new `freePlaceEdit` prop on the preview), Preview plays the real karaoke/build timing. The floating caption drag box hides while a card has placed words, and the toggle only renders when the current clip actually has placed (`xPct`/`yPct`) words |
| The plan passthrough | `render/plan.ts` | `RenderPlan.captionOverrides` carries the overrides object into the frame so the visibility predicate + stack mode resolve at paint time |

## The data contract (what a port must reproduce)

- **Mute is paint-only.** `hidden` never touches `start`/`end` — the word still
  advances the karaoke clock, still shows in the subtitle list (dimmed), still
  counts for card grouping. Deleting every other mark key strips the `mark`
  object entirely (an empty mark serializes back to a bare word).
- **Card membership is contiguous.** The layer groups by walking left/right
  from the active word while `card.id` matches — a non-member word breaks the
  card. Reusing an id across two separate phrases merges them into one card;
  always mint a fresh id per phrase (`newCardId`).
- **Card-local overrides beat the preset, the word's own `mark.anim` beats the
  card's `anim`.** `rows`/`wordsPerRow` on the card replace the global layout
  for the window only.
- **Ranges are half-open `[fromSec, toSec)`** on the project clock, so adjacent
  ranges don't double-hide the boundary frame.

## Guards

- `tests/lib/caption-mute-stack.test.ts` — `isCaptionVisibleAt`: master off,
  inside/at-edge of a range, default-visible with null/empty overrides.
- `tests/lib/caption-stack-cards.test.ts` — the window mirror: contiguous
  grouping, no-card null, hidden independent of global ranges, phrase mute
  covering every word in range.

## Port notes

- **Dual-write is the rule.** Every reel-lib change lands in BOTH
  `src/lib/mothermode/reel/*` and `render-worker/src/lib/mothermode/reel/*` —
  the Railway worker renders the MP4 from the same plan, so drift means the
  preview lies about the render. Rebuild the worker image to pick up the
  mirrored lib changes; no new env or system packages.
- The feature composes with free-place (per-word `xPct`/`yPct`): a card word
  can be dragged anywhere and still follows its card's build timing. The
  free-place repair cascade around it is documented in
  `CAPTION_ANIMATION_FIDELITY_REPAIR_WAVE_PORT.md`.

# Caption drag + corner resize handles — next task

> **Status 2026-08-05: Step 1 SHIPPED.** The transform box (drag to move + four
> corner-resize handles) is live on both preview branches, and two follow-up
> fixes landed after user testing: (a) the box outline now DERIVES from the
> caption block's geometry (86% frame width, line-height 1.15 × `rows`, font
> scaled by `sizePx / CAPTION_STAGE_W × frameW` via a ResizeObserver) instead of
> fixed padding, so it tracks the text when scaling; (b) the Captions-tab
> subtitle panel got a 240px floor + `flex-[2]` and the gallery cap dropped to
> 32%, so the word list can't be crowded out. `rows` is passed at both mounts
> (`captionOverrides?.rows ?? 1`). Steps 2 (per-word marks) and 3 (text layers)
> are NOT started. Full state: `docs/CAPTION_TRANSFORM_BOX_AND_SUBTITLE_PANEL_HANDOFF.md`.

Requested after the caption-style bug was closed: (1) the drag-to-move on the
preview canvas needs to feel better, (2) corner handles should scale the caption
text up and down.

## What already exists (do not rebuild it)

- **`src/app/(fullscreen)/admin/reel-studio/CaptionDragLayer.tsx`** — the current
  drag puck. Both stages already mount it (see `page.tsx` ~6732 and ~6840) and
  wire it the same way:
  - `onMove(x, y)` → `setCaptionOverridesLocal({ xPct: x, positionPct: y })`
    (live, no network — this is what makes dragging feel instant)
  - `onCommit(x, y)` → `void setCaptionOverrides({ xPct: x, positionPct: y })`
    (persists)
  That local/committed split is the right shape. Keep it for resize too.

- **`captionOverrides.sizePx` already exists, persists, and is honored by the
  render.** Reels in the DB carry values like
  `{"xPct":47,"sizePx":41,"positionPct":43}`. So corner handles do **not** need a
  new field or a migration — they set `sizePx` through the same two callbacks.
  Verify with `node scripts/inspect-reel-caption-style.cjs`.

- **The caption layer is a single shared implementation:**
  `src/lib/mothermode/reel/render/captionLayer.tsx`, with a byte-identical
  vendored copy at `render-worker/src/lib/...` (kept in sync by
  `scripts/sync-vendored-captions.cjs`, enforced by
  `tests/lib/render-vendor-parity.test.ts`). The preview stage, the Remotion
  preview and the MP4 all draw it. **If you change geometry, change it there and
  re-run the sync script** — do not add a second implementation. There were
  three at one point and it cost four sessions.

## The trap that just cost four sessions — read this before starting

`normalizeCaptionPreset` in `src/lib/mothermode/reel/types.ts` validated caption
preset ids against a hand-written list of four while the registry had 41. The
other 37 were silently rewritten to `'karaoke'`, on **save** and on the **render
path**, while the preview read live state and looked correct. The lesson for this
task, because `sizePx` travels the same road:

- Anything you add to `captionOverrides` must survive
  `normalizeProjectJson` → `projectToJson` → `buildRenderPlan`. Note that
  `normalizeProjectJson` currently passes `captionOverrides` through **whole and
  unvalidated** (`o.captionOverrides as CaptionOverrides`). If you add clamping,
  extend `tests/lib/caption-preset-round-trip.test.ts` in the same style —
  parameterised over real data, not a copied list.
- Confirm behavior against the **database** and the worker's
  `[worker] caption plan: … sizePx=…` log line, not against screenshots. Those
  two facts are what finally localized the last bug.

## Suggested approach

1. Rename/extend `CaptionDragLayer` into a transform box: the existing move
   behavior plus four corner handles.
2. Corner drag → scale `sizePx`. Anchor from the caption block's centre (the
   layer already centres an 86%-width block), so text grows symmetrically instead
   of walking off-frame. Clamp to something sane (roughly 18–90px at 1080 wide)
   and make the clamp a named constant with a comment.
3. Handles must be in **stage** coordinate space, so the puck lines up at every
   preview size. The layer scales font size by frame width for exactly this
   reason — reuse that scale, don't re-derive it.
4. "Drag feels better" is unspecified. Ask which of these is actually bothering
   you before building: pointer offset/jump on grab, no snapping to centre or
   thirds, no keyboard nudge, hit area too small, or lag. Cheap to fix, easy to
   fix the wrong one.

## Follow-up ask: per-row drag, per-word animation, overlapping mixed effects

Asked: can I drag only the *bottom row* of a 2-row caption? Can I change the
animation of one row or one word? Reference image: a big script "Hook" wordmark
overlapping a small line and a bold "Top G", each with its own look and timing.

**Short answer: the per-word part is a natural extension; the per-ROW part is a
trap; and the reference image is not a caption feature at all.** Details, because
this decides the data model and the model is the expensive thing to get wrong:

### Why per-row addressing is the wrong primitive
Rows do not exist in the data. `captionOverrides` today is **one global set of
knobs for the whole reel** (`xPct`, `positionPct`, `sizePx`, `rows`,
`wordsPerRow`, `wordSpacing`, `letterSpacing`), and the caption layer *derives*
rows at render time by slicing the active word window. So "row 2" is not a thing
you can attach state to — it's a different set of words every few frames. Key
anything on row index and it will drift the moment `wordsPerRow` changes, a word
is longer, or the size changes the wrap. That is the same class of mistake as the
preset whitelist: a second, implicit source of truth that looks fine in the
preview and rots elsewhere.

### The primitive that does work: per-word marks
`captions: Record<clipId, ReelWord[]>` is the real, stable, addressable unit —
each word already has `word`, `start`, `end`, and words are what the layer
iterates. Extend `ReelWord` with an **optional** style mark:

```ts
interface ReelWord {
  word: string; start: number; end: number;
  mark?: { anim?: string; color?: string; scale?: number; font?: string };
}
```

Optional and additive, so every existing reel keeps working; when `mark` is
absent the word inherits the preset. This gets you "mix and match animations" per
word, and per-row falls out for free in the UI — select the words currently on a
row and apply a mark to each. `normalizeReelWords` must validate `mark` the way
the presets should have been validated (unknown anim → inherit, never a silent
substitution), and `tests/lib/caption-preset-round-trip.test.ts` extends to prove
a marked word survives save → plan → render.

### The reference image is a text LAYER, not a caption
That "Hook" wordmark overlaps the caption, sits at its own angle/scale, has its
own in/out timing, and is not a transcribed word. Forcing it through the caption
system would mean inventing fake words with fake timings — and captions are
transcript-derived by design. The project already has the right precedent:
`ReelOverlayClip` (`overlays`), which is a list of independently-positioned,
independently-timed things layered on the main track. Add a sibling: a list of
text layers with `text`, `startSec`/`endSec`, position, scale, rotation, font,
anim. Independent by construction, so overlap and mixed effects are free and it
cannot destabilize captions.

### Per-letter: derive it, never store it
Asked next: "can you do per letter too?" Yes — but it is a **different kind of
thing**, and conflating the two would put us back in trouble.

A word is *data*: it comes from the transcript with its own `start`/`end`. A
letter has no data of its own — no timing, no identity, nothing to key on. If we
stored per-letter marks we would be inventing an entity the transcript never
produced, and any re-transcribe, edit or retime would orphan every one of those
marks silently. That is the same failure shape as keying on row index.

So per-letter is a **render behavior parameterized by the word's mark**, not a
new addressable unit. The word says "animate me letter by letter"; the layer
splits and staggers within the word's own `start`/`end`:

```ts
mark?: { anim?: string; stagger?: number; /* … */ }   // stagger = seconds per letter
```

`CAPTION_STYLE_DEFS` already ships letter-level looks (`typewriter`,
`type-swift`), so the layer is the right place for this and some of the machinery
exists. Letters stay derived, always in sync with the word, and impossible to
orphan. The reference video's "rolls out words and even letters" is this: a
per-word mark whose anim happens to be letter-staggered.

**Rule of thumb for the whole feature set:** if the transcript produced it, it can
hold state (words). If we computed it, it must stay computed (rows, letters).

### Recommended order (each shippable alone)
1. **Transform box** (move + corner resize) driving the existing global
   `captionOverrides`. Small, and it makes the tighten/overlap tuning possible.
2. **Per-word marks** — the data change above, then a click-a-word-to-restyle UI.
3. **Text layers** — the wordmark/overlap feature from the image.

Do **not** start with 3 dressed up as 1. And confirm the ask before building 2:
"change the animation of a row" might mean *this reel's caption animation*, which
is one existing knob, not a new model.

## Verify

- `npx tsc --noEmit`
- `npx vitest run tests/lib/caption-preset-round-trip.test.ts tests/lib/caption-layer-geometry-parity.test.ts tests/lib/render-vendor-parity.test.ts tests/lib/stage-caption-single-source.test.ts`
- `node scripts/sync-vendored-captions.cjs` if the shared layer changed
- Drag + resize, then `node scripts/inspect-reel-caption-style.cjs` to confirm
  `sizePx`/`xPct`/`positionPct` persisted, then render and compare to the canvas.

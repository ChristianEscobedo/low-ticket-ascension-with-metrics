# Handoff — "the render and the preview show different captions" (third caption implementation)

Written mid-session because the context window ran out. Everything below is the
state of the working tree as of this doc.

## The complaint

The exported MP4's captions did not match the captions on screen — different
size, different line breaks, different feel. Two previous rounds "fixed" this by
unifying the Remotion caption layers, and the user still saw a mismatch.

## The actual root cause

There were **THREE** caption implementations, not two. The one being looked at
depended on the stage's **Remotion / Edit** toggle
(`src/app/(fullscreen)/admin/reel-studio/page.tsx`, the button near the target
picker, state `previewMode`):

| surface | drew captions with |
| --- | --- |
| Remotion-mode stage | `remotion-project/CaptionLayer.tsx` → shared layer |
| MP4 (worker) | `render-worker/remotion-project/CaptionLayer.tsx` → shared layer |
| **Edit-mode stage** | **`KaraokeLine`, local to page.tsx — a third copy** |

`KaraokeLine` shared only `captionCssFor()` with the render. It differed in every
way that changes what you see:

- `fontSize: layout.sizePx` **raw** — no `sizePx / CAPTION_STAGE_W * frameWidth`
  scale, so type size had no relation to the export;
- it lived in a `w-max` chip, not an 86%-wide centred block → **different wrap
  width → different line breaks**;
- active word picked from clip-local seconds, held forever (the render works in
  frames, with hold-then-clear);
- inactive rows dimmed `opacity-70`, which the render never does.

So the previous two rounds were correct but aimed at the wrong surface.

## What is already changed in the tree (uncommitted)

All in `src/app/(fullscreen)/admin/reel-studio/page.tsx`:

1. **Imports added** (top of file, after `captionFontsFor`):
   ```ts
   import { CaptionLayerFrame, type CaptionPlanLike } from '@/lib/mothermode/reel/render/captionLayer';
   import { DEFAULT_FPS } from '@/lib/mothermode/reel/render/plan';
   ```
2. **`KaraokeLine` re-documented** as *platform-mock swatches only* (it is still
   used by `PlatformMockView`'s `MockVideo`, a decorative scaled-down chip inside
   the fake phone frames — that use is fine). The doc comment spells out the four
   divergences above so nobody puts it back on a video frame.
3. **New `StageCaptions` component** added just after `KaraokeLine`. It wraps
   `CaptionLayerFrame` — i.e. the render component — and converts the stage's
   clip-local seconds to frames:
   - `plan.width = stageBox.w` (the stage's CSS px width) so the caption occupies
     the same *fraction* of the frame it will at 1080 → wrap points match;
   - `plan.words = words.map(w => ({ text: w.word, fromFrame: round(w.start*fps), toFrame: round(w.end*fps) }))`;
   - `frame = round(timeSec * fps)`, `fps = DEFAULT_FPS`.
4. **The Edit-mode stage overlay was replaced.** The old hand-rolled draggable
   `w-max` div + `<KaraokeLine>` is gone. It now renders:
   - `<div className="pointer-events-none absolute inset-0 z-20"><StageCaptions …/></div>`
   - plus `<CaptionDragLayer …/>` — the SAME drag puck the Remotion branch uses,
     so placement behaves identically on both previews.

## Verification status (updated — follow-up session)

- [x] **Typecheck.** `npx tsc --noEmit` → **0 errors**, whole program. Both
      uncertainties in the original list resolved as written, no edits needed:
      - `CaptionPlanLike` really is `{ fps, width, words, captionStyle,
        captionLayout, powerWords }` with words as `{ text, fromFrame, toFrame }` —
        `StageCaptions` already maps `w.word → text` and seconds → frames
        correctly;
      - `DEFAULT_FPS` **is** exported from `src/lib/mothermode/reel/render/plan.ts`
        (`export const DEFAULT_FPS = 30`), so the import stands and nothing was
        inlined.
- [x] **A guard test.** New file `tests/lib/stage-caption-single-source.test.ts`
      (kept separate from the geometry-parity test, which is about the two Remotion
      wrappers — this one is about the app stage). Five assertions, comment-stripped
      source so the prose documenting the bug stays legal:
      - the shared layer is imported and `StageCaptions` renders
        `<CaptionLayerFrame`;
      - `<StageCaptions` appears on the stage;
      - **`<KaraokeLine` occurs exactly once** — the platform-mock swatch. This is
        the tripwire against copy #4;
      - `layout.sizePx` occurs exactly once (inside `KaraokeLine`) and
        `CAPTION_STAGE_W` never appears in page.tsx, i.e. the stage cannot grow its
        own font-size or stage-width math again.
- [x] **Caption/render suites green.** `npx vitest run` over
      `caption-layer-geometry-parity`, `caption-presets`, `caption-vendor-parity`,
      `render-plan`, `render-vendor-parity`, `stage-caption-single-source`:
      **6 files, 48 tests, all passing.**
      (Note for the next session: vitest here is v4 — `--reporter=basic` was
      removed and errors out; use the default reporter.)
- [ ] **Visual confirm** with the user on BOTH toggle positions (Remotion and
      Edit) against a fresh render — still outstanding, and still the only real
      proof. Everything above only proves there is one implementation, not that
      the one implementation looks right.
- [ ] Consider deleting `KaraokeLine` entirely by giving the platform mocks a
      `StageCaptions` at a fixed nominal width; left alone this session to keep
      the diff tight.

## ⛔ Why the MP4 STILL doesn't match — and why no code change can fix it

Reported after the work above: *"the render is completely different from the
preview still, I tried with a brand new project, it is not picking up the colors
or styles."* Investigated. **The code is not the problem any more. The deploy is.**

Measured, not inferred:

| check | result |
| --- | --- |
| `git status` | **every** caption file is uncommitted; `src/lib/.../render/captionLayer.tsx` and the vendored copy are **untracked (`??`)** |
| worker `/health` | `{"commit":"6663179","branch":"main"}` — equals local `HEAD` |
| `git show HEAD:render-worker/remotion-project/CaptionLayer.tsx` | references `CaptionLayerFrame`: **false**; has its own `layout.sizePx` math: **true** |
| `git cat-file -e HEAD:…/render/captionLayer.tsx` | **ABSENT** — both app and vendored copies |

So the Railway worker is faithfully building the newest *commit*, and that commit
predates the entire unification. The shared layer **has never existed on the
machine that produces the MP4.** Meanwhile the preview you are comparing against
is your local dev server, running the uncommitted working tree.

Preview ≠ render is therefore *structurally guaranteed* right now, and it would
stay that way no matter how many more times the layer is "fixed". A brand-new
project cannot escape it either — the mismatch is in the code the renderer runs,
not in the project data.

Also ruled out along the way, so nobody re-checks them:

- **Style does reach the render.** `useRenderJob` posts the live project
  (`getProject: () => project ?? null`), the route merges it over the saved row,
  and `buildRenderPlan` resolves `captionStyle`/`captionLayout` from
  `project.captionStyle` + `captionOverrides` — the *same* two calls the stage
  makes. The fully-resolved `CaptionStyleDef` travels in the plan JSON, so the
  worker never re-derives colors.
- **Vendored copies are byte-identical** to their sources
  (`captions.ts`, `render/captionLayer.tsx`) — verified by direct comparison, not
  just by the parity test.

**The only next step that can change what you see: commit and push to `main`.**
Railway auto-redeploys on push (see `RAILWAY_WORKER_DEPLOY_STATE.md`); poll
`/health` until `commit` matches the new SHA, *then* render. Vercel must also
redeploy for the app-side plan builder. Comparing a local preview against a
production render is not a valid comparison in the first place — after the push,
compare the deployed preview to the deployed render.

## Files touched


- `src/app/(fullscreen)/admin/reel-studio/page.tsx` (only file edited in this
  session's final phase)

Earlier in the session the shared layer + vendored worker copy + sync script were
already unified; see `docs/CAPTION_RENDERING_REMOTION_PORT.md` and
`scripts/sync-vendored-captions.cjs`. Those are believed correct — the bug that
survived them was the Edit-stage third copy documented here.

## The rule going forward

There is exactly ONE caption geometry: `CaptionLayerFrame` in
`src/lib/mothermode/reel/render/captionLayer.tsx`. Every surface that draws
captions on a video frame renders it. Anything that re-implements `fontSize`,
block width, row slicing, or active-word selection is a bug, no matter how good
it looks on its own.

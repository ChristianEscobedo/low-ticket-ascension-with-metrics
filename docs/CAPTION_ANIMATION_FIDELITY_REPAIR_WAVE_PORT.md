# Caption Animation-Fidelity Repair Wave — System Port

> The 2026-08-13 editor-FX / gradient / ghost landing (`8fa2cc9`, `b45c54b` —
> feature side documented in `CAPTION_EDITOR_FX_AND_DRAFT_RENDER_PORT.md`)
> shipped the surface, and the following ~36 hours were the repair cascade
> that made it render-true: the Vercel/Railway build broke on type drift, then
> the free-place stack landing (`be9c20e`, 2026-08-14) produced a dozen
> paint/timing/interaction bugs fixed one commit at a time. The surgical edits
> were driven by a fleet of ~108 one-off node scripts, all swept into
> `0ceaf60` (2026-08-14, "keep the player alive when an upload finishes") —
> 111 files, +19,318/-6, of which the only runtime source change is 24 lines
> in the studio `page.tsx`. The scripts ARE the audit trail: each header names
> the symptom, the root cause, and the exact splice, and they intentionally
> persist at `scripts/` (86 `fix-*.cjs` + 31 `inspect-*.cjs` at HEAD).

## Phase 1 — the build-breakage chain (2026-08-13)

The FX wave renamed/extended the override types faster than the two build
targets (Vercel app tsc, Railway worker tsc) could follow:

| Commit | Repair |
|---|---|
| `02cd7ff` | Repair mangled imports + `CaptionOverrides` so the Vercel build compiles |
| `6a640ec` | `CaptionStyleOverrides` → `CaptionOverrides` rename across the boundary |
| `6204229` | Complete the `CaptionOverrides` fields the resolver/UI actually use |
| `5b8172d` | Clean `renderGradientWord` + waveBounce types for both tsc targets |
| `86e40b2` | Add `waveBounce` to the `CaptionBlockFx` union (the layer painted it, the type denied it) |
| `57fe699` | Test allows an empty entrance anim without keyframes |

## Phase 2 — render fidelity under the new FX (2026-08-13)

- `59f669d` — the active word no longer shifts right on highlight. Root cause
  (recorded in `scripts/fix-highlight-shift.cjs`): `wordCss` applied horizontal
  padding/box chrome only when `active`, so the highlight pushed the glyphs.
- `460841a` — the active word keeps its drop shadow / outer glow when a
  highlight, gradient, or entrance rewrite touches `textShadow`/`filter`; a
  real `none` entrance in `CAPTION_ANIMS` (layer skips the entrance math); a
  reset-all-overrides control in the gallery + page wiring. (Analysis in
  `scripts/fix-shadow-entrance-reset.cjs`.)

## Phase 3 — the free-place cascade (2026-08-14)

Free-place stack words with canvas drag (`be9c20e`, feature) landed ahead of
its interactions; each follow-up is one named symptom:

| Commit | Repair |
|---|---|
| `020f9b9` | Wire the free-place drag imports and stamp `mark.xPct` |
| `371e4db` / `953d720` | `cardWin` scope fix, `Array.from` on the fx-word set, the SubtitlePanel prop, `resolveCardWindow` accepts readonly words |
| `ea03d4a` | Free-place words render with the FULL theme + FX (not a stripped fallback); clearing mark fields actually clears; wider style menu |
| `3b37f73` | No scatter: a mixed card keeps the normal layout for words that were never dragged |
| `27e9a47` | Moved words keep their full theme styles (drag no longer drops the preset look) |
| `aedf704` | Stop the free-place double-paint (word drawn in the flow AND at its pin) and the jacked gradient shadows it caused |
| `951eb52` | Free-place preview timing, the right fonts on placed words, the edit lock, snap/nudge |
| `e9dbbac` | Stack-edit crash fix, restore plain Play, start clean from an empty canvas |
| `9e37296` | Place/Style modes no longer jump words; drag handles hug the painted glyphs (not the layout box) |
| `620f47f` | Edit mode shows every section word at full weight and never hides one on select |
| `a831965` | Edit no longer duplicates unplaced words at the bottom of the frame |
| `0ceaf60` | The named fix: the Player stays alive when an upload finishes (the upload completion no longer unmounts/remounts it) — plus the script fleet sweep |

## What the scripts changed in the libs

The `fix-*`/`patch-*` fleet edited three surfaces, always mirrored into the
vendored `render-worker/src/lib/mothermode/reel/*` copies:

- **`render/captionLayer.tsx`** — the ghost-stagger page envelope +
  `ghostUnitOpacity` (`patch-ghost-stagger.cjs`), active-word chrome
  preservation, gradient resolve, the free-place paint path, and the card
  window helpers from the stack-card feature.
- **`captions.ts`** — the `none` entrance + keyframe repair
  (`fix-anim-keyframes.cjs`), the `CaptionOverrides` field completion
  (`fix-gradient-resolve.cjs` family), and the visibility predicate inputs.
- **The gallery** — `fix-gallery-setoverrides.cjs` (the gallery's override
  writes) + `fix-gallery-sync-ui.cjs` (the sync-UI refresh); these two are the
  gallery-setOverrides/sync fixes the caption-docs previously left unnamed.

Also swept in: `tmp-inspect.txt` / `tmp-tsc.txt` debug captures and 22
`inspect-*` scripts — kept because they document how each root cause was
isolated (dual-gradient dump, keyframe tail, layer render trace).

## Folded-in commits the docs previously skipped

- **`c11bd4a` (2026-08-14) — Play/Place/Style modes, J/K/L, word rail, ruler
  ticks** (`page.tsx` +143): the stack editor becomes a mode state machine —
  Play is pure playback, Place owns drag, Style owns FX — with mode keys gating
  the edit surfaces so playback shortcuts never fight drag state
  (Delete/Backspace scoped to `!stackEditMode`), `data-word-tick` marks on the
  timeline ruler, and the word rail for per-word pick.
- **`f543f1f` (2026-08-17) — cue drag box tracks the playing frame + no attach
  blink:** covered in full at the top of `REEL_STUDIO_SYSTEM_PORT.md`
  (the `frameupdate` write-back into the studio clock + the pre-attach cache
  warm). Named here so the trail is complete.

## Port notes

- Port the LIBS, not the scripts. The scripts are the parent repo's working
  history; the target repo needs the repaired `captionLayer.tsx` /
  `captions.ts` / gallery / `page.tsx` state and the tests that pin it
  (`caption-mute-stack`, `caption-stack-cards`, the anim/gradient coverage in
  the reel test lane).
- The dual-write rule is load-bearing here: every one of these fixes exists
  twice (`src/` + `render-worker/src/`). When in doubt, diff the two copies —
  the wave's whole point is that preview and MP4 render agree pixel-for-pixel.
- Rebuild the Railway worker image to pick up mirrored lib changes; the wave
  added no env vars and no system packages.
